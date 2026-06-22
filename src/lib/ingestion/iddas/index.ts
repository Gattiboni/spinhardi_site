/**
 * Entry point de ingestão API -> bronze do Iddas.
 *
 * Reproduz a `main()` de scripts/backfill-iddas.ts: banner, auth fail-fast,
 * tabela de recursos na mesma ordem, sumário com símbolos, ingestion_log.
 * `mode` ("backfill" | "sync") carimba `ingestion_source` e `ingestion_type`.
 */

import { randomUUID } from "crypto";
import { resolveIddasConfig, type IddasConfig } from "../config";
import { createSupabaseRest } from "../supabase-rest";
import { createConsoleLogger } from "../logger";
import { logIngestionStart, logIngestionEnd } from "../ingestion-log";
import type { IngestionMode, IngestionOptions, IngestionResult, IngestionStatus, ResourceResult, RunError } from "../types";
import { createIddasTransport, PAUSE_MS } from "./transport";
import { fetchAndProcess, IDDAS_RESOURCES, type IddasCtx, type IddasResource } from "./resources";

export interface IngestIddasOptions extends IngestionOptions {
  /** Config já resolvida (opcional). Default = resolveIddasConfig(process.env). */
  config?: IddasConfig;
}

export async function ingestIddas(opts: IngestIddasOptions = {}): Promise<IngestionResult> {
  const startMs = Date.now();
  const runId = opts.runId ?? randomUUID();

  const mode: IngestionMode = opts.mode ?? "backfill";
  const dryRun = !opts.apply;
  const cfg = opts.config ?? resolveIddasConfig();
  const only = opts.only && opts.only.length > 0 ? opts.only : null;
  const skip = new Set(opts.skip ?? []);
  const logger = opts.logger ?? createConsoleLogger("[backfill-iddas]", !!opts.verbose);
  const triggeredBy = opts.triggeredBy ?? "codinho:backfill-iddas";
  const manageLog = opts.writeIngestionLog !== false;

  const rest = createSupabaseRest(cfg.supabase.url, cfg.supabase.key);
  const transport = createIddasTransport(cfg, logger);

  function shouldRun(resource: IddasResource): boolean {
    if (skip.has(resource)) return false;
    if (!only) return true;
    return only.includes(resource);
  }

  const results: Record<string, ResourceResult> = {};
  const runErrors: RunError[] = [];

  const ctx: IddasCtx = { runId, source: mode, dryRun, transport, rest, logger, results, runErrors };

  // ─── Banner ──────────────────────────────────────────────────────────────
  logger.raw("=".repeat(60));
  logger.raw("  Backfill Iddas → Supabase (bronze)");
  logger.raw(`  Modo: ${dryRun ? "DRY-RUN (sem gravação)" : "APPLY (gravando!)"}`);
  if (only) logger.raw(`  Recursos: ${only.join(", ")}`);
  if (skip.size > 0) logger.raw(`  Skip: ${[...skip].join(", ")}`);
  logger.raw(`  Run ID: ${runId}`);
  logger.raw(`  API URL: ${cfg.apiUrl}`);
  logger.raw(`  Pause: ${PAUSE_MS}ms por chamada`);
  logger.raw("=".repeat(60));

  // Autenticar antes de começar — falha rápida.
  try {
    await transport.getValidToken();
  } catch (err) {
    throw new Error(`falha no login Iddas: ${String(err)}`);
  }

  if (!dryRun && manageLog) {
    await logIngestionStart(rest, {
      runId,
      sourceSystem: "iddas",
      ingestionType: mode,
      triggeredBy,
      logger,
    });
  }

  // ─── Recursos (mesma ordem/grupos da main() original) ──────────────────────
  for (const spec of IDDAS_RESOURCES) {
    if (shouldRun(spec.resource)) await fetchAndProcess(ctx, spec);
  }

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
  const cols = [
    "recurso".padEnd(30),
    "esperado".padEnd(9),
    "fetched".padEnd(9),
    "would".padEnd(7),
    "inserted",
  ];
  logger.raw("  " + cols.join(" | "));
  logger.raw("  " + "─".repeat(72));
  for (const [resource, r] of Object.entries(results)) {
    const inserted = dryRun ? `${r.would_insert} (dry-run)` : String(r.actual_inserted ?? 0);
    const match =
      r.expected !== undefined && r.fetched === r.expected ? "✓" : r.fetched === 0 ? "?" : "⚠";
    logger.raw(
      `  ${match} ${resource.padEnd(28)} ${String(r.expected ?? "?").padEnd(9)} ${String(r.fetched).padEnd(9)} ${String(r.would_insert).padEnd(7)} ${inserted}`,
    );
  }

  if (hasErrors) {
    logger.raw("\nErros / Bandeiras:");
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
