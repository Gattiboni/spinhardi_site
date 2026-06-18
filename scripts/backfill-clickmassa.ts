/**
 * Turno H.2 — Backfill V2 ETL ClickMassa → Supabase
 *
 * Combina API externa (opportunities, pipeline-steps, products) com
 * API interna (todos os outros recursos).
 *
 * Por padrão roda em DRY-RUN (zero INSERTs).
 * Salva output em docs/backfill-v2-dryrun-<timestamp>.json
 *
 * Uso:
 *   npx tsx scripts/backfill-clickmassa.ts                        # dry-run
 *   npx tsx scripts/backfill-clickmassa.ts --apply                # executa INSERTs
 *   npx tsx scripts/backfill-clickmassa.ts --verbose              # log extra
 *   npx tsx scripts/backfill-clickmassa.ts --only=contacts        # apenas contacts
 *   npx tsx scripts/backfill-clickmassa.ts --skip=contacts,users  # pula recursos (csv)
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
const ONLY_RESOURCE = onlyArg ? onlyArg.slice("--only=".length) : null;

const skipArg = argv.find((a) => a.startsWith("--skip="));
const SKIP_RESOURCES = new Set(skipArg ? skipArg.slice("--skip=".length).split(",") : []);

type Resource =
  | "tags"
  | "users"
  | "queues"
  | "settings"
  | "whatsapp"
  | "api-config"
  | "funnels"
  | "lead-status"
  | "pipeline-steps"
  | "products"
  | "opportunities"
  | "contacts"
  | "contacts-dashboard";

function shouldRun(resource: Resource): boolean {
  if (SKIP_RESOURCES.has(resource)) return false;
  if (!ONLY_RESOURCE) return true;
  return ONLY_RESOURCE === resource;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const CM_EXTERNAL_URL = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const CM_KEY = process.env.CLICKMASSA_API_KEY ?? "";
const SB_URL = (
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
).replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!CM_EXTERNAL_URL || !CM_KEY) {
  console.error("ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidas.");
  process.exit(1);
}
if (!SB_URL || !SB_KEY) {
  console.error("ERRO: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidas.");
  process.exit(1);
}

// Derivar host interno a partir da URL externa
// CM_EXTERNAL_URL = "https://enterprise-352napi.clickmassa.com.br/v1/api/external/b14c6651-..."
const CM_INTERNAL_BASE = (() => {
  try {
    return new URL(CM_EXTERNAL_URL).origin; // "https://enterprise-352napi.clickmassa.com.br"
  } catch {
    // fallback: tira o path
    const m = CM_EXTERNAL_URL.match(/^(https?:\/\/[^/]+)/);
    return m ? m[1] : "";
  }
})();

// Quirk 1: users endpoint usa path invertido na API externa
const lastSlash = CM_EXTERNAL_URL.lastIndexOf("/");
const API_ID = CM_EXTERNAL_URL.slice(lastSlash + 1);
const CM_URL_WITHOUT_APIID = CM_EXTERNAL_URL.slice(0, lastSlash);
const USERS_EXTERNAL_URL = `${CM_URL_WITHOUT_APIID}/users/${API_ID}`;

const PAUSE_MS = 300;
const RETRY_DELAYS = [500, 1000, 2000];

const INTERNAL_ORIGIN = CM_INTERNAL_BASE.replace(/-352napi\./, "-352n."); // painel origin

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type IngestionSource = "backfill" | "sync" | "webhook";

interface BronzeIngestionMeta {
  ingested_at: string;
  ingestion_run_id: string;
  ingestion_source: IngestionSource;
}

interface PipelineStep {
  id: number;
  name: string;
  color: string;
  order: number;
}

// ─── Estado do run ────────────────────────────────────────────────────────────

interface ResourceResult {
  fetched: number;
  mapped: number;
  would_insert: number;
  actual_inserted?: number;
  pages?: number;
  sample?: unknown;
}

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
  console.log(`[backfill] ${msg}`);
}

function verbose(msg: string): void {
  if (VERBOSE) console.log(`  [verbose] ${msg}`);
}

function sep(label: string): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

function jwtPreview(token: string): string {
  return token.slice(0, 8) + "...";
}

function meta(runId: string): BronzeIngestionMeta {
  return {
    ingested_at: new Date().toISOString(),
    ingestion_run_id: runId,
    ingestion_source: "backfill",
  };
}

function extractArray(body: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(body)) return body as unknown[];
  const obj = body as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

// ─── HTTP: External API ───────────────────────────────────────────────────────

const EXTERNAL_HEADERS = {
  Authorization: `Bearer ${CM_KEY}`,
  "Content-Type": "application/json",
};

async function externalGet(urlOrPath: string, params?: Record<string, string>): Promise<unknown> {
  let url = urlOrPath.startsWith("http") ? urlOrPath : `${CM_EXTERNAL_URL}${urlOrPath}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    await sleep(PAUSE_MS);
    const t0 = Date.now();
    verbose(`[external] GET ${url} (attempt ${attempt + 1})`);
    try {
      const res = await fetch(url, { headers: EXTERNAL_HEADERS });
      const latency = Date.now() - t0;
      verbose(`  HTTP ${res.status} (${latency}ms)`);
      if (!res.ok) {
        let errBody: unknown;
        try { errBody = await res.json(); } catch { errBody = await res.text(); }
        if (attempt < RETRY_DELAYS.length && res.status >= 500) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        verbose(`  Erro, aguardando ${RETRY_DELAYS[attempt]}ms...`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Todas as tentativas falharam: ${url}`);
}

// ─── HTTP: Internal API ───────────────────────────────────────────────────────

const INTERNAL_HEADERS = {
  Authorization: `Bearer ${CM_KEY}`,
  Accept: "application/json, text/plain, */*",
  Origin: INTERNAL_ORIGIN,
  Referer: `${INTERNAL_ORIGIN}/`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

async function internalGet(path: string, params?: Record<string, string>): Promise<unknown> {
  let url = `${CM_INTERNAL_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    await sleep(PAUSE_MS);
    const t0 = Date.now();
    verbose(`[internal] GET ${path}${params ? "?" + new URLSearchParams(params) : ""} (attempt ${attempt + 1})`);
    try {
      const res = await fetch(url, { headers: INTERNAL_HEADERS });
      const latency = Date.now() - t0;
      verbose(`  HTTP ${res.status} (${latency}ms)`);
      if (!res.ok) {
        let errBody: unknown;
        try { errBody = await res.json(); } catch { errBody = await res.text(); }
        if (attempt < RETRY_DELAYS.length && res.status >= 500) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        verbose(`  Erro, aguardando ${RETRY_DELAYS[attempt]}ms...`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Todas as tentativas falharam: ${path}`);
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

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
  try { resBody = await res.json(); } catch { resBody = null; }
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

// ─── Ingestion log ────────────────────────────────────────────────────────────

async function logIngestionStart(runId: string): Promise<void> {
  try {
    const { status } = await sbFetch("/ingestion_log", {
      method: "POST",
      body: {
        id: runId,
        source_system: "clickmassa",
        ingestion_type: "backfill",
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: "codinho:backfill-v2",
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
    const { status } = await sbFetch("/ingestion_log", {
      method: "PATCH",
      body: {
        status: finalStatus,
        finished_at: new Date().toISOString(),
        counts: { ...counts, _duration_ms: durationMs },
        error_message: errorMsg,
      },
      queryParams: { id: `eq.${runId}` },
    });
    if (status < 200 || status >= 300) {
      log(`AVISO: ingestion_log PATCH HTTP ${status}`);
    }
  } catch (err) {
    log(`AVISO: ingestion_log end falhou: ${String(err)}`);
  }
}

// ─── Resource: Tags (passo 2) ─────────────────────────────────────────────────

async function runTags(runId: string): Promise<void> {
  sep("Tags (2/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/tags");
    raw = extractArray(body, "data", "tags");
  } catch (err) {
    const msg = `Falha ao buscar tags: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "tags", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.tag ?? ""), // renomeia tag → name
      color: String(item.color ?? ""),
      is_active: Boolean(item.isActive ?? true),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} tags`);
  recordResult("tags", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("tags")) {
    const r = await sbUpsert("bronze_clickmassa_tags", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert tags: ${r.error}`); runErrors.push({ resource: "tags", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_tags`); }
    results["tags"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} tags seriam upsertadas`);
  }
}

// ─── Resource: Users (passo 3) ────────────────────────────────────────────────

async function runUsers(runId: string): Promise<void> {
  sep("Users (3/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    // Tenta API interna primeiro (shape mais rico com profilePic, canViewDepartmentTickets, etc.)
    const body = await internalGet("/users");
    raw = extractArray(body, "users", "data");
  } catch {
    // Fallback: API externa (Quirk 1 — path invertido)
    log("API interna falhou, tentando API externa (Quirk 1)...");
    try {
      const body = await externalGet(USERS_EXTERNAL_URL);
      raw = extractArray(body, "users", "data");
    } catch (err) {
      const msg = `Falha ao buscar users: ${String(err)}`;
      log(`ERRO: ${msg}`);
      runErrors.push({ resource: "users", message: msg });
      return;
    }
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      email: item.email != null ? String(item.email) : null,
      phone: item.phone != null ? String(item.phone) : null,
      profile: String(item.profile ?? ""),
      profile_pic: item.profilePic != null ? String(item.profilePic) : null,
      uid: item.uid != null ? String(item.uid) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      is_disable_autodistribution:
        item.isDisableAutodistribution != null ? Boolean(item.isDisableAutodistribution) : null,
      can_view_department_tickets:
        item.canViewDepartmentTickets != null ? Boolean(item.canViewDepartmentTickets) : null,
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} users`);
  recordResult("users", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("users")) {
    const r = await sbUpsert("bronze_clickmassa_users", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert users: ${r.error}`); runErrors.push({ resource: "users", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_users`); }
    results["users"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} users seriam upsertados`);
  }
}

// ─── Resource: Queues (passo 4) ───────────────────────────────────────────────

async function runQueues(runId: string): Promise<void> {
  sep("Queues (4/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/queue"); // SINGULAR, confirmado H.1
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar queues: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "queues", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      queue: String(item.queue ?? ""),
      is_active: Boolean(item.isActive ?? true),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      message_default_contact: item.messageDefaultContact != null ? String(item.messageDefaultContact) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} queues`);
  recordResult("queues", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("queues")) {
    const r = await sbUpsert("bronze_clickmassa_queues", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert queues: ${r.error}`); runErrors.push({ resource: "queues", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_queues`); }
    results["queues"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} queues seriam upsertadas`);
  }
}

// ─── Resource: Settings (passo 5) ─────────────────────────────────────────────

async function runSettings(runId: string): Promise<void> {
  sep("Settings (5/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/settings");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar settings: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "settings", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      key: String(item.key ?? ""),
      value: item.value != null ? String(item.value) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} settings`);
  recordResult("settings", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("settings")) {
    const r = await sbUpsert("bronze_clickmassa_settings", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert settings: ${r.error}`); runErrors.push({ resource: "settings", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_settings`); }
    results["settings"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} settings seriam upsertadas`);
  }
}

// ─── Resource: WhatsApp Sessions (passo 6) ────────────────────────────────────

async function runWhatsapp(runId: string): Promise<void> {
  sep("WhatsApp Sessions (6/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/whatsapp");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar whatsapp sessions: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "whatsapp", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      number: item.number != null ? String(item.number) : null,
      status: item.status != null ? String(item.status) : null,
      type: item.type != null ? String(item.type) : null,
      is_active: Boolean(item.isActive ?? false),
      is_default: Boolean(item.isDefault ?? false),
      provider: item.provider != null ? String(item.provider) : null,
      uid: item.uid != null ? String(item.uid) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} whatsapp sessions`);
  recordResult("whatsapp", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("whatsapp")) {
    const r = await sbUpsert("bronze_clickmassa_whatsapp_sessions", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert whatsapp: ${r.error}`); runErrors.push({ resource: "whatsapp", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_whatsapp_sessions`); }
    results["whatsapp"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} whatsapp sessions seriam upsertadas`);
  }
}

// ─── Resource: API Configs (passo 7) ──────────────────────────────────────────

async function runApiConfig(runId: string): Promise<void> {
  sep("API Config (7/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/api-config");
    raw = extractArray(body, "apis", "data");
  } catch (err) {
    const msg = `Falha ao buscar api-config: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "api-config", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = { ...(r as Record<string, unknown>) };
    // SEGURANÇA: REMOVER token antes do INSERT
    delete item.token;
    if ("token" in item) {
      log("AVISO CRÍTICO: token ainda presente após delete — abortando este item");
      throw new Error("token não removido do api-config payload");
    }
    return {
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      session_id: item.sessionId != null ? Number(item.sessionId) : null,
      is_active: Boolean(item.isActive ?? false),
      ticket_action: item.ticketAction != null ? String(item.ticketAction) : null,
      queue_id: item.queueId != null ? Number(item.queueId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      webhook_url: item.webhookUrl != null ? String(item.webhookUrl) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item, // clone sem token
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} api-configs (token removido: ${APPLY ? "SIM" : "dry-run"})`);
  recordResult("api-config", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("api-config")) {
    const r = await sbUpsert("bronze_clickmassa_api_configs", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert api-config: ${r.error}`); runErrors.push({ resource: "api-config", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_api_configs`); }
    results["api-config"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} api-configs seriam upsertados (sem token)`);
  }
}

// ─── Resource: Funnels + Funnel Steps (passo 8) ────────────────────────────────

async function runFunnels(runId: string): Promise<void> {
  sep("Funnels + Funnel Steps (8/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/funnel");
    raw = extractArray(body, "funnels", "data");
  } catch (err) {
    const msg = `Falha ao buscar funnels: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "funnels", message: msg });
    return;
  }

  const funnelRows: Record<string, unknown>[] = [];
  const stepRows: Record<string, unknown>[] = [];

  for (const r of raw) {
    const funnel = r as Record<string, unknown>;
    const funnelId = Number(funnel.id ?? 0);
    const steps = Array.isArray(funnel.steps) ? (funnel.steps as Record<string, unknown>[]) : [];

    funnelRows.push({
      id: funnelId,
      name: String(funnel.name ?? ""),
      action: funnel.action != null ? String(funnel.action) : null,
      session_id: funnel.sessionId != null ? Number(funnel.sessionId) : null,
      queue_id: funnel.queueId != null ? Number(funnel.queueId) : null,
      user_id: funnel.userId != null ? Number(funnel.userId) : null,
      tenant_id: funnel.tenantId != null ? Number(funnel.tenantId) : null,
      schedule_enabled: Boolean(funnel.scheduleEnabled ?? false),
      total_contacts: funnel.totalContacts != null ? parseInt(String(funnel.totalContacts), 10) : null,
      source_created_at: String(funnel.createdAt ?? m.ingested_at),
      source_updated_at: String(funnel.updatedAt ?? m.ingested_at),
      raw_payload: funnel, // inclui steps no raw_payload
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    });

    for (const step of steps) {
      stepRows.push({
        id: Number(step.id ?? 0),
        funnel_id: funnelId,
        tenant_id: step.tenantId != null ? Number(step.tenantId) : null,
        user_id: step.userId != null ? Number(step.userId) : null,
        step_order: Number(step.order ?? 0),
        message: step.message != null ? String(step.message) : null,
        minutes_later: step.minutesLater != null ? Number(step.minutesLater) : null,
        lead_status_id: step.leadStatusId != null ? Number(step.leadStatusId) : null,
        total_contacts: step.totalContacts != null ? parseInt(String(step.totalContacts), 10) : null,
        total_sents: step.totalSents != null ? parseInt(String(step.totalSents), 10) : null,
        source_created_at: String(step.createdAt ?? m.ingested_at),
        source_updated_at: String(step.updatedAt ?? m.ingested_at),
        raw_payload: step,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      });
    }
  }

  log(`API: ${funnelRows.length} funnels, ${stepRows.length} funnel_steps`);
  recordResult("funnels", { fetched: funnelRows.length, mapped: funnelRows.length, would_insert: funnelRows.length, sample: funnelRows[0] });
  recordResult("funnel_steps", { fetched: stepRows.length, mapped: stepRows.length, would_insert: stepRows.length, sample: stepRows[0] });

  if (!DRY_RUN && shouldRun("funnels")) {
    const r1 = await sbUpsert("bronze_clickmassa_funnels", funnelRows, "id");
    if (r1.error) { log(`ERRO upsert funnels: ${r1.error}`); runErrors.push({ resource: "funnels", message: r1.error }); }
    else { log(`Upsert: ${r1.inserted} rows em bronze_clickmassa_funnels`); }
    results["funnels"].actual_inserted = r1.inserted;

    if (stepRows.length > 0) {
      const r2 = await sbUpsert("bronze_clickmassa_funnel_steps", stepRows, "id");
      if (r2.error) { log(`ERRO upsert funnel_steps: ${r2.error}`); runErrors.push({ resource: "funnel_steps", message: r2.error }); }
      else { log(`Upsert: ${r2.inserted} rows em bronze_clickmassa_funnel_steps`); }
      results["funnel_steps"].actual_inserted = r2.inserted;
    }
  } else {
    log(`[dry-run] ${funnelRows.length} funnels + ${stepRows.length} steps seriam upsertados`);
  }
}

// ─── Resource: Lead Statuses (passo 9) ────────────────────────────────────────

async function runLeadStatuses(runId: string): Promise<void> {
  sep("Lead Statuses (9/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await internalGet("/lead-status");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar lead-status: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "lead-status", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      status: String(item.status ?? ""),
      color: item.color != null ? String(item.color) : null,
      active: Boolean(item.active ?? true),
      user_id: item.userId != null ? Number(item.userId) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      funnel_id: item.funnelId != null ? Number(item.funnelId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} lead_statuses`);
  recordResult("lead-status", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("lead-status")) {
    const r = await sbUpsert("bronze_clickmassa_lead_statuses", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert lead-status: ${r.error}`); runErrors.push({ resource: "lead-status", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_lead_statuses`); }
    results["lead-status"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} lead_statuses seriam upsertados`);
  }
}

// ─── Resource: Pipeline Steps (passo 10) ──────────────────────────────────────

async function runPipelineSteps(runId: string): Promise<PipelineStep[]> {
  sep("Pipeline Steps (10/14)");
  const m = meta(runId);
  let steps: PipelineStep[] = [];

  try {
    const body = await externalGet("/pipeline-steps");
    const raw = extractArray(body, "data");
    steps = raw.map((r) => {
      const item = r as Record<string, unknown>;
      return {
        id: Number(item.id ?? 0),
        name: String(item.name ?? ""),
        color: String(item.color ?? ""),
        order: Number(item.order ?? 0),
      };
    });
    log(`API: ${steps.length} pipeline steps`);
  } catch (err) {
    log(`API externa falhou (Quirk 2): ${String(err)}`);
    log("Tentando cache Supabase...");
    try {
      const { status, body } = await sbFetch("/bronze_clickmassa_pipeline_steps", {
        queryParams: { order: "ordem.asc" },
      });
      if (status === 200 && Array.isArray(body)) {
        steps = (body as Record<string, unknown>[]).map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          color: String(r.color ?? ""),
          order: Number(r.ordem ?? 0),
        }));
        log(`Cache Supabase: ${steps.length} pipeline steps`);
      }
    } catch (cacheErr) {
      log(`Cache Supabase falhou: ${String(cacheErr)}`);
    }
  }

  if (steps.length === 0) {
    runErrors.push({ resource: "pipeline-steps", message: "Nenhum step disponível (API + cache)" });
    return [];
  }

  recordResult("pipeline-steps", { fetched: steps.length, mapped: steps.length, would_insert: steps.length, sample: steps[0] });

  if (!DRY_RUN && shouldRun("pipeline-steps")) {
    const now = m.ingested_at;
    const rows = steps.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || null,
      ordem: s.order,
      is_active: true,
      synced_at: now,
      ingestion_run_id: runId,
    }));
    const r = await sbUpsert("bronze_clickmassa_pipeline_steps", rows, "id");
    if (r.error) { log(`ERRO upsert pipeline-steps: ${r.error}`); runErrors.push({ resource: "pipeline-steps", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_pipeline_steps`); }
    results["pipeline-steps"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${steps.length} pipeline steps seriam upsertados`);
  }

  return steps;
}

// ─── Resource: Products (passo 11) ────────────────────────────────────────────

async function runProducts(runId: string): Promise<void> {
  sep("Products (11/14)");
  const m = meta(runId);
  let raw: unknown[];
  try {
    const body = await externalGet("/products");
    raw = extractArray(body, "data", "products");
  } catch (err) {
    const msg = `Falha ao buscar products: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "products", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      description: item.description != null ? String(item.description) : null,
      is_active: Boolean(item.isActive ?? true),
      value: String(item.value ?? "0"),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  log(`API: ${rows.length} products`);
  recordResult("products", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!DRY_RUN && shouldRun("products")) {
    const r = await sbUpsert("bronze_clickmassa_products", rows as Record<string, unknown>[], "id");
    if (r.error) { log(`ERRO upsert products: ${r.error}`); runErrors.push({ resource: "products", message: r.error }); }
    else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_products`); }
    results["products"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] ${rows.length} products seriam upsertados`);
  }
}

// ─── Resource: Opportunities (passo 12) ───────────────────────────────────────

async function runOpportunities(runId: string, steps: PipelineStep[]): Promise<void> {
  sep("Opportunities (12/14)");
  const m = meta(runId);

  if (steps.length === 0) {
    log("Nenhum pipeline step disponível — pulando opportunities");
    recordResult("opportunities", { fetched: 0, mapped: 0, would_insert: 0 });
    return;
  }

  const oppRows: Record<string, unknown>[] = [];
  const contactRowsFromOpps: Map<number, Record<string, unknown>> = new Map();

  for (const step of steps) {
    log(`Step ${step.id} "${step.name}"...`);
    let opps: Record<string, unknown>[];
    try {
      const body = await externalGet("/opportunities", { pipelineStepId: String(step.id) });
      opps = extractArray(body, "data", "opportunities") as Record<string, unknown>[];
      verbose(`  ${opps.length} opps no step ${step.id}`);
    } catch (err) {
      const msg = `Falha ao listar opps do step ${step.id}: ${String(err)}`;
      log(`ERRO: ${msg}`);
      runErrors.push({ resource: "opportunities", message: msg });
      continue;
    }

    for (const opp of opps) {
      const oppId = Number(opp.id ?? 0);
      if (!oppId) continue;

      oppRows.push({
        id: oppId,
        tenant_id: Number(opp.tenantId ?? 0),
        contact_id: Number(opp.contactId ?? 0),
        user_id: Number(opp.userId ?? 0),
        responsible_id: Number(opp.responsibleId ?? 0),
        pipeline_step_id: Number(opp.pipelineStepId ?? step.id),
        status: String(opp.status ?? "open"),
        value: String(opp.value ?? "0"),
        expected_close_date: opp.expectedCloseDate != null ? String(opp.expectedCloseDate) : null,
        close_date: opp.closeDate != null ? String(opp.closeDate) : null,
        pipeline_updated_at: opp.pipelineUpdatedAt != null ? String(opp.pipelineUpdatedAt) : null,
        source_created_at: String(opp.createdAt ?? m.ingested_at),
        source_updated_at: String(opp.updatedAt ?? m.ingested_at),
        raw_payload: opp,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      });

      // Contact embed (bronze contact light — será sobrescrito pelo /contacts do passo 13)
      const contactRaw = opp.contact;
      if (contactRaw && typeof contactRaw === "object" && !Array.isArray(contactRaw)) {
        const c = contactRaw as Record<string, unknown>;
        const contactId = Number(c.id ?? 0);
        if (contactId && !contactRowsFromOpps.has(contactId)) {
          contactRowsFromOpps.set(contactId, {
            id: contactId,
            tenant_id: Number(c.tenantId ?? 0),
            name: String(c.name ?? ""),
            number: String(c.number ?? ""),
            pushname: c.pushname != null ? String(c.pushname) : null,
            email: c.email != null ? String(c.email) : null,
            channel: String(c.channel ?? "whatsapp"),
            company: c.company != null ? String(c.company) : null,
            gender: c.gender != null ? String(c.gender) : null,
            birth_date: c.birthDate != null ? String(c.birthDate) : null,
            cep: c.cep != null ? String(c.cep) : null,
            pais: c.pais != null ? String(c.pais) : null,
            estado: c.estado != null ? String(c.estado) : null,
            cidade: c.cidade != null ? String(c.cidade) : null,
            bairro: c.bairro != null ? String(c.bairro) : null,
            logradouro: c.logradouro != null ? String(c.logradouro) : null,
            numero_endereco: c.numero != null ? String(c.numero) : null,
            complemento: c.complemento != null ? String(c.complemento) : null,
            is_number: Boolean(c.isNumber ?? false),
            is_user: Boolean(c.isUser ?? false),
            is_wa_contact: Boolean(c.isWAContact ?? false),
            is_group: Boolean(c.isGroup ?? false),
            is_blacklisted: false,
            tags: [],
            lead_status: null,
            lead_status_id: c.leadStatusId != null ? Number(c.leadStatusId) : null,
            profile_pic_url: c.profilePicUrl != null ? String(c.profilePicUrl) : null,
            pic_is_object_storage: c.picIsObjectStorage != null ? Boolean(c.picIsObjectStorage) : null,
            wallet_id: null,
            funnels: null,
            lid: c.lid != null ? String(c.lid) : null,
            first_connection: c.firstConnection != null ? Number(c.firstConnection) : null,
            deleted_at: c.deletedAt != null ? String(c.deletedAt) : null,
            source_created_at: String(c.createdAt ?? m.ingested_at),
            source_updated_at: String(c.updatedAt ?? m.ingested_at),
            raw_payload: c,
            ingested_at: m.ingested_at,
            ingestion_run_id: m.ingestion_run_id,
            ingestion_source: m.ingestion_source,
          });
        }
      }
    }
  }

  log(`Total: ${oppRows.length} opportunities, ${contactRowsFromOpps.size} contacts (de embed)`);
  recordResult("opportunities", { fetched: oppRows.length, mapped: oppRows.length, would_insert: oppRows.length, sample: oppRows[0] });

  if (!DRY_RUN && shouldRun("opportunities")) {
    if (oppRows.length > 0) {
      const r = await sbUpsert("bronze_clickmassa_opportunities", oppRows, "id");
      if (r.error) { log(`ERRO upsert opportunities: ${r.error}`); runErrors.push({ resource: "opportunities", message: r.error }); }
      else { log(`Upsert: ${r.inserted} rows em bronze_clickmassa_opportunities`); }
      results["opportunities"].actual_inserted = r.inserted;
    }
    // Contacts from embed (light upsert — passo 13 vai sobrescrever com dados mais ricos)
    if (contactRowsFromOpps.size > 0) {
      const contactBatch = Array.from(contactRowsFromOpps.values());
      const rc = await sbUpsert("bronze_clickmassa_contacts", contactBatch, "id");
      if (rc.error) { log(`ERRO upsert contacts (embed opps): ${rc.error}`); }
      else { log(`Upsert: ${rc.inserted} contacts de embed em bronze_clickmassa_contacts`); }
    }
  } else {
    log(`[dry-run] ${oppRows.length} opps + ${contactRowsFromOpps.size} contacts (embed) seriam upsertados`);
  }
}

// ─── Resource: Contacts paginado (passo 13) ────────────────────────────────────

async function runContacts(runId: string): Promise<void> {
  sep("Contacts paginado (13/14)");
  const m = meta(runId);

  let pageNumber = 1;
  let totalFetched = 0;
  let totalMapped = 0;
  let totalInserted = 0;
  let pages = 0;
  let sampleRow: unknown = undefined;

  while (true) {
    let body: unknown;
    try {
      body = await internalGet("/contacts", { pageNumber: String(pageNumber) });
    } catch (err) {
      const msg = `Falha na página ${pageNumber}: ${String(err)}`;
      log(`ERRO: ${msg}`);
      runErrors.push({ resource: "contacts", message: msg });
      break;
    }

    const resp = body as Record<string, unknown>;
    const contacts = extractArray(resp.contacts ?? resp, "contacts");
    const count = parseInt(String(resp.count ?? "0"), 10); // Quirk: count é STRING
    const hasMore = Boolean(resp.hasMore ?? false);

    if (pageNumber === 1) {
      log(`Total contacts declarado: ${count} (string parse: ${count})`);
      if (count !== 1483) {
        log(`BANDEIRA: esperado 1483, API retornou ${count}`);
        runErrors.push({ resource: "contacts", message: `count inesperado: ${count} (esperado 1483)` });
      }
    }

    totalFetched += contacts.length;
    pages++;

    const rows = contacts.map((c) => {
      const item = c as Record<string, unknown>;
      return {
        id: Number(item.id ?? 0),
        tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
        name: String(item.name ?? ""),
        number: String(item.number ?? ""),
        pushname: item.pushname != null ? String(item.pushname) : null,
        email: item.email != null ? String(item.email) : null,
        channel: String(item.channel ?? "whatsapp"),
        company: null,
        gender: null,
        birth_date: null,
        cep: null,
        pais: null,
        estado: null,
        cidade: null,
        bairro: null,
        logradouro: null,
        numero_endereco: null,
        complemento: null,
        is_number: Boolean(item.isNumber ?? false),
        is_user: Boolean(item.isUser ?? false),
        is_wa_contact: Boolean(item.isWAContact ?? false),
        is_group: Boolean(item.isGroup ?? false),
        is_blacklisted: Boolean(item.isBlacklisted ?? false),
        deleted_at: null,
        profile_pic_url: item.profilePicUrl != null ? String(item.profilePicUrl) : null,
        pic_is_object_storage: item.picIsObjectStorage != null ? Boolean(item.picIsObjectStorage) : null,
        lead_status: item.leadStatus != null ? String(item.leadStatus) : null,
        lead_status_id: null, // não disponível no /contacts list (só no embed da opp)
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
        wallet_id: item.walletId != null ? Number(item.walletId) : null,
        funnels: item.funnels != null ? (item.funnels as Record<string, unknown>) : null,
        lid: item.lid != null ? String(item.lid) : null,
        first_connection: item.firstConnection != null ? Number(item.firstConnection) : null,
        source_created_at: String(item.createdAt ?? m.ingested_at),
        source_updated_at: String(item.updatedAt ?? m.ingested_at),
        raw_payload: item,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      };
    });

    totalMapped += rows.length;
    if (!sampleRow && rows.length > 0) sampleRow = rows[0];

    verbose(`  Página ${pageNumber}: ${contacts.length} contacts (hasMore=${hasMore})`);

    if (!DRY_RUN && shouldRun("contacts")) {
      const r = await sbUpsert("bronze_clickmassa_contacts", rows as Record<string, unknown>[], "id");
      if (r.error) {
        log(`ERRO upsert contacts página ${pageNumber}: ${r.error}`);
        runErrors.push({ resource: "contacts", message: `page ${pageNumber}: ${r.error}` });
      } else {
        totalInserted += r.inserted;
      }
    }

    if (!hasMore || contacts.length === 0) break;
    pageNumber++;
  }

  log(`Contacts: ${totalFetched} fetchados, ${totalMapped} mapeados em ${pages} páginas`);
  recordResult("contacts", {
    fetched: totalFetched,
    mapped: totalMapped,
    would_insert: totalMapped,
    actual_inserted: totalInserted,
    pages,
    sample: sampleRow,
  });

  if (DRY_RUN) {
    log(`[dry-run] ${totalMapped} contacts seriam upsertados`);
  } else {
    log(`Upsert: ${totalInserted} rows em bronze_clickmassa_contacts`);
  }
}

// ─── Resource: Contacts Dashboard (passo 14) ──────────────────────────────────

async function runContactsDashboard(runId: string): Promise<void> {
  sep("Contacts Dashboard (14/14)");
  const m = meta(runId);
  let dashBody: unknown;
  try {
    dashBody = await internalGet("/contacts-dashboard");
  } catch (err) {
    const msg = `Falha ao buscar contacts-dashboard: ${String(err)}`;
    log(`ERRO: ${msg}`);
    runErrors.push({ resource: "contacts-dashboard", message: msg });
    return;
  }

  const dash = dashBody as Record<string, unknown>;
  const recency = (dash.recency ?? {}) as Record<string, number>;

  const row: Record<string, unknown> = {
    snapshot_at: m.ingested_at,
    total: Number(dash.total ?? 0),
    weekly_new: dash.weeklyNew != null ? Number(dash.weeklyNew) : null,
    recency_d30: recency.d30 != null ? Number(recency.d30) : null,
    recency_d90: recency.d90 != null ? Number(recency.d90) : null,
    recency_d180: recency.d180 != null ? Number(recency.d180) : null,
    recency_d360: recency.d360 != null ? Number(recency.d360) : null,
    recency_d360plus: recency.d360plus != null ? Number(recency.d360plus) : null,
    raw_payload: dash,
    ingested_at: m.ingested_at,
    ingestion_run_id: m.ingestion_run_id,
    ingestion_source: m.ingestion_source,
  };

  log(`API: dashboard total=${row.total}, weekly_new=${row.weekly_new}`);
  recordResult("contacts-dashboard", { fetched: 1, mapped: 1, would_insert: 1, sample: row });

  if (!DRY_RUN && shouldRun("contacts-dashboard")) {
    const r = await sbInsert("bronze_clickmassa_contacts_dashboard", [row]);
    if (r.error) {
      log(`ERRO insert contacts-dashboard: ${r.error}`);
      runErrors.push({ resource: "contacts-dashboard", message: r.error });
    } else {
      log(`Insert: ${r.inserted} row em bronze_clickmassa_contacts_dashboard`);
    }
    results["contacts-dashboard"].actual_inserted = r.inserted;
  } else {
    log(`[dry-run] 1 snapshot seria inserido em bronze_clickmassa_contacts_dashboard`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startMs = Date.now();
  const runId = randomUUID();

  const jwtPrev = jwtPreview(CM_KEY);
  console.log("=".repeat(60));
  console.log("  Backfill V2 ETL — ClickMassa → Supabase");
  console.log(`  Modo: ${DRY_RUN ? "DRY-RUN (sem gravação)" : "APPLY (gravando!)"}`);
  if (ONLY_RESOURCE) console.log(`  Recurso: ${ONLY_RESOURCE}`);
  if (SKIP_RESOURCES.size > 0) console.log(`  Skip: ${[...SKIP_RESOURCES].join(", ")}`);
  console.log(`  Run ID: ${runId}`);
  console.log(`  Internal base: ${CM_INTERNAL_BASE}`);
  console.log(`  Internal origin: ${INTERNAL_ORIGIN}`);
  console.log(`  JWT preview: ${jwtPrev}`);
  console.log(`  Pause entre chamadas: ${PAUSE_MS}ms`);
  console.log("=".repeat(60));

  if (!DRY_RUN) {
    await logIngestionStart(runId);
  }

  // Passo 1: ingestion_log já feito acima
  // Passo 2-14: executar em ordem
  if (shouldRun("tags")) await runTags(runId);
  if (shouldRun("users")) await runUsers(runId);
  if (shouldRun("queues")) await runQueues(runId);
  if (shouldRun("settings")) await runSettings(runId);
  if (shouldRun("whatsapp")) await runWhatsapp(runId);
  if (shouldRun("api-config")) await runApiConfig(runId);
  if (shouldRun("funnels")) await runFunnels(runId);
  if (shouldRun("lead-status")) await runLeadStatuses(runId);

  let steps: PipelineStep[] = [];
  if (shouldRun("pipeline-steps") || shouldRun("opportunities")) {
    steps = await runPipelineSteps(runId);
  }

  if (shouldRun("products")) await runProducts(runId);
  if (shouldRun("opportunities")) await runOpportunities(runId, steps);
  if (shouldRun("contacts")) await runContacts(runId);
  if (shouldRun("contacts-dashboard")) await runContactsDashboard(runId);

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
      hasErrors ? runErrors.map((e) => `[${e.resource}] ${e.message}`).join("; ") : null,
    );
  }

  // ─── Sumário ───────────────────────────────────────────────────────────────

  sep("Sumário");
  log(`Duração total: ${durationMs}ms`);
  log(`Status: ${finalStatus}`);
  console.log("\nContagens por recurso:");
  for (const [resource, r] of Object.entries(results)) {
    const inserted = DRY_RUN ? `${r.would_insert} (dry-run)` : String(r.actual_inserted ?? 0);
    console.log(`  ${resource.padEnd(22)} fetched=${r.fetched} would=${r.would_insert} inserted=${inserted}${r.pages ? ` pages=${r.pages}` : ""}`);
  }

  if (hasErrors) {
    console.log("\nErros:");
    for (const e of runErrors) {
      console.log(`  [${e.resource}] ${e.message}`);
    }
  }

  // ─── Salvar output ─────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-").slice(0, 19);
  const prefix = DRY_RUN ? "backfill-v2-dryrun" : "backfill-v2-apply";
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

  if (finalStatus === "failed") {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
