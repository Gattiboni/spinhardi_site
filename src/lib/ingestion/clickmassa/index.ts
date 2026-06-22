/**
 * Entry point de ingestão API -> bronze do ClickMassa.
 *
 * Reproduz a `main()` de scripts/backfill-clickmassa.ts: mesmo banner, mesma
 * ordem de recursos, mesmo sumário, mesma escrita de ingestion_log. A única
 * alavanca nova é `mode` ("backfill" | "sync"), que carimba `ingestion_source`
 * e `ingestion_type`. Sem efeito de filesystem/processo: devolve IngestionResult.
 */

import { randomUUID } from "crypto";
import { resolveClickMassaConfig, type ClickMassaConfig } from "../config";
import { createSupabaseRest } from "../supabase-rest";
import { createConsoleLogger } from "../logger";
import { logIngestionStart, logIngestionEnd } from "../ingestion-log";
import type { IngestionMode, IngestionOptions, IngestionResult, IngestionStatus, ResourceResult, RunError } from "../types";
import { createClickMassaTransport, PAUSE_MS } from "./transport";
import {
  type CmCtx,
  type CmResource,
  type PipelineStep,
  runTags,
  runUsers,
  runQueues,
  runSettings,
  runWhatsapp,
  runApiConfig,
  runFunnels,
  runLeadStatuses,
  runPipelineSteps,
  runProducts,
  runOpportunities,
  runContacts,
  runContactsDashboard,
} from "./resources";

function jwtPreview(token: string): string {
  return token.slice(0, 8) + "...";
}

export interface IngestClickMassaOptions extends IngestionOptions {
  /** Config já resolvida (opcional). Default = resolveClickMassaConfig(process.env). */
  config?: ClickMassaConfig;
}

export async function ingestClickMassa(opts: IngestClickMassaOptions = {}): Promise<IngestionResult> {
  const startMs = Date.now();
  const runId = opts.runId ?? randomUUID();

  const mode: IngestionMode = opts.mode ?? "backfill";
  const dryRun = !opts.apply;
  const cfg = opts.config ?? resolveClickMassaConfig();
  const only = opts.only && opts.only.length > 0 ? opts.only : null;
  const skip = new Set(opts.skip ?? []);
  const logger = opts.logger ?? createConsoleLogger("[backfill]", !!opts.verbose);
  const triggeredBy = opts.triggeredBy ?? "codinho:backfill-v2";
  const manageLog = opts.writeIngestionLog !== false;

  const rest = createSupabaseRest(cfg.supabase.url, cfg.supabase.key);
  const transport = createClickMassaTransport(cfg, logger);

  function shouldRun(resource: CmResource): boolean {
    if (skip.has(resource)) return false;
    if (!only) return true;
    return only.includes(resource);
  }

  const results: Record<string, ResourceResult> = {};
  const runErrors: RunError[] = [];

  const ctx: CmCtx = {
    runId,
    source: mode,
    dryRun,
    cfg,
    transport,
    rest,
    logger,
    shouldRun,
    results,
    runErrors,
  };

  // ─── Banner ──────────────────────────────────────────────────────────────
  logger.raw("=".repeat(60));
  logger.raw("  Backfill V2 ETL — ClickMassa → Supabase");
  logger.raw(`  Modo: ${dryRun ? "DRY-RUN (sem gravação)" : "APPLY (gravando!)"}`);
  if (only) logger.raw(`  Recurso: ${only.join(",")}`);
  if (skip.size > 0) logger.raw(`  Skip: ${[...skip].join(", ")}`);
  logger.raw(`  Run ID: ${runId}`);
  logger.raw(`  Internal base: ${cfg.internalBase}`);
  logger.raw(`  Internal origin: ${cfg.internalOrigin}`);
  logger.raw(`  JWT preview: ${jwtPreview(cfg.apiKey)}`);
  logger.raw(`  Pause entre chamadas: ${PAUSE_MS}ms`);
  logger.raw("=".repeat(60));

  if (!dryRun && manageLog) {
    await logIngestionStart(rest, {
      runId,
      sourceSystem: "clickmassa",
      ingestionType: mode,
      triggeredBy,
      logger,
    });
  }

  // ─── Recursos (mesma ordem da main() original) ─────────────────────────────
  if (shouldRun("tags")) await runTags(ctx);
  if (shouldRun("users")) await runUsers(ctx);
  if (shouldRun("queues")) await runQueues(ctx);
  if (shouldRun("settings")) await runSettings(ctx);
  if (shouldRun("whatsapp")) await runWhatsapp(ctx);
  if (shouldRun("api-config")) await runApiConfig(ctx);
  if (shouldRun("funnels")) await runFunnels(ctx);
  if (shouldRun("lead-status")) await runLeadStatuses(ctx);

  let steps: PipelineStep[] = [];
  if (shouldRun("pipeline-steps") || shouldRun("opportunities")) {
    steps = await runPipelineSteps(ctx);
  }

  if (shouldRun("products")) await runProducts(ctx);
  if (shouldRun("opportunities")) await runOpportunities(ctx, steps);
  if (shouldRun("contacts")) await runContacts(ctx);
  if (shouldRun("contacts-dashboard")) await runContactsDashboard(ctx);

  const durationMs = Date.now() - startMs;
  const hasErrors = runErrors.length > 0;
  const finalStatus: IngestionStatus =
    hasErrors && Object.keys(results).length === 0
      ? "failed"
      : hasErrors
        ? "partial"
        : "completed";

  if (!dryRun && manageLog) {
    const countsSummary: Record<string, number> = {};
    for (const [key, val] of Object.entries(results)) {
      countsSummary[key] = val.actual_inserted ?? val.would_insert;
    }
    await logIngestionEnd(rest, {
      runId,
      finalStatus,
      counts: countsSummary,
      durationMs,
      errorMsg: hasErrors ? runErrors.map((e) => `[${e.resource}] ${e.message}`).join("; ") : null,
      logger,
    });
  }

  // ─── Sumário ───────────────────────────────────────────────────────────────
  logger.sep("Sumário");
  logger.log(`Duração total: ${durationMs}ms`);
  logger.log(`Status: ${finalStatus}`);
  logger.raw("\nContagens por recurso:");
  for (const [resource, r] of Object.entries(results)) {
    const inserted = dryRun ? `${r.would_insert} (dry-run)` : String(r.actual_inserted ?? 0);
    logger.raw(`  ${resource.padEnd(22)} fetched=${r.fetched} would=${r.would_insert} inserted=${inserted}${r.pages ? ` pages=${r.pages}` : ""}`);
  }

  if (hasErrors) {
    logger.raw("\nErros:");
    for (const e of runErrors) {
      logger.raw(`  [${e.resource}] ${e.message}`);
    }
  }

  return {
    ingestionRunId: runId,
    mode,
    status: finalStatus,
    startedAt: new Date(startMs).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs,
    resources: results,
    errors: runErrors,
  };
}
