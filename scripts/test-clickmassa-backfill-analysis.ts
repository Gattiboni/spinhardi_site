/**
 * Turno C — Sondagem de janelas e volume da API ClickMassa
 *
 * READ-ONLY. Zero efeito colateral.
 * Sonda: volume por stage, paginacao, filtros temporais, rate limit,
 * shape completo das opps, tags e historico de mensagens.
 *
 * Gera: docs/clickmassa-backfill-analysis.md + docs/samples/opp-{id}.json
 *
 * Uso: npx tsx scripts/test-clickmassa-backfill-analysis.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ─── Carregar .env.local ───────────────────────────────────────────────────

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

// ─── Configuracao ──────────────────────────────────────────────────────────

const URL_BASE = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";
const SUPABASE_URL = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!URL_BASE || !API_KEY) {
  console.error("ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidas. Verifique .env.local.");
  process.exit(1);
}

// Derivar componentes da URL
// URL_BASE = "https://host/v1/api/external/{apiId}"
const lastSlash = URL_BASE.lastIndexOf("/");
const API_ID = URL_BASE.slice(lastSlash + 1);
const URL_BASE_SEM_APIID = URL_BASE.slice(0, lastSlash);

const CM_HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

const DEFAULT_PAUSE_MS = 200;

// ─── Tipos de trabalho ────────────────────────────────────────────────────

interface PipelineStep {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface TimedResponse {
  status: number;
  body: unknown;
  ms: number;
  rlHeaders: string[];
}

interface StageVolume {
  id: number;
  name: string;
  count: number;
  ms: number;
  envelopeKeys: string[];
  envelopeMeta: Record<string, unknown>;
  status: number;
  sampleOppIds: number[];
}

interface PaginationResult {
  label: string;
  qs: string;
  status: number;
  count: number;
  ms: number;
  reducesCount: boolean;
}

interface TemporalResult {
  label: string;
  status: number;
  count: number;
  ms: number;
  plausiblyFilters: boolean;
}

interface RateLimitCall {
  callNum: number;
  status: number;
  ms: number;
  hitLimit: boolean;
}

interface OppSample {
  id: number;
  stageId: number;
  stageName: string;
  topLevelFields: Array<{ name: string; type: string }>;
  contactFields: Array<{ name: string; type: string; sample: string }>;
  hasRealName: boolean;
  contactNumber: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sep(label: string): void {
  console.log(`\n${"═".repeat(65)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(65));
}

async function fetchWithTiming(url: string, extraHeaders?: Record<string, string>): Promise<TimedResponse> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { ...CM_HEADERS, ...extraHeaders },
    });
    const ms = Date.now() - t0;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const rlHeaders: string[] = [];
    for (const hName of [
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
      "x-rate-limit-limit",
      "x-rate-limit-remaining",
    ]) {
      const val = res.headers.get(hName);
      if (val !== null) rlHeaders.push(`${hName}: ${val}`);
    }
    return { status: res.status, body, ms, rlHeaders };
  } catch (err) {
    return { status: -1, body: String(err), ms: Date.now() - t0, rlHeaders: [] };
  }
}

function extractArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["data", "opportunities", "items", "users"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

function getEnvelopeKeys(body: unknown): string[] {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>);
}

function getEnvelopeMeta(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};
  const obj = body as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  for (const key of ["count", "hasMore", "total", "nextPage", "nextCursor", "message", "success"]) {
    if (key in obj) meta[key] = obj[key];
  }
  return meta;
}

function typeLabel(val: unknown): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return `array[${(val as unknown[]).length}]`;
  if (typeof val === "object") return "object";
  return typeof val;
}

function sampleValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return "";
  return ` — ex: ${JSON.stringify(val)}`;
}

// ─── Sub-passo 1a: Supabase cache ─────────────────────────────────────────

async function getPipelineStepsFromSupabase(): Promise<PipelineStep[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.log("    Supabase nao configurado (env ausente), pulando.");
    return [];
  }
  const url = `${SUPABASE_URL}/rest/v1/bronze_clickmassa_pipeline_steps?order=ordem.asc`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.log(`    Supabase REST ${res.status}: ${text.slice(0, 120)}`);
      return [];
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log("    Supabase: tabela vazia ou inexistente.");
      return [];
    }
    return (data as Record<string, unknown>[]).map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ""),
      color: String(row.color ?? ""),
      order: Number(row.ordem ?? 0),
    }));
  } catch (err) {
    console.log(`    Supabase erro: ${String(err)}`);
    return [];
  }
}

// ─── Sub-passo 1b: API direta com retries ─────────────────────────────────

async function getPipelineStepsFromApi(): Promise<PipelineStep[]> {
  const url = `${URL_BASE}/pipeline-steps`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`    Tentativa ${attempt}/3 -> GET /pipeline-steps`);
    const { status, body } = await fetchWithTiming(url);
    console.log(`    Status: ${status}`);
    if (status === 200) {
      let items: unknown[] = [];
      if (Array.isArray(body)) {
        items = body;
      } else if (body !== null && typeof body === "object") {
        const obj = body as Record<string, unknown>;
        if (Array.isArray(obj.data)) items = obj.data as unknown[];
      }
      if (items.length > 0) {
        return (items as Record<string, unknown>[]).map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          color: String(r.color ?? ""),
          order: Number(r.order ?? 0),
        }));
      }
    }
    if (attempt < 3) {
      console.log("    Aguardando 5s antes do retry...");
      await sleep(5000);
    }
  }
  return [];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(65));
  console.log("  Turno C — Sondagem de janelas e volume da API ClickMassa");
  console.log(`  URL_BASE: ${URL_BASE}`);
  console.log(`  API_ID: ${API_ID}`);
  console.log(`  URL_BASE_SEM_APIID: ${URL_BASE_SEM_APIID}`);
  console.log("=".repeat(65));

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 1: Obter pipeline-step IDs");
  // ═══════════════════════════════════════════════════════════════

  let steps: PipelineStep[] = [];
  let stepsSource = "unknown";

  console.log("\n  1a. Tentando cache Supabase (tabela bronze_clickmassa_pipeline_steps)...");
  steps = await getPipelineStepsFromSupabase();
  if (steps.length > 0) {
    stepsSource = "supabase-cache";
    console.log(`  [OK] ${steps.length} step(s) lidos do cache Supabase.`);
  } else {
    console.log("\n  1b. Cache vazio/indisponivel. Tentando API ClickMassa...");
    steps = await getPipelineStepsFromApi();
    if (steps.length > 0) {
      stepsSource = "api";
      console.log(`  [OK] ${steps.length} step(s) obtidos da API.`);
    } else {
      console.error("\n  FATAL: Nao foi possivel obter pipeline steps (cache vazio + API falhou 3x).");
      console.error("  Sem stage IDs, impossivel continuar. Encerrando.");
      process.exit(1);
    }
  }

  console.log(`\n  Source: ${stepsSource}`);
  for (const s of steps) {
    console.log(`  - id=${s.id} "${s.name}" (order=${s.order}, color=${s.color})`);
  }

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 2: Volume por stage");
  // ═══════════════════════════════════════════════════════════════

  const stageVolumes: StageVolume[] = [];

  for (const step of steps) {
    await sleep(DEFAULT_PAUSE_MS);
    const url = `${URL_BASE}/opportunities?pipelineStepId=${step.id}`;
    console.log(`\n  stage ${step.id} "${step.name}":`);
    const { status, body, ms } = await fetchWithTiming(url);
    const items = extractArray(body);
    const envelopeKeys = getEnvelopeKeys(body);
    const envelopeMeta = getEnvelopeMeta(body);
    const sampleOppIds = items
      .slice(0, 3)
      .map((i) => Number((i as Record<string, unknown>).id ?? 0))
      .filter((id) => id > 0);

    console.log(`  HTTP ${status}, ${ms}ms, ${items.length} opps`);
    console.log(`  Envelope keys: [${envelopeKeys.join(", ")}]`);
    console.log(`  Meta: ${JSON.stringify(envelopeMeta)}`);
    if (sampleOppIds.length > 0) {
      console.log(`  Sample opp IDs: [${sampleOppIds.join(", ")}]`);
    }

    stageVolumes.push({
      id: step.id,
      name: step.name,
      count: items.length,
      ms,
      envelopeKeys,
      envelopeMeta,
      status,
      sampleOppIds,
    });
  }

  const totalOpps = stageVolumes.reduce((acc, s) => acc + s.count, 0);
  const largestStage = stageVolumes.reduce(
    (max, s) => (s.count > max.count ? s : max),
    stageVolumes[0],
  );

  console.log(`\n  Total de opps no funil: ${totalOpps}`);
  console.log(`  Stage com mais opps: id=${largestStage.id} "${largestStage.name}" (${largestStage.count} opps)`);

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 3: Sondagem de paginacao implícita");
  // ═══════════════════════════════════════════════════════════════

  const paginationVariants = [
    { label: "page=1&pageSize=10", qs: "page=1&pageSize=10" },
    { label: "limit=10&offset=0",  qs: "limit=10&offset=0" },
    { label: "pageNumber=1",       qs: "pageNumber=1" },
    { label: "size=10",            qs: "size=10" },
    { label: "take=10&skip=0",     qs: "take=10&skip=0" },
  ];

  const paginationResults: PaginationResult[] = [];
  console.log(`\n  Stage de teste: id=${largestStage.id} "${largestStage.name}" (baseline: ${largestStage.count} opps)`);

  for (const variant of paginationVariants) {
    await sleep(DEFAULT_PAUSE_MS);
    const url = `${URL_BASE}/opportunities?pipelineStepId=${largestStage.id}&${variant.qs}`;
    const { status, body, ms } = await fetchWithTiming(url);
    const items = extractArray(body);
    const reducesCount = status === 200 && items.length < largestStage.count;
    console.log(`  [${variant.label}] HTTP ${status}, ${ms}ms, ${items.length} opps${reducesCount ? " ← REDUZ!" : ""}`);
    paginationResults.push({ label: variant.label, qs: variant.qs, status, count: items.length, ms, reducesCount });
  }

  const workingPagination = paginationResults.find((r) => r.reducesCount) ?? null;

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 4: Sondagem de filtros temporais");
  // ═══════════════════════════════════════════════════════════════

  const temporalVariants = [
    { label: "createdAfter=2026-01-01",             qs: "createdAfter=2026-01-01" },
    { label: "createdAt[gte]=2026-01-01",           qs: "createdAt[gte]=2026-01-01" },
    { label: "updatedAfter=2026-06-01",             qs: "updatedAfter=2026-06-01" },
    { label: "from=2026-01-01&to=2026-12-31",       qs: "from=2026-01-01&to=2026-12-31" },
    { label: "startDate=2026-01-01",                qs: "startDate=2026-01-01" },
  ];

  const temporalResults: TemporalResult[] = [];
  console.log(`\n  Stage de teste: id=${largestStage.id} (baseline: ${largestStage.count} opps)`);

  for (const variant of temporalVariants) {
    await sleep(DEFAULT_PAUSE_MS);
    const url = `${URL_BASE}/opportunities?pipelineStepId=${largestStage.id}&${variant.qs}`;
    const { status, body, ms } = await fetchWithTiming(url);
    const items = extractArray(body);
    // Plausivel = count diferente E menor que baseline (nao maior, o que seria bug)
    const plausiblyFilters = status === 200 && items.length !== largestStage.count && items.length < largestStage.count;
    console.log(`  [${variant.label}] HTTP ${status}, ${ms}ms, ${items.length} opps${plausiblyFilters ? " ← FILTRA PLAUS.!" : ""}`);
    temporalResults.push({ label: variant.label, status, count: items.length, ms, plausiblyFilters });
  }

  const workingTemporalFilter = temporalResults.find((r) => r.plausiblyFilters) ?? null;

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 5: Teste de rate limit / throttling (15 chamadas sem pausa)");
  // ═══════════════════════════════════════════════════════════════

  const testStageForRL = stageVolumes.find((s) => s.count > 0) ?? stageVolumes[0];
  const rateLimitCalls: RateLimitCall[] = [];
  let hitRateLimit = false;

  console.log(`\n  Stage de teste: id=${testStageForRL.id} "${testStageForRL.name}"`);
  console.log("  15 chamadas sequenciais sem pausa...");

  for (let i = 1; i <= 15; i++) {
    const url = `${URL_BASE}/opportunities?pipelineStepId=${testStageForRL.id}`;
    const { status, ms, rlHeaders } = await fetchWithTiming(url);
    const isLimitHit = status === 429 || status === 503;

    const headerNote = rlHeaders.length > 0 ? ` [${rlHeaders.join(", ")}]` : "";
    const limitNote = isLimitHit ? " ← RATE LIMIT!" : "";
    console.log(`  [${i.toString().padStart(2)}/15] HTTP ${status}, ${ms}ms${limitNote}${headerNote}`);

    rateLimitCalls.push({ callNum: i, status, ms, hitLimit: isLimitHit });

    if (isLimitHit) {
      hitRateLimit = true;
      const retryAfterStr = rlHeaders.find((h) => h.startsWith("retry-after:"));
      const retryAfterSec = retryAfterStr
        ? Number(retryAfterStr.split(":")[1].trim())
        : 30;
      const pauseMs = Math.min(retryAfterSec * 1000, 30000);
      console.log(`  Aguardando ${pauseMs / 1000}s antes de continuar...`);
      await sleep(pauseMs);
    }
  }

  const avgLatency = rateLimitCalls.reduce((acc, r) => acc + r.ms, 0) / rateLimitCalls.length;
  const firstHalfAvg = rateLimitCalls.slice(0, 7).reduce((acc, r) => acc + r.ms, 0) / 7;
  const secondHalfAvg = rateLimitCalls.slice(8).reduce((acc, r) => acc + r.ms, 0) / 7;
  const throttlingNote =
    secondHalfAvg > firstHalfAvg * 1.5
      ? `SIM — latência cresceu (primeiras 7: ${firstHalfAvg.toFixed(0)}ms, últimas 7: ${secondHalfAvg.toFixed(0)}ms)`
      : `Nao evidente (primeiras 7: ${firstHalfAvg.toFixed(0)}ms, últimas 7: ${secondHalfAvg.toFixed(0)}ms)`;

  console.log(`\n  Media latencia: ${avgLatency.toFixed(0)}ms`);
  console.log(`  Rate limit atingido: ${hitRateLimit ? "SIM" : "NAO"}`);
  console.log(`  Throttling soft: ${throttlingNote}`);

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 6: Amostragem de payload completo");
  // ═══════════════════════════════════════════════════════════════

  // Coletar ate 3 opp IDs de stages diferentes
  const toSample: Array<{ id: number; stageId: number; stageName: string }> = [];
  for (const stage of stageVolumes) {
    if (toSample.length >= 3) break;
    if (stage.sampleOppIds.length > 0 && !toSample.some((s) => s.stageId === stage.id)) {
      toSample.push({ id: stage.sampleOppIds[0], stageId: stage.id, stageName: stage.name });
    }
  }
  // Completar ate 3 se nao tiver stages suficientes com opps distintas
  for (const stage of stageVolumes) {
    if (toSample.length >= 3) break;
    for (const oppId of stage.sampleOppIds) {
      if (toSample.length >= 3) break;
      if (!toSample.some((s) => s.id === oppId)) {
        toSample.push({ id: oppId, stageId: stage.id, stageName: stage.name });
      }
    }
  }

  if (toSample.length === 0) {
    console.log("\n  Nenhuma opp disponivel para amostrar (todos os stages vazios).");
  }

  const samplesDir = join(process.cwd(), "docs", "samples");
  if (!existsSync(samplesDir)) {
    mkdirSync(samplesDir, { recursive: true });
    console.log(`\n  Criado: docs/samples/`);
  }

  const oppSamples: OppSample[] = [];
  let envelopeMetaSample: Record<string, unknown> | null = null;

  for (const { id: oppId, stageId, stageName } of toSample) {
    await sleep(DEFAULT_PAUSE_MS);
    const url = `${URL_BASE}/opportunities/${oppId}`;
    console.log(`\n  GET /opportunities/${oppId} (stage "${stageName}")`);
    const { status, body, ms } = await fetchWithTiming(url);
    console.log(`  HTTP ${status}, ${ms}ms`);

    if (status !== 200) {
      console.log("  Erro — pulando esta opp.");
      continue;
    }

    // Captura envelope meta para sub-passo 2 refinement
    if (!envelopeMetaSample) {
      envelopeMetaSample = getEnvelopeMeta(body);
    }

    const rawObj = body as Record<string, unknown>;
    const data = (rawObj.data ?? rawObj) as Record<string, unknown>;

    const topLevelFields = Object.keys(data).map((name) => ({
      name,
      type: typeLabel(data[name]),
    }));

    const contact =
      data.contact !== null && typeof data.contact === "object"
        ? (data.contact as Record<string, unknown>)
        : null;

    const contactFields = contact
      ? Object.keys(contact).map((name) => ({
          name,
          type: typeLabel(contact[name]),
          sample: sampleValue(contact[name]),
        }))
      : [];

    const contactName = typeof contact?.name === "string" ? contact.name : "";
    const contactNumber = typeof contact?.number === "string" ? contact.number : "";
    const hasRealName =
      contactName !== "" &&
      contactName !== contactNumber &&
      !/^\d+$/.test(contactName);

    if (hasRealName) {
      console.log(`  [DESTAQUE] contact.name = "${contactName}" (nome real!)`);
    } else {
      console.log(`  contact.name = "${contactName}" (parece numero de telefone)`);
    }
    console.log(`  Campos top-level: [${topLevelFields.map((f) => f.name).join(", ")}]`);
    console.log(`  Campos contact: [${contactFields.map((f) => f.name).join(", ")}]`);

    // Dump JSON
    const dumpPath = join(samplesDir, `opp-${oppId}.json`);
    writeFileSync(dumpPath, JSON.stringify(body, null, 2), "utf-8");
    console.log(`  Dumped -> docs/samples/opp-${oppId}.json`);

    oppSamples.push({
      id: oppId,
      stageId,
      stageName,
      topLevelFields,
      contactFields,
      hasRealName,
      contactNumber,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 7: Tags em opps");
  // ═══════════════════════════════════════════════════════════════

  const tagsInOppsNotes: string[] = [];

  for (const sample of oppSamples) {
    const sampleFile = join(samplesDir, `opp-${sample.id}.json`);
    const raw: unknown = JSON.parse(readFileSync(sampleFile, "utf-8"));
    const rawObj = raw as Record<string, unknown>;
    const data = (rawObj.data ?? rawObj) as Record<string, unknown>;

    if ("tags" in data) {
      const note = `opp ${sample.id}: campo 'tags' top-level = ${JSON.stringify(data.tags)}`;
      console.log(`  ${note}`);
      tagsInOppsNotes.push(note);
    }
    if ("tagsId" in data) {
      const note = `opp ${sample.id}: campo 'tagsId' = ${JSON.stringify(data.tagsId)}`;
      console.log(`  ${note}`);
      tagsInOppsNotes.push(note);
    }
    const contact =
      data.contact !== null && typeof data.contact === "object"
        ? (data.contact as Record<string, unknown>)
        : null;
    if (contact && "tags" in contact) {
      const note = `opp ${sample.id}: contact.tags = ${JSON.stringify(contact.tags)}`;
      console.log(`  ${note}`);
      tagsInOppsNotes.push(note);
    }
  }

  await sleep(DEFAULT_PAUSE_MS);
  const tagsUrl = `${URL_BASE}/tags`;
  console.log(`\n  GET /tags`);
  const { status: tagsStatus, body: tagsBody, ms: tagsMs } = await fetchWithTiming(tagsUrl);
  const tagsArray = extractArray(tagsBody);
  console.log(`  HTTP ${tagsStatus}, ${tagsMs}ms, ${tagsArray.length} tags`);

  let tagFields: string[] = [];
  let tagExample = "";
  let tagHasUsageCount = false;

  if (tagsArray.length > 0) {
    const firstTag = tagsArray[0] as Record<string, unknown>;
    tagFields = Object.keys(firstTag);
    tagExample = JSON.stringify(firstTag);
    tagHasUsageCount = tagFields.some(
      (k) => k.toLowerCase().includes("usage") || k.toLowerCase().includes("count"),
    );
    console.log(`  Campos de uma tag: [${tagFields.join(", ")}]`);
    console.log(`  Exemplo: ${tagExample}`);
    console.log(`  Tem usageCount ou similar: ${tagHasUsageCount ? "SIM" : "NAO"}`);
  }

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 8: Histórico de mensagens (sondagem leve)");
  // ═══════════════════════════════════════════════════════════════

  interface MessagesProbe {
    tried: boolean;
    externalKeyUsed: string;
    status: number;
    ms: number;
    count: number;
    envelopeKeys: string[];
    envelopeMeta: Record<string, unknown>;
    msgFields: string[];
  }

  let messagesProbe: MessagesProbe | null = null;

  const oppWithNumber = oppSamples.find((s) => s.contactNumber !== "");
  if (oppWithNumber) {
    const externalKey = oppWithNumber.contactNumber;
    // Endpoint: GET /v1/api/external/messages/{apiId}/{externalKey}?pageNumber=1
    const msgUrl = `${URL_BASE_SEM_APIID}/messages/${API_ID}/${encodeURIComponent(externalKey)}?pageNumber=1`;
    console.log(`\n  externalKey (contact.number): ${externalKey}`);
    console.log(`  URL: ${msgUrl}`);
    await sleep(DEFAULT_PAUSE_MS);
    const { status, body, ms } = await fetchWithTiming(msgUrl);
    console.log(`  HTTP ${status}, ${ms}ms`);
    const msgs = extractArray(body);
    const envKeys = getEnvelopeKeys(body);
    const envMeta = getEnvelopeMeta(body);
    console.log(`  Mensagens: ${msgs.length}`);
    console.log(`  Envelope keys: [${envKeys.join(", ")}]`);
    console.log(`  Meta: ${JSON.stringify(envMeta)}`);
    const msgFields =
      msgs.length > 0 ? Object.keys(msgs[0] as Record<string, unknown>) : [];
    if (msgFields.length > 0) {
      console.log(`  Campos de uma mensagem: [${msgFields.join(", ")}]`);
    }
    messagesProbe = {
      tried: true,
      externalKeyUsed: externalKey,
      status,
      ms,
      count: msgs.length,
      envelopeKeys: envKeys,
      envelopeMeta: envMeta,
      msgFields,
    };
  } else {
    console.log("\n  Nenhum contact.number disponivel nas amostras. Sub-passo 8 pulado.");
  }

  // ═══════════════════════════════════════════════════════════════
  sep("Sub-passo 9: Gerando docs/clickmassa-backfill-analysis.md");
  // ═══════════════════════════════════════════════════════════════

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace("T", " ");
  const lines: string[] = [];

  // ── Header ──
  lines.push("# Análise de Janelas e Volume — Backfill ClickMassa");
  lines.push("");
  lines.push(`Gerado em: ${dateStr} (UTC)`);
  lines.push(`Base URL: ${URL_BASE}`);
  lines.push(`Pipeline steps source: ${stepsSource}`);
  lines.push("");

  // ── Volume por stage ──
  lines.push("## Volume por Pipeline-Step");
  lines.push("");
  lines.push("| ID | Nome | Count | Latência (ms) | Envelope keys |");
  lines.push("|---|---|---|---|---|");
  for (const s of stageVolumes) {
    lines.push(`| ${s.id} | ${s.name} | ${s.count} | ${s.ms} | \`[${s.envelopeKeys.join(", ")}]\` |`);
  }
  lines.push("");
  lines.push(`**Total estimado de opps no funil**: ${totalOpps}`);
  lines.push(`**Stage com mais opps**: id=${largestStage.id} "${largestStage.name}" (${largestStage.count} opps)`);
  lines.push("");

  // ── Envelope meta ──
  const metaSample = stageVolumes.find((s) => Object.keys(s.envelopeMeta).length > 0);
  if (metaSample) {
    lines.push("### Shape do envelope de listagem");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(metaSample.envelopeMeta, null, 2));
    lines.push("```");
    lines.push("");
  }

  // ── Paginação ──
  lines.push("## Paginação");
  lines.push("");
  lines.push(`Stage de teste: id=${largestStage.id} "${largestStage.name}" (baseline: ${largestStage.count} opps)`);
  lines.push("");
  lines.push("| Param testado | Status | Count retornado | Efeito |");
  lines.push("|---|---|---|---|");
  for (const r of paginationResults) {
    lines.push(`| \`${r.label}\` | ${r.status} | ${r.count} | ${r.reducesCount ? "✓ REDUZ" : "sem efeito"} |`);
  }
  lines.push("");
  if (workingPagination) {
    lines.push(`**Paginação funcional**: \`${workingPagination.label}\` (count ${workingPagination.count} vs baseline ${largestStage.count})`);
  } else {
    lines.push("**Resultado**: Nenhum parâmetro de paginação reduziu o count. API provavelmente retorna tudo de uma vez por stage.");
  }
  lines.push("");

  // ── Filtros temporais ──
  lines.push("## Filtros Temporais");
  lines.push("");
  lines.push(`Stage de teste: id=${largestStage.id} (baseline: ${largestStage.count} opps)`);
  lines.push("");
  lines.push("| Filtro testado | Status | Count retornado | Efeito |");
  lines.push("|---|---|---|---|");
  for (const r of temporalResults) {
    lines.push(`| \`${r.label}\` | ${r.status} | ${r.count} | ${r.plausiblyFilters ? "✓ FILTRA" : "sem efeito"} |`);
  }
  lines.push("");
  if (workingTemporalFilter) {
    lines.push(`**Filtro temporal funcional**: \`${workingTemporalFilter.label}\``);
  } else {
    lines.push("**Resultado**: Nenhum filtro temporal funcionou. A API retorna todas as opps independente da data.");
  }
  lines.push("");

  // ── Rate limit ──
  lines.push("## Rate Limit / Throttling");
  lines.push("");
  lines.push(`15 chamadas seguidas sem pausa — stage id=${testStageForRL.id} "${testStageForRL.name}":`);
  lines.push("");
  lines.push("| Chamada | Status | Latência (ms) | Rate limit? |");
  lines.push("|---|---|---|---|");
  for (const r of rateLimitCalls) {
    lines.push(`| ${r.callNum} | ${r.status} | ${r.ms} | ${r.hitLimit ? "SIM ⚠️" : "—"} |`);
  }
  lines.push("");
  lines.push(`**Media de latência**: ${avgLatency.toFixed(0)}ms`);
  lines.push(`**Rate limit atingido**: ${hitRateLimit ? "SIM ⚠️" : "NAO"}`);
  lines.push(`**Throttling soft**: ${throttlingNote}`);
  lines.push("");

  // ── Shape de Opportunity ──
  lines.push("## Shape de Opportunity (completo)");
  lines.push("");
  if (oppSamples.length > 0) {
    const firstSample = oppSamples[0];
    lines.push(`Campos top-level (opp ${firstSample.id}, stage "${firstSample.stageName}"):`);
    lines.push("");
    for (const f of firstSample.topLevelFields) {
      lines.push(`- \`${f.name}\`: ${f.type}`);
    }
    lines.push("");

    lines.push("### Contact embedado em Opportunity");
    lines.push("");
    if (firstSample.contactFields.length > 0) {
      lines.push(`Campos do contact embed (opp ${firstSample.id}):`);
      lines.push("");
      for (const f of firstSample.contactFields) {
        lines.push(`- \`${f.name}\`: ${f.type}${f.sample}`);
      }
      lines.push("");
      const realNameSample = oppSamples.find((s) => s.hasRealName);
      if (realNameSample) {
        lines.push(`**Destaque**: opp ${realNameSample.id} tem \`contact.name\` com nome real (não número de telefone).`);
      } else {
        lines.push("**Nota**: Todas as opps amostradas têm `contact.name` = número de telefone (sem nome cadastrado no CRM).");
      }
    } else {
      lines.push("Contact embed ausente nas amostras.");
    }
  } else {
    lines.push("Nenhuma opp disponível para amostrar (todos os stages vazios).");
  }
  lines.push("");

  // ── Tags ──
  lines.push("## Tags");
  lines.push("");
  lines.push(`\`GET /tags\`: HTTP ${tagsStatus}, ${tagsMs}ms, ${tagsArray.length} tags`);
  if (tagFields.length > 0) {
    lines.push("");
    lines.push(`Campos de uma tag: \`${tagFields.join(", ")}\``);
    lines.push(`Exemplo: \`${tagExample}\``);
    lines.push(`Tem \`usageCount\` ou similar: ${tagHasUsageCount ? "SIM" : "NAO"}`);
  }
  if (tagsInOppsNotes.length > 0) {
    lines.push("");
    lines.push("Tags observadas nas opps amostradas:");
    for (const note of tagsInOppsNotes) {
      lines.push(`- ${note}`);
    }
  }
  lines.push("");

  // ── Histórico de mensagens ──
  lines.push("## Histórico de Mensagens");
  lines.push("");
  if (!messagesProbe || !messagesProbe.tried) {
    lines.push("Sub-passo pulado: nenhum `contact.number` disponível nas amostras ou opps vazias.");
  } else {
    lines.push(`\`externalKey\` testada (contact.number): \`${messagesProbe.externalKeyUsed}\``);
    lines.push(`HTTP ${messagesProbe.status}, ${messagesProbe.ms}ms, ${messagesProbe.count} mensagens`);
    lines.push(`Envelope keys: \`[${messagesProbe.envelopeKeys.join(", ")}]\``);
    lines.push(`Meta: \`${JSON.stringify(messagesProbe.envelopeMeta)}\``);
    if (messagesProbe.msgFields.length > 0) {
      lines.push("");
      lines.push(`Campos de uma mensagem: \`${messagesProbe.msgFields.join(", ")}\``);
    }
  }
  lines.push("");

  // ── Dumps gerados ──
  lines.push("## Dumps Gerados");
  lines.push("");
  if (oppSamples.length > 0) {
    for (const sample of oppSamples) {
      lines.push(`- \`docs/samples/opp-${sample.id}.json\` — stage "${sample.stageName}"`);
    }
  } else {
    lines.push("Nenhum dump gerado (stages vazios).");
  }
  lines.push("");

  // ── Recomendação ETL ──
  lines.push("## Recomendação de Estratégia ETL");
  lines.push("");
  lines.push("Baseado nos achados desta sondagem:");
  lines.push("");
  lines.push(`- **Estratégia de listagem**: ${steps.length} GETs (1 por pipeline step). Sem endpoint "listar tudo" — \`pipelineStepId\` é obrigatório.`);

  if (workingPagination) {
    lines.push(`- **Paginação**: Disponível via \`${workingPagination.label}\`. Usar para stages com alto volume.`);
  } else {
    lines.push("- **Paginação**: Não funcional para `/opportunities`. API retorna todas as opps do stage de uma vez. Monitorar tamanho de response se volume crescer.");
  }

  if (workingTemporalFilter) {
    lines.push(`- **Filtro temporal**: Disponível via \`${workingTemporalFilter.label}\`. Backfill incremental possível.`);
  } else {
    lines.push("- **Filtro temporal**: Indisponível. Backfill incremental requer comparação com `clickmassa_ultimo_sync` local (Supabase). A cada sync, comparar `opp.updatedAt` com o timestamp do último sync.");
  }

  lines.push(`- **Latência média**: ${avgLatency.toFixed(0)}ms por chamada.`);
  lines.push(`- **Rate limit**: ${hitRateLimit ? "Atingido em 15 chamadas seguidas. Respeitar Retry-After header." : `Não observado em 15 chamadas seguidas. Pausa de ${DEFAULT_PAUSE_MS}ms entre chamadas deve ser segura.`}`);
  lines.push(`- **Estimativa tempo (listagem por stage)**: ${steps.length} stages × ~${avgLatency.toFixed(0)}ms ≈ ${((steps.length * Number(avgLatency.toFixed(0))) / 1000).toFixed(1)}s`);
  lines.push(`- **Estimativa tempo (opps individuais)**: ${totalOpps} opps × (~${avgLatency.toFixed(0)}ms + ${DEFAULT_PAUSE_MS}ms pausa) ≈ ${((totalOpps * (Number(avgLatency.toFixed(0)) + DEFAULT_PAUSE_MS)) / 1000 / 60).toFixed(1)} minutos`);
  lines.push("");

  // ── Bandeiras ──
  lines.push("## Bandeiras");
  lines.push("");
  lines.push(`1. Pipeline steps obtidos via: **${stepsSource}**`);
  lines.push(`2. Paginação em /opportunities: **${workingPagination ? `funciona via ${workingPagination.label}` : "nao funciona (retorna tudo de uma vez)"}**`);
  lines.push(`3. Filtro temporal: **${workingTemporalFilter ? `funciona via ${workingTemporalFilter.label}` : "nao funciona — sem filtro incremental nativo"}**`);
  lines.push(`4. Rate limit: **${hitRateLimit ? "atingido!" : "nao observado em 15 chamadas"}**`);
  const realNameCount = oppSamples.filter((s) => s.hasRealName).length;
  lines.push(`5. Opps com contact.name real (nao numero): **${realNameCount}/${oppSamples.length}** amostradas`);
  lines.push(`6. Tags nas opps: **${tagsInOppsNotes.length > 0 ? `visto em ${tagsInOppsNotes.length} campo(s)` : "nao observado nas amostras"}**`);
  if (!workingTemporalFilter) {
    lines.push("");
    lines.push("> **Impacto no ETL**: Sem filtro temporal nativo, o backfill inicial precisará percorrer todas as opps de todos os stages. Backfill incremental será baseado em comparação local (`clickmassa_opp.updatedAt > contacts.clickmassa_ultimo_sync`). Recomendado: salvar timestamp de cada sync completo por stage.");
  }
  lines.push("");

  const reportPath = join(process.cwd(), "docs", "clickmassa-backfill-analysis.md");
  writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(`\n  Relatorio gerado: docs/clickmassa-backfill-analysis.md`);
  console.log(`  Dumps: docs/samples/ (${oppSamples.length} arquivos)`);

  console.log(`\n${"=".repeat(65)}`);
  console.log("  Turno C concluido.");
  console.log("=".repeat(65));
}

main().catch((err: unknown) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
