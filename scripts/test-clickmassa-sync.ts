/**
 * Smoke test G.2 - ClickMassa: sendMessage, createOpportunity, syncContactFlow
 *
 * ATENCAO: este script envia mensagens REAIS pro WhatsApp do CLICKMASSA_TEST_NUMBER.
 * Total de mensagens enviadas: 2 (1 tecnica + 1 de boas-vindas via syncContactFlow).
 *
 * Pre-requisitos:
 *   - CLICKMASSA_TEST_NUMBER no .env.local (formato: 5519XXXXXXXXX, sem +)
 *   - CLICKMASSA_DEFAULT_AGENT_ID no .env.local (id numerico do agente padrao)
 *
 * Uso: npx tsx scripts/test-clickmassa-sync.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

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

// ─── Validar env vars ──────────────────────────────────────────────────────

const API_URL = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";
const TEST_NUMBER = process.env.CLICKMASSA_TEST_NUMBER ?? "";
const DEFAULT_AGENT_ID = process.env.CLICKMASSA_DEFAULT_AGENT_ID ?? "";

if (!API_URL || !API_KEY) {
  console.error(
    "ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidas. Verifique .env.local.",
  );
  process.exit(1);
}
if (!TEST_NUMBER) {
  console.error(
    "ERRO: Defina CLICKMASSA_TEST_NUMBER no .env.local antes de rodar (formato: 5519XXXXXXXXX, sem +).",
  );
  process.exit(1);
}
if (!DEFAULT_AGENT_ID) {
  console.error(
    "ERRO: Defina CLICKMASSA_DEFAULT_AGENT_ID no .env.local antes de rodar (id numerico do agente padrao).",
  );
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ─── Helpers (reimplementados sem depender de server-only) ─────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (digits.length >= 10 && digits.length <= 11 && ddd >= 11 && ddd <= 99) {
    return `55${digits}`;
  }
  return digits;
}

function buildWelcomeMessageBody(name: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Olá, ${firstName}! 🌎` : "Olá! 🌎";
  return (
    `${greeting}\n\n` +
    "Aqui é da Spinhardi Turismo. Recebemos seu contato pelo site e já estamos com a sua mensagem em mãos. Em instantes uma das nossas consultoras vai te chamar pra entender sua viagem dos sonhos.\n\n" +
    "Até já! ✨"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sep(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

// ─── API helpers ───────────────────────────────────────────────────────────

interface ApiResult {
  status: number;
  ok: boolean;
  data: unknown;
  errorCode?: string;
}

async function apiPost(path: string, body: unknown): Promise<ApiResult> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
    const errorCode =
      data && typeof data === "object"
        ? String((data as Record<string, unknown>).error ?? "")
        : undefined;
    return { status: res.status, ok: res.ok, data, errorCode: errorCode || undefined };
  } catch (err) {
    return { status: -1, ok: false, data: String(err) };
  }
}

async function apiGet(path: string): Promise<ApiResult> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: -1, ok: false, data: String(err) };
  }
}

// Extrai o primeiro pipeline step (menor order) de uma resposta de /pipeline-steps
function extractFirstStep(
  data: unknown,
): { id: number; name: string; order: number } | null {
  let items: unknown[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) items = obj.data as unknown[];
  }
  if (!items.length) return null;
  const steps = items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return { id: Number(r.id ?? 0), name: String(r.name ?? ""), order: Number(r.order ?? 0) };
  });
  return steps.sort((a, b) => a.order - b.order)[0];
}

// ─── Fluxo de sync reimplementado inline ──────────────────────────────────

interface SyncResult {
  status: "opportunity_created" | "message_sent" | "blocked" | "failed";
  clickmassaContactId: number | null;
  clickmassaTicketId: number | null;
  clickmassaOpportunityId: number | null;
  error?: string;
  errorCode?: string;
}

async function runSyncContactFlow(input: {
  id: string;
  name: string | null;
  phone: string;
}): Promise<SyncResult> {
  const phone = normalizePhone(input.phone);

  // sendMessage com boas-vindas
  const sendResult = await apiPost(API_URL, {
    number: phone,
    body: buildWelcomeMessageBody(input.name),
    externalKey: input.id,
  });

  if (!sendResult.ok) {
    return {
      status: "failed",
      clickmassaContactId: null,
      clickmassaTicketId: null,
      clickmassaOpportunityId: null,
      error: JSON.stringify(sendResult.data),
      errorCode: sendResult.errorCode,
    };
  }

  const msgRaw =
    sendResult.data && typeof sendResult.data === "object"
      ? ((sendResult.data as Record<string, unknown>).message ?? sendResult.data)
      : sendResult.data;
  const msg = msgRaw as Record<string, unknown>;
  const clickmassaContactId = Number(msg.contactId ?? 0);
  const clickmassaTicketId = Number(msg.ticketId ?? 0);

  // listPipelineSteps
  const stepsResult = await apiGet("/pipeline-steps");
  const firstStep = extractFirstStep(stepsResult.data);
  if (!firstStep) {
    return {
      status: "failed",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: null,
      error: "Nenhum pipeline step encontrado",
    };
  }

  // expectedCloseDate: hoje + 30 dias
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 30);
  const expectedCloseDate = closeDate.toISOString().slice(0, 10);

  const firstName = input.name?.trim().split(/\s+/)[0] ?? null;
  const displayName = firstName ?? phone;

  const oppResult = await apiPost("/opportunities", {
    name: `Lead via Site - ${displayName}`,
    value: 0,
    expectedCloseDate,
    contactId: clickmassaContactId,
    responsibleId: DEFAULT_AGENT_ID,
    pipelineStepId: firstStep.id,
    userId: DEFAULT_AGENT_ID,
  });

  if (!oppResult.ok) {
    const isBlocked =
      oppResult.errorCode === "ERR_CONTACT_PIPELINE_NOT_FOUND" ||
      JSON.stringify(oppResult.data).includes("ERR_CONTACT_PIPELINE_NOT_FOUND");
    return {
      status: isBlocked ? "blocked" : "failed",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: null,
      error: isBlocked
        ? "Módulo de Oportunidades não configurado no ClickMassa"
        : JSON.stringify(oppResult.data),
      errorCode: oppResult.errorCode,
    };
  }

  const oppData =
    oppResult.data && typeof oppResult.data === "object"
      ? ((oppResult.data as Record<string, unknown>).data ??
        (oppResult.data as Record<string, unknown>).opportunity ??
        oppResult.data)
      : oppResult.data;
  const oppId = Number((oppData as Record<string, unknown>).id ?? 0);

  return {
    status: "opportunity_created",
    clickmassaContactId,
    clickmassaTicketId,
    clickmassaOpportunityId: oppId,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  ClickMassa Smoke Test G.2 - Sync de Lead");
  console.log(`  Base URL: ${API_URL}`);
  console.log(`  Test number: ${TEST_NUMBER}`);
  console.log(`  Agent ID: ${DEFAULT_AGENT_ID}`);
  console.log("=".repeat(60));
  console.log();
  console.log(
    "ATENCAO: este script envia mensagem REAL pro WhatsApp do numero",
  );
  console.log("configurado em CLICKMASSA_TEST_NUMBER. Continuando em 3 segundos.");
  console.log("Ctrl+C pra cancelar.");
  await sleep(3000);

  const smokeInput = {
    id: randomUUID(),
    name: "Alan Smoke Test",
    phone: TEST_NUMBER,
    email: "alan-smoke@gattiboni.com",
  };
  const timestamp = Date.now();

  // ─── PRIMEIRO: sendMessage tecnico ────────────────────────────────────

  sep("PRIMEIRO: sendMessage (mensagem tecnica)");
  console.log("  Enviando mensagem de teste tecnico...");
  const sendResult = await apiPost(API_URL, {
    number: normalizePhone(TEST_NUMBER),
    body: "[TESTE TÉCNICO] Esta é uma mensagem de teste do sistema de integração ClickMassa. Pode ignorar.",
    externalKey: `smoke-${timestamp}`,
  });

  console.log(`  HTTP status: ${sendResult.status}`);
  console.log(`  OK: ${sendResult.ok}`);
  console.log("\n  Response completo:");
  console.log(JSON.stringify(sendResult.data, null, 2));

  let contactIdFromSend: number | null = null;
  let ticketIdFromSend: number | null = null;

  if (sendResult.ok && sendResult.data && typeof sendResult.data === "object") {
    const msgRaw =
      (sendResult.data as Record<string, unknown>).message ?? sendResult.data;
    const msg = msgRaw as Record<string, unknown>;
    contactIdFromSend = Number(msg.contactId ?? 0) || null;
    ticketIdFromSend = Number(msg.ticketId ?? 0) || null;
    console.log(`\n  contactId: ${contactIdFromSend}`);
    console.log(`  ticketId:  ${ticketIdFromSend}`);
    console.log(`  status:    ${String(msg.status ?? "?")}`);
    console.log(`  externalKey: ${String(msg.externalKey ?? "?")}`);
  } else {
    console.log("\n  ERRO no sendMessage - veja response acima.");
  }

  // ─── SEGUNDO: createOpportunity ───────────────────────────────────────

  sep("SEGUNDO: createOpportunity");
  if (!contactIdFromSend) {
    console.log("  PULANDO: nao temos contactId (sendMessage falhou).");
  } else {
    // Busca pipeline steps
    const stepsResult = await apiGet("/pipeline-steps");
    const firstStep = extractFirstStep(stepsResult.data);
    console.log(`  Pipeline steps status: ${stepsResult.status}`);
    if (firstStep) {
      console.log(`  Primeiro step: id=${firstStep.id} name="${firstStep.name}" order=${firstStep.order}`);
    } else {
      console.log("  Nenhum step encontrado - dados:", JSON.stringify(stepsResult.data, null, 2));
    }

    if (firstStep) {
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() + 30);
      const expectedCloseDate = closeDate.toISOString().slice(0, 10);

      const oppResult = await apiPost("/opportunities", {
        name: "Lead via Site - Alan Smoke Test",
        value: 0,
        expectedCloseDate,
        contactId: contactIdFromSend,
        responsibleId: DEFAULT_AGENT_ID,
        pipelineStepId: firstStep.id,
        userId: DEFAULT_AGENT_ID,
      });

      console.log(`\n  HTTP status: ${oppResult.status}`);
      console.log(`  OK: ${oppResult.ok}`);
      console.log("\n  Response completo:");
      console.log(JSON.stringify(oppResult.data, null, 2));

      if (!oppResult.ok) {
        const isBlocked =
          oppResult.errorCode === "ERR_CONTACT_PIPELINE_NOT_FOUND" ||
          JSON.stringify(oppResult.data).includes("ERR_CONTACT_PIPELINE_NOT_FOUND");
        if (isBlocked) {
          console.log(
            "\n  [CONFIRMADO] ERR_CONTACT_PIPELINE_NOT_FOUND - modulo de oportunidades bloqueado (ja visto em G.1).",
          );
          console.log("  syncContactFlow vai retornar status=blocked.");
        } else {
          console.log(`\n  ERRO: code=${oppResult.errorCode ?? "?"}`);
        }
      } else {
        console.log("\n  Oportunidade criada com sucesso!");
      }
    }
  }

  // ─── TERCEIRO: syncContactFlow completo ───────────────────────────────

  sep("TERCEIRO: syncContactFlow completo");
  console.log("  Input:");
  console.log(`    id:    ${smokeInput.id}`);
  console.log(`    name:  ${smokeInput.name}`);
  console.log(`    phone: ${smokeInput.phone}`);
  console.log(`    email: ${smokeInput.email}`);
  console.log();
  console.log("  Executando syncContactFlow (envia boas-vindas real + cria opp)...");

  const syncResult = await runSyncContactFlow(smokeInput);

  console.log("\n  SyncContactResult:");
  console.log(JSON.stringify(syncResult, null, 2));

  if (syncResult.status === "opportunity_created") {
    console.log("\n  [OK] Oportunidade criada com sucesso.");
    console.log(`  clickmassaContactId:    ${syncResult.clickmassaContactId}`);
    console.log(`  clickmassaTicketId:     ${syncResult.clickmassaTicketId}`);
    console.log(`  clickmassaOpportunityId: ${syncResult.clickmassaOpportunityId}`);
  } else if (syncResult.status === "blocked") {
    console.log("\n  [BLOCKED] Modulo de Oportunidades nao disponivel.");
    console.log("  Mensagem foi enviada mas opp NAO foi criada.");
    console.log("  G.2.c pode usar status=message_sent como fallback quando blocked.");
    console.log(`  errorCode: ${syncResult.errorCode}`);
  } else if (syncResult.status === "failed") {
    console.log("\n  [FALHA] syncContactFlow retornou status=failed.");
    console.log(`  error: ${syncResult.error}`);
    console.log(`  errorCode: ${syncResult.errorCode}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Smoke test G.2 concluido.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
