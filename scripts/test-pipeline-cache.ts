/**
 * Smoke test -- cache de pipeline steps
 *
 * Valida o fluxo completo da camada de cache:
 *   1. Chama refreshPipelineStepsCache() (API -> UPSERT no Supabase)
 *   2. Le via getCachedPipelineSteps() e imprime os steps
 *   3. Chama listPipelineStepsResilient() e mostra source
 *
 * Pre-requisitos (em .env.local):
 *   - CLICKMASSA_API_URL
 *   - CLICKMASSA_API_KEY
 *   - SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso: npx tsx scripts/test-pipeline-cache.ts
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

// ─── Validar env vars ──────────────────────────────────────────────────────

const API_URL = process.env.CLICKMASSA_API_URL ?? "";
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!API_URL) { console.error("ERRO: CLICKMASSA_API_URL nao definida"); process.exit(1); }
if (!API_KEY) { console.error("ERRO: CLICKMASSA_API_KEY nao definida"); process.exit(1); }
if (!SUPABASE_URL) { console.error("ERRO: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL nao definida"); process.exit(1); }
if (!SERVICE_ROLE_KEY) { console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY nao definida"); process.exit(1); }

console.log("=== Smoke test: pipeline-steps-cache ===\n");

// ─── Imports (apos env estar disponivel) ──────────────────────────────────

const { refreshPipelineStepsCache, getCachedPipelineSteps, listPipelineStepsResilient } =
  await import("../src/lib/integrations/clickmassa/pipeline-steps-cache.js");

// ─── 1. Refresh via API ────────────────────────────────────────────────────

console.log("1. refreshPipelineStepsCache() ...");
const refreshResult = await refreshPipelineStepsCache();
if (refreshResult.error) {
  console.error(`   ERRO: ${refreshResult.error}`);
} else {
  console.log(`   OK: ${refreshResult.updated} step(s) gravados no Supabase`);
}

// ─── 2. Leitura do cache ───────────────────────────────────────────────────

console.log("\n2. getCachedPipelineSteps() ...");
const cached = await getCachedPipelineSteps();
if (cached.length === 0) {
  console.log("   Cache vazio (pode ser stale ou API falhou no passo 1)");
} else {
  console.log(`   ${cached.length} step(s) no cache:`);
  for (const s of cached) {
    console.log(`   - [${s.id}] ${s.name} (color: ${s.color || "n/a"}, ordem: ${s.order})`);
  }
}

// ─── 3. Orquestrador resiliente ────────────────────────────────────────────

console.log("\n3. listPipelineStepsResilient() ...");
const resilientResult = await listPipelineStepsResilient();
console.log(`   source: ${resilientResult.source}`);
console.log(`   steps: ${resilientResult.steps.length}`);
if (resilientResult.error) {
  console.log(`   error: ${resilientResult.error}`);
}

console.log("\n=== Fim do smoke test ===");
