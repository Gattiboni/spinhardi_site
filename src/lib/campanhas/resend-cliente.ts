import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { upsertContactExternalLink } from "@/lib/contacts/external-links";

/**
 * Adaptador do Resend pro fluxo de campanha. Tudo que fala com a API do Resend
 * neste lote passa por aqui.
 *
 * SUPERFÍCIE CONFERIDA no SDK instalado (resend 6.12.4, `dist/index.d.mts`),
 * não em memória de doc:
 *  • `segments.create({name})` / `.list()` / `.get(id)` — Segment { id, name }.
 *  • `contacts.create({email, firstName, lastName, segments:[{id}]})`,
 *    `.list({segmentId})`, `.update({id|email, ...})`.
 *  • `contacts.segments.add({segmentId, contactId|email})` / `.remove(...)`.
 *  • `broadcasts.create({segmentId, from, subject, html, text, send, scheduledAt})`,
 *    `.send(id, {scheduledAt})`, `.get(id)`, `.remove(id)`.
 *  • `webhooks.verify({payload, headers, webhookSecret})` → WebhookEventPayload.
 *
 * NÃO EXISTE `broadcasts.cancel` no SDK 6.12.4 — a única saída remota pra um
 * agendamento é `DELETE /broadcasts/:id`, exposto como `broadcasts.remove(id)`.
 * É o que `cancelarBroadcast` usa, e é por isso que ele se chama assim e não
 * "apagar": pra broadcast em `scheduled`, deletar É cancelar. Se o Resend
 * recusar (ex: já saiu), a função devolve o erro e o chamador NÃO transiciona
 * de estado — nada de fingir que cancelou.
 *
 * `audienceId` está deprecado no SDK e não é usado em lugar nenhum daqui.
 */

let cliente: Resend | null = null;

export function resend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada.");
  }
  cliente ??= new Resend(process.env.RESEND_API_KEY);
  return cliente;
}

export function remetente(): string {
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) throw new Error("RESEND_FROM_EMAIL não configurada.");
  return `Spinhardi Turismo <${email}>`;
}

/** Divide "Ana Maria Souza" em first/last do jeito que o Resend espera. */
function partesDoNome(nome: string): { firstName: string; lastName: string } {
  const limpo = nome.trim().replace(/\s+/g, " ");
  const [primeiro, ...resto] = limpo.split(" ");
  return { firstName: primeiro || limpo, lastName: resto.join(" ") };
}

// ─────────────────────────────────────────────────────────────────
// Contatos (espelho)
// ─────────────────────────────────────────────────────────────────

export type PessoaEspelhada = {
  contactId: string | null;
  email: string;
  nome: string;
  resendContactId: string;
};

/**
 * Garante cada destinatário como Contact no Resend (correspondência por e-mail,
 * R2) e grava o vínculo em `contact_external_links` com `provider='resend'`
 * (R3) — reusando o upsert que já existe, nenhuma coluna nova em `contacts`.
 *
 * Idempotente: e-mail já existente no Resend devolve erro de duplicidade, e
 * nesse caso a gente lê o id em vez de tratar como falha.
 */
export async function espelharContatos(
  pessoas: { contactId: string | null; email: string; nome: string }[],
): Promise<PessoaEspelhada[]> {
  const r = resend();
  const espelhadas: PessoaEspelhada[] = [];

  for (const p of pessoas) {
    const { firstName, lastName } = partesDoNome(p.nome);
    let resendContactId: string | null = null;

    const criado = await r.contacts.create({ email: p.email, firstName, lastName });
    if (criado.data?.id) {
      resendContactId = criado.data.id;
    } else {
      // Já existe (ou outro erro): tenta ler por e-mail antes de desistir.
      const achado = await r.contacts.get({ email: p.email });
      if (achado.data?.id) resendContactId = achado.data.id;
      else {
        console.error(
          `[campanhas.resend] não foi possível espelhar ${p.email}:`,
          criado.error ?? achado.error,
        );
        continue;
      }
    }

    espelhadas.push({ ...p, resendContactId });

    // Vínculo só pra contato REAL do CRM. Destinatário de teste do MODO SEGURO
    // vem com contactId null e não vira linha em contact_external_links.
    if (p.contactId) {
      try {
        await upsertContactExternalLink({
          contactId: p.contactId,
          provider: "resend",
          externalKind: "contact",
          externalId: resendContactId,
        });
      } catch (err) {
        console.error(`[campanhas.resend] vínculo externo de ${p.email} falhou:`, err);
      }
    }
  }

  return espelhadas;
}

// ─────────────────────────────────────────────────────────────────
// Segmentos
// ─────────────────────────────────────────────────────────────────

/** Segment reservado do público "todos os elegíveis" (R2). */
const NOME_SEGMENTO_TODOS = "Spinhardi · todos os elegíveis";

async function criarSegmento(nome: string): Promise<string> {
  const { data, error } = await resend().segments.create({ name: nome });
  if (error || !data?.id) {
    throw new Error(`Erro ao criar segmento no Resend: ${error?.message ?? "sem id"}`);
  }
  return data.id;
}

/**
 * Segment do público `todos_elegiveis`. Usa `RESEND_SEGMENT_TODOS_ELEGIVEIS_ID`
 * quando existe; senão cria na primeira vez e GRITA o id no log pro Alan setar
 * a env (sem a env, a próxima execução criaria outro segmento).
 */
export async function segmentoTodosElegiveis(): Promise<string> {
  const daEnv = process.env.RESEND_SEGMENT_TODOS_ELEGIVEIS_ID?.trim();
  if (daEnv) return daEnv;

  // Antes de criar, procura um com o mesmo nome — evita duplicar a cada deploy
  // enquanto a env não estiver setada.
  const lista = await resend().segments.list();
  if (lista.error) {
    // Listagem falhou = não sabemos se já existe. Criar aqui duplicaria o
    // segmento com base num "não achei" que na verdade é "não consegui olhar".
    throw new Error(`Erro ao listar segmentos no Resend: ${lista.error.message}`);
  }
  const existente = lista.data?.data?.find((s) => s.name === NOME_SEGMENTO_TODOS);
  if (existente) {
    console.warn(
      `[campanhas.resend] ==> SETE A ENV: RESEND_SEGMENT_TODOS_ELEGIVEIS_ID=${existente.id}`,
    );
    return existente.id;
  }

  const id = await criarSegmento(NOME_SEGMENTO_TODOS);
  console.warn(
    `[campanhas.resend] ==> SEGMENTO "todos os elegíveis" CRIADO AGORA.\n` +
      `[campanhas.resend] ==> SETE A ENV: RESEND_SEGMENT_TODOS_ELEGIVEIS_ID=${id}`,
  );
  return id;
}

const NOME_SEGMENTO_MODO_SEGURO = "Spinhardi · MODO SEGURO (teste)";

/**
 * Segment exclusivo do MODO SEGURO.
 *
 * Por que não reusar o segmento real: a reconciliação REMOVE quem sobra (R4).
 * Rodar uma fumaça contra o segmento "todos os elegíveis" esvaziaria a
 * membresia real pra pôr dois endereços @resend.dev no lugar. Segmento
 * separado mantém o teste inerte de verdade.
 */
export async function segmentoModoSeguro(): Promise<string> {
  const lista = await resend().segments.list();
  if (lista.error) {
    throw new Error(`Erro ao listar segmentos no Resend: ${lista.error.message}`);
  }
  const existente = lista.data?.data?.find((s) => s.name === NOME_SEGMENTO_MODO_SEGURO);
  if (existente) return existente.id;
  return criarSegmento(NOME_SEGMENTO_MODO_SEGURO);
}

/**
 * Segment de um grupo. Cria na primeira vez e persiste o id em
 * `grupos.resend_segment_id` (materialização preguiçosa — nenhum CRUD de grupo
 * fala com o Resend).
 */
export async function segmentoDoGrupo(grupoId: string, nomeGrupo: string): Promise<string> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("grupos")
    .select("resend_segment_id")
    .eq("id", grupoId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao ler o grupo: ${error.message}`);
  const existente = (data as { resend_segment_id: string | null } | null)?.resend_segment_id;
  if (existente) return existente;

  const id = await criarSegmento(`Spinhardi · grupo ${nomeGrupo}`);

  const { error: eU } = await sb.from("grupos").update({ resend_segment_id: id }).eq("id", grupoId);
  if (eU) throw new Error(`Erro ao guardar o segmento do grupo: ${eU.message}`);

  return id;
}

/**
 * Reconcilia a membresia do segmento (R4): adiciona quem falta e REMOVE quem
 * sobra. A nossa lista é a verdade — nada no Resend é fonte sobre dados de
 * contato. Devolve o que mudou, pra auditoria.
 */
export async function reconciliarSegmento(
  segmentId: string,
  pessoas: PessoaEspelhada[],
): Promise<{ adicionados: number; removidos: number }> {
  const r = resend();
  const desejados = new Set(pessoas.map((p) => p.resendContactId));

  const atuais = new Set<string>();
  const lista = await r.contacts.list({ segmentId });
  if (lista.error) {
    // Sem a membresia atual não dá pra reconciliar: o `data` vazio de uma
    // listagem que FALHOU faria a remoção (R4) virar no-op silencioso e deixar
    // gente de fora da nossa lista dentro do segmento — exatamente o risco que
    // a reconciliação existe pra fechar.
    throw new Error(`Erro ao listar a membresia do segmento: ${lista.error.message}`);
  }
  for (const c of lista.data?.data ?? []) atuais.add(c.id);

  let adicionados = 0;
  for (const p of pessoas) {
    if (atuais.has(p.resendContactId)) continue;
    const { error } = await r.contacts.segments.add({ segmentId, contactId: p.resendContactId });
    if (error) console.error(`[campanhas.resend] add ${p.email} no segmento:`, error);
    else adicionados++;
  }

  let removidos = 0;
  for (const id of atuais) {
    if (desejados.has(id)) continue;
    const { error } = await r.contacts.segments.remove({ segmentId, contactId: id });
    if (error) console.error(`[campanhas.resend] remove ${id} do segmento:`, error);
    else removidos++;
  }

  return { adicionados, removidos };
}

// ─────────────────────────────────────────────────────────────────
// Opt-out lido do Resend (R5)
// ─────────────────────────────────────────────────────────────────

/**
 * Lê o estado de opt-out do Resend ANTES do envio e devolve os e-mails que
 * estão descadastrados lá.
 *
 * SUPERFÍCIE REAL: `Contact` do SDK 6.12.4 expõe `unsubscribed: boolean`, então
 * a leitura É viável — não precisou de ponto de extensão vazio. A leitura é
 * por segmento (`contacts.list({segmentId})`), que é a única listagem
 * disponível; contato que ainda não está no segmento não é consultado aqui e
 * fica coberto pelo webhook `contact.updated`.
 */
export async function lerOptOut(segmentId: string): Promise<Set<string>> {
  const fora = new Set<string>();
  try {
    const lista = await resend().contacts.list({ segmentId });
    if (lista.error) {
      // Aqui NÃO lança, de propósito: a decisão documentada acima é não
      // bloquear o envio por causa do opt-out. Mas o erro para de sumir.
      console.error("[campanhas.resend] listagem de opt-out recusada:", lista.error);
      return fora;
    }
    for (const c of lista.data?.data ?? []) {
      if (c.unsubscribed && c.email) fora.add(c.email.trim().toLowerCase());
    }
  } catch (err) {
    // Não bloqueia o envio: a supressão do webhook é a rede de segurança.
    console.error("[campanhas.resend] não foi possível ler opt-out:", err);
  }
  return fora;
}

// ─────────────────────────────────────────────────────────────────
// Broadcast
// ─────────────────────────────────────────────────────────────────

export type CriarBroadcastInput = {
  nome: string;
  segmentId: string;
  assunto: string;
  html: string;
  texto: string;
  /** ISO 8601. Ausente = envia agora. */
  agendadoPara?: string | null;
  /** Vai no header `Idempotency-Key`. Use algo estável por campanha. */
  chaveIdempotencia: string;
};

/**
 * Cria e dispara (ou agenda) o broadcast. `send: true` no create, com
 * `scheduledAt` quando é agendamento — é a forma suportada pelo SDK
 * (`SendBroadcastOnCreationOptions`).
 *
 * IDEMPOTÊNCIA (E5), com o que o SDK 6.12.4 realmente oferece: o tipo
 * `CreateBroadcastRequestOptions` NÃO tem `idempotencyKey` (só o `resend.post`
 * cru tem), mas ele estende `PostOptions`, e a implementação de `post` funde
 * `options.headers` nos headers da requisição. Então a chave vai pelo header
 * `Idempotency-Key`, que é o mecanismo documentado do Resend — sem gambiarra e
 * sem sair do SDK. Isso é a segunda trava; a primeira é o gate de estado no
 * servidor, que impede a chamada de acontecer duas vezes.
 */
export async function criarBroadcast(input: CriarBroadcastInput): Promise<string> {
  const { data, error } = await resend().broadcasts.create(
    {
      name: input.nome,
      segmentId: input.segmentId,
      from: remetente(),
      subject: input.assunto,
      html: input.html,
      text: input.texto,
      send: true,
      ...(input.agendadoPara ? { scheduledAt: input.agendadoPara } : {}),
    },
    { headers: { "Idempotency-Key": input.chaveIdempotencia } },
  );

  if (error || !data?.id) {
    throw new Error(`Erro ao criar o broadcast: ${error?.message ?? "sem id"}`);
  }
  return data.id;
}

/**
 * Cancela um agendamento no Resend. Ver docblock do módulo: `remove` é o único
 * caminho remoto que o SDK 6.12.4 oferece, e pra broadcast `scheduled` ele É o
 * cancelamento. Lança em erro — quem chama não transiciona estado sem isto.
 */
export async function cancelarBroadcast(broadcastId: string): Promise<void> {
  const { error } = await resend().broadcasts.remove(broadcastId);
  if (error) {
    throw new Error(`O Resend recusou o cancelamento: ${error.message}`);
  }
}

/** Envio de TESTE — e-mail simples, sem broadcast e sem segmento. */
export async function enviarTeste(input: {
  para: string[];
  assunto: string;
  html: string;
  texto: string;
}): Promise<void> {
  const { error } = await resend().emails.send({
    from: remetente(),
    to: input.para,
    subject: `[TESTE] ${input.assunto}`,
    html: input.html,
    text: input.texto,
  });
  if (error) throw new Error(`Erro ao enviar o teste: ${error.message}`);
}
