/**
 * Camada de ingestão API -> bronze, reusável por CLI (npx tsx) e por rota Next.
 *
 * Dois entry points, parametrizados por `mode`:
 * - backfill full  → ingestX({ mode: "backfill", apply: true })
 * - sync delta      → ingestX({ mode: "sync", apply: true })  (re-fetch + upsert)
 *
 * Não importa `server-only`; config injetável (default = process.env).
 */

export { ingestClickMassa } from "./clickmassa";
export type { IngestClickMassaOptions } from "./clickmassa";
export { ingestIddas } from "./iddas";
export type { IngestIddasOptions } from "./iddas";
export type { IddasResource } from "./iddas/resources";

export { createConsoleLogger, silentLogger } from "./logger";
export {
  resolveClickMassaConfig,
  resolveIddasConfig,
  IngestionConfigError,
  type ClickMassaConfig,
  type IddasConfig,
  type SupabaseRestConfig,
} from "./config";

export type {
  IngestionMode,
  IngestionSource,
  IngestionOptions,
  IngestionResult,
  IngestionStatus,
  ResourceResult,
  RunError,
  Logger,
} from "./types";
