/**
 * Turno Iddas B.2 — Backfill completo Iddas → Supabase (bronze)
 *
 * 22 recursos via UPSERT (on_conflict=id) + 1 snapshot puro (infosolicitacao).
 * Por padrão roda em DRY-RUN (zero INSERTs).
 * Salva output em docs/backfill-iddas-dryrun-<timestamp>.json
 *
 * Uso:
 *   npx tsx scripts/backfill-iddas.ts                        # dry-run
 *   npx tsx scripts/backfill-iddas.ts --apply                # grava
 *   npx tsx scripts/backfill-iddas.ts --verbose              # log extra
 *   npx tsx scripts/backfill-iddas.ts --only=pessoa,voo      # só esses (CSV)
 *   npx tsx scripts/backfill-iddas.ts --skip=aeroporto       # pula esses (CSV)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// ─── Carregar .env.local ────────────────────────────────────────────────────

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
const APPLY = argv.includes("--apply");
const VERBOSE = argv.includes("--verbose");
const DRY_RUN = !APPLY;

const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY_RESOURCES = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()))
  : null;

const skipArg = argv.find((a) => a.startsWith("--skip="));
const SKIP_RESOURCES = new Set(
  skipArg ? skipArg.slice("--skip=".length).split(",").map((s) => s.trim()) : [],
);

type Resource =
  | "canal"
  | "situacao"
  | "motivoreprovacao"
  | "etiqueta"
  | "usuario"
  | "conta"
  | "cartao"
  | "categoriareceitasdespesas"
  | "aeroporto"
  | "companhia"
  | "pessoa"
  | "orcamento"
  | "venda"
  | "receita"
  | "despesa"
  | "tarefa"
  | "voo"
  | "cruzeiro"
  | "hospedagem"
  | "seguro"
  | "transporte"
  | "solicitacao"
  | "infosolicitacao";

function shouldRun(resource: Resource): boolean {
  if (SKIP_RESOURCES.has(resource)) return false;
  if (!ONLY_RESOURCES) return true;
  return ONLY_RESOURCES.has(resource);
}

// ─── Config ─────────────────────────────────────────────────────────────────

const IDDAS_URL = (process.env.IDDAS_API_URL ?? "").replace(/\/$/, "");
const IDDAS_API_KEY = process.env.IDDAS_API_KEY ?? "";
const SB_URL = (
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
).replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!IDDAS_URL || !IDDAS_API_KEY) {
  console.error("ERRO: IDDAS_API_URL ou IDDAS_API_KEY nao definidas.");
  process.exit(1);
}
if (!SB_URL || !SB_KEY) {
  console.error(
    "ERRO: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidas.",
  );
  process.exit(1);
}

const PAUSE_MS = 300;
const RETRY_DELAYS = [500, 1000, 2000];

// ─── Tipos ──────────────────────────────────────────────────────────────────

type IngestionSource = "backfill" | "sync" | "webhook";

interface BronzeIngestionMeta {
  ingested_at: string;
  ingestion_run_id: string;
  ingestion_source: IngestionSource;
}

interface ResourceResult {
  fetched: number;
  mapped: number;
  would_insert: number;
  actual_inserted?: number;
  pages?: number;
  expected?: number;
  sample?: unknown;
}

// ─── Estado do run ────────────────────────────────────────────────────────────

const results: Record<string, ResourceResult> = {};
const runErrors: Array<{ resource: string; message: string }> = [];

function recordResult(resource: string, r: ResourceResult): void {
  results[resource] = r;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string): void {
  console.log(`[backfill-iddas] ${msg}`);
}

function verbose(msg: string): void {
  if (VERBOSE) console.log(`  [verbose] ${msg}`);
}

function sep(label: string): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

function buildAudit(runId: string): BronzeIngestionMeta {
  return {
    ingested_at: new Date().toISOString(),
    ingestion_run_id: runId,
    ingestion_source: "backfill",
  };
}

// ─── Normalizações ────────────────────────────────────────────────────────────

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val);
  return s === "" ? null : s;
}

function normalizeDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  return s;
}

// Converte dd/MM/yyyy → yyyy-MM-dd; outros formatos passam por normalizeDate
function parseDateBR(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return normalizeDate(val);
}

function parseMonetary(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val));
  if (isNaN(n)) return null;
  return Number(n.toFixed(2));
}

function parseBool(val: unknown): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase().trim();
  if (s === "s" || s === "1" || s === "true" || s === "sim") return true;
  if (s === "n" || s === "0" || s === "false" || s === "nao" || s === "não") return false;
  return null;
}

// Extrai código IATA de "São Paulo (GRU)" → "GRU"
function extractIATA(airport: unknown): string | null {
  if (!airport || typeof airport !== "string") return null;
  const m = airport.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : null;
}

// ─── Token management ─────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let tokenCache: TokenCache | null = null;

async function getValidToken(): Promise<string> {
  const now = Date.now();
  const BUFFER_MS = 5 * 60 * 1000; // renova se faltar menos de 5 min

  if (tokenCache && tokenCache.expiresAt - now > BUFFER_MS) {
    return tokenCache.token;
  }

  verbose("Obtendo novo token Iddas...");
  const res = await fetch(`${IDDAS_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chave: IDDAS_API_KEY }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Login Iddas falhou: HTTP ${res.status} — ${errBody}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  if (!data.success || !data.access_token) {
    throw new Error(`Login Iddas: resposta inesperada: ${JSON.stringify(data)}`);
  }

  let expiresAt: number;
  try {
    const parts = data.access_token.split(".");
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as {
      exp?: number;
    };
    expiresAt = payload.exp ? payload.exp * 1000 : now + data.expires_in * 1000;
  } catch {
    expiresAt = now + data.expires_in * 1000;
  }

  tokenCache = { token: data.access_token, expiresAt };
  const keyPreview = IDDAS_API_KEY.slice(0, 4) + "...";
  log(`Token obtido (key: ${keyPreview}), expira ${new Date(expiresAt).toISOString()}`);

  return tokenCache.token;
}

// ─── HTTP: Iddas API ──────────────────────────────────────────────────────────

async function iddasFetch(url: string): Promise<unknown> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    await sleep(PAUSE_MS);
    const token = await getValidToken(); // verifica expiração antes de cada chamada
    verbose(`GET ${url} (attempt ${attempt + 1})`);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        let errBody: unknown;
        try {
          errBody = await res.json();
        } catch {
          errBody = await res.text();
        }
        if (attempt < RETRY_DELAYS.length && (res.status === 429 || res.status >= 500)) {
          verbose(`  HTTP ${res.status}, retry em ${RETRY_DELAYS[attempt]}ms`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        verbose(`  Erro de rede: ${String(err)}, retry em ${RETRY_DELAYS[attempt]}ms`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Todas as tentativas falharam: ${url}`);
}

interface IddasList {
  success: boolean;
  data: unknown[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    next: string | null;
    previous: string | null;
  };
}

async function fetchAllPages(
  resourcePath: string,
): Promise<{ items: unknown[]; total: number; pages: number }> {
  const items: unknown[] = [];
  let page = 1;
  let reportedTotal = 0;
  let pageCount = 0;

  while (true) {
    // Não usa meta.next (Quirk 1: URL interna index.php quebrada)
    const url = `${IDDAS_URL}/api/v1/${resourcePath}?page=${page}`;
    const body = (await iddasFetch(url)) as IddasList;
    const pageItems: unknown[] = Array.isArray(body?.data) ? body.data : [];
    pageCount++;

    if (page === 1) {
      reportedTotal = Number(body?.meta?.total ?? 0);
      verbose(`  Total declarado: ${reportedTotal}`);
      // Quirk 2: recursos vazios retornam total=0 mas next não-null
      if (reportedTotal === 0) {
        verbose(`  Recurso vazio (total=0) — parando`);
        break;
      }
    }

    if (pageItems.length === 0) break;
    items.push(...pageItems);
    verbose(
      `  Página ${page}: +${pageItems.length} (acumulado: ${items.length}/${reportedTotal})`,
    );

    if (items.length >= reportedTotal) break;
    page++;
  }

  return { items, total: reportedTotal, pages: pageCount };
}

// ─── Supabase ──────────────────────────────────────────────────────────────────

const SB_HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbFetch(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    queryParams?: Record<string, string>;
    prefer?: string;
  } = {},
): Promise<{ status: number; body: unknown }> {
  let url = `${SB_URL}/rest/v1${path}`;
  if (opts.queryParams) {
    const qs = new URLSearchParams(opts.queryParams).toString();
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = { ...SB_HEADERS };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { status: res.status, body: resBody };
}

async function sbUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };
  const { status, body } = await sbFetch(`/${table}`, {
    method: "POST",
    body: rows,
    queryParams: { on_conflict: onConflict },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  if (status >= 200 && status < 300) return { inserted: rows.length };
  return { inserted: 0, error: `HTTP ${status}: ${JSON.stringify(body)}` };
}

async function sbInsert(
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };
  const { status, body } = await sbFetch(`/${table}`, {
    method: "POST",
    body: rows,
    prefer: "return=minimal",
  });
  if (status >= 200 && status < 300) return { inserted: rows.length };
  return { inserted: 0, error: `HTTP ${status}: ${JSON.stringify(body)}` };
}

// ─── Ingestion log ──────────────────────────────────────────────────────────────

async function logIngestionStart(runId: string): Promise<void> {
  try {
    const { status } = await sbFetch("/ingestion_log", {
      method: "POST",
      body: {
        id: runId,
        source_system: "iddas",
        ingestion_type: "backfill",
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: "codinho:backfill-iddas",
      },
      prefer: "return=minimal",
    });
    if (status >= 200 && status < 300) {
      verbose(`ingestion_log start OK (run_id=${runId})`);
    } else {
      log(`AVISO: ingestion_log INSERT HTTP ${status}`);
    }
  } catch (err) {
    log(`AVISO: ingestion_log start falhou: ${String(err)}`);
  }
}

async function logIngestionEnd(
  runId: string,
  finalStatus: "completed" | "failed" | "partial",
  counts: Record<string, number>,
  durationMs: number,
  errorMsg: string | null,
): Promise<void> {
  try {
    // Tabela não tem coluna duration_ms — vai dentro de counts
    const { status } = await sbFetch("/ingestion_log", {
      method: "PATCH",
      body: {
        status: finalStatus,
        finished_at: new Date().toISOString(),
        counts: { ...counts, _duration_ms: durationMs },
        error_message: errorMsg,
      },
      queryParams: { id: `eq.${runId}` }, // PK é "id"
    });
    if (status < 200 || status >= 300) {
      log(`AVISO: ingestion_log PATCH HTTP ${status}`);
    }
  } catch (err) {
    log(`AVISO: ingestion_log end falhou: ${String(err)}`);
  }
}

// ─── Processor genérico ────────────────────────────────────────────────────────

type Mapper = (
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
) => Record<string, unknown>;

async function fetchAndProcess(
  resource: Resource,
  resourcePath: string,
  tableName: string,
  expectedTotal: number,
  mapper: Mapper,
  runId: string,
  isSnapshot = false,
): Promise<void> {
  sep(`${resource} → ${tableName}`);
  const audit = buildAudit(runId);

  let items: unknown[];
  let total: number;
  let pages: number;

  try {
    const result = await fetchAllPages(resourcePath);
    items = result.items;
    total = result.total;
    pages = result.pages;
  } catch (err) {
    const msg = `Falha ao buscar ${resource}: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource, message: msg });
    recordResult(resource, { fetched: 0, mapped: 0, would_insert: 0, expected: expectedTotal });
    return;
  }

  if (expectedTotal > 0 && total !== expectedTotal) {
    log(`BANDEIRA: esperado ${expectedTotal}, meta.total=${total}`);
    runErrors.push({
      resource,
      message: `total inesperado: ${total} (esperado ${expectedTotal})`,
    });
  }

  const rows: Record<string, unknown>[] = [];
  let mapFailures = 0;
  for (const item of items) {
    try {
      rows.push(mapper(item as Record<string, unknown>, audit));
    } catch (err) {
      mapFailures++;
      verbose(`  Mapper falhou: ${String(err)}`);
    }
  }
  if (mapFailures > 0) {
    const msg = `${mapFailures} item(ns) falharam no mapper`;
    log(`AVISO: ${msg}`);
    runErrors.push({ resource, message: msg });
  }

  log(
    `API: ${items.length} fetchados (meta.total=${total}, esperado=${expectedTotal}) em ${pages} página(s)`,
  );
  recordResult(resource, {
    fetched: items.length,
    mapped: rows.length,
    would_insert: rows.length,
    pages,
    expected: expectedTotal,
    sample: rows[0],
  });

  if (DRY_RUN) {
    log(
      `[dry-run] ${rows.length} rows seriam ${isSnapshot ? "inseridas" : "upsertadas"} em ${tableName}`,
    );
    return;
  }

  const r = isSnapshot
    ? await sbInsert(tableName, rows)
    : await sbUpsert(tableName, rows, "id");

  if (r.error) {
    const msg = `Falha ao ${isSnapshot ? "inserir" : "upsert"} ${resource}: ${r.error}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource, message: msg });
  } else {
    log(`${isSnapshot ? "Insert" : "Upsert"}: ${r.inserted} rows em ${tableName}`);
  }
  results[resource].actual_inserted = r.inserted;
}

// ─── Mappers por recurso ───────────────────────────────────────────────────────

function mapCanal(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapSituacao(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    cor: str(item.cor),
    codigo: str(item.codigo),
    ordem: item.ordem != null ? Number(item.ordem) : null,
    situacao_final: parseBool(item.situacao_final),
    situacao_padrao: parseBool(item.situacao_padrao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapMotivoreprovacao(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    ativo: parseBool(item.ativo),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapEtiqueta(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    cor: str(item.cor),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapUsuario(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    situacao: str(item.situacao),
    email: str(item.email),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapConta(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    saldo_inicial: parseMonetary(item.saldo_inicial),
    agencia: str(item.agencia),
    numero_conta: str(item.numero_conta),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapCartao(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    descricao: str(item.descricao),
    digitos: str(item.digitos),
    fechamento: str(item.fechamento),  // dia do mês, não data
    vencimento: str(item.vencimento),  // dia do mês, não data
    limite: parseMonetary(item.limite),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapCategoriaReceitasDespesas(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    tipo: str(item.tipo),
    ativo: parseBool(item.ativo),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapAeroporto(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapCompanhia(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapPessoa(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    sexo: str(item.sexo),
    tipo_cliente: str(item.tipo_cliente),
    celular: str(item.celular),
    email: str(item.email),
    cpf_cnpj: str(item.cpf_cnpj),
    canal_venda: str(item.canal_venda),
    cidade: str(item.cidade),
    estado: str(item.estado),
    nascimento: normalizeDate(item.nascimento),  // 0000-00-00 → NULL
    aceita_comunicacao: str(item.aceita_comunicacao),
    observacao: str(item.observacao),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapOrcamento(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    titulo: str(item.titulo),
    identificador: str(item.identificador),
    situacao: str(item.situacao),
    nome_situacao: str(item.nome_situacao),
    cliente: str(item.cliente),
    canal_venda: str(item.canal_venda),
    usuario: str(item.usuario),
    valor: parseMonetary(item.valor),
    passageiros_adulto: str(item.passageiros_adulto),
    passageiros_crianca: str(item.passageiros_crianca),
    passageiros_bebe: str(item.passageiros_bebe),
    informacoes: str(item.informacoes),
    detalhes_viagem: str(item.detalhes_viagem),
    outras_informacoes: str(item.outras_informacoes),
    data_orcamento: normalizeDate(item.data_orcamento),
    data_ultima_situacao: normalizeDate(item.data_ultima_situacao),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapVenda(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    cliente: str(item.cliente),  // Quirk 5: nome do cliente, não ID
    id_orcamento: str(item.id_orcamento),
    data: parseDateBR(item.data),  // Quirk 3: dd/MM/yyyy → ISO
    orcado: parseMonetary(item.orcado),
    custo: parseMonetary(item.custo),
    venda: parseMonetary(item.venda),  // Quirk 4: float artefato
    lucro: parseMonetary(item.lucro),
    percentual_lucro: str(item.percentual_lucro),
    comissao_mais: parseMonetary(item.comissao_mais),
    comissao_menos: parseMonetary(item.comissao_menos),
    situacao: str(item.situacao),
    vencimento: normalizeDate(item.vencimento),
    status_pagamento: str(item.status_pagamento),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapReceita(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    pessoa: str(item.pessoa),
    conta: str(item.conta),
    categoria: str(item.categoria),
    descricao: str(item.descricao),
    lancamento: normalizeDate(item.lancamento),
    vencimento: normalizeDate(item.vencimento),
    pagamento: normalizeDate(item.pagamento),
    forma_lancamento: str(item.forma_lancamento),
    forma_pagamento: str(item.forma_pagamento),
    valor: parseMonetary(item.valor),
    observacao: str(item.observacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapDespesa(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    pessoa: str(item.pessoa),
    conta: str(item.conta),
    categoria: str(item.categoria),
    descricao: str(item.descricao),
    lancamento: normalizeDate(item.lancamento),
    vencimento: normalizeDate(item.vencimento),
    pagamento: normalizeDate(item.pagamento),
    forma_lancamento: str(item.forma_lancamento),
    forma_pagamento: str(item.forma_pagamento),
    valor: parseMonetary(item.valor),
    parcela: str(item.parcela),
    observacao: str(item.observacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapTarefa(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    assunto: str(item.assunto),
    descricao: str(item.descricao),
    data: normalizeDate(item.data),
    hora: str(item.hora),
    situacao: str(item.situacao),
    tipo: str(item.tipo),
    id_orcamento: str(item.id_orcamento),
    id_responsavel: str(item.id_responsavel),
    id_usuario_origem: str(item.id_usuario_origem),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapVoo(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  const ao = str(item.aeroporto_origem);
  const ad = str(item.aeroporto_destino);
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    tipo_trecho: str(item.tipo_trecho),
    voo: str(item.voo),
    companhia: str(item.companhia),
    id_companhia: str(item.id_companhia),
    classe: str(item.classe),
    aeroporto_origem: ao,
    aeroporto_origem_iata: extractIATA(ao),  // "São Paulo (GRU)" → "GRU"
    aeroporto_destino: ad,
    aeroporto_destino_iata: extractIATA(ad),
    data_embarque: normalizeDate(item.data_embarque),
    hora_embarque: str(item.hora_embarque),
    data_chegada: normalizeDate(item.data_chegada),
    hora_chegada: str(item.hora_chegada),
    duracao: str(item.duracao),
    localizador: str(item.localizador),
    numero_compra: str(item.numero_compra),
    checkin: str(item.checkin),
    observacao: str(item.observacao),
    assento: str(item.assento),
    portao: str(item.portao),
    terminal: str(item.terminal),
    qtd_paradas: str(item.qtd_paradas),
    bagagem_bolsa: str(item.bagagem_bolsa),
    bagagem_demao: str(item.bagagem_demao),
    bagagem_despachada: str(item.bagagem_despachada),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapCruzeiro(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    embarque: str(item.embarque),
    desembarque: str(item.desembarque),
    tipo_cabine: str(item.tipo_cabine),
    data_entrada: normalizeDate(item.data_entrada),
    data_saida: normalizeDate(item.data_saida),
    localizador: str(item.localizador),
    cliente: str(item.cliente),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapHospedagem(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    data_entrada: normalizeDate(item.data_entrada),
    data_saida: normalizeDate(item.data_saida),
    localizador: str(item.localizador),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapSeguro(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    inicio_vigencia: normalizeDate(item.inicio_vigencia),
    fim_vigencia: normalizeDate(item.fim_vigencia),
    localizador: str(item.localizador),
    cliente: str(item.cliente),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapTransporte(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  // Só id e id_orcamento como colunas planas; resto vai no raw_payload
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

function mapSolicitacao(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    id: str(item.id),
    identificador: str(item.identificador),
    nome: str(item.nome),
    email: str(item.email),
    telefone: str(item.telefone),
    origem: str(item.origem),
    destino: str(item.destino),
    data_ida: normalizeDate(item.data_ida),
    data_volta: normalizeDate(item.data_volta),
    adultos: str(item.adultos),
    criancas: str(item.criancas),
    bagagem_despachada: str(item.bagagem_despachada),
    possui_flexibilidade: str(item.possui_flexibilidade),
    observacao: str(item.observacao),
    data_solicitacao: normalizeDate(item.data_solicitacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

// Snapshot: cada run cria N linhas novas; snapshot_id é BIGSERIAL gerado pelo banco
function mapInfosolicitacao(
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
): Record<string, unknown> {
  return {
    snapshot_at: audit.ingested_at,
    nome: str(item.nome),
    campo: str(item.campo),
    tipo: str(item.tipo),
    opcoes: item.opcoes ?? null,
    obrigatorio: parseBool(item.obrigatorio),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startMs = Date.now();
  const runId = randomUUID();

  console.log("=".repeat(60));
  console.log("  Backfill Iddas → Supabase (bronze)");
  console.log(`  Modo: ${DRY_RUN ? "DRY-RUN (sem gravação)" : "APPLY (gravando!)"}`);
  if (ONLY_RESOURCES) console.log(`  Recursos: ${[...ONLY_RESOURCES].join(", ")}`);
  if (SKIP_RESOURCES.size > 0) console.log(`  Skip: ${[...SKIP_RESOURCES].join(", ")}`);
  console.log(`  Run ID: ${runId}`);
  console.log(`  API URL: ${IDDAS_URL}`);
  console.log(`  Pause: ${PAUSE_MS}ms por chamada`);
  console.log("=".repeat(60));

  // Autenticar antes de começar — falha rápida
  try {
    await getValidToken();
  } catch (err) {
    console.error(`ERRO FATAL: falha no login Iddas: ${String(err)}`);
    process.exit(1);
  }

  if (!DRY_RUN) {
    await logIngestionStart(runId);
  }

  // Grupo 1: referência pequena
  if (shouldRun("canal"))
    await fetchAndProcess("canal", "canal", "bronze_iddas_canal", 9, mapCanal, runId);
  if (shouldRun("situacao"))
    await fetchAndProcess("situacao", "situacao", "bronze_iddas_situacao", 8, mapSituacao, runId);
  if (shouldRun("motivoreprovacao"))
    await fetchAndProcess(
      "motivoreprovacao",
      "motivoreprovacao",
      "bronze_iddas_motivoreprovacao",
      8,
      mapMotivoreprovacao,
      runId,
    );
  if (shouldRun("etiqueta"))
    await fetchAndProcess(
      "etiqueta",
      "etiqueta",
      "bronze_iddas_etiqueta",
      20,
      mapEtiqueta,
      runId,
    );
  if (shouldRun("usuario"))
    await fetchAndProcess(
      "usuario",
      "usuario",
      "bronze_iddas_usuario",
      4,
      mapUsuario,
      runId,
    );
  if (shouldRun("conta"))
    await fetchAndProcess("conta", "conta", "bronze_iddas_conta", 2, mapConta, runId);
  if (shouldRun("cartao"))
    await fetchAndProcess("cartao", "cartao", "bronze_iddas_cartao", 7, mapCartao, runId);
  if (shouldRun("categoriareceitasdespesas"))
    await fetchAndProcess(
      "categoriareceitasdespesas",
      "categoriareceitasdespesas",
      "bronze_iddas_categoriareceitasdespesas",
      30,
      mapCategoriaReceitasDespesas,
      runId,
    );

  // Grupo 2: referência grande (paginada)
  if (shouldRun("aeroporto"))
    await fetchAndProcess(
      "aeroporto",
      "aeroporto",
      "bronze_iddas_aeroporto",
      4564,
      mapAeroporto,
      runId,
    );
  if (shouldRun("companhia"))
    await fetchAndProcess(
      "companhia",
      "companhia",
      "bronze_iddas_companhia",
      1018,
      mapCompanhia,
      runId,
    );

  // Grupo 3: núcleo
  if (shouldRun("pessoa"))
    await fetchAndProcess("pessoa", "pessoa", "bronze_iddas_pessoa", 838, mapPessoa, runId);
  if (shouldRun("orcamento"))
    await fetchAndProcess(
      "orcamento",
      "orcamento",
      "bronze_iddas_orcamento",
      614,
      mapOrcamento,
      runId,
    );

  // Grupo 4: transacionais
  if (shouldRun("venda"))
    await fetchAndProcess("venda", "venda", "bronze_iddas_venda", 208, mapVenda, runId);
  if (shouldRun("receita"))
    await fetchAndProcess(
      "receita",
      "receita",
      "bronze_iddas_receita",
      441,
      mapReceita,
      runId,
    );
  if (shouldRun("despesa"))
    await fetchAndProcess(
      "despesa",
      "despesa",
      "bronze_iddas_despesa",
      327,
      mapDespesa,
      runId,
    );
  if (shouldRun("tarefa"))
    await fetchAndProcess(
      "tarefa",
      "tarefa",
      "bronze_iddas_tarefa",
      629,
      mapTarefa,
      runId,
    );
  if (shouldRun("voo"))
    await fetchAndProcess("voo", "voo", "bronze_iddas_voo", 387, mapVoo, runId);

  // Grupo 5: sub-recursos de orcamento
  if (shouldRun("cruzeiro"))
    await fetchAndProcess(
      "cruzeiro",
      "cruzeiro",
      "bronze_iddas_cruzeiro",
      6,
      mapCruzeiro,
      runId,
    );
  if (shouldRun("hospedagem"))
    await fetchAndProcess(
      "hospedagem",
      "hospedagem",
      "bronze_iddas_hospedagem",
      109,
      mapHospedagem,
      runId,
    );
  if (shouldRun("seguro"))
    await fetchAndProcess(
      "seguro",
      "seguro",
      "bronze_iddas_seguro",
      3,
      mapSeguro,
      runId,
    );
  if (shouldRun("transporte"))
    await fetchAndProcess(
      "transporte",
      "transporte",
      "bronze_iddas_transporte",
      11,
      mapTransporte,
      runId,
    );

  // Grupo 6: lead
  if (shouldRun("solicitacao"))
    await fetchAndProcess(
      "solicitacao",
      "solicitacao",
      "bronze_iddas_solicitacao",
      9,
      mapSolicitacao,
      runId,
    );

  // Grupo 7: snapshot (INSERT puro, sem UPSERT, snapshot_id gerado pelo banco)
  if (shouldRun("infosolicitacao"))
    await fetchAndProcess(
      "infosolicitacao",
      "infosolicitacao",
      "bronze_iddas_infosolicitacao",
      3,
      mapInfosolicitacao,
      runId,
      true, // isSnapshot
    );

  const durationMs = Date.now() - startMs;
  const hasErrors = runErrors.length > 0;
  const finalStatus: "completed" | "failed" | "partial" =
    hasErrors && Object.keys(results).length === 0
      ? "failed"
      : hasErrors
        ? "partial"
        : "completed";

  if (!DRY_RUN) {
    const countsSummary: Record<string, number> = {};
    for (const [key, val] of Object.entries(results)) {
      countsSummary[key] = val.actual_inserted ?? val.would_insert;
    }
    await logIngestionEnd(
      runId,
      finalStatus,
      countsSummary,
      durationMs,
      hasErrors
        ? runErrors.map((e) => `[${e.resource}] ${e.message}`).join("; ")
        : null,
    );
  }

  // ─── Sumário ────────────────────────────────────────────────────────────────

  sep("Sumário");
  log(`Duração total: ${durationMs}ms`);
  log(`Status: ${finalStatus}`);
  console.log("\nContagens por recurso:");
  const cols = [
    "recurso".padEnd(30),
    "esperado".padEnd(9),
    "fetched".padEnd(9),
    "would".padEnd(7),
    "inserted",
  ];
  console.log("  " + cols.join(" | "));
  console.log("  " + "─".repeat(72));
  for (const [resource, r] of Object.entries(results)) {
    const inserted = DRY_RUN ? `${r.would_insert} (dry-run)` : String(r.actual_inserted ?? 0);
    const match =
      r.expected !== undefined && r.fetched === r.expected ? "✓" : r.fetched === 0 ? "?" : "⚠";
    console.log(
      `  ${match} ${resource.padEnd(28)} ${String(r.expected ?? "?").padEnd(9)} ${String(r.fetched).padEnd(9)} ${String(r.would_insert).padEnd(7)} ${inserted}`,
    );
  }

  if (hasErrors) {
    console.log("\nErros / Bandeiras:");
    for (const e of runErrors) {
      console.log(`  [${e.resource}] ${e.message}`);
    }
  }

  // ─── Salvar output ──────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-").slice(0, 19);
  const prefix = DRY_RUN ? "backfill-iddas-dryrun" : "backfill-iddas-apply";
  const outputPath = join(process.cwd(), "docs", `${prefix}-${timestamp}.json`);

  const output: Record<string, unknown> = {
    ingestion_run_id: runId,
    mode: DRY_RUN ? "dry-run" : "apply",
    started_at: new Date(startMs).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    status: finalStatus,
    resources: results,
    errors: runErrors,
  };

  const docsDir = join(process.cwd(), "docs");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nOutput salvo em: ${outputPath}`);
  console.log("\n" + "=".repeat(60));

  if (finalStatus === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
