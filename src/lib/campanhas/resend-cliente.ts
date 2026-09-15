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
 *  • `segments.create({name})` / `.list(PaginationOptions)` / `.get(id)` — Segment { id, name }.
 *  • `contacts.create({email, firstName, lastName, segments:[{id}]})`,
 *    `.list({segmentId, limit, after})`, `.get({email}|{id})`, `.update({id|email, ...})`.
 *  • `contacts.segments.add({segmentId, contactId|email})` / `.remove(...)`.
 *  • `broadcasts.create({segmentId, from, subject, html, text, send, scheduledAt})`,
 *    `.send(id, {scheduledAt})`, `.get(id)`, `.remove(id)`.
 *  • `webhooks.verify({payload, headers, webhookSecret})` → WebhookEventPayload.
 *  • Toda resposta é `{ data, error, headers }`; `headers` vem em minúsculas
 *    (`Object.fromEntries(response.headers)`), então `retry-after` é legível.
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

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────
// Rate limit e retry
// ─────────────────────────────────────────────────────────────────

/**
 * Decisões locais (lote CAMP-fix), todas ajustáveis aqui sem mexer em lógica:
 *  • 3 tentativas POR CHAMADA à API (create, get, add, remove, página de
 *    listagem). Um contato faz no máximo create + get, então no pior caso são
 *    6 idas por contato, nunca um loop aberto.
 *  • Espera = `retry-after` do Resend quando vem (segundos ou data HTTP);
 *    senão backoff exponencial 500 ms, 1 s. Teto de 10 s por espera, pra um
 *    header maluco não segurar a função até o `maxDuration`.
 *  • Cota diária/mensal estourada também chega como 429, mas NÃO é repetida:
 *    esperar não resolve, e as tentativas só gastariam tempo.
 *  • Ritmo proativo: quando o Resend avisa `ratelimit-remaining: 0`, espera
 *    `ratelimit-reset` antes da próxima chamada. Evita pagar um 429 por janela.
 */
export const TENTATIVAS_MAX = 3;
const BACKOFF_INICIAL_MS = 500;
const ESPERA_MAX_MS = 10_000;

type RespostaSdk = {
  error: { message: string; name?: string; statusCode?: number | null } | null;
  headers?: Record<string, string> | null;
};

function ehRateLimit(error: RespostaSdk["error"]): boolean {
  if (!error) return false;
  if (error.name === "daily_quota_exceeded" || error.name === "monthly_quota_exceeded") {
    return false;
  }
  return error.name === "rate_limit_exceeded" || error.statusCode === 429;
}

function segundosOuDataHttp(valor: string | undefined): number | null {
  if (!valor) return null;
  const s = Number(valor);
  if (Number.isFinite(s) && s >= 0) return Math.min(s * 1000, ESPERA_MAX_MS);
  const quando = Date.parse(valor);
  if (!Number.isNaN(quando)) return Math.min(Math.max(0, quando - Date.now()), ESPERA_MAX_MS);
  return null;
}

/**
 * Executa uma chamada do SDK repetindo em rate limit. Nunca lança por conta
 * própria: devolve a última resposta, com o `error` que o chamador já trata.
 */
export async function comRetry<R extends RespostaSdk>(chamada: () => Promise<R>): Promise<R> {
  let resposta = await chamada();
  for (let tentativa = 1; tentativa < TENTATIVAS_MAX && ehRateLimit(resposta.error); tentativa++) {
    const espera =
      segundosOuDataHttp(resposta.headers?.["retry-after"]) ??
      BACKOFF_INICIAL_MS * 2 ** (tentativa - 1);
    console.warn(
      `[campanhas.resend] rate limit, tentativa ${tentativa + 1}/${TENTATIVAS_MAX} em ${espera} ms`,
    );
    await dormir(espera);
    resposta = await chamada();
  }

  if (resposta.headers?.["ratelimit-remaining"] === "0") {
    const reset = segundosOuDataHttp(resposta.headers["ratelimit-reset"]);
    if (reset) await dormir(reset);
  }
  return resposta;
}

/**
 * Lotes de 10, sequenciais dentro do lote, com 75 ms entre lotes (meio da
 * faixa 50 a 100 ms). Sequencial de propósito: o limite do Resend é por
 * segundo e por time, paralelizar só trocaria espera por 429.
 */
export const TAMANHO_LOTE = 10;
const PAUSA_ENTRE_LOTES_MS = 75;

async function emLotes<T>(itens: T[], passo: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
    if (i > 0) await dormir(PAUSA_ENTRE_LOTES_MS);
    for (const item of itens.slice(i, i + TAMANHO_LOTE)) await passo(item);
  }
}

// ─────────────────────────────────────────────────────────────────
// Paginação
// ─────────────────────────────────────────────────────────────────

/** 100 é o máximo que o `PaginationOptions` do SDK aceita. */
const LIMITE_POR_PAGINA = 100;

/**
 * 50 páginas × 100 = 5.000 itens, o mesmo teto de leitura da view
 * `contatos_elegiveis_email` (`TETO_LEITURA` em `publico.ts`). Passar disso é
 * sinal de algo errado, e operar sobre lista incompleta é pior que parar.
 */
export const TETO_PAGINAS = 50;

type PaginaSdk<T> = RespostaSdk & {
  data: { data: T[]; has_more: boolean } | null;
};

/**
 * Percorre uma listagem paginada do Resend inteira: `limit: 100` e
 * `after` = id do último item da página anterior, até `has_more === false`.
 *
 * LANÇA em três casos, sempre com mensagem explícita: erro do Resend numa
 * página (depois dos retries), estouro do teto de páginas, e `has_more` com
 * página vazia (sem cursor pra seguir). Nos três, devolver o parcial faria a
 * reconciliação remover ou deixar de remover gente com base em lista cortada.
 */
export async function listarTudo<T extends { id: string }>(
  pagina: (opcoes: { limit: number; after?: string }) => Promise<PaginaSdk<T>>,
  rotulo: string,
): Promise<T[]> {
  const todos: T[] = [];
  let after: string | undefined;

  for (let n = 1; n <= TETO_PAGINAS; n++) {
    const r = await comRetry(() =>
      pagina(after ? { limit: LIMITE_POR_PAGINA, after } : { limit: LIMITE_POR_PAGINA }),
    );
    if (r.error || !r.data) {
      throw new Error(`Erro ao ${rotulo} no Resend: ${r.error?.message ?? "resposta vazia"}`);
    }

    const itens = r.data.data ?? [];
    todos.push(...itens);
    if (!r.data.has_more) return todos;

    const ultimo = itens.at(-1);
    if (!ultimo) {
      throw new Error(`Erro ao ${rotulo} no Resend: has_more sem itens na página ${n}.`);
    }
    after = ultimo.id;
  }

  throw new Error(
    `Erro ao ${rotulo} no Resend: passou de ${TETO_PAGINAS} páginas ` +
      `(${TETO_PAGINAS * LIMITE_POR_PAGINA} itens). Listagem abortada.`,
  );
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

export type FalhaNoProvedor = { email: string; motivo: string };

export type ResultadoEspelhamento = {
  espelhadas: PessoaEspelhada[];
  falhas: FalhaNoProvedor[];
};

/**
 * Garante cada destinatário como Contact no Resend (correspondência por e-mail,
 * R2) e grava o vínculo em `contact_external_links` com `provider='resend'`
 * (R3) — reusando o upsert que já existe, nenhuma coluna nova em `contacts`.
 *
 * Idempotente por consequência: e-mail já existente no Resend devolve erro de
 * duplicidade, e nesse caso a gente lê o id em vez de tratar como falha.
 *
 * POR QUE create + get e não get + create: o SDK 6.12.4 não tem upsert de
 * contato, mas tem `contacts.get({email})` direto. Inverter a ordem custaria
 * 2 chamadas por contato no PRIMEIRO envio (205 contatos novos) pra economizar
 * no segundo. Mantido create + get: é o caminho já provado na fumaça de 28/07
 * e o custo extra só aparece em contato que já existe.
 *
 * SEGMENTO NO CREATE (CAMP-fix-2): contato NOVO nasce dentro de `segmentId`
 * (`CreateContactOptions.segments: { id }[]`, repassado como `segments` no
 * POST /contacts pelo SDK 6.12.4). Isso corta o `segments.add` de cada
 * contato novo: no primeiro envio real são N creates, não N creates + N adds.
 * Contato que JÁ existia cai no get e NÃO é adicionado aqui: quem decide se
 * ele está ou não no segmento é `reconciliarSegmento`, que roda depois e lê a
 * membresia inteira. Por isso o chamador resolve o segmento ANTES de espelhar.
 *
 * Quem não pôde ser espelhado volta em `falhas`, com o motivo. A decisão de
 * seguir ou abortar é do chamador (teto de falha em `envio.ts`).
 */
export async function espelharContatos(
  pessoas: { contactId: string | null; email: string; nome: string }[],
  segmentId: string,
): Promise<ResultadoEspelhamento> {
  const r = resend();
  const espelhadas: PessoaEspelhada[] = [];
  const falhas: FalhaNoProvedor[] = [];

  await emLotes(pessoas, async (p) => {
    const { firstName, lastName } = partesDoNome(p.nome);
    let resendContactId: string | null = null;

    const criado = await comRetry(() =>
      r.contacts.create({ email: p.email, firstName, lastName, segments: [{ id: segmentId }] }),
    );
    if (criado.data?.id) {
      resendContactId = criado.data.id;
    } else {
      // Já existe (ou outro erro): tenta ler por e-mail antes de desistir.
      const achado = await comRetry(() => r.contacts.get({ email: p.email }));
      if (achado.data?.id) resendContactId = achado.data.id;
      else {
        const motivo =
          criado.error?.message ?? achado.error?.message ?? "sem id na resposta do Resend";
        console.error(`[campanhas.resend] não foi possível espelhar ${p.email}: ${motivo}`);
        falhas.push({ email: p.email, motivo });
        return;
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
  });

  return { espelhadas, falhas };
}

// ─────────────────────────────────────────────────────────────────
// Segmentos
// ─────────────────────────────────────────────────────────────────

/** Segment reservado do público "todos os elegíveis" (R2). */
const NOME_SEGMENTO_TODOS = "Spinhardi · todos os elegíveis";

async function criarSegmento(nome: string): Promise<string> {
  const { data, error } = await comRetry(() => resend().segments.create({ name: nome }));
  if (error || !data?.id) {
    throw new Error(`Erro ao criar segmento no Resend: ${error?.message ?? "sem id"}`);
  }
  return data.id;
}

/**
 * Todos os segmentos da conta. Listagem que falha LANÇA: não sabemos se o
 * segmento já existe, e criar aqui duplicaria com base num "não achei" que na
 * verdade é "não consegui olhar".
 */
function listarSegmentos() {
  return listarTudo((o) => resend().segments.list(o), "listar segmentos");
}

/**
 * Segment do público `todos_elegiveis`. Usa `RESEND_SEGMENT_TODOS_ELEGIVEIS_ID`
 * quando existe; senão cria na primeira vez e GRITA o id no log pro Alan setar
 * a env (sem a env, a próxima execução criaria outro segmento).
 */
export async function segmentoTodosElegiveis(): Promise<string> {
  const daEnv = process.env.RESEND_SEGMENT_TODOS_ELEGIVEIS_ID?.trim();
  if (daEnv) return daEnv;

  // Antes de criar, procura um com o mesmo nome no resultado COMPLETO — evita
  // duplicar a cada deploy enquanto a env não estiver setada.
  const existente = (await listarSegmentos()).find((s) => s.name === NOME_SEGMENTO_TODOS);
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
  const existente = (await listarSegmentos()).find((s) => s.name === NOME_SEGMENTO_MODO_SEGURO);
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

/** Membresia COMPLETA de um segmento (todas as páginas). */
function listarMembros(segmentId: string) {
  return listarTudo(
    (o) => resend().contacts.list({ segmentId, ...o }),
    "listar a membresia do segmento",
  );
}

export type ResultadoReconciliacao = {
  adicionados: number;
  removidos: number;
  /** Quem devia entrar no segmento e não entrou: não recebe o broadcast. */
  falhasAoAdicionar: FalhaNoProvedor[];
  falhasAoRemover: number;
};

/**
 * Reconcilia a membresia do segmento (R4): adiciona quem falta e REMOVE quem
 * sobra. A nossa lista é a verdade — nada no Resend é fonte sobre dados de
 * contato. Devolve o que mudou, pra auditoria.
 *
 * Sem a membresia atual COMPLETA não dá pra reconciliar: `listarTudo` lança se
 * qualquer página falhar, e o erro sobe. Uma listagem parcial faria a remoção
 * virar no-op silencioso pra quem estivesse da página 2 em diante.
 */
export async function reconciliarSegmento(
  segmentId: string,
  pessoas: PessoaEspelhada[],
): Promise<ResultadoReconciliacao> {
  const r = resend();
  const desejados = new Set(pessoas.map((p) => p.resendContactId));
  const atuais = new Set((await listarMembros(segmentId)).map((c) => c.id));

  let adicionados = 0;
  const falhasAoAdicionar: FalhaNoProvedor[] = [];
  await emLotes(
    pessoas.filter((p) => !atuais.has(p.resendContactId)),
    async (p) => {
      const { error } = await comRetry(() =>
        r.contacts.segments.add({ segmentId, contactId: p.resendContactId }),
      );
      if (error) {
        console.error(`[campanhas.resend] add ${p.email} no segmento:`, error);
        falhasAoAdicionar.push({ email: p.email, motivo: error.message });
      } else adicionados++;
    },
  );

  let removidos = 0;
  let falhasAoRemover = 0;
  await emLotes(
    [...atuais].filter((id) => !desejados.has(id)),
    async (id) => {
      const { error } = await comRetry(() =>
        r.contacts.segments.remove({ segmentId, contactId: id }),
      );
      if (error) {
        console.error(`[campanhas.resend] remove ${id} do segmento:`, error);
        falhasAoRemover++;
      } else removidos++;
    },
  );

  return { adicionados, removidos, falhasAoAdicionar, falhasAoRemover };
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
 * por segmento (`contacts.list({segmentId})`, todas as páginas), que é a única
 * listagem disponível; contato que ainda não está no segmento não é consultado
 * aqui e fica coberto pelo webhook `contact.updated`.
 */
export async function lerOptOut(segmentId: string): Promise<Set<string>> {
  const fora = new Set<string>();
  try {
    for (const c of await listarMembros(segmentId)) {
      if (c.unsubscribed && c.email) fora.add(c.email.trim().toLowerCase());
    }
  } catch (err) {
    // Aqui NÃO lança, de propósito: a decisão documentada acima é não
    // bloquear o envio por causa do opt-out. A supressão do webhook é a rede
    // de segurança. Mas o erro não some.
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
 * servidor, que impede a chamada de acontecer duas vezes. É também o que torna
 * seguro o retry de 429 aqui: a repetição carrega a mesma chave.
 */
export async function criarBroadcast(input: CriarBroadcastInput): Promise<string> {
  const { data, error } = await comRetry(() =>
    resend().broadcasts.create(
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
    ),
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
