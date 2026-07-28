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
} from "./resend-cliente";
import type { Campanha } from "./types";

/**
 * Motor de envio. Pipeline em sete passos, na ordem do contrato:
 *
 *  1. resolver público AGORA (E3) contra a view de elegibilidade;
 *  2. MODO SEGURO: ponto único de interceptação (nada real recebe);
 *  3. espelhar cada destinatário como Contact no Resend + vínculo (R2/R3);
 *  4. materializar o Segment e RECONCILIAR a membresia (R1/R4);
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
 * contato REAL do CRM: destinatário de teste chega com `contactId: null`.
 *
 * Em MODO SEGURO o público efetivo é a lista de teste, então esta função roda
 * (a máquina é exercitada) mas não encontra contato pra marcar — que é o
 * comportamento certo: fumaça não descadastra ninguém de verdade.
 */
async function refletirOptOut(
  segmentId: string,
  publico: { contactId: string | null; email: string }[],
): Promise<number> {
  const fora = await lerOptOut(segmentId);
  if (fora.size === 0) return 0;

  const alvos = publico.filter((p) => p.contactId && fora.has(p.email.trim().toLowerCase()));
  if (alvos.length === 0) return 0;

  const { error } = await supabaseAdmin()
    .from("contacts")
    .update({
      email_marketing_status: "descadastrado",
      email_marketing_status_em: new Date().toISOString(),
      email_marketing_status_origem: "descadastro",
    })
    .in(
      "id",
      alvos.map((a) => a.contactId as string),
    );

  if (error) {
    console.error("[campanhas.refletirOptOut] erro ao marcar descadastrados:", error);
    return 0;
  }
  return alvos.length;
}

/**
 * Dispara (ou agenda) a campanha.
 *
 * `agendadoParaIso` ausente = envia agora. O estado final é `enviada` ou
 * `agendada` — e em ambos os casos os destinatários já ficam congelados, porque
 * é o público resolvido NAQUELE instante que vale (E3/E4). Grupo alterado
 * depois não altera nada de campanha já disparada (G5).
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

    // 3. Espelhar contatos no Resend.
    const espelhadas = await espelharContatos(publico);
    if (espelhadas.length === 0) {
      return { ok: false, erro: "Não foi possível preparar os destinatários no provedor." };
    }

    // 4. Materializar o segmento.
    const segmentId = intercept.ativo
      ? await segmentoModoSeguro()
      : campanha.publicoTipo === "grupo"
        ? await segmentoDoGrupo(campanha.grupoId!, await nomeDoGrupo(campanha.grupoId!))
        : await segmentoTodosElegiveis();

    const reconciliacao = await reconciliarSegmento(segmentId, espelhadas);

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
    const congelados = await congelarDestinatarios(campanhaId, espelhadas);

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
      reconciliacao,
      descadastrados_lidos_do_provedor: descadastradosAgora,
      modo_seguro: intercept.ativo,
      enviado_de_fato_para: intercept.ativo ? publico.map((p) => p.email) : undefined,
      agendado_para: agendadoParaIso ?? null,
    });

    return {
      ok: true,
      broadcastId,
      enviados: espelhadas.length,
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
