import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  atualizar,
  auditar,
  congelarDestinatarios,
  getCampanhaById,
  urlImagemCampanha,
} from "./index";
import { calcularConteudoHash } from "./hash";
import {
  conteudoDe,
  montarEmailHtml,
  montarEmailTexto,
  preflight,
  preflightPassou,
  TOKEN_DESCADASTRO,
} from "./conteudo";
import { resolverPublico } from "./publico";
import { aplicarModoSeguro, modoSeguroAtivo } from "./modo-seguro";
import { suprimir } from "./eventos";
import {
  cancelarBroadcast,
  criarBroadcast,
  enviarTeste,
  espelharContatos,
  lerOptOut,
  reconciliarSegmento,
  segmentoDoGrupo,
  segmentoModoSeguro,
  segmentoTodosElegiveis,
  type FalhaNoProvedor,
} from "./resend-cliente";
import type { Campanha } from "./types";

/**
 * Motor de envio. Pipeline em sete passos, na ordem do contrato:
 *
 *  1. resolver público AGORA (E3) contra a view de elegibilidade;
 *  2. MODO SEGURO: ponto único de interceptação (nada real recebe);
 *  3. materializar o Segment (R1). ANTES do espelhamento desde o CAMP-fix-2
 *     (16/09/2026): contato novo é criado já dentro dele, sem add separado;
 *  4. espelhar cada destinatário como Contact no Resend + vínculo (R2/R3), e
 *     RECONCILIAR a membresia (R4), que continua sendo a fonte de verdade;
 *  5. ler opt-out do Resend e refletir em `email_marketing_status` (R5);
 *  6. criar o broadcast (enviar agora ou agendar);
 *  7. congelar destinatários, transicionar estado e auditar (E4/E6).
 *
 * Tudo que pode recusar recusa AQUI, no servidor. A tela é conveniência.
 */

export type ResultadoEnvio =
  | { ok: true; broadcastId: string; enviados: number; totalReal: number; modoSeguro: boolean }
  | { ok: false; erro: string };

/** Fuso do agendamento — ver `agendamentoParaIso`. */
export const FUSO_AGENDAMENTO = "America/Sao_Paulo";

/**
 * Converte o `date` + `time` do formulário (sem fuso) pro ISO que o Resend
 * espera. O horário digitado é SEMPRE lido como America/Sao_Paulo (UTC−03:00),
 * que é onde as duas usuárias estão; o Brasil não tem horário de verão desde
 * 2019, então o deslocamento é fixo e não precisa de tabela de fuso.
 *
 * Consequência aceita: se o horário de verão voltar, esta linha muda.
 */
export function agendamentoParaIso(data: string, hora: string): string {
  const iso = new Date(`${data}T${hora}:00-03:00`);
  if (Number.isNaN(iso.getTime())) throw new Error("Data ou hora de agendamento inválida.");
  return iso.toISOString();
}

// ─────────────────────────────────────────────────────────────────
// Guardas de servidor
// ─────────────────────────────────────────────────────────────────

/**
 * Tudo que precisa estar verdadeiro pra um envio acontecer. Roda no servidor,
 * a partir da campanha LIDA DO BANCO — payload adulterado pela rede não passa,
 * porque nada aqui vem do cliente.
 */
export async function checarEnvio(
  campanha: Campanha,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  // E5 — idempotência: enviada não envia de novo.
  if (campanha.estado === "enviada") {
    return { ok: false, erro: "Esta campanha já foi enviada." };
  }
  // E8 — teste é pré-requisito.
  if (campanha.estado === "rascunho") {
    return { ok: false, erro: "Faça o envio de teste antes de disparar." };
  }

  const hashAtual = calcularConteudoHash(conteudoDe(campanha));

  // C4 — o conteúdo mudou depois do teste.
  if (!campanha.testadoHash || campanha.testadoHash !== hashAtual) {
    return {
      ok: false,
      erro: "O conteúdo mudou depois do teste. Faça um novo envio de teste.",
    };
  }

  // E7 — preflight sobre o e-mail montado de verdade.
  const html = montarEmailHtml(conteudoDe(campanha), {
    imagemUrl: urlImagemCampanha(campanha.imagemPath),
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });
  const itens = preflight(conteudoDe(campanha), html);
  if (!preflightPassou(itens)) {
    const falhou = itens.filter((i) => !i.ok).map((i) => i.label);
    return { ok: false, erro: `Falta resolver: ${falhou.join("; ")}.` };
  }

  if (campanha.publicoTipo === "grupo" && !campanha.grupoId) {
    return { ok: false, erro: "Escolha o grupo que vai receber." };
  }

  return { ok: true };
}

/**
 * Teto de falha no provedor. Passou de 10 contatos OU de 5% do público (o que
 * vier primeiro), o envio aborta ANTES do broadcast. "Passar" é estritamente
 * maior: 205 de público aguenta 10 falhas e aborta na 11ª.
 *
 * Em MODO SEGURO o público é a lista de teste (2 a 4 endereços), então uma
 * falha só já passa dos 5% e aborta. É o comportamento certo pra fumaça.
 */
export const TETO_FALHA_ABSOLUTO = 10;
export const TETO_FALHA_PERCENTUAL = 0.05;

export function excedeTetoDeFalha(publico: number, falhas: number): boolean {
  return falhas > TETO_FALHA_ABSOLUTO || falhas > publico * TETO_FALHA_PERCENTUAL;
}

// ─────────────────────────────────────────────────────────────────
// Teste
// ─────────────────────────────────────────────────────────────────

/**
 * Envia o teste e grava `testado_em` / `testado_hash` / `testado_para`.
 *
 * O token `{{{RESEND_UNSUBSCRIBE_URL}}}` só é substituído pelo Resend em
 * BROADCAST. No teste (e-mail simples) ele viraria um href literal, então aqui
 * ele é trocado por `#` — o link fica inerte no teste e íntegro no envio real.
 */
export async function enviarTesteDaCampanha(
  campanhaId: string,
  destinos: string[],
  operador: string,
): Promise<{ ok: true; hash: string } | { ok: false; erro: string }> {
  const campanha = await getCampanhaById(campanhaId);
  if (!campanha) return { ok: false, erro: "Campanha não encontrada." };
  if (campanha.estado === "enviada") {
    return { ok: false, erro: "Esta campanha já foi enviada." };
  }
  if (destinos.length === 0) return { ok: false, erro: "Escolha pra quem enviar o teste." };
  if (!campanha.assunto?.trim()) return { ok: false, erro: "Escreva o assunto antes de testar." };

  const conteudo = conteudoDe(campanha);
  const html = montarEmailHtml(conteudo, {
    imagemUrl: urlImagemCampanha(campanha.imagemPath),
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });
  const texto = montarEmailTexto(conteudo, {
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });

  try {
    await enviarTeste({
      para: destinos,
      assunto: campanha.assunto,
      html: html.split(TOKEN_DESCADASTRO).join("#"),
      texto: texto.split(TOKEN_DESCADASTRO).join("(link ativo só no envio real)"),
    });
  } catch (err) {
    console.error("[campanhas.enviarTesteDaCampanha] falhou:", err);
    return { ok: false, erro: "Não foi possível enviar o teste. Tente de novo." };
  }

  const hash = calcularConteudoHash(conteudo);
  await atualizar(campanhaId, {
    estado: "testada",
    testadoEm: new Date().toISOString(),
    testadoHash: hash,
    testadoPara: destinos.join(", "),
  });
  await auditar(campanhaId, "teste", { operador, destinos, hash });

  return { ok: true, hash };
}

// ─────────────────────────────────────────────────────────────────
// Pipeline de envio
// ─────────────────────────────────────────────────────────────────

/**
 * Reflete o opt-out lido do Resend (R5) em `email_marketing_status`. Só toca
 * contato REAL do CRM: destinatário de teste chega com `contactId: null` e é
 * filtrado aqui, antes de qualquer escrita (sem isso, `suprimir` casaria por
 * e-mail e um endereço de teste igual ao de um contato real o descadastraria).
 *
 * A escrita é a de `suprimir` (eventos.ts), com origem `descadastro`, a mesma
 * do webhook `contact.updated`: só contato `ativo`, nunca rebaixa `invalido`
 * nem reescreve `descadastrado`, e grava `_em` e `_origem`. Uma régua só pra
 * coluna. Devolve quantos contatos mudaram de fato.
 *
 * Em MODO SEGURO o público efetivo é a lista de teste, então esta função roda
 * (a máquina é exercitada) mas não encontra contato pra marcar — que é o
 * comportamento certo: fumaça não descadastra ninguém de verdade.
 */
export async function refletirOptOut(
  segmentId: string,
  publico: { contactId: string | null; email: string }[],
): Promise<number> {
  const fora = await lerOptOut(segmentId);
  if (fora.size === 0) return 0;

  const alvos = publico.filter((p) => p.contactId && fora.has(p.email.trim().toLowerCase()));

  let marcados = 0;
  for (const a of alvos) {
    marcados += await suprimir(
      { contactId: a.contactId, email: a.email },
      "descadastrado",
      "descadastro",
    );
  }
  return marcados;
}

/**
 * Aborta o envio por falha no provedor acima do teto. Nada foi criado no
 * Resend além de contatos e membresia (inofensivos, a próxima tentativa
 * reconcilia) e o estado da campanha NÃO é tocado: continua o de antes.
 */
async function recusarPorFalhaNoProvedor(input: {
  campanha: Campanha;
  operador: string;
  etapa: "espelhamento" | "segmento";
  publico: number;
  falhas: FalhaNoProvedor[];
  modoSeguro: boolean;
}): Promise<ResultadoEnvio> {
  const { campanha, falhas, publico } = input;
  const motivo =
    `${falhas.length} de ${publico} destinatário(s) não puderam ser preparados no provedor ` +
    `(etapa: ${input.etapa}). Teto: mais de ${TETO_FALHA_ABSOLUTO} contatos ou mais de ` +
    `${TETO_FALHA_PERCENTUAL * 100}% do público.`;

  console.error(`[campanhas.dispararCampanha] envio abortado antes do broadcast: ${motivo}`);
  await auditar(campanha.id, "envio_recusado", {
    operador: input.operador,
    motivo,
    estado: campanha.estado,
    etapa: input.etapa,
    publico,
    falhas: falhas.length,
    emails_que_falharam: falhas,
    teto: { absoluto: TETO_FALHA_ABSOLUTO, percentual: TETO_FALHA_PERCENTUAL },
    modo_seguro: input.modoSeguro,
  });

  return {
    ok: false,
    erro:
      `Nada foi enviado: ${falhas.length} de ${publico} destinatários não puderam ser ` +
      "preparados no provedor. Tente de novo em alguns minutos. O detalhe está na auditoria.",
  };
}

/**
 * Dispara (ou agenda) a campanha.
 *
 * `agendadoParaIso` ausente = envia agora. O estado final é `enviada` ou
 * `agendada` — e em ambos os casos os destinatários já ficam congelados, porque
 * é o público resolvido NAQUELE instante que vale (E3/E4). Grupo alterado
 * depois não altera nada de campanha já disparada (G5).
 *
 * ORDEM (CAMP-fix-2): o segmento é resolvido ANTES do espelhamento, invertendo
 * a ordem original. Motivo: `contacts.create` recebe o segmento no mesmo
 * payload e o contato novo já nasce membro, sem `segments.add` separado (no
 * primeiro envio real, ~306 chamadas a menos). A reconciliação continua
 * depois e continua sendo a fonte de verdade da membresia. Custo aceito: se o
 * espelhamento abortar pelo teto, o segmento já pode ter sido criado; ele é
 * reutilizado na próxima tentativa.
 *
 * TETO DE FALHA (lote CAMP-fix): checado duas vezes antes do broadcast. Ao fim
 * do espelhamento, com as falhas de create/get; e depois da reconciliação,
 * somando quem não entrou no segmento (quem não está no segmento não recebe,
 * então conta igual). Acima do teto, `envio_recusado` com a lista e o estado
 * não muda. Abaixo, segue, e `auditoria.envio` diz quantos e quais ficaram de
 * fora; esses também não entram no congelamento.
 */
export async function dispararCampanha(
  campanhaId: string,
  operador: string,
  agendadoParaIso?: string | null,
): Promise<ResultadoEnvio> {
  const campanha = await getCampanhaById(campanhaId);
  if (!campanha) return { ok: false, erro: "Campanha não encontrada." };

  const check = await checarEnvio(campanha);
  if (!check.ok) {
    // Recusa também vira prova (E6): sem a linha, um "por que não enviou?" no
    // dia seguinte não tem resposta.
    await auditar(campanhaId, "envio_recusado", {
      operador,
      motivo: check.erro,
      estado: campanha.estado,
    });
    return { ok: false, erro: check.erro };
  }

  try {
    // 1. Público agora.
    const publicoReal = await resolverPublico(campanha.publicoTipo, campanha.grupoId);
    if (publicoReal.destinatarios.length === 0 && !modoSeguroAtivo()) {
      return { ok: false, erro: "Ninguém está elegível pra receber esta campanha agora." };
    }

    // 2. MODO SEGURO — ponto único de interceptação.
    const intercept = aplicarModoSeguro(publicoReal.destinatarios, campanhaId);
    const publico = intercept.publico;

    // 3. Materializar o segmento ANTES de espelhar (CAMP-fix-2): contato novo
    // nasce dentro dele no próprio `contacts.create`.
    const segmentId = intercept.ativo
      ? await segmentoModoSeguro()
      : campanha.publicoTipo === "grupo"
        ? await segmentoDoGrupo(campanha.grupoId!, await nomeDoGrupo(campanha.grupoId!))
        : await segmentoTodosElegiveis();

    // 4. Espelhar contatos no Resend, com teto de falha.
    const espelhamento = await espelharContatos(publico, segmentId);
    if (excedeTetoDeFalha(publico.length, espelhamento.falhas.length)) {
      return recusarPorFalhaNoProvedor({
        campanha,
        operador,
        etapa: "espelhamento",
        publico: publico.length,
        falhas: espelhamento.falhas,
        modoSeguro: intercept.ativo,
      });
    }
    if (espelhamento.espelhadas.length === 0) {
      return { ok: false, erro: "Não foi possível preparar os destinatários no provedor." };
    }

    // 4b. Reconciliar (R4, fonte de verdade da membresia): contato novo já
    // entrou no create; aqui só entra quem já existia fora, e sai quem sobra.
    const reconciliacao = await reconciliarSegmento(segmentId, espelhamento.espelhadas);

    const ficaramDeFora = [...espelhamento.falhas, ...reconciliacao.falhasAoAdicionar];
    if (excedeTetoDeFalha(publico.length, ficaramDeFora.length)) {
      return recusarPorFalhaNoProvedor({
        campanha,
        operador,
        etapa: "segmento",
        publico: publico.length,
        falhas: ficaramDeFora,
        modoSeguro: intercept.ativo,
      });
    }
    const foraDoSegmento = new Set(reconciliacao.falhasAoAdicionar.map((f) => f.email));
    const noSegmento = espelhamento.espelhadas.filter((p) => !foraDoSegmento.has(p.email));

    // 5. Opt-out lido do provedor antes do envio.
    const descadastradosAgora = await refletirOptOut(segmentId, publico);

    // 6. Broadcast.
    const conteudo = conteudoDe(campanha);
    const html = montarEmailHtml(conteudo, {
      imagemUrl: urlImagemCampanha(campanha.imagemPath),
      enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
    });
    const texto = montarEmailTexto(conteudo, {
      enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
    });

    const broadcastId = await criarBroadcast({
      nome: campanha.nomeInterno,
      segmentId,
      assunto: campanha.assunto!,
      html,
      texto,
      agendadoPara: agendadoParaIso ?? null,
      // Estável por campanha + hash testado: se a mesma campanha for disparada
      // duas vezes por corrida, o Resend também recusa a segunda.
      chaveIdempotencia: `campanha:${campanhaId}:${campanha.testadoHash}`,
    });

    // 7. Congelar, transicionar e auditar.
    const congelados = await congelarDestinatarios(campanhaId, noSegmento);

    const agora = new Date().toISOString();
    await atualizar(campanhaId, {
      estado: agendadoParaIso ? "agendada" : "enviada",
      resendBroadcastId: broadcastId,
      agendadoPara: agendadoParaIso ?? null,
      enviadoEm: agendadoParaIso ? null : agora,
    });

    await auditar(campanhaId, agendadoParaIso ? "agendamento" : "envio", {
      operador,
      em: agora,
      estado_anterior: campanha.estado,
      estado_novo: agendadoParaIso ? "agendada" : "enviada",
      broadcast_id: broadcastId,
      segment_id: segmentId,
      publico_tipo: campanha.publicoTipo,
      grupo_id: campanha.grupoId,
      contagem_resolvida: publicoReal.destinatarios.length,
      total_grupo: publicoReal.totalGrupo,
      exclusoes: publicoReal.exclusoes,
      congelados,
      reconciliacao: {
        adicionados: reconciliacao.adicionados,
        removidos: reconciliacao.removidos,
        falhas_ao_remover: reconciliacao.falhasAoRemover,
      },
      ficaram_de_fora: ficaramDeFora.length,
      ficaram_de_fora_detalhe: ficaramDeFora,
      descadastrados_lidos_do_provedor: descadastradosAgora,
      modo_seguro: intercept.ativo,
      enviado_de_fato_para: intercept.ativo ? noSegmento.map((p) => p.email) : undefined,
      agendado_para: agendadoParaIso ?? null,
    });

    return {
      ok: true,
      broadcastId,
      enviados: noSegmento.length,
      totalReal: intercept.totalReal,
      modoSeguro: intercept.ativo,
    };
  } catch (err) {
    console.error("[campanhas.dispararCampanha] falhou:", err);
    await auditar(campanhaId, "envio_falhou", {
      operador,
      erro: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, erro: "Não foi possível disparar a campanha. O log tem o detalhe." };
  }
}

async function nomeDoGrupo(grupoId: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("grupos")
    .select("nome")
    .eq("id", grupoId)
    .maybeSingle();
  return (data as { nome: string } | null)?.nome ?? grupoId;
}

/**
 * Cancela o agendamento: agendada → testada, e cancela o broadcast no Resend.
 *
 * A ORDEM importa. O Resend vem PRIMEIRO: se ele recusar, a função lança e o
 * estado local não muda — a tela nunca diz "cancelado" com um disparo ainda de
 * pé lá fora.
 */
export async function cancelarAgendamento(
  campanhaId: string,
  operador: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const campanha = await getCampanhaById(campanhaId);
  if (!campanha) return { ok: false, erro: "Campanha não encontrada." };
  if (campanha.estado !== "agendada") {
    return { ok: false, erro: "Esta campanha não está agendada." };
  }

  try {
    if (campanha.resendBroadcastId) {
      await cancelarBroadcast(campanha.resendBroadcastId);
    }
  } catch (err) {
    console.error("[campanhas.cancelarAgendamento] o provedor recusou:", err);
    return {
      ok: false,
      erro: "O provedor não conseguiu cancelar o disparo. Nada foi alterado aqui.",
    };
  }

  await atualizar(campanhaId, {
    estado: "testada",
    agendadoPara: null,
    resendBroadcastId: null,
  });
  await auditar(campanhaId, "cancelamento_agendamento", {
    operador,
    em: new Date().toISOString(),
    estado_anterior: "agendada",
    estado_novo: "testada",
    broadcast_cancelado: campanha.resendBroadcastId,
  });

  return { ok: true };
}
