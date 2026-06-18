/**
 * Smoke test exploratório da API ClickMassa.
 *
 * Roda fora do Next.js (sem server-only, sem @/ aliases).
 * Carrega .env.local manualmente para ter CLICKMASSA_API_URL e CLICKMASSA_API_KEY.
 *
 * Uso: npx tsx scripts/test-clickmassa-explore.ts
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

// O endpoint de users tem path diferente: /v1/api/external/users/{apiId}
const lastSlash = API_URL.lastIndexOf("/");
const API_ID = API_URL.slice(lastSlash + 1);
const API_PARENT = API_URL.slice(0, lastSlash);
const USERS_URL = `${API_PARENT}/users/${API_ID}`;

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ─── Fetch helper ──────────────────────────────────────────────────────────

async function apiFetch(
  label: string,
  url: string,
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return { status: res.status, body };
  } catch (err) {
    console.error(`  [${label}] ERRO de rede:`, err);
    return { status: -1, body: null };
  }
}

function count(body: unknown): number | string {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["data", "users", "opportunities", "items"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).length;
    }
    if (typeof obj.count === "number") return `count=${obj.count}`;
  }
  return "?";
}

function firstItem(body: unknown): unknown {
  if (Array.isArray(body)) return body[0] ?? null;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["data", "users", "opportunities", "items"]) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        return (obj[key] as unknown[])[0];
      }
    }
  }
  return body;
}

function sep(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  ClickMassa Smoke Test Exploratorio");
  console.log(`  Base URL: ${API_URL}`);
  console.log("=".repeat(60));

  // 1. Pipeline Steps
  sep("1/5 Pipeline Steps");
  {
    const { status, body } = await apiFetch("pipeline-steps", `${API_URL}/pipeline-steps`);
    console.log(`  Status: ${status}`);
    console.log(`  Items: ${count(body)}`);
    console.log("  Primeiro item:", JSON.stringify(firstItem(body), null, 2));
  }

  // 2. Opportunities
  sep("2/5 Opportunities");
  {
    const { status, body } = await apiFetch("opportunities", `${API_URL}/opportunities`);
    console.log(`  Status: ${status}`);
    console.log(`  Items: ${count(body)}`);
    const first = firstItem(body);
    console.log("  Primeiro item:", JSON.stringify(first, null, 2));

    if (first && typeof first === "object") {
      const opp = first as Record<string, unknown>;
      if (opp.contact && typeof opp.contact === "object") {
        console.log("\n  [ACHADO POSITIVO] contact vem embedado na response de opportunities:");
        console.log("  ", JSON.stringify(opp.contact, null, 2));
      } else if (opp.contactId != null && !opp.contact) {
        console.log(
          "\n  [GAP G.2] Oportunidade tem contactId mas SEM objeto contact embedado.",
          `contactId=${opp.contactId}`,
        );
      }
    }
  }

  // 3. Tags
  sep("3/5 Tags");
  {
    const { status, body } = await apiFetch("tags", `${API_URL}/tags`);
    console.log(`  Status: ${status}`);
    console.log(`  Items: ${count(body)}`);
    console.log("  Primeiro item:", JSON.stringify(firstItem(body), null, 2));
  }

  // 4. Products
  sep("4/5 Products");
  {
    const { status, body } = await apiFetch("products", `${API_URL}/products`);
    console.log(`  Status: ${status}`);
    console.log(`  Items: ${count(body)}`);
    console.log("  Primeiro item:", JSON.stringify(firstItem(body), null, 2));
  }

  // 5. Users
  sep("5/5 Users");
  {
    const { status, body } = await apiFetch("users", USERS_URL);
    console.log(`  Status: ${status}`);
    console.log(`  URL usada: ${USERS_URL}`);
    console.log(`  Items: ${count(body)}`);
    console.log("  Primeiro item:", JSON.stringify(firstItem(body), null, 2));

    // Tenta rota alternativa se a primeira falhou
    if (status !== 200) {
      console.log("\n  Tentando rota alternativa /users...");
      const alt = await apiFetch("users-alt", `${API_URL}/users`);
      console.log(`  Status alternativo: ${alt.status}`);
      if (alt.status === 200) {
        console.log(`  Items alternativos: ${count(alt.body)}`);
        console.log("  Primeiro item alt:", JSON.stringify(firstItem(alt.body), null, 2));
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Smoke test concluido.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
