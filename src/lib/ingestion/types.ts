/**
 * Tipos compartilhados da camada de ingestão API -> bronze.
 *
 * Esta lib NÃO importa `server-only`: roda tanto sob `npx tsx` (CLI de backfill)
 * quanto dentro de uma rota Next (sync recorrente). Por isso config é injetada,
 * nunca lida de `@/lib/supabase/server`.
 */

/** Modo da execução. Vira `ingestion_source` (nas linhas bronze) e `ingestion_type` (no ingestion_log). */
export type IngestionMode = "backfill" | "sync";

/** Valores possíveis da coluna `ingestion_source` no bronze. "webhook" reservado, sem entry point ainda. */
export type IngestionSource = "backfill" | "sync" | "webhook";

/** Carimbo de auditoria escrito em toda linha bronze. */
export interface BronzeIngestionMeta {
  ingested_at: string;
  ingestion_run_id: string;
  ingestion_source: IngestionSource;
}

/** Resultado por recurso. Superset do que CM e Iddas reportam. */
export interface ResourceResult {
  fetched: number;
  mapped: number;
  would_insert: number;
  actual_inserted?: number;
  pages?: number;
  expected?: number;
  sample?: unknown;
}

/** Erro acumulado durante o run. */
export interface RunError {
  resource: string;
  message: string;
}

/** Status final do run, igual ao que os scripts calculam hoje. */
export type IngestionStatus = "completed" | "failed" | "partial";

/**
 * Logger injetável. O CLI passa um logger console (linhas idênticas às de hoje);
 * uma rota passa `silentLogger` (ou um logger estruturado).
 *
 * - `raw`     — banner/sumário (era `console.log` direto nos scripts)
 * - `log`     — progresso com prefixo (`[backfill] ` / `[backfill-iddas] `)
 * - `verbose` — só sai quando verbose=true
 * - `sep`     — separador de seção
 */
export interface Logger {
  raw(msg: string): void;
  log(msg: string): void;
  verbose(msg: string): void;
  sep(label: string): void;
}

/** Opções comuns dos dois entry points. */
export interface IngestionOptions {
  /** "backfill" (default) ou "sync". Única alavanca que muda o carimbo de origem. */
  mode?: IngestionMode;
  /** false (default) => dry-run, zero gravação. */
  apply?: boolean;
  /** Restringe a esses recursos. null/ausente => todos. */
  only?: string[] | null;
  /** Pula esses recursos. */
  skip?: string[];
  /** Log extra. */
  verbose?: boolean;
  /** Logger injetável. Default = console logger com o prefixo da fonte. */
  logger?: Logger;
  /** Quem disparou (vai pro ingestion_log.triggered_by). Default por fonte. */
  triggeredBy?: string;
  /**
   * Se `false`, a lib NÃO escreve `ingestion_log` (start/end best-effort). Default
   * `true` (comportamento idêntico ao backfill de hoje).
   *
   * O trilho de sync/cron passa `false` porque assume a auditoria por fora, de
   * forma NÃO best-effort — falha de gravação do log vira erro visível. Nesse caso
   * ele TAMBÉM injeta `runId` (abaixo) e escreve a linha `ingestion_log` ANTES de
   * chamar a lib: as tabelas bronze têm FK `ingestion_run_id → ingestion_log.id`,
   * então a linha precisa existir antes do primeiro INSERT no bronze. Ver a NOTA
   * em `ingestion-log.ts` e `@/lib/sync/run-sync`.
   */
  writeIngestionLog?: boolean;
  /**
   * Run id a usar (carimba as linhas bronze e o `ingestion_log`). Default =
   * `randomUUID()`. O trilho de sync injeta o seu para poder gravar a linha de
   * `ingestion_log` (FK do bronze) antes de a ingestão começar.
   */
  runId?: string;
}

/** Retorno estruturado dos entry points. Sem efeito de filesystem/processo. */
export interface IngestionResult {
  ingestionRunId: string;
  mode: IngestionMode;
  status: IngestionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  resources: Record<string, ResourceResult>;
  errors: RunError[];
}
