/**
 * Critério de aceite (β) do lote CAMP-fix: paginação do Resend, dedup de
 * `contact.updated`, teto/throttle/retry no espelhamento, opt-out com régua
 * única.
 *
 * PROCESSO SELADO. `globalThis.fetch` é trocado, ANTES de qualquer import, por
 * um roteador em memória que atende dois hosts inventados
 * (`supabase.beta.invalid` e `resend.beta.invalid`) e LANÇA pra qualquer outro.
 * O `.env.local` não é lido: as envs de Supabase e Resend apontam pros hosts
 * falsos. Nada aqui chega a banco ou provedor de verdade, e o check 0 prova.
 *
 * Por isso dá pra exercitar o código REAL do repo ponta a ponta, sem seam de
 * teste em produção: `dispararCampanha`, `ingerirEvento`, `refletirOptOut`,
 * `reconciliarSegmento`, `listarTudo`, passando pelo SDK `resend` 6.12.4 e
 * pelo `@supabase/supabase-js` de verdade. Só a rede é falsa. O Supabase falso
 * interpreta os filtros PostgREST (eq, not.in, ilike, in, gte, order, limit,
 * upsert com on_conflict), então as guardas de `suprimir` são provadas pelo
 * que a query pede, não por reimplementação.
 *
 * MODO SEGURO: fica "1" o tempo todo, EXCETO dentro do check 4, que precisa do
 * público de 205 pra medir o teto. Lá ele vai a "0" e volta a "1" num finally.
 * Com o fetch selado, o "público real" são 205 contatos inventados em memória.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/beta-campanhas-fix.ts
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

// ══ Selagem ══════════════════════════════════════════════════════

const HOST_SUPABASE = "https://supabase.beta.invalid";
const HOST_RESEND = "https://resend.beta.invalid";

process.env.NEXT_PUBLIC_SUPABASE_URL = HOST_SUPABASE;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "beta-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "beta-service";
process.env.RESEND_API_KEY = "re_beta_chave_falsa";
process.env.RESEND_BASE_URL = HOST_RESEND;
process.env.RESEND_FROM_EMAIL = "beta@spinhardi.invalid";
process.env.CAMPANHAS_MODO_SEGURO = "1";
delete process.env.RESEND_SEGMENT_TODOS_ELEGIVEIS_ID;
delete process.env.CAMPANHAS_EMAILS_TESTE;

const bloqueadas: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin === HOST_SUPABASE) return supabaseFalso(req, url);
  if (url.origin === HOST_RESEND) return resendFalso(req, url);
  bloqueadas.push(req.url);
  throw new Error(`β: rede real bloqueada (${req.url})`);
}) as typeof fetch;

// ══ Utilidades ═══════════════════════════════════════════════════

type Linha = Record<string, unknown>;

let sequencia = 0;
function novoId(): string {
  sequencia++;
  return `00000000-0000-4000-8000-${String(sequencia).padStart(12, "0")}`;
}

function json(corpo: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ══ Supabase em memória (subconjunto PostgREST) ══════════════════

const db = new Map<string, Linha[]>();

function tabela(nome: string): Linha[] {
  if (!db.has(nome)) db.set(nome, []);
  return db.get(nome)!;
}

const PARAMS_RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function lista(valor: string): string[] {
  return valor
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""));
}

function casaFiltro(linha: Linha, coluna: string, expressao: string): boolean {
  let expr = expressao;
  let negado = false;
  if (expr.startsWith("not.")) {
    negado = true;
    expr = expr.slice(4);
  }
  const ponto = expr.indexOf(".");
  const op = expr.slice(0, ponto);
  const valor = expr.slice(ponto + 1);
  const atual = linha[coluna];

  let r: boolean;
  switch (op) {
    case "eq":
      r = atual != null && String(atual) === valor;
      break;
    case "neq":
      r = atual != null && String(atual) !== valor;
      break;
    case "gte":
      r = atual != null && String(atual) >= valor;
      break;
    case "lte":
      r = atual != null && String(atual) <= valor;
      break;
    case "in":
      r = atual != null && lista(valor).includes(String(atual));
      break;
    case "ilike":
    case "like": {
      const padrao = valor.split("%").map(escaparRegex).join(".*");
      r =
        typeof atual === "string" &&
        new RegExp(`^${padrao}$`, op === "ilike" ? "i" : "").test(atual);
      break;
    }
    case "is":
      r = valor === "null" ? atual == null : String(atual) === valor;
      break;
    default:
      throw new Error(`β: operador PostgREST não simulado: ${op}`);
  }
  return negado ? !r : r;
}

async function supabaseFalso(req: Request, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/rest\/v1\/([^/]+)$/);
  if (!m) return json({ message: `β: rota Supabase não simulada ${url.pathname}` }, 404);

  const linhas = tabela(m[1]);
  const filtros = [...url.searchParams.entries()].filter(([k]) => !PARAMS_RESERVADOS.has(k));
  const filtrar = (ls: Linha[]) => ls.filter((l) => filtros.every(([c, e]) => casaFiltro(l, c, e)));
  const prefer = req.headers.get("prefer") ?? "";
  const representacao = prefer.includes("return=representation");
  const objeto = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object+json");
  const select = url.searchParams.get("select");

  const projetar = (l: Linha): Linha =>
    !select || select === "*"
      ? { ...l }
      : Object.fromEntries(
          select
            .split(",")
            .map((c) => c.trim())
            .filter((c) => c && !c.includes("("))
            .map((c) => [c, l[c] ?? null]),
        );

  const responder = (ls: Linha[], status = 200): Response => {
    if (!objeto) return json(ls.map(projetar), status);
    if (ls.length !== 1) {
      return json(
        { code: "PGRST116", message: "JSON object requested, multiple (or no) rows" },
        406,
      );
    }
    return json(projetar(ls[0]), status);
  };

  if (req.method === "GET") {
    let ls = filtrar(linhas);
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      ls = [...ls].sort((a, b) => {
        const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
        return dir === "desc" ? -cmp : cmp;
      });
    }
    const limit = url.searchParams.get("limit");
    if (limit) ls = ls.slice(0, Number(limit));
    return responder(ls);
  }

  if (req.method === "POST") {
    const corpo = (await req.json()) as Linha | Linha[];
    const novos = Array.isArray(corpo) ? corpo : [corpo];
    const conflito = url.searchParams.get("on_conflict")?.split(",");
    const ignorar = prefer.includes("resolution=ignore-duplicates");
    const mesclar = prefer.includes("resolution=merge-duplicates");
    const afetados: Linha[] = [];

    for (const n of novos) {
      const existente = conflito
        ? linhas.find((l) => conflito.every((c) => (l[c] ?? null) === (n[c] ?? null)))
        : undefined;
      if (existente) {
        if (ignorar) continue;
        if (mesclar) {
          Object.assign(existente, n);
          afetados.push(existente);
          continue;
        }
        return json({ code: "23505", message: "duplicate key value" }, 409);
      }
      const agora = new Date().toISOString();
      const linha: Linha = {
        id: novoId(),
        created_at: agora,
        updated_at: agora,
        recebido_em: agora,
        enviado_em: agora,
        ...n,
      };
      linhas.push(linha);
      afetados.push(linha);
    }
    return representacao ? responder(afetados, 201) : new Response(null, { status: 201 });
  }

  if (req.method === "PATCH") {
    const patch = (await req.json()) as Linha;
    const alvo = filtrar(linhas);
    for (const l of alvo) Object.assign(l, patch);
    return representacao ? responder(alvo) : new Response(null, { status: 204 });
  }

  return json({ message: `β: método não simulado ${req.method}` }, 405);
}

// ══ Resend em memória ════════════════════════════════════════════

type ContatoResend = {
  object: "contact";
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  created_at: string;
};

const rs = {
  contatos: new Map<string, ContatoResend>(),
  segmentos: [] as { id: string; name: string; created_at: string }[],
  membros: new Map<string, string[]>(),
  broadcasts: [] as { id: string; segment_id: string; name: string }[],
  /** create → 422 e get → 404: e-mail que o provedor recusa. */
  recusar: new Set<string>(),
  /** create → 429 com retry-after na primeira vez, sucesso depois. */
  rateLimitUmaVez: new Set<string>(),
  chamadas: [] as string[],
  /** Corpo de cada POST /contacts: e-mail e ids de segmento pedidos no create. */
  creates: [] as { email: string; segments: string[] }[],
};

function zerar() {
  db.clear();
  rs.contatos.clear();
  rs.segmentos.length = 0;
  rs.membros.clear();
  rs.broadcasts.length = 0;
  rs.recusar.clear();
  rs.rateLimitUmaVez.clear();
  rs.chamadas.length = 0;
  rs.creates.length = 0;
}

function paginar<T extends { id: string }>(itens: T[], url: URL): Response {
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const after = url.searchParams.get("after");
  const inicio = after ? itens.findIndex((i) => i.id === after) + 1 : 0;
  const pagina = itens.slice(inicio, inicio + limit);
  return json({ object: "list", data: pagina, has_more: inicio + limit < itens.length });
}

function contatoPorEmail(email: string): ContatoResend | undefined {
  return [...rs.contatos.values()].find((c) => c.email === email.toLowerCase());
}

async function resendFalso(req: Request, url: URL): Promise<Response> {
  const caminho = decodeURIComponent(url.pathname);
  rs.chamadas.push(`${req.method} ${caminho}${url.search}`);
  const erro = (status: number, name: string, message: string, headers = {}) =>
    json({ statusCode: status, name, message }, status, headers);

  let m: RegExpMatchArray | null;

  if (req.method === "POST" && caminho === "/contacts") {
    const b = (await req.json()) as {
      email: string;
      first_name?: string;
      last_name?: string;
      segments?: { id: string }[];
    };
    rs.creates.push({ email: b.email, segments: (b.segments ?? []).map((s) => s.id) });
    const email = b.email.toLowerCase();
    if (rs.rateLimitUmaVez.has(email)) {
      rs.rateLimitUmaVez.delete(email);
      return erro(429, "rate_limit_exceeded", "Too many requests", { "retry-after": "1" });
    }
    if (rs.recusar.has(email)) return erro(422, "validation_error", "β: e-mail recusado");
    if (contatoPorEmail(email)) return erro(422, "validation_error", "Contact already exists");
    const c: ContatoResend = {
      object: "contact",
      id: novoId(),
      email,
      first_name: b.first_name ?? null,
      last_name: b.last_name ?? null,
      unsubscribed: false,
      created_at: new Date().toISOString(),
    };
    rs.contatos.set(c.id, c);
    // Contato NOVO criado com `segments` já nasce membro (CreateContactOptions).
    for (const s of b.segments ?? []) {
      const ids = rs.membros.get(s.id) ?? [];
      if (!ids.includes(c.id)) ids.push(c.id);
      rs.membros.set(s.id, ids);
    }
    return json({ object: "contact", id: c.id }, 201);
  }

  if (req.method === "GET" && (m = caminho.match(/^\/contacts\/([^/]+)$/))) {
    const chave = m[1];
    const c = rs.contatos.get(chave) ?? contatoPorEmail(chave);
    if (!c || rs.recusar.has(c.email)) return erro(404, "not_found", "Contact not found");
    return json(c);
  }

  if (req.method === "GET" && caminho === "/segments") return paginar(rs.segmentos, url);

  if (req.method === "POST" && caminho === "/segments") {
    const b = (await req.json()) as { name: string };
    const s = { id: novoId(), name: b.name, created_at: new Date().toISOString() };
    rs.segmentos.push(s);
    return json({ object: "segment", ...s }, 201);
  }

  if (req.method === "GET" && (m = caminho.match(/^\/segments\/([^/]+)\/contacts$/))) {
    const ids = rs.membros.get(m[1]) ?? [];
    return paginar(
      ids.map((id) => rs.contatos.get(id)!),
      url,
    );
  }

  if ((m = caminho.match(/^\/contacts\/([^/]+)\/segments\/([^/]+)$/))) {
    const [, contactId, segmentId] = m;
    const ids = rs.membros.get(segmentId) ?? [];
    if (req.method === "POST") {
      if (!ids.includes(contactId)) ids.push(contactId);
      rs.membros.set(segmentId, ids);
      return json({ id: segmentId });
    }
    if (req.method === "DELETE") {
      rs.membros.set(
        segmentId,
        ids.filter((id) => id !== contactId),
      );
      return json({ id: segmentId, deleted: true });
    }
  }

  if (req.method === "POST" && caminho === "/broadcasts") {
    const b = (await req.json()) as { segment_id: string; name: string };
    const br = { id: novoId(), segment_id: b.segment_id, name: b.name };
    rs.broadcasts.push(br);
    return json({ id: br.id }, 201);
  }

  return erro(404, "not_found", `β: rota Resend não simulada ${req.method} ${caminho}`);
}

// ══ Sementes ═════════════════════════════════════════════════════

type Pessoa = { contactId: string; email: string; nome: string };

function semearCrm(n: number, prefixo: string): Pessoa[] {
  const pessoas: Pessoa[] = [];
  for (let i = 1; i <= n; i++) {
    const p = { contactId: novoId(), email: `${prefixo}${i}@beta.invalid`, nome: `Pessoa ${i}` };
    tabela("contacts").push({
      id: p.contactId,
      name: p.nome,
      email: p.email,
      status: "ativo",
      email_marketing_status: "legitimo_interesse",
      email_marketing_status_em: null,
      email_marketing_status_origem: null,
    });
    tabela("contatos_elegiveis_email").push({ id: p.contactId, name: p.nome, email: p.email });
    pessoas.push(p);
  }
  return pessoas;
}

function contatoCrm(id: string): Linha {
  return tabela("contacts").find((c) => c.id === id)!;
}

// ══ Checks ═══════════════════════════════════════════════════════

const resultados: { n: string; ok: boolean; nota: string }[] = [];

function check(n: string, ok: boolean, nota: string) {
  resultados.push({ n, ok, nota });
  console.log(`[${ok ? "PASSOU" : "NÃO PASSOU"}] ${n}: ${nota}`);
}

async function lanca(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function main() {
  const {
    listarTudo,
    reconciliarSegmento,
    espelharContatos,
    segmentoTodosElegiveis,
    TETO_PAGINAS,
  } = await import("@/lib/campanhas/resend-cliente");
  const { chaveDoEvento, ingerirEvento } = await import("@/lib/campanhas/eventos");
  const { dispararCampanha, refletirOptOut, excedeTetoDeFalha } =
    await import("@/lib/campanhas/envio");
  const { calcularConteudoHash } = await import("@/lib/campanhas/hash");
  const { resumoModoSeguro } = await import("@/lib/campanhas/modo-seguro");
  const { metricaMedida, taxaDe } = await import("@/lib/campanhas/metricas-shared");
  const { RASTREIO_ABERTURA } = await import("@/lib/campanhas/config");

  // ── 0. Selagem ──────────────────────────────────────────────────
  console.log("\n=== 0 · Selagem ===");
  const vazou = await lanca(() => fetch("https://api.resend.com/segments"));
  check(
    "0.1 rede real bloqueada",
    vazou !== null && bloqueadas.length === 1,
    vazou ?? "PROBLEMA: a chamada saiu",
  );
  bloqueadas.length = 0;

  // ── 1. listarTudo ───────────────────────────────────────────────
  console.log("\n=== 1 · Paginação ===");
  {
    const itens = Array.from({ length: 250 }, (_, i) => ({ id: `item-${i}` }));
    const cursores: (string | undefined)[] = [];
    const todos = await listarTudo(async (o) => {
      cursores.push(o.after);
      const inicio = o.after ? itens.findIndex((i) => i.id === o.after) + 1 : 0;
      return {
        data: { data: itens.slice(inicio, inicio + o.limit), has_more: inicio + o.limit < 250 },
        error: null,
        headers: null,
      };
    }, "listar itens");
    check(
      "1.1 250 itens em páginas de 100",
      todos.length === 250 &&
        todos.every((t, i) => t.id === `item-${i}`) &&
        cursores.length === 3 &&
        cursores.join(",") === ",item-99,item-199",
      `${todos.length} itens na ordem, ${cursores.length} chamadas, cursores [${cursores.join(", ")}]`,
    );

    let chamadas = 0;
    const msg = await lanca(() =>
      listarTudo(async () => {
        chamadas++;
        return { data: { data: [{ id: `x-${chamadas}` }], has_more: true }, error: null };
      }, "listar sem fim"),
    );
    check(
      "1.2 has_more eterno estoura no teto",
      msg !== null && msg.includes(`${TETO_PAGINAS} páginas`) && chamadas === TETO_PAGINAS,
      `${chamadas} chamadas, erro: ${msg}`,
    );

    let depoisDoErro = 0;
    const msgErro = await lanca(() =>
      listarTudo(async (o) => {
        depoisDoErro++;
        return o.after
          ? { data: null, error: { message: "boom", name: "application_error", statusCode: 500 } }
          : { data: { data: [{ id: "a" }], has_more: true }, error: null };
      }, "listar com erro"),
    );
    check(
      "1.3 erro numa página lança, sem devolver parcial",
      msgErro !== null && msgErro.includes("boom") && depoisDoErro === 2,
      `erro: ${msgErro}`,
    );

    zerar();
    for (let i = 0; i < 150; i++) {
      rs.segmentos.push({
        id: `seg-${i}`,
        name: i === 130 ? "Spinhardi · todos os elegíveis" : `outro ${i}`,
        created_at: "2026-01-01",
      });
    }
    const achado = await segmentoTodosElegiveis();
    check(
      "1.4 segmentoTodosElegiveis acha o segmento na página 2",
      achado === "seg-130" && rs.segmentos.length === 150,
      `id ${achado}, ${rs.segmentos.length} segmentos (nenhum criado)`,
    );
  }

  // ── 2. Reconciliação ────────────────────────────────────────────
  console.log("\n=== 2 · Reconciliação ===");
  {
    zerar();
    const segId = "seg-todos";
    const pessoas = Array.from({ length: 208 }, (_, i) => {
      const id = novoId();
      rs.contatos.set(id, {
        object: "contact",
        id,
        email: `m${i}@beta.invalid`,
        first_name: null,
        last_name: null,
        unsubscribed: false,
        created_at: "2026-01-01",
      });
      return { contactId: null, email: `m${i}@beta.invalid`, nome: `M ${i}`, resendContactId: id };
    });
    rs.membros.set(
      segId,
      pessoas.map((p) => p.resendContactId),
    );
    const desejados = pessoas.slice(0, 205);
    const sobrando = pessoas.slice(205).map((p) => p.resendContactId);

    const r = await reconciliarSegmento(segId, desejados);
    const removidosDeFato = rs.chamadas
      .filter((c) => c.startsWith("DELETE"))
      .map((c) => c.split("/")[2]);
    const paginas = rs.chamadas.filter((c) => c.startsWith(`GET /segments/${segId}/contacts`));

    check(
      "2.1 205 membros e 3 sobrando: remove exatamente os 3",
      r.removidos === 3 &&
        r.adicionados === 0 &&
        removidosDeFato.length === 3 &&
        removidosDeFato.every((id) => sobrando.includes(id)) &&
        rs.membros.get(segId)!.length === 205,
      `removidos ${r.removidos} (${removidosDeFato.length} DELETE, todos da sobra), ` +
        `adicionados ${r.adicionados}, membresia lida em ${paginas.length} páginas, sobrou ${rs.membros.get(segId)!.length}`,
    );
  }

  // ── 3. contact.updated ─────────────────────────────────────────
  console.log("\n=== 3 · contact.updated ===");
  {
    zerar();
    const [ana] = semearCrm(1, "ana");
    const baseContato = {
      id: "resend-contato-ana",
      audience_id: "",
      segment_ids: [],
      created_at: "2026-07-01T10:00:00.000Z",
      email: ana.email,
    };
    const update = {
      type: "contact.updated",
      created_at: "2026-09-15T12:00:00.500Z",
      data: { ...baseContato, updated_at: "2026-09-15T12:00:00.000Z", unsubscribed: false },
    };
    const descadastro = {
      type: "contact.updated",
      created_at: "2026-09-15T12:30:00.500Z",
      data: { ...baseContato, updated_at: "2026-09-15T12:30:00.000Z", unsubscribed: true },
    };

    const k1 = chaveDoEvento(update);
    const k2 = chaveDoEvento(descadastro);
    check(
      "3.1 dois contact.updated, duas chaves",
      k1.ocorridoEm !== k2.ocorridoEm &&
        k1.resendEmailId === "resend-contato-ana" &&
        k2.resendEmailId === "resend-contato-ana" &&
        k1.ocorridoEm === update.data.updated_at,
      `(${k1.resendEmailId}, ${k1.ocorridoEm}) vs (${k2.resendEmailId}, ${k2.ocorridoEm}); ` +
        `a chave antiga seria a mesma nos dois: data.created_at=${baseContato.created_at}`,
    );

    const r1 = await ingerirEvento(update);
    const statusDepoisDoUpdate = contatoCrm(ana.contactId).email_marketing_status;
    const r2 = await ingerirEvento(descadastro);
    const c = contatoCrm(ana.contactId);
    check(
      "3.2 o segundo (unsubscribed) processa e suprime",
      r1.gravado &&
        statusDepoisDoUpdate === "legitimo_interesse" &&
        r2.gravado &&
        !r2.duplicado &&
        c.email_marketing_status === "descadastrado" &&
        c.email_marketing_status_origem === "descadastro" &&
        typeof c.email_marketing_status_em === "string",
      `update: gravado=${r1.gravado}, status=${statusDepoisDoUpdate}; descadastro: gravado=${r2.gravado}, ` +
        `status=${c.email_marketing_status}, origem=${c.email_marketing_status_origem}, em=${c.email_marketing_status_em}`,
    );

    const r3 = await ingerirEvento(descadastro);
    check(
      "3.3 reentrega do mesmo payload segue deduplicada (V4)",
      r3.duplicado && !r3.gravado && tabela("campanha_eventos").length === 2,
      `duplicado=${r3.duplicado}, ${tabela("campanha_eventos").length} linhas`,
    );

    const avisos: string[] = [];
    const warnOriginal = console.warn;
    console.warn = (...a: unknown[]) => void avisos.push(a.map(String).join(" "));
    const semUpdatedAt = {
      type: "contact.updated",
      created_at: "2026-09-15T13:00:00.000Z",
      data: { ...baseContato, unsubscribed: true },
    };
    let r4;
    try {
      r4 = await ingerirEvento(semUpdatedAt);
    } finally {
      console.warn = warnOriginal;
    }
    const linha4 = tabela("campanha_eventos").at(-1)!;
    check(
      "3.4 sem updated_at: cai em created_at com aviso, não descarta",
      r4.gravado &&
        linha4.ocorrido_em === semUpdatedAt.created_at &&
        avisos.some((a) => a.includes("sem data.updated_at")),
      `gravado=${r4.gravado}, ocorrido_em=${String(linha4.ocorrido_em)}, aviso: ${avisos[0]}`,
    );

    const kEmail = chaveDoEvento({
      type: "email.delivered",
      created_at: "2026-09-15T14:00:01.000Z",
      data: { email_id: "email-1", created_at: "2026-09-15T14:00:00.000Z", updated_at: "x" },
    });
    check(
      "3.5 evento de e-mail continua com data.created_at",
      kEmail.resendEmailId === "email-1" && kEmail.ocorridoEm === "2026-09-15T14:00:00.000Z",
      `(${kEmail.resendEmailId}, ${kEmail.ocorridoEm})`,
    );
  }

  // ── 4. Espelhamento com teto ───────────────────────────────────
  console.log("\n=== 4 · Espelhamento, teto e 429 ===");
  check(
    "4.0 fronteiras do teto",
    !excedeTetoDeFalha(205, 10) &&
      excedeTetoDeFalha(205, 11) &&
      !excedeTetoDeFalha(100, 5) &&
      excedeTetoDeFalha(100, 6) &&
      excedeTetoDeFalha(4, 1) &&
      !excedeTetoDeFalha(0, 0),
    "205: 10 passa, 11 aborta · 100: 5 passa, 6 aborta · modo seguro com 4: 1 aborta",
  );

  {
    zerar();
    const [lenta] = semearCrm(1, "lenta");
    rs.rateLimitUmaVez.add(lenta.email);
    const t0 = Date.now();
    const r = await espelharContatos([lenta], "seg-lenta");
    const creates = rs.chamadas.filter((c) => c === "POST /contacts").length;
    check(
      "4.1 429 na primeira, sucesso na segunda, conta como sucesso",
      r.espelhadas.length === 1 && r.falhas.length === 0 && creates === 2 && Date.now() - t0 >= 900,
      `${creates} creates, ${r.espelhadas.length} espelhada, ${r.falhas.length} falhas, ` +
        `esperou ${Date.now() - t0} ms (retry-after: 1)`,
    );
  }

  function semearCampanha(): string {
    const conteudo = {
      assunto: "β assunto",
      titulo: "β",
      intro: null,
      corpo: "Corpo de teste do CAMP-fix.",
      ctaTexto: null,
      ctaLink: null,
      notaRodape: null,
      imagemPath: null,
      imagemAlt: null,
    };
    const hash = calcularConteudoHash(conteudo);
    const id = novoId();
    const agora = new Date().toISOString();
    tabela("campanhas").push({
      id,
      nome_interno: "β CAMP-fix",
      tipo: "newsletter",
      assunto: conteudo.assunto,
      titulo: conteudo.titulo,
      intro: null,
      corpo: conteudo.corpo,
      cta_texto: null,
      cta_link: null,
      nota_rodape: null,
      imagem_path: null,
      imagem_alt: null,
      estado: "testada",
      conteudo_hash: hash,
      publico_tipo: "todos_elegiveis",
      grupo_id: null,
      testado_em: agora,
      testado_hash: hash,
      testado_para: "beta@spinhardi.invalid",
      agendado_para: null,
      enviado_em: null,
      resend_broadcast_id: null,
      criado_por: null,
      created_at: agora,
      updated_at: agora,
    });
    return id;
  }

  const auditoria = (campanhaId: string, tipo: string) =>
    tabela("campanha_eventos").filter((e) => e.campanha_id === campanhaId && e.tipo === tipo);

  process.env.CAMPANHAS_MODO_SEGURO = "0";
  try {
    // 205 com 4 recusados + 1 com 429 passageiro: segue.
    zerar();
    const publico = semearCrm(205, "p");
    const recusados = publico.slice(10, 14).map((p) => p.email);
    recusados.forEach((e) => rs.recusar.add(e));
    const lenta = publico[50].email;
    rs.rateLimitUmaVez.add(lenta);
    const idOk = semearCampanha();

    const r = await dispararCampanha(idOk, "beta");
    const camp = tabela("campanhas").find((c) => c.id === idOk)!;
    const [envio] = auditoria(idOk, "auditoria.envio");
    const detalhe = (envio?.raw_payload ?? {}) as {
      ficaram_de_fora?: number;
      ficaram_de_fora_detalhe?: { email: string }[];
      congelados?: number;
    };
    const listados = (detalhe.ficaram_de_fora_detalhe ?? []).map((f) => f.email).sort();

    check(
      "4.2 205 com 4 falhas: segue e registra os 4",
      r.ok &&
        camp.estado === "enviada" &&
        rs.broadcasts.length === 1 &&
        detalhe.ficaram_de_fora === 4 &&
        listados.join(",") === [...recusados].sort().join(",") &&
        detalhe.congelados === 201,
      `ok=${r.ok}, estado=${String(camp.estado)}, broadcasts=${rs.broadcasts.length}, ` +
        `ficaram de fora=${detalhe.ficaram_de_fora} [${listados.join(", ")}], congelados=${detalhe.congelados}`,
    );

    const segmento = rs.membros.get(rs.broadcasts[0]?.segment_id ?? "") ?? [];
    const lentaNoSegmento = segmento.some((id) => rs.contatos.get(id)?.email === lenta);
    check(
      "4.3 o contato do 429 entrou no envio",
      r.ok && r.enviados === 201 && lentaNoSegmento && !listados.includes(lenta),
      `enviados=${r.ok ? r.enviados : "-"}, ${lenta} no segmento=${lentaNoSegmento}, membresia=${segmento.length}`,
    );

    // 205 com 11 recusados: aborta antes do broadcast.
    zerar();
    const publico2 = semearCrm(205, "q");
    const recusados2 = publico2.slice(100, 111).map((p) => p.email);
    recusados2.forEach((e) => rs.recusar.add(e));
    const idAborta = semearCampanha();

    const r2 = await dispararCampanha(idAborta, "beta");
    const camp2 = tabela("campanhas").find((c) => c.id === idAborta)!;
    const [recusa] = auditoria(idAborta, "auditoria.envio_recusado");
    const detalheRecusa = (recusa?.raw_payload ?? {}) as {
      emails_que_falharam?: { email: string; motivo: string }[];
      etapa?: string;
    };
    const listados2 = (detalheRecusa.emails_que_falharam ?? []).map((f) => f.email).sort();

    check(
      "4.4 205 com 11 falhas: aborta antes do broadcast",
      !r2.ok &&
        rs.broadcasts.length === 0 &&
        !rs.chamadas.some((c) => c.startsWith("POST /broadcasts")) &&
        camp2.estado === "testada" &&
        camp2.enviado_em === null &&
        auditoria(idAborta, "auditoria.envio").length === 0 &&
        tabela("campanha_destinatarios").length === 0,
      `ok=${r2.ok}, broadcasts=${rs.broadcasts.length}, estado=${String(camp2.estado)}, ` +
        `destinatários congelados=${tabela("campanha_destinatarios").length}, erro: ${r2.ok ? "-" : r2.erro}`,
    );
    check(
      "4.5 envio_recusado lista os 11",
      detalheRecusa.etapa === "espelhamento" &&
        listados2.length === 11 &&
        listados2.join(",") === [...recusados2].sort().join(",") &&
        (detalheRecusa.emails_que_falharam ?? []).every((f) => !!f.motivo),
      `etapa=${detalheRecusa.etapa}, ${listados2.length} e-mails, motivo do primeiro: ` +
        `${detalheRecusa.emails_que_falharam?.[0]?.motivo}`,
    );
  } finally {
    process.env.CAMPANHAS_MODO_SEGURO = "1";
  }

  // ── 5. refletirOptOut ──────────────────────────────────────────
  console.log("\n=== 5 · Opt-out com régua única ===");
  {
    zerar();
    const [invalida, ativa, homonima] = semearCrm(3, "opt");
    Object.assign(contatoCrm(invalida.contactId), {
      email_marketing_status: "invalido",
      email_marketing_status_em: "2026-08-01T00:00:00.000Z",
      email_marketing_status_origem: "bounce",
    });

    const segId = "seg-opt";
    const ids = [invalida, ativa, homonima].map((p) => {
      const id = novoId();
      rs.contatos.set(id, {
        object: "contact",
        id,
        email: p.email,
        first_name: null,
        last_name: null,
        unsubscribed: true,
        created_at: "2026-01-01",
      });
      return id;
    });
    rs.membros.set(segId, ids);

    const antesDaAtiva = Date.now();
    const marcados = await refletirOptOut(segId, [
      { contactId: invalida.contactId, email: invalida.email },
      { contactId: ativa.contactId, email: ativa.email },
      // Destinatário de teste com o MESMO e-mail de um contato real.
      { contactId: null, email: homonima.email },
    ]);

    const ci = contatoCrm(invalida.contactId);
    check(
      "5.1 contato inválido não muda",
      ci.email_marketing_status === "invalido" &&
        ci.email_marketing_status_origem === "bounce" &&
        ci.email_marketing_status_em === "2026-08-01T00:00:00.000Z",
      `status=${ci.email_marketing_status}, origem=${ci.email_marketing_status_origem}, em=${ci.email_marketing_status_em}`,
    );

    const ca = contatoCrm(ativa.contactId);
    check(
      "5.2 contato ativo vira descadastrado com _em e _origem",
      ca.email_marketing_status === "descadastrado" &&
        ca.email_marketing_status_origem === "descadastro" &&
        Date.parse(String(ca.email_marketing_status_em)) >= antesDaAtiva - 1000 &&
        marcados === 1,
      `status=${ca.email_marketing_status}, origem=${ca.email_marketing_status_origem}, ` +
        `em=${ca.email_marketing_status_em}, marcados=${marcados}`,
    );

    const ch = contatoCrm(homonima.contactId);
    check(
      "5.3 destinatário de teste não descadastra o contato real de mesmo e-mail",
      ch.email_marketing_status === "legitimo_interesse",
      `status do contato real=${ch.email_marketing_status}`,
    );
  }

  // ── 6. CAMP-fix-2 ──────────────────────────────────────────────
  console.log("\n=== 6 · CAMP-fix-2 ===");
  {
    // `contarPublicoAction` exige sessão (requireRole) e não roda fora do Next;
    // ela devolve `{ ...contarPublico(), ...resumoModoSeguro() }`, então o que
    // se prova aqui é a peça que decide o que o modal recebe.
    let ligado: ReturnType<typeof resumoModoSeguro>;
    let desligado: ReturnType<typeof resumoModoSeguro>;
    process.env.CAMPANHAS_EMAILS_TESTE = "Alguem@Beta.invalid";
    try {
      process.env.CAMPANHAS_MODO_SEGURO = "1";
      ligado = resumoModoSeguro();
      process.env.CAMPANHAS_MODO_SEGURO = "0";
      desligado = resumoModoSeguro();
    } finally {
      process.env.CAMPANHAS_MODO_SEGURO = "1";
      delete process.env.CAMPANHAS_EMAILS_TESTE;
    }
    check(
      "6.1 recontagem do modal leva a trava e os endereços",
      ligado.modoSeguro === true &&
        ligado.enderecosTeste.join(",") ===
          "delivered@resend.dev,bounced@resend.dev,alguem@beta.invalid" &&
        desligado.modoSeguro === false &&
        desligado.enderecosTeste.length === 0,
      `ligado: [${ligado.enderecosTeste.join(", ")}] · desligado: ${JSON.stringify(desligado)}`,
    );
  }

  const ehAdd = (c: string) => /^POST \/contacts\/[^/]+\/segments\/[^/]+$/.test(c);
  const ehGetContato = (c: string) => /^GET \/contacts\/[^/?]+$/.test(c);

  {
    zerar();
    const seg = "seg-novos";
    const pessoas = semearCrm(205, "novo");
    const r = await espelharContatos(pessoas, seg);
    const comSegmento = rs.creates.filter(
      (c) => c.segments.length === 1 && c.segments[0] === seg,
    ).length;
    const rec = await reconciliarSegmento(seg, r.espelhadas);
    const adds = rs.chamadas.filter(ehAdd).length;
    check(
      "6.2 205 novos nascem no segmento: 205 creates com segmento, zero add",
      r.espelhadas.length === 205 &&
        rs.creates.length === 205 &&
        comSegmento === 205 &&
        adds === 0 &&
        rec.adicionados === 0 &&
        rs.membros.get(seg)?.length === 205,
      `${rs.creates.length} creates (${comSegmento} com o segmento), ${adds} add, ` +
        `reconciliação adicionou ${rec.adicionados}, membresia ${rs.membros.get(seg)?.length}`,
    );
  }

  async function existentes(dentro: boolean) {
    zerar();
    const seg = dentro ? "seg-dentro" : "seg-fora";
    const pessoas = semearCrm(100, dentro ? "dentro" : "fora");
    const ids = pessoas.map((p) => {
      const id = novoId();
      rs.contatos.set(id, {
        object: "contact",
        id,
        email: p.email,
        first_name: null,
        last_name: null,
        unsubscribed: false,
        created_at: "2026-01-01",
      });
      return id;
    });
    if (dentro) rs.membros.set(seg, [...ids]);
    const r = await espelharContatos(pessoas, seg);
    const rec = await reconciliarSegmento(seg, r.espelhadas);
    return {
      espelhadas: r.espelhadas.length,
      gets: rs.chamadas.filter(ehGetContato).length,
      adds: rs.chamadas.filter(ehAdd).length,
      adicionados: rec.adicionados,
      membresia: rs.membros.get(seg)?.length ?? 0,
    };
  }

  const fora = await existentes(false);
  check(
    "6.3 100 já existentes FORA do segmento: 100 get + 100 add",
    fora.espelhadas === 100 &&
      fora.gets === 100 &&
      fora.adds === 100 &&
      fora.adicionados === 100 &&
      fora.membresia === 100,
    JSON.stringify(fora),
  );

  const dentro = await existentes(true);
  check(
    "6.4 100 já existentes DENTRO do segmento: 100 get + zero add",
    dentro.espelhadas === 100 &&
      dentro.gets === 100 &&
      dentro.adds === 0 &&
      dentro.adicionados === 0 &&
      dentro.membresia === 100,
    JSON.stringify(dentro),
  );

  {
    // Pipeline inteiro em MODO SEGURO (fetch selado): segmento antes do create.
    zerar();
    semearCrm(3, "real");
    const id = semearCampanha();
    const r = await dispararCampanha(id, "beta");
    const primeiroSegmento = rs.chamadas.findIndex(
      (c) => c.startsWith("GET /segments?") || c === "POST /segments",
    );
    const primeiroCreate = rs.chamadas.indexOf("POST /contacts");
    const segModo = rs.segmentos.find((s) => s.name === "Spinhardi · MODO SEGURO (teste)")?.id;
    check(
      "6.5 dispararCampanha resolve o segmento antes de espelhar",
      r.ok &&
        r.modoSeguro &&
        primeiroSegmento >= 0 &&
        primeiroSegmento < primeiroCreate &&
        rs.creates.length === 2 &&
        rs.creates.every((c) => c.segments[0] === segModo) &&
        rs.chamadas.filter(ehAdd).length === 0,
      `ok=${r.ok}, 1ª chamada de segmento na posição ${primeiroSegmento}, 1º create na ${primeiroCreate}, ` +
        `creates=${rs.creates.length} no segmento do modo seguro, adds=${rs.chamadas.filter(ehAdd).length}`,
    );
  }

  check(
    "6.6 abertura não medida devolve null com base; clique devolve número",
    RASTREIO_ABERTURA === false &&
      !metricaMedida("abertura") &&
      taxaDe("abertura", 3, 4) === null &&
      metricaMedida("clique") &&
      taxaDe("clique", 1, 4) === 25,
    `abertura com 3 de 4 entregues: ${taxaDe("abertura", 3, 4)} · clique 1 de 4: ${taxaDe("clique", 1, 4)}%`,
  );

  check(
    "0.2 nenhuma chamada tentou sair do processo",
    bloqueadas.length === 0,
    bloqueadas.length ? bloqueadas.join(", ") : "0 bloqueios durante os checks",
  );

  const falhas = resultados.filter((r) => !r.ok);
  console.log(
    `\n${resultados.length - falhas.length}/${resultados.length} checks passaram.` +
      (falhas.length ? ` FALHAS: ${falhas.map((f) => f.n).join(", ")}` : " Nenhuma falha."),
  );
  process.exit(falhas.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("β FALHOU:", err);
  process.exit(1);
});
