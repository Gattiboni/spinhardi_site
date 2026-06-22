/**
 * Turno H.2 — Backfill V2 ETL ClickMassa → Supabase (wrapper CLI)
 *
 * A lógica de ingestão API->bronze vive em `src/lib/ingestion/clickmassa`
 * (reusável por CLI e por rota Next). Este script só: carrega `.env.local`,
 * parseia argv, chama `ingestClickMassa({ mode: "backfill" })` e despeja o
 * resultado em docs/. Comportamento idêntico ao backfill anterior.
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
import {
  ingestClickMassa,
  resolveClickMassaConfig,
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
const ONLY_RESOURCE = onlyArg ? onlyArg.slice("--only=".length) : null;

const skipArg = argv.find((a) => a.startsWith("--skip="));
const SKIP_RESOURCES = skipArg ? skipArg.slice("--skip=".length).split(",") : [];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Resolve/valida config antes de tudo (mensagens idênticas às de antes via
  // IngestionConfigError → main().catch).
  const config = resolveClickMassaConfig();

  const result: IngestionResult = await ingestClickMassa({
    mode: "backfill",
    apply: APPLY,
    verbose: VERBOSE,
    only: ONLY_RESOURCE ? [ONLY_RESOURCE] : null,
    skip: SKIP_RESOURCES,
    config,
  });

  // ─── Salvar output ─────────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-").slice(0, 19);
  const prefix = APPLY ? "backfill-v2-apply" : "backfill-v2-dryrun";
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

  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  if (err instanceof IngestionConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
