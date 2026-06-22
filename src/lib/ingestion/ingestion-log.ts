import type { SupabaseRest } from "./supabase-rest";
import type { IngestionStatus, Logger } from "./types";

/**
 * Gravação do `ingestion_log` (auditoria de cada run), lift verbatim dos
 * scripts. Best-effort: falha de log não derruba o run, só emite AVISO.
 *
 * NOTA (trilha cron, fora desta extração): no modo "sync" disparado por cron,
 * este best-effort silencioso precisa virar erro visível — o ingestion_log é a
 * auditoria do job. Aqui mantém-se idêntico ao backfill de hoje.
 */

export async function logIngestionStart(
  rest: SupabaseRest,
  args: {
    runId: string;
    sourceSystem: string;
    ingestionType: string;
    triggeredBy: string;
    logger: Logger;
  },
): Promise<void> {
  const { runId, sourceSystem, ingestionType, triggeredBy, logger } = args;
  try {
    const { status } = await rest.sbFetch("/ingestion_log", {
      method: "POST",
      body: {
        id: runId,
        source_system: sourceSystem,
        ingestion_type: ingestionType,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: triggeredBy,
      },
      prefer: "return=minimal",
    });
    if (status >= 200 && status < 300) {
      logger.verbose(`ingestion_log start OK (run_id=${runId})`);
    } else {
      logger.log(`AVISO: ingestion_log INSERT HTTP ${status}`);
    }
  } catch (err) {
    logger.log(`AVISO: ingestion_log start falhou: ${String(err)}`);
  }
}

export async function logIngestionEnd(
  rest: SupabaseRest,
  args: {
    runId: string;
    finalStatus: IngestionStatus;
    counts: Record<string, number>;
    durationMs: number;
    errorMsg: string | null;
    logger: Logger;
  },
): Promise<void> {
  const { runId, finalStatus, counts, durationMs, errorMsg, logger } = args;
  try {
    // Tabela não tem coluna duration_ms — vai dentro de counts.
    const { status } = await rest.sbFetch("/ingestion_log", {
      method: "PATCH",
      body: {
        status: finalStatus,
        finished_at: new Date().toISOString(),
        counts: { ...counts, _duration_ms: durationMs },
        error_message: errorMsg,
      },
      queryParams: { id: `eq.${runId}` },
    });
    if (status < 200 || status >= 300) {
      logger.log(`AVISO: ingestion_log PATCH HTTP ${status}`);
    }
  } catch (err) {
    logger.log(`AVISO: ingestion_log end falhou: ${String(err)}`);
  }
}
