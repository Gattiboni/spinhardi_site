/**
 * Turno A - Glossario operacional da API ClickMassa.
 *
 * Smoke autocontido (sem import 'server-only', sem @/ aliases).
 * Carrega .env.local manualmente para ter CLICKMASSA_API_URL e CLICKMASSA_API_KEY.
 *
 * Uso: npx tsx scripts/test-clickmassa-glossary.ts
 *
 * Total: ~30 chamadas GET, todas read-only e idempotentes.
 * Pausas de 200ms entre chamadas pra evitar rate limit.
 * Retry de 1x apos 2s em 500 (Quirk 2: pipeline-steps).
 */

import { readFileSync } from "fs";
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

const API_URL = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";

if (!API_URL || !API_KEY) {
  console.error(
    "ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidas. Verifique .env.local.",
  );
  process.exit(1);
}

// Deriva URL_BASE_SEM_APIID e API_ID a partir do URL_BASE
const lastSlash = API_URL.lastIndexOf("/");
const API_ID = API_URL.slice(lastSlash + 1);
const API_PARENT = API_URL.slice(0, lastSlash); // ex: .../v1/api/external

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ProbeResult {
  label: string;
  url: string;
  status: number;
  ok: boolean;
  body: unknown;
  truncatedBody: string;
  retried: boolean;
  errorOnRetry: boolean;
}

async function fetchOnce(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: HEADERS });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return { status: res.status, body };
}

async function probe(
  label: string,
  url: string,
  opts: { retryOn500?: boolean } = {},
): Promise<ProbeResult> {
  let result = await fetchOnce(url);
  let retried = false;
  let errorOnRetry = false;

  if (result.status === 500 && opts.retryOn500) {
    retried = true;
    await sleep(2000);
    try {
      result = await fetchOnce(url);
    } catch {
      errorOnRetry = true;
    }
  }

  const bodyStr = JSON.stringify(result.body ?? "");
  const truncatedBody = bodyStr.length > 500 ? bodyStr.slice(0, 500) + "..." : bodyStr;

  return {
    label,
    url,
    status: result.status,
    ok: result.status >= 200 && result.status < 300,
    body: result.body,
    truncatedBody,
    retried,
    errorOnRetry,
  };
}

function extractTopLevelShape(body: unknown): string {
  if (!body || typeof body !== "object") return typeof body;
  if (Array.isArray(body)) {
    if (body.length === 0) return "Array(0)";
    const first = body[0];
    if (first && typeof first === "object") {
      return `Array[{${Object.keys(first as object).join(", ")}}]`;
    }
    return `Array(${body.length})`;
  }
  const obj = body as Record<string, unknown>;
  const topKeys = Object.keys(obj).join(", ");
  // Envelopes comuns: { success, data, count, message }
  const dataVal = obj.data;
  if (Array.isArray(dataVal) && dataVal.length > 0) {
    const first = dataVal[0];
    if (first && typeof first === "object") {
      return `{${topKeys}} | data[0]={${Object.keys(first as object).join(", ")}}`;
    }
    return `{${topKeys}} | data=Array(${dataVal.length})`;
  }
  if (dataVal && typeof dataVal === "object" && !Array.isArray(dataVal)) {
    return `{${topKeys}} | data={${Object.keys(dataVal as object).join(", ")}}`;
  }
  return `{${topKeys}}`;
}

function sep(title: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

function row(r: ProbeResult) {
  const flag = r.ok
    ? "OK "
    : r.status === -1
      ? "ERR"
      : r.status.toString().padStart(3);
  const retry = r.retried ? ` [retried${r.errorOnRetry ? " FALHOU" : ""}]` : "";
  console.log(
    `  [${flag}]${retry} ${r.label}`,
  );
  if (r.ok) {
    console.log(`         shape: ${extractTopLevelShape(r.body)}`);
  } else {
    console.log(`         erro:  ${r.truncatedBody}`);
  }
}

// ─── Coleta resultados por grupo ───────────────────────────────────────────

const RESULTS: ProbeResult[] = [];

async function run(label: string, url: string, opts: { retryOn500?: boolean } = {}) {
  await sleep(200);
  const r = await probe(label, url, opts);
  RESULTS.push(r);
  row(r);
  return r;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("  ClickMassa Glossary Probe - Turno A");
  console.log(`  URL_BASE:          ${API_URL}`);
  console.log(`  API_ID:            ${API_ID}`);
  console.log(`  URL_BASE_SEM_APIID: ${API_PARENT}`);
  console.log("=".repeat(70));

  // ── Grupo 1: Confirmacao de objetos criados nos smokes anteriores ─────────

  sep("Grupo 1: Confirmacao de objetos do smoke G.2.b");

  await run("GET /opportunities/8935", `${API_URL}/opportunities/8935`);
  await run(
    "GET users/{apiId} (Quirk 1)",
    `${API_PARENT}/users/${API_ID}`,
  );
  await run(
    "GET /pipeline-steps (Quirk 2, retry on 500)",
    `${API_URL}/pipeline-steps`,
    { retryOn500: true },
  );
  await run("GET /tags (sanity check)", `${API_URL}/tags`);

  // ── Grupo 2: Variacoes de listOpportunities ───────────────────────────────

  sep("Grupo 2: Variacoes de listOpportunities (descobrir param que desbloqueia)");

  await run(
    "GET /opportunities (controle, esperado 404/erro)",
    `${API_URL}/opportunities`,
  );
  await run(
    "GET /opportunities?contactId=109710",
    `${API_URL}/opportunities?contactId=109710`,
  );
  await run(
    "GET /opportunities?pipelineStepId=73",
    `${API_URL}/opportunities?pipelineStepId=73`,
  );
  await run(
    "GET /opportunities?status=open",
    `${API_URL}/opportunities?status=open`,
  );
  await run(
    "GET /opportunities?responsibleId=164",
    `${API_URL}/opportunities?responsibleId=164`,
  );
  await run(
    "GET /opportunities?contactPipelineId=1",
    `${API_URL}/opportunities?contactPipelineId=1`,
  );
  await run(
    "GET /opportunities?pipelineId=1",
    `${API_URL}/opportunities?pipelineId=1`,
  );
  await run(
    "GET /opportunities?page=1&pageSize=20",
    `${API_URL}/opportunities?page=1&pageSize=20`,
  );
  await run(
    "GET /opportunities?limit=20&offset=0",
    `${API_URL}/opportunities?limit=20&offset=0`,
  );

  // ── Grupo 3: Endpoints nao-documentados (apiId no meio) ──────────────────

  sep("Grupo 3: Endpoints nao-documentados (padrao apiId no meio)");

  await run("GET /contacts", `${API_URL}/contacts`);
  await run("GET /contacts/109710", `${API_URL}/contacts/109710`);
  await run("GET /tickets", `${API_URL}/tickets`);
  await run("GET /tickets/206673", `${API_URL}/tickets/206673`);
  await run("GET /contact-pipelines (kebab)", `${API_URL}/contact-pipelines`);
  await run("GET /contactPipelines (camel)", `${API_URL}/contactPipelines`);
  await run("GET /closing-reasons (kebab)", `${API_URL}/closing-reasons`);
  await run("GET /closingReasons (camel)", `${API_URL}/closingReasons`);
  await run(
    "GET /gain-or-loss-reasons (kebab)",
    `${API_URL}/gain-or-loss-reasons`,
  );
  await run(
    "GET /gainOrLossReasons (camel)",
    `${API_URL}/gainOrLossReasons`,
  );
  await run("GET /queues", `${API_URL}/queues`);
  await run("GET /departments", `${API_URL}/departments`);
  await run("GET /channels", `${API_URL}/channels`);

  // ── Grupo 4: Endpoints com apiId no final (padrao Quirk 1) ───────────────

  sep("Grupo 4: Endpoints com apiId no final (Quirk 1 pattern)");

  await run(
    "GET /contacts/{apiId} (Quirk1-alt)",
    `${API_PARENT}/contacts/${API_ID}`,
  );
  await run(
    "GET /tickets/{apiId} (Quirk1-alt)",
    `${API_PARENT}/tickets/${API_ID}`,
  );
  await run(
    "GET /closing-reasons/{apiId} (Quirk1-alt)",
    `${API_PARENT}/closing-reasons/${API_ID}`,
  );
  await run(
    "GET /gain-or-loss-reasons/{apiId} (Quirk1-alt)",
    `${API_PARENT}/gain-or-loss-reasons/${API_ID}`,
  );
  await run(
    "GET /queues/{apiId} (Quirk1-alt)",
    `${API_PARENT}/queues/${API_ID}`,
  );
  await run(
    "GET /departments/{apiId} (Quirk1-alt)",
    `${API_PARENT}/departments/${API_ID}`,
  );

  // ── Resumo ─────────────────────────────────────────────────────────────────

  sep("Resumo final");
  console.log(
    `  Total sondagens: ${RESULTS.length}`,
  );
  const ok = RESULTS.filter((r) => r.ok);
  const not200 = RESULTS.filter((r) => !r.ok);
  console.log(`  Respostas 2xx: ${ok.length}`);
  console.log(`  Respostas nao-2xx: ${not200.length}`);

  console.log("\n  --- 2xx (endpoints que respondem) ---");
  for (const r of ok) {
    console.log(`    ${r.status} ${r.label}`);
    console.log(`         shape: ${extractTopLevelShape(r.body)}`);
  }

  console.log("\n  --- Nao-2xx ---");
  for (const r of not200) {
    console.log(`    ${r.status} ${r.label}`);
    console.log(`         erro: ${r.truncatedBody}`);
  }

  // Imprime shapes completos dos objetos encontrados nos smokes
  const opp8935 = RESULTS.find((r) => r.label === "GET /opportunities/8935");
  if (opp8935?.ok) {
    sep("Shape completo: Opportunity 8935");
    const data =
      opp8935.body && typeof opp8935.body === "object"
        ? ((opp8935.body as Record<string, unknown>).data ?? opp8935.body)
        : opp8935.body;
    console.log(JSON.stringify(data, null, 2));
  }

  const contacts109710 = RESULTS.find((r) => r.label === "GET /contacts/109710");
  if (contacts109710?.ok) {
    sep("Shape completo: Contact 109710");
    const data =
      contacts109710.body && typeof contacts109710.body === "object"
        ? ((contacts109710.body as Record<string, unknown>).data ?? contacts109710.body)
        : contacts109710.body;
    console.log(JSON.stringify(data, null, 2));
  }

  const ticket206673 = RESULTS.find((r) => r.label === "GET /tickets/206673");
  if (ticket206673?.ok) {
    sep("Shape completo: Ticket 206673");
    const data =
      ticket206673.body && typeof ticket206673.body === "object"
        ? ((ticket206673.body as Record<string, unknown>).data ?? ticket206673.body)
        : ticket206673.body;
    console.log(JSON.stringify(data, null, 2));
  }

  // Imprime resultados das variacoes de listOpportunities para analise
  sep("Analise: variacoes de listOpportunities");
  const oppGroup = RESULTS.filter((r) => r.label.startsWith("GET /opportunities"));
  for (const r of oppGroup) {
    const flag = r.ok ? "200" : String(r.status);
    console.log(`  [${flag}] ${r.label}`);
    if (r.ok) {
      console.log(`       shape: ${extractTopLevelShape(r.body)}`);
    } else {
      console.log(`       erro: ${r.truncatedBody}`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  Probe Turno A concluido.");
  console.log("=".repeat(70));

  // Retorna dados brutos para uso externo (glossario)
  return RESULTS;
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
