/**
 * Turno Iddas B.2 — Backfill completo Iddas → Supabase (bronze) — wrapper CLI
 *
 * A lógica de ingestão API->bronze vive em `src/lib/ingestion/iddas`
 * (reusável por CLI e por rota Next). Este script só: carrega `.env.local`,
 * parseia argv, chama `ingestIddas({ mode: "backfill" })` e despeja o resultado
 * em docs/. Comportamento idêntico ao backfill anterior.
 *
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
import {
  ingestIddas,
  resolveIddasConfig,
  IngestionConfigError,
  type IngestionResult,
} from "@/lib/ingestion";

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

const onlyArg = argv.find((a) => a.startsWith("--only="));
const ONLY_RESOURCES = onlyArg
  ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim())
  : null;

const skipArg = argv.find((a) => a.startsWith("--skip="));
const SKIP_RESOURCES = skipArg
  ? skipArg.slice("--skip=".length).split(",").map((s) => s.trim())
  : [];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Resolve/valida config antes de tudo (mensagens idênticas via
  // IngestionConfigError → main().catch).
  const config = resolveIddasConfig();

  const result: IngestionResult = await ingestIddas({
    mode: "backfill",
    apply: APPLY,
    verbose: VERBOSE,
    only: ONLY_RESOURCES,
    skip: SKIP_RESOURCES,
    config,
  });

  // ─── Salvar output ──────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-").slice(0, 19);
  const prefix = APPLY ? "backfill-iddas-apply" : "backfill-iddas-dryrun";
  const outputPath = join(process.cwd(), "docs", `${prefix}-${timestamp}.json`);

  const output: Record<string, unknown> = {
    ingestion_run_id: result.ingestionRunId,
    mode: APPLY ? "apply" : "dry-run",
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    duration_ms: result.durationMs,
    status: result.status,
    resources: result.resources,
    errors: result.errors,
  };

  const docsDir = join(process.cwd(), "docs");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nOutput salvo em: ${outputPath}`);
  console.log("\n" + "=".repeat(60));

  if (result.status === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof IngestionConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error("ERRO FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
