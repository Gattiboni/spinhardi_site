/**
 * Turno H.1 — Exploração de rotas internas ClickMassa (Whaticket fork)
 *
 * READ-ONLY (apenas GET). Zero mutação no CRM.
 * Descobre o terreno da API interna (não-externa) e reporta shapes + volume.
 *
 * Outputs:
 *   docs/clickmassa-internal-endpoints.md
 *   docs/samples/clickmassa-internal/<endpoint>.json
 *   docs/clickmassa-internal-exploration-<timestamp>.json
 *
 * Uso: npx tsx scripts/explore-clickmassa-internal.ts
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

// ─── Config ────────────────────────────────────────────────────────────────

const EXTERNAL_URL = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";

if (!EXTERNAL_URL || !API_KEY) {
  console.error("ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidos");
  process.exit(1);
}

// Extrai apenas o host: https://enterprise-352napi.clickmassa.com.br
const HOST = new URL(EXTERNAL_URL).origin;

const KEY_PREVIEW = API_KEY.slice(0, 8) + "...";
const DELAY_MS = 300;
const TIMEOUT_MS = 15_000;

// ─── Tipos internos ─────────────────────────────────────────────────────────

interface CallResult {
  path: string;
  url: string;
  status: number | null;
  latencyMs: number;
  bodySize: number;
  bodyPreview: string;
  parsed: unknown;
  error: string | null;
  group: string;
  label: string;
}

interface LogEntry {
  seq: number;
  path: string;
  status: number | null;
  latencyMs: number;
  bodySize: number;
  error: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safePreview(parsed: unknown, maxLen = 500): string {
  try {
    const s = JSON.stringify(parsed, null, 2);
    return s.length > maxLen ? s.slice(0, maxLen) + "\n... [truncado]" : s;
  } catch {
    return "[nao serializavel]";
  }
}

function extractFirstId(parsed: unknown): number | undefined {
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = (parsed as Record<string, unknown>[])[0];
    return typeof first?.id === "number" ? first.id : undefined;
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["contacts", "tickets", "data", "users", "results"]) {
      const arr = obj[key];
      if (Array.isArray(arr) && arr.length > 0) {
        const first = (arr as Record<string, unknown>[])[0];
        return typeof first?.id === "number" ? first.id : undefined;
      }
    }
  }
  return undefined;
}

function extractSamples(parsed: unknown, maxItems = 3): unknown {
  if (Array.isArray(parsed)) return (parsed as unknown[]).slice(0, maxItems);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of [
      "contacts", "tickets", "data", "users", "results",
      "messages", "campaigns", "schedules", "funnels", "wallets",
    ]) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        return { ...obj, [key]: (obj[key] as unknown[]).slice(0, maxItems) };
      }
    }
  }
  return parsed;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Host interno: ${HOST}`);
  console.log(`JWT (preview): ${KEY_PREVIEW}`);
  console.log(`Delay entre chamadas: ${DELAY_MS}ms`);
  console.log("─".repeat(60));

  const allResults: CallResult[] = [];
  const runLog: LogEntry[] = [];

  // IDs descobertos durante Group A para usar em Group B
  const discoveredIds: {
    contactId?: number;
    ticketId?: number;
    userId?: number;
    whatsappId?: number;
  } = {};

  // Criação de diretórios de output
  const SAMPLES_DIR = join(process.cwd(), "docs", "samples", "clickmassa-internal");
  if (!existsSync(SAMPLES_DIR)) mkdirSync(SAMPLES_DIR, { recursive: true });

  function saveSample(endpointKey: string, data: unknown): void {
    const filename = endpointKey
      .replace(/^\//, "")
      .replace(/\//g, "__")
      .replace(/[?&=]/g, "-")
      .replace(/[^a-zA-Z0-9\-_.]/g, "_")
      .slice(0, 100);
    const filePath = join(SAMPLES_DIR, `${filename}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`  AVISO: nao foi possivel salvar sample ${filename}: ${e}`);
    }
  }

  async function get(path: string, group: string, label: string): Promise<CallResult> {
    const url = `${HOST}${path}`;
    const start = Date.now();
    let status: number | null = null;
    let bodySize = 0;
    let bodyPreview = "";
    let parsed: unknown = null;
    let error: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json, text/plain, */*",
          Origin: "https://enterprise-352n.clickmassa.com.br",
          Referer: "https://enterprise-352n.clickmassa.com.br/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timer);
      status = res.status;

      const text = await res.text();
      bodySize = text.length;

      try {
        parsed = JSON.parse(text);
        bodyPreview = safePreview(parsed);
      } catch {
        bodyPreview = text.slice(0, 500);
        parsed = null;
        if (status === 200) {
          error = "body nao e JSON valido";
        }
      }
    } catch (e) {
      const latencyMs = Date.now() - start;
      error =
        e instanceof Error
          ? e.name === "AbortError"
            ? "TIMEOUT"
            : e.message
          : String(e);
      const result: CallResult = {
        path, url, status: null, latencyMs, bodySize: 0,
        bodyPreview: "", parsed: null, error, group, label,
      };
      allResults.push(result);
      runLog.push({ seq: allResults.length, path, status: null, latencyMs, bodySize: 0, error });
      console.log(`  [E] ERR  ${String(latencyMs).padStart(5)}ms  ${path}  => ${error}`);
      return result;
    }

    const latencyMs = Date.now() - start;
    const result: CallResult = {
      path, url, status, latencyMs, bodySize, bodyPreview, parsed, error, group, label,
    };
    allResults.push(result);
    runLog.push({ seq: allResults.length, path, status, latencyMs, bodySize, error });

    const statusEmoji = status === 200 ? "✓" : "✗";
    console.log(
      `  [${statusEmoji}] ${status}  ${String(latencyMs).padStart(5)}ms  ${path}`,
    );

    return result;
  }

  // ─── GRUPO A — CRUD básico Whaticket ──────────────────────────────────────

  console.log("\n=== GRUPO A — CRUD básico Whaticket ===");

  const a1 = await get("/contacts?pageNumber=1", "A", "contacts-list");
  await sleep(DELAY_MS);
  if (a1.status === 200 && a1.parsed) {
    saveSample("/contacts", extractSamples(a1.parsed));
    discoveredIds.contactId = extractFirstId(a1.parsed) ?? discoveredIds.contactId;
  }

  const a2 = await get("/tickets?pageNumber=1", "A", "tickets-list");
  await sleep(DELAY_MS);
  if (a2.status === 200 && a2.parsed) {
    saveSample("/tickets", extractSamples(a2.parsed));
    discoveredIds.ticketId = extractFirstId(a2.parsed) ?? discoveredIds.ticketId;
  }

  const a3 = await get("/tickets?status=open&pageNumber=1", "A", "tickets-open");
  await sleep(DELAY_MS);
  if (a3.status === 200 && a3.parsed) {
    saveSample("/tickets-open", extractSamples(a3.parsed));
    if (!discoveredIds.ticketId) discoveredIds.ticketId = extractFirstId(a3.parsed);
  }

  const a4 = await get("/tickets?status=closed&pageNumber=1", "A", "tickets-closed");
  await sleep(DELAY_MS);
  if (a4.status === 200 && a4.parsed) saveSample("/tickets-closed", extractSamples(a4.parsed));

  const a5 = await get("/tickets?status=pending&pageNumber=1", "A", "tickets-pending");
  await sleep(DELAY_MS);
  if (a5.status === 200 && a5.parsed) saveSample("/tickets-pending", extractSamples(a5.parsed));

  const a6 = await get("/users", "A", "users-list");
  await sleep(DELAY_MS);
  if (a6.status === 200 && a6.parsed) {
    saveSample("/users", extractSamples(a6.parsed));
    discoveredIds.userId = extractFirstId(a6.parsed) ?? discoveredIds.userId;
  }

  const a7 = await get("/whatsapp", "A", "whatsapp-list");
  await sleep(DELAY_MS);
  if (a7.status === 200 && a7.parsed) {
    saveSample("/whatsapp", extractSamples(a7.parsed));
    discoveredIds.whatsappId = extractFirstId(a7.parsed) ?? discoveredIds.whatsappId;
  }

  const a8 = await get("/queue", "A", "queue-singular");
  await sleep(DELAY_MS);
  if (a8.status === 200 && a8.parsed) saveSample("/queue", extractSamples(a8.parsed));

  const a9 = await get("/queues", "A", "queues-plural");
  await sleep(DELAY_MS);
  if (a9.status === 200 && a9.parsed) saveSample("/queues", extractSamples(a9.parsed));

  const a10 = await get("/tags", "A", "tags-list");
  await sleep(DELAY_MS);
  if (a10.status === 200 && a10.parsed) saveSample("/tags", extractSamples(a10.parsed));

  const a11 = await get("/quickAnswers", "A", "quickAnswers-list");
  await sleep(DELAY_MS);
  if (a11.status === 200 && a11.parsed) saveSample("/quickAnswers", extractSamples(a11.parsed));

  const a12 = await get("/settings", "A", "settings");
  await sleep(DELAY_MS);
  if (a12.status === 200 && a12.parsed) saveSample("/settings", a12.parsed);

  console.log(`\nIDs descobertos após Grupo A: ${JSON.stringify(discoveredIds)}`);

  // ─── GRUPO B — Detail por ID ───────────────────────────────────────────────

  console.log("\n=== GRUPO B — Detail por ID ===");

  if (discoveredIds.contactId) {
    const b1 = await get(`/contacts/${discoveredIds.contactId}`, "B", "contact-detail");
    await sleep(DELAY_MS);
    if (b1.status === 200 && b1.parsed) saveSample(`/contacts__id`, b1.parsed);
  } else {
    console.log("  [SKIP] contactId nao descoberto no Grupo A");
  }

  if (discoveredIds.ticketId) {
    const b2 = await get(`/tickets/${discoveredIds.ticketId}`, "B", "ticket-detail");
    await sleep(DELAY_MS);
    if (b2.status === 200 && b2.parsed) saveSample(`/tickets__id`, b2.parsed);

    const b3 = await get(`/messages/${discoveredIds.ticketId}?pageNumber=1`, "B", "messages-by-ticket");
    await sleep(DELAY_MS);
    if (b3.status === 200 && b3.parsed) saveSample(`/messages__ticketId`, extractSamples(b3.parsed));
  } else {
    console.log("  [SKIP] ticketId nao descoberto no Grupo A");
  }

  if (discoveredIds.userId) {
    const b4 = await get(`/users/${discoveredIds.userId}`, "B", "user-detail");
    await sleep(DELAY_MS);
    if (b4.status === 200 && b4.parsed) saveSample(`/users__id`, b4.parsed);
  } else {
    console.log("  [SKIP] userId nao descoberto no Grupo A");
  }

  if (discoveredIds.whatsappId) {
    const b5 = await get(`/whatsapp/${discoveredIds.whatsappId}`, "B", "whatsapp-detail");
    await sleep(DELAY_MS);
    if (b5.status === 200 && b5.parsed) saveSample(`/whatsapp__id`, b5.parsed);
  } else {
    console.log("  [SKIP] whatsappId nao descoberto no Grupo A");
  }

  // ─── GRUPO C — Whaticket SaaS / multi-tenant ──────────────────────────────

  console.log("\n=== GRUPO C — Whaticket SaaS / multi-tenant ===");

  const groupCPaths: [string, string][] = [
    ["/campaigns", "campaigns"],
    ["/contactLists", "contactLists"],
    ["/contact-lists", "contact-lists"],
    ["/schedules", "schedules"],
    ["/wallets", "wallets"],
    ["/lead-status", "lead-status"],
    ["/leadStatus", "leadStatus"],
    ["/funnel", "funnel"],
    ["/funnels", "funnels"],
    ["/companies", "companies"],
    ["/plans", "plans"],
    ["/announcements", "announcements"],
    ["/chat-flows", "chat-flows"],
    ["/chatFlow", "chatFlow"],
    ["/helps", "helps"],
  ];

  for (const [path, label] of groupCPaths) {
    const r = await get(path, "C", label);
    await sleep(DELAY_MS);
    if (r.status === 200 && r.parsed) saveSample(path, extractSamples(r.parsed));
  }

  // ─── GRUPO D — Opportunities / Pipeline (via interna) ─────────────────────

  console.log("\n=== GRUPO D — Opportunities / Pipeline interno ===");

  const d1 = await get("/opportunities", "D", "opportunities-no-filter");
  await sleep(DELAY_MS);
  if (d1.status === 200 && d1.parsed) saveSample("/opportunities", extractSamples(d1.parsed));

  const d2 = await get("/opportunities?pageNumber=1", "D", "opportunities-page1");
  await sleep(DELAY_MS);
  if (d2.status === 200 && d2.parsed) saveSample("/opportunities-page1", extractSamples(d2.parsed));

  const d3 = await get("/pipeline-steps", "D", "pipeline-steps");
  await sleep(DELAY_MS);
  if (d3.status === 200 && d3.parsed) saveSample("/pipeline-steps", d3.parsed);

  const d4 = await get("/pipelineSteps", "D", "pipelineSteps-camel");
  await sleep(DELAY_MS);
  if (d4.status === 200 && d4.parsed) saveSample("/pipelineSteps", d4.parsed);

  const d5 = await get("/products", "D", "products");
  await sleep(DELAY_MS);
  if (d5.status === 200 && d5.parsed) saveSample("/products", extractSamples(d5.parsed));

  // ─── GRUPO E — Dashboards e agregações ────────────────────────────────────

  console.log("\n=== GRUPO E — Dashboards e agregações ===");

  const groupEPaths: [string, string][] = [
    ["/contacts-dashboard", "contacts-dashboard"],
    ["/dashboard", "dashboard"],
    ["/dashboard/contacts", "dashboard-contacts"],
    ["/dashboard/tickets", "dashboard-tickets"],
    ["/dashboard/messages", "dashboard-messages"],
    ["/dashboard/overview", "dashboard-overview"],
    ["/report", "report"],
    ["/reports", "reports"],
  ];

  for (const [path, label] of groupEPaths) {
    const r = await get(path, "E", label);
    await sleep(DELAY_MS);
    if (r.status === 200 && r.parsed) saveSample(path, r.parsed);
  }

  // ─── GRUPO F — API config e webhooks ──────────────────────────────────────

  console.log("\n=== GRUPO F — API config e webhooks ===");

  const groupFPaths: [string, string][] = [
    ["/api-config", "api-config"],
    ["/api-configs", "api-configs"],
    ["/webhooks", "webhooks"],
    ["/webhook", "webhook"],
    ["/webhook-configs", "webhook-configs"],
    ["/integrations", "integrations"],
  ];

  for (const [path, label] of groupFPaths) {
    const r = await get(path, "F", label);
    await sleep(DELAY_MS);
    if (r.status === 200 && r.parsed) saveSample(path, r.parsed);
  }

  // ─── TAREFA 2 — Sondagem extra de /contacts ───────────────────────────────

  console.log("\n=== TAREFA 2 — Sondagem extra /contacts ===");

  if (a1.status === 200) {
    const contactsExtra: [string, string][] = [
      ["/contacts?pageNumber=2", "contacts-page2"],
      ["/contacts?pageNumber=38", "contacts-page38"],
      ["/contacts?pageNumber=999", "contacts-page999"],
      ["/contacts?searchParam=alan", "contacts-search-alan"],
      ["/contacts?searchParam=5511", "contacts-search-5511"],
      ["/contacts?pageNumber=1&extraSize=80", "contacts-extraSize80"],
      ["/contacts?pageNumber=1&pageSize=80", "contacts-pageSize80"],
      ["/contacts?pageNumber=1&limit=80", "contacts-limit80"],
      ["/contacts?pageNumber=1&size=80", "contacts-size80"],
    ];

    for (const [path, label] of contactsExtra) {
      const r = await get(path, "T2", label);
      await sleep(DELAY_MS);
      if (r.status === 200 && r.parsed) {
        saveSample(path, extractSamples(r.parsed, 2));
      }
    }
  } else {
    console.log("  [SKIP] /contacts nao retornou 200 no Grupo A");
  }

  // ─── GRUPO G — Exploracoes adicionais ─────────────────────────────────────

  console.log("\n=== GRUPO G — Exploracoes adicionais ===");

  const groupGPaths: [string, string][] = [
    ["/contact-tags", "contact-tags"],
    ["/ticket-tags", "ticket-tags"],
    ["/subscriptions", "subscriptions"],
    ["/tenant", "tenant"],
    ["/tenants", "tenants"],
    ["/billing", "billing"],
    ["/invoices", "invoices"],
    ["/notifications", "notifications"],
    ["/logs", "logs"],
    ["/audit-logs", "audit-logs"],
    ["/contact-notes", "contact-notes"],
    ["/notes", "notes"],
    ["/tasks", "tasks"],
    ["/reminders", "reminders"],
    ["/ratings", "ratings"],
  ];

  for (const [path, label] of groupGPaths) {
    const r = await get(path, "G", label);
    await sleep(DELAY_MS);
    if (r.status === 200 && r.parsed) saveSample(path, extractSamples(r.parsed));
  }

  // ─── Análise dos resultados ────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("ANÁLISE DOS RESULTADOS");
  console.log("=".repeat(60));

  const total = allResults.length;
  const ok200 = allResults.filter((r) => r.status === 200);
  const err401_403 = allResults.filter((r) => r.status === 401 || r.status === 403);
  const err404 = allResults.filter((r) => r.status === 404);
  const err5xx = allResults.filter((r) => r.status !== null && r.status >= 500);
  const errNull = allResults.filter((r) => r.status === null);

  console.log(`\nTotal testados: ${total}`);
  console.log(`  200 OK:       ${ok200.length}`);
  console.log(`  401/403:      ${err401_403.length}`);
  console.log(`  404:          ${err404.length}`);
  console.log(`  5xx:          ${err5xx.length}`);
  console.log(`  Timeout/erro: ${errNull.length}`);

  console.log("\n--- Endpoints 200 OK ---");
  for (const r of ok200) {
    const obj = r.parsed as Record<string, unknown> | null;
    let count = "?";
    let topFields = "?";
    if (obj) {
      if (Array.isArray(obj)) {
        count = String((obj as unknown[]).length);
        topFields = Object.keys((obj as Record<string, unknown>[])[0] ?? {}).slice(0, 6).join(", ");
      } else {
        if (typeof obj.count === "number") count = String(obj.count);
        for (const key of ["contacts", "tickets", "data", "users", "results"]) {
          if (Array.isArray(obj[key])) {
            count = `${(obj[key] as unknown[]).length}+`;
            topFields = Object.keys((obj[key] as Record<string, unknown>[])[0] ?? {}).slice(0, 6).join(", ");
            break;
          }
        }
        if (topFields === "?") topFields = Object.keys(obj).slice(0, 6).join(", ");
      }
    }
    console.log(`  ${r.path.padEnd(55)} cnt=${count.padEnd(6)} fields: ${topFields}`);
  }

  // ─── Gerar docs/clickmassa-internal-endpoints.md ────────────────────────

  function buildEndpointMd(): string {
    const lines: string[] = [
      "# ClickMassa Internal API — Endpoints Explorados",
      "",
      `Gerado em: ${new Date().toISOString()}`,
      `Host: ${HOST}`,
      `Auth: Bearer JWT (preview: ${KEY_PREVIEW})`,
      "",
      "---",
      "",
      "## Resumo",
      "",
      "| | Count |",
      "|---|---|",
      `| Total testados | ${total} |`,
      `| 200 OK | ${ok200.length} |`,
      `| 401/403 | ${err401_403.length} |`,
      `| 404 | ${err404.length} |`,
      `| 5xx | ${err5xx.length} |`,
      `| Timeout/erro rede | ${errNull.length} |`,
      "",
      "---",
      "",
      "## Endpoints com 200 OK",
      "",
    ];

    for (const r of ok200) {
      const obj = r.parsed as Record<string, unknown> | null;
      let count = "?";
      let topFields: string[] = [];
      let paginacao = "não testada";

      if (obj) {
        if (Array.isArray(obj)) {
          count = String((obj as unknown[]).length);
          topFields = Object.keys((obj as Record<string, unknown>[])[0] ?? {});
        } else {
          if (typeof obj.count === "number") count = String(obj.count);
          if (typeof obj.hasMore === "boolean") {
            paginacao = `pageNumber. hasMore=${obj.hasMore}, count=${obj.count}`;
          }
          for (const key of ["contacts", "tickets", "data", "users", "results", "messages"]) {
            if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
              topFields = Object.keys((obj[key] as Record<string, unknown>[])[0] ?? {});
              if (count === "?") count = String((obj[key] as unknown[]).length) + "+";
              break;
            }
          }
          if (topFields.length === 0) topFields = Object.keys(obj);
        }
      }

      lines.push(`### \`GET ${r.path}\``);
      lines.push("");
      lines.push(`- **Status**: 200`);
      lines.push(`- **Latência**: ${r.latencyMs}ms`);
      lines.push(`- **Body size**: ${r.bodySize} bytes`);
      lines.push(`- **Volume/count**: ${count}`);
      lines.push(`- **Paginação**: ${paginacao}`);
      lines.push(`- **Campos top-level**: \`${topFields.slice(0, 12).join("`, `")}\``);
      lines.push(`- **Preview**:`);
      lines.push("```json");
      lines.push(r.bodyPreview.slice(0, 800));
      lines.push("```");
      lines.push("");
    }

    lines.push("---", "", "## Endpoints 404 (JSON — rota existe, erro de negócio)", "");
    for (const r of err404.filter((x) => x.parsed)) {
      lines.push(`- \`GET ${r.path}\` → \`${r.bodyPreview.slice(0, 150)}\``);
    }

    lines.push("", "---", "", "## Endpoints 404 (HTML — rota inexistente no Express)", "");
    for (const r of err404.filter((x) => !x.parsed)) {
      lines.push(`- \`GET ${r.path}\``);
    }

    lines.push("", "---", "", "## Endpoints 401/403", "");
    for (const r of err401_403) {
      lines.push(`- \`GET ${r.path}\` → ${r.status}: \`${r.bodyPreview.slice(0, 150)}\``);
    }

    lines.push("", "---", "", "## Endpoints 5xx", "");
    for (const r of err5xx) {
      lines.push(`- \`GET ${r.path}\` → ${r.status}: \`${r.bodyPreview.slice(0, 150)}\``);
    }

    lines.push("", "---", "", "## Endpoints timeout/erro rede", "");
    for (const r of errNull) {
      lines.push(`- \`GET ${r.path}\` → ${r.error}`);
    }

    return lines.join("\n");
  }

  const endpointsMd = buildEndpointMd();
  writeFileSync(
    join(process.cwd(), "docs", "clickmassa-internal-endpoints.md"),
    endpointsMd,
    "utf-8",
  );
  console.log("\n✓ docs/clickmassa-internal-endpoints.md gerado");

  // ─── Gerar log estruturado ─────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logFilePath = join(
    process.cwd(),
    "docs",
    `clickmassa-internal-exploration-${timestamp}.json`,
  );
  writeFileSync(
    logFilePath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        host: HOST,
        jwtPreview: KEY_PREVIEW,
        totalCalls: allResults.length,
        summary: {
          ok200: ok200.length,
          err401_403: err401_403.length,
          err404: err404.length,
          err5xx: err5xx.length,
          errNull: errNull.length,
        },
        discoveredIds,
        calls: runLog,
        results200: ok200.map((r) => ({
          path: r.path,
          latencyMs: r.latencyMs,
          bodySize: r.bodySize,
          topFields:
            r.parsed && typeof r.parsed === "object" && !Array.isArray(r.parsed)
              ? Object.keys(r.parsed as object).slice(0, 20)
              : [],
        })),
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`✓ ${logFilePath} gerado`);
  console.log(`✓ Samples em docs/samples/clickmassa-internal/`);
  console.log("\n=== CONCLUÍDO ===");
}

main().catch((err: unknown) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
