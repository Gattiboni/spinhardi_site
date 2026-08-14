/**
 * Sonda Iddas — onde vive a APLICAÇÃO das etiquetas (etiqueta ↔ registro)
 *
 * A bronze já tem o CATÁLOGO (`bronze_iddas_etiqueta`, 20 linhas, com `tipo`
 * P/C). O que não existe em lugar nenhum da bronze é o VÍNCULO: varredura SQL
 * nos payloads de pessoa/orcamento/solicitacao/venda/tarefa não achou nenhuma
 * chave `%etiq%`/`%tag%`/`%label%`. Esta sonda descobre se a API expõe esse
 * vínculo em algum lugar que o sync não consome hoje.
 *
 * READ-ONLY ABSOLUTO: só GET contra o Iddas (o único POST é o /auth/login do
 * próprio transporte do sync, necessário pra obter o bearer). Zero escrita no
 * Supabase — as leituras da bronze servem só pra amostrar ids.
 *
 * Responde:
 *   P1 — de onde vem a aplicação? (detalhe vs lista → params de expansão →
 *        endpoint dedicado → filtro por etiqueta na lista)
 *   P2 — o que significam os tipos P e C
 *   P3 — volume real de uso (ordem de grandeza, por amostra)
 *   P4 — shape do vínculo (id? nome? objeto? array?)
 *
 * Orçamento: teto de MAX_CALLS chamadas GET, pausa >= 1s entre elas (600ms
 * daqui + 500ms do PAUSE_MS do transporte). Aborta após 3 falhas seguidas.
 * O contador é de chamadas LÓGICAS: o transporte reexecuta 429/5xx por conta
 * própria (RETRY_DELAYS), então uma chamada que falha com 500 vale até 4
 * requests HTTP. O teto continua valendo pro que a sonda pede, não pro retry.
 *
 * Reusa client/auth do sync por IMPORT (`createIddasTransport`), sem alterar o
 * módulo. Envs: as mesmas do sync (IDDAS_API_URL, IDDAS_API_KEY,
 * SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Uso:
 *   npx tsx scripts/sonda-iddas-etiquetas.ts             # sonda completa
 *   npx tsx scripts/sonda-iddas-etiquetas.ts --verbose   # log do transporte
 *   npx tsx scripts/sonda-iddas-etiquetas.ts --amostra=3 # ids por entidade (default 5)
 *   npx tsx scripts/sonda-iddas-etiquetas.ts --censo     # filtra por TODAS as etiquetas
 *                                                        # do catálogo (censo exato de uso)
 *
 * Não grava arquivo nenhum: o relatório sai em stdout.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createConsoleLogger, resolveIddasConfig, IngestionConfigError } from "@/lib/ingestion";
import { createIddasTransport } from "@/lib/ingestion/iddas/transport";
import { createSupabaseRest } from "@/lib/ingestion/supabase-rest";

// ─── Carregar .env.local (mesmo bloco dos outros scripts) ───────────────────

try {
  const envPath = join(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    const value = rawVal.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.error("AVISO: nao foi possivel carregar .env.local");
}

// ─── CLI args ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const CENSO = argv.includes("--censo");
const amostraArg = argv.find((a) => a.startsWith("--amostra="));
const AMOSTRA = amostraArg ? Math.max(1, Number(amostraArg.slice("--amostra=".length)) || 5) : 5;

/** Teto duro de chamadas contra o Iddas na execução inteira. */
const MAX_CALLS = 40;
/** Pausa adicional daqui; o transporte já dorme PAUSE_MS=500 antes de cada GET. */
const EXTRA_PAUSE_MS = 600;
/** Falhas consecutivas que abortam a sonda. */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Chave que "cheira" a etiqueta em qualquer nível do payload. */
const ETIQ_RE = /etiq|tag|label/i;
/** Campos PII mascarados em qualquer excerto impresso. */
const PII_RE = /nome|email|celular|telefone|cpf|cnpj|rg|passaporte|endereco|cliente/i;

// ─── Utilidades ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrai o status de um erro do transporte (`HTTP 404: {...}`). Quando o erro
 * não é HTTP (rede, ou body que não parseia como JSON — a API responde HTML em
 * alguns 4xx), devolve `ERR:<motivo>` pra não perder a causa no log.
 */
function statusFromError(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err);
  const m = msg.match(/HTTP (\d{3})/);
  return m ? m[1] : `ERR:${msg.slice(0, 120).replace(/\s+/g, " ")}`;
}

/** Caminhos de chave até `maxDepth`, pra achar etiqueta aninhada também. */
function keyPaths(value: unknown, prefix = "", depth = 0, maxDepth = 3): string[] {
  if (depth > maxDepth || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    // amostra só o primeiro elemento — arrays são homogêneos aqui
    return value.length > 0 ? keyPaths(value[0], `${prefix}[]`, depth + 1, maxDepth) : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    out.push(...keyPaths(v, path, depth + 1, maxDepth));
  }
  return out;
}

/** Mascara valores de campos PII, preservando shape pra colar no relatório. */
function mask(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((v) => mask(v, key));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mask(v, k);
    return out;
  }
  if (PII_RE.test(key) && typeof value === "string" && value !== "") return "<mascarado>";
  return value;
}

interface IddasList {
  success?: boolean;
  data?: unknown[];
  meta?: { page?: number; per_page?: number; total?: number };
}

interface CallLogEntry {
  n: number;
  url: string;
  status: string;
  keys: string;
}

// ─── Sonda ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cfg = resolveIddasConfig();
  const logger = createConsoleLogger("[sonda-etiquetas]", VERBOSE);
  const transport = createIddasTransport(cfg, logger);
  const rest = createSupabaseRest(cfg.supabase.url, cfg.supabase.key);

  const callLog: CallLogEntry[] = [];
  let calls = 0;
  let consecutiveFailures = 0;
  let aborted: string | null = null;

  /** Único ponto de saída pra rede Iddas. Só GET. Conta, pausa e loga. */
  async function get(
    path: string,
    label: string,
  ): Promise<{ ok: true; body: unknown } | { ok: false; status: string }> {
    if (aborted) return { ok: false, status: "abortado" };
    if (calls >= MAX_CALLS) {
      aborted = `teto de ${MAX_CALLS} chamadas atingido`;
      return { ok: false, status: "teto" };
    }
    const url = `${transport.apiUrl}/api/v1/${path}`;
    await sleep(EXTRA_PAUSE_MS);
    calls++;
    try {
      const body = await transport.iddasFetch(url); // GET-only por construção
      consecutiveFailures = 0;
      const top = body && typeof body === "object" ? Object.keys(body) : [];
      const dataKeys = keyPaths((body as IddasList)?.data, "data", 1, 2).slice(0, 40);
      const keys = `top=[${top.join(",")}] data=[${dataKeys.join(",")}]`;
      callLog.push({ n: calls, url: `${label} ${url}`, status: "200", keys });
      console.log(`  #${calls} GET ${url} → 200`);
      console.log(`      chaves: ${keys.slice(0, 400)}`);
      return { ok: true, body };
    } catch (err) {
      const status = statusFromError(err);
      consecutiveFailures++;
      callLog.push({ n: calls, url: `${label} ${url}`, status, keys: "—" });
      console.log(`  #${calls} GET ${url} → ${status}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = `${MAX_CONSECUTIVE_FAILURES} falhas consecutivas (última: ${status})`;
      }
      return { ok: false, status };
    }
  }

  /** Chaves de um payload que casam com etiqueta/tag/label, em qualquer nível. */
  function etiqHits(payload: unknown): string[] {
    return keyPaths(payload, "", 0, 3).filter((p) => ETIQ_RE.test(p.split(".").pop() ?? ""));
  }

  // ── Passo 0: catálogo de etiquetas (leitura da bronze, sem gastar chamada) ──

  logger.sep("Passo 0 — catálogo de etiquetas (bronze, leitura)");
  const catRes = await rest.sbFetch("/bronze_iddas_etiqueta", {
    queryParams: { select: "id,nome,raw_payload", limit: "50" },
  });
  const catalogo = (Array.isArray(catRes.body) ? catRes.body : []) as {
    id: string;
    nome: string;
    raw_payload: Record<string, unknown>;
  }[];
  const porTipo = new Map<string, { id: string; nome: string }[]>();
  for (const e of catalogo) {
    const tipo = String(e.raw_payload?.tipo ?? "?");
    if (!porTipo.has(tipo)) porTipo.set(tipo, []);
    porTipo.get(tipo)!.push({ id: e.id, nome: e.nome });
  }
  console.log(`Catálogo: ${catalogo.length} etiquetas`);
  for (const [tipo, list] of porTipo) {
    console.log(
      `  tipo=${tipo}: ${list.length} — ex: ${list
        .slice(0, 3)
        .map((x) => `${x.id}/${x.nome}`)
        .join(" | ")}`,
    );
  }

  // ── Passo 1: amostrar ids da bronze (leitura, sem gastar chamada) ───────────

  logger.sep("Passo 1 — amostrar ids (bronze, leitura)");
  async function amostrarIds(table: string): Promise<string[]> {
    const r = await rest.sbFetch(`/${table}`, {
      queryParams: { select: "id", order: "id.desc", limit: String(AMOSTRA) },
    });
    const rows = (Array.isArray(r.body) ? r.body : []) as { id: string }[];
    return rows.map((x) => String(x.id));
  }
  const pessoaIds = await amostrarIds("bronze_iddas_pessoa");
  const orcamentoIds = await amostrarIds("bronze_iddas_orcamento");
  console.log(`pessoa: ${pessoaIds.length} ids | orcamento: ${orcamentoIds.length} ids`);

  // ── Passo 2: baseline das LISTAS ───────────────────────────────────────────

  logger.sep("Passo 2 — baseline: chaves das listas");
  const baseline: Record<string, { keys: Set<string>; total: number; hits: string[] }> = {};
  for (const recurso of ["pessoa", "orcamento"]) {
    const r = await get(`${recurso}?page=1`, `[lista ${recurso}]`);
    if (!r.ok) continue;
    const body = r.body as IddasList;
    const first = (body.data ?? [])[0];
    baseline[recurso] = {
      keys: new Set(first ? Object.keys(first as Record<string, unknown>) : []),
      total: Number(body.meta?.total ?? 0),
      hits: etiqHits(body.data),
    };
    console.log(
      `  ${recurso}: total=${baseline[recurso].total}, ${baseline[recurso].keys.size} chaves no item`,
    );
    console.log(
      `  etiqueta na lista? ${baseline[recurso].hits.length ? baseline[recurso].hits.join(",") : "NÃO"}`,
    );
  }

  // ── Passo 3 (P1.1) — DETALHE vs LISTA ──────────────────────────────────────

  logger.sep("Passo 3 (P1.1) — detalhe vs lista");
  const detalhes: {
    recurso: string;
    id: string;
    novasChaves: string[];
    /** chaves que casam com etiqueta/tag/label — presença do CAMPO. */
    hits: string[];
    /** quantas etiquetas de fato aplicadas — `etiquetas: []` conta 0. */
    aplicadas: number;
    excerto: unknown;
  }[] = [];

  for (const [recurso, ids] of [
    ["pessoa", pessoaIds],
    ["orcamento", orcamentoIds],
  ] as const) {
    for (const id of ids) {
      const r = await get(`${recurso}/${id}`, `[detalhe ${recurso}]`);
      if (!r.ok) continue;
      const data = (r.body as { data?: unknown }).data;
      const chaves = data && typeof data === "object" ? Object.keys(data as object) : [];
      const novas = chaves.filter((k) => !baseline[recurso]?.keys.has(k));
      const hits = etiqHits(data);
      const excerto: Record<string, unknown> = {};
      let aplicadas = 0;
      for (const h of hits) {
        const rootKey = h.split(".")[0].replace("[]", "");
        const valor = (data as Record<string, unknown>)[rootKey];
        excerto[rootKey] = mask(valor, rootKey);
        // campo presente e vazio (`etiquetas: []`) NÃO é etiqueta aplicada
        if (Array.isArray(valor)) aplicadas += valor.length;
        else if (valor !== null && valor !== undefined && valor !== "") aplicadas += 1;
      }
      detalhes.push({ recurso, id, novasChaves: novas, hits, aplicadas, excerto });
      console.log(
        `  ${recurso}/${id}: +${novas.length} chaves vs lista${novas.length ? ` (${novas.join(",")})` : ""} | campo etiqueta: ${hits.length ? hits.join(",") : "não"} | aplicadas: ${aplicadas}`,
      );
    }
  }

  const detalheAchou = detalhes.some((d) => d.hits.length > 0);

  // ── Passo 4 (P1.2) — parâmetros de expansão (só se o detalhe não achou) ────

  const expansao: { param: string; status: string; achou: boolean }[] = [];
  if (!detalheAchou && !aborted && orcamentoIds.length > 0) {
    logger.sep("Passo 4 (P1.2) — parâmetros de expansão");
    console.log("  (a spec do repo não declara include/expand/with/fields — teste às cegas)");
    const alvo = orcamentoIds[0];
    for (const param of ["include=etiquetas", "expand=etiquetas", "with=etiquetas"]) {
      const r = await get(`orcamento/${alvo}?${param}`, `[expansao]`);
      const achou = r.ok && etiqHits((r.body as { data?: unknown }).data).length > 0;
      expansao.push({ param, status: r.ok ? "200" : r.status, achou });
      console.log(`  ?${param} → ${r.ok ? "200" : r.status} | etiqueta: ${achou ? "SIM" : "não"}`);
      if (achou) break;
    }
  }

  // ── Passo 5 (P1.3) — endpoint dedicado ─────────────────────────────────────
  // A spec do repo (docs/misc_etls/api_iddas_full.json, 56 paths) só expõe
  // /etiqueta e /etiqueta/{id}. Não há rota de aplicação — nada a chamar aqui.

  logger.sep("Passo 5 (P1.3) — endpoint dedicado de aplicação");
  console.log(
    "  spec (56 paths): apenas /etiqueta e /etiqueta/{id}. Nenhuma rota de vínculo — 0 chamadas.",
  );

  // ── Passo 6 (P1.4) — filtro por etiqueta na lista ──────────────────────────

  logger.sep("Passo 6 (P1.4) — filtro por etiqueta na lista");
  const filtros: {
    recurso: string;
    param: string;
    etiqueta: string;
    nome: string;
    status: string;
    total: number | null;
    baselineTotal: number;
    hits: string[];
  }[] = [];

  const alvosFiltro: { recurso: "pessoa" | "orcamento"; tipo: string; param: string }[] = [
    { recurso: "pessoa", tipo: "P", param: "etiqueta" },
    { recurso: "orcamento", tipo: "C", param: "etiqueta" },
  ];

  // Sem --censo: 2 etiquetas por tipo (barato). Com --censo: o catálogo inteiro,
  // que dá o número exato de registros por etiqueta — 20 chamadas.
  let nameFallbackFeito = false;

  for (const alvo of alvosFiltro) {
    const todas = porTipo.get(alvo.tipo) ?? [];
    const candidatas = CENSO ? todas : todas.slice(0, 2);
    for (const et of candidatas) {
      const r = await get(
        `${alvo.recurso}?page=1&${alvo.param}=${encodeURIComponent(et.id)}`,
        `[filtro ${alvo.recurso}]`,
      );
      const body = r.ok ? (r.body as IddasList) : null;
      filtros.push({
        recurso: alvo.recurso,
        param: alvo.param,
        etiqueta: et.id,
        nome: et.nome,
        status: r.ok ? "200" : r.status,
        total: body ? Number(body.meta?.total ?? 0) : null,
        baselineTotal: baseline[alvo.recurso]?.total ?? 0,
        hits: body ? etiqHits(body.data) : [],
      });
      console.log(
        `  ${alvo.recurso}?${alvo.param}=${et.id} ("${et.nome}") → ${r.ok ? "200" : r.status} | total=${body ? body.meta?.total : "—"} (sem filtro: ${baseline[alvo.recurso]?.total ?? "?"})`,
      );

      // total=0 é ambíguo: ou ninguém tem a etiqueta, ou o filtro não aceita id.
      // Uma vez só, repete pelo NOME pra desambiguar (a spec só diz "string").
      const zero = r.ok && Number(body?.meta?.total ?? 0) === 0;
      if (zero && !nameFallbackFeito && !aborted) {
        nameFallbackFeito = true;
        const rn = await get(
          `${alvo.recurso}?page=1&${alvo.param}=${encodeURIComponent(et.nome)}`,
          `[filtro por nome]`,
        );
        const bn = rn.ok ? (rn.body as IddasList) : null;
        console.log(
          `  ↳ desambiguação por nome: ${alvo.recurso}?${alvo.param}=${et.nome} → ${rn.ok ? "200" : rn.status} | total=${bn ? bn.meta?.total : "—"}`,
        );
      }
    }
  }

  // `tag` é sinônimo declarado na spec só pra /orcamento — confirma se filtra igual.
  if (!aborted) {
    const et = (porTipo.get("C") ?? [])[0];
    if (et) {
      const r = await get(`orcamento?page=1&tag=${encodeURIComponent(et.id)}`, `[filtro tag]`);
      const body = r.ok ? (r.body as IddasList) : null;
      filtros.push({
        recurso: "orcamento",
        param: "tag",
        etiqueta: et.id,
        nome: et.nome,
        status: r.ok ? "200" : r.status,
        total: body ? Number(body.meta?.total ?? 0) : null,
        baselineTotal: baseline.orcamento?.total ?? 0,
        hits: body ? etiqHits(body.data) : [],
      });
      console.log(
        `  orcamento?tag=${et.id} → ${r.ok ? "200" : r.status} | total=${body ? body.meta?.total : "—"}`,
      );
    }
  }

  // ── Relatório ──────────────────────────────────────────────────────────────

  logger.sep("RESUMO");
  console.log(
    `Chamadas GET ao Iddas: ${calls}/${MAX_CALLS}${aborted ? ` — ABORTADA: ${aborted}` : ""}`,
  );
  console.log(`\nP1 — aplicação no DETALHE? ${detalheAchou ? "SIM" : "NÃO"}`);
  // preenchidos primeiro — um `etiquetas: []` não mostra shape nenhum
  const comCampoOrdenado = detalhes
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.aplicadas - a.aplicadas);
  for (const d of comCampoOrdenado.slice(0, 4)) {
    console.log(`  ${d.recurso}/${d.id} → ${d.hits.join(",")} (${d.aplicadas} aplicada(s))`);
    console.log(`    ${JSON.stringify(d.excerto).slice(0, 600)}`);
  }
  if (expansao.length) {
    console.log(
      `P1 — params de expansão: ${expansao.map((e) => `${e.param}=${e.status}/${e.achou ? "achou" : "não"}`).join(" | ")}`,
    );
  }
  console.log(
    `P1 — filtro por etiqueta: ${filtros.map((f) => `${f.recurso}?${f.param}=${f.etiqueta}→${f.status} total=${f.total}/${f.baselineTotal}`).join(" | ")}`,
  );

  const filtraDeVerdade = filtros.filter(
    (f) => f.status === "200" && f.total !== null && f.total < f.baselineTotal,
  );
  console.log(
    `\nP2 — tipos: spec declara C=Cotação, P=Pessoa. Filtro coerente? ${
      filtraDeVerdade.length
        ? filtraDeVerdade.map((f) => `${f.recurso}/${f.etiqueta}=${f.total}`).join(", ")
        : "sem evidência"
    }`,
  );

  const comCampo = detalhes.filter((d) => d.hits.length > 0);
  const comEtiqueta = detalhes.filter((d) => d.aplicadas > 0);
  console.log(
    `\nP3 — volume (amostra do detalhe): ${comEtiqueta.length}/${detalhes.length} entidades com etiqueta APLICADA` +
      ` (${comCampo.length}/${detalhes.length} expõem o campo)`,
  );
  for (const f of filtros.filter((x) => x.param === "etiqueta" && x.status === "200")) {
    console.log(
      `  via filtro: "${f.nome}" (${f.recurso}, id ${f.etiqueta}) → ${f.total} registros`,
    );
  }
  if (CENSO) {
    for (const recurso of ["pessoa", "orcamento"]) {
      const doRecurso = filtros.filter(
        (f) => f.recurso === recurso && f.param === "etiqueta" && f.status === "200",
      );
      if (!doRecurso.length) continue;
      const soma = doRecurso.reduce((a, f) => a + (f.total ?? 0), 0);
      const usadas = doRecurso.filter((f) => (f.total ?? 0) > 0).length;
      // soma = aplicações (uma entidade com N etiquetas conta N vezes), não entidades distintas.
      console.log(
        `  CENSO ${recurso}: ${soma} aplicações em ${doRecurso.length} etiquetas (${usadas} em uso) — universo ${baseline[recurso]?.total ?? "?"}`,
      );
    }
  }

  console.log(`\nP4 — shape do vínculo:`);
  if (comEtiqueta.length) {
    console.log(`  ${JSON.stringify(comEtiqueta[0].excerto).slice(0, 800)}`);
  } else {
    console.log(`  sem vínculo em payload de leitura — ver filtros acima`);
  }

  console.log(`\n── LOG DE CHAMADAS (${callLog.length}) ──`);
  for (const c of callLog) console.log(`  #${c.n} GET ${c.url} → ${c.status}`);

  if (aborted) process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof IngestionConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error("ERRO FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
