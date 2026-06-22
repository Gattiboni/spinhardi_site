import type { BronzeIngestionMeta, IngestionSource } from "./types";

/**
 * Carimbo de auditoria de cada linha bronze.
 *
 * Era `meta()` (ClickMassa) e `buildAudit()` (Iddas), com `ingestion_source`
 * hardcoded em "backfill". Agora a origem é parametrizada (backfill | sync).
 */
export function buildMeta(runId: string, source: IngestionSource): BronzeIngestionMeta {
  return {
    ingested_at: new Date().toISOString(),
    ingestion_run_id: runId,
    ingestion_source: source,
  };
}
