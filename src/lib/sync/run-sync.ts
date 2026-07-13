import "server-only";
import { randomUUID } from "node:crypto";
import {
  ingestClickMassa,
  ingestIddas,
  silentLogger,
  type IddasResource,
  type IngestionResult,
  type IngestionStatus,
} from "@/lib/ingestion";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Core de sincronização recorrente (API → bronze → silver), compartilhado pelas
 * rotas de cron. NÃO vive dentro de `app/api`: é a lógica; as rotas são finas.
 *
 * Mora aqui (e não em `@/lib/ingestion`) de propósito: a camada de ingestão é
 * livre de `server-only` pra rodar sob `npx tsx` (CLI de backfill). Este core usa
 * o client service-role do projeto (`supabaseAdmin`, `server-only`) pra gravar a
 * auditoria e promover bronze → silver — então é estritamente server-side.
 *
 * Fluxo de uma run (e POR QUÊ nesta ordem):
 *  1. Gera `runId` e grava a linha `ingestion_log` (status `running`) ANTES da
 *     ingestão. Obrigatório: as tabelas bronze têm FK `ingestion_run_id →
 *     ingestion_log.id`, então a linha precisa existir antes do 1º INSERT bronze.
 *  2. Ingere a fonte via a lib (`mode: "sync"`, `apply: true`), injetando o mesmo
 *     `runId` e `writeIngestionLog: false` (a lib não escreve o log — nós já
 *     escrevemos e vamos fechar; evita linha duplicada).
 *  3. Se `!ingestOnly`, chama o RPC `promote_contacts_from_bronze()` via
 *     service-role e captura os contadores. A promoção é parte do ciclo: se ela
 *     estoura, a run é `failed` (bronze salvo, mas ciclo não fechou).
 *  4. Fecha a linha `ingestion_log` (PATCH) SÓ DEPOIS da promoção — RPC estourou
 *     → `failed` com a mensagem no `error_message`; RPC ok → status da ingestão
 *     (completed/partial/failed). REQUISITO FIRME: toda run gera registro. NÃO
 *     best-effort: falha de gravação do log vira erro visível (lança), ao
 *     contrário do backfill. (Antes o log fechava ANTES da promoção, escondendo
 *     promoção morta atrás de runs verdes.)
 */

export type SyncSource = "clickmassa" | "iddas";

/** Uma linha do retorno do RPC `promote_contacts_from_bronze()`. */
export interface PromoteResultRow {
  fonte: "iddas" | "clickmassa";
  inseridos: number;
  preenchidos: number;
}

export interface RunSyncOptions {
  /** Se `true`, só ingere o bronze e pula a promoção bronze → silver. */
  ingestOnly?: boolean;
}

export interface SyncResult {
  source: SyncSource;
  /** Resultado bruto da ingestão API → bronze (runId, status, contagens, erros). */
  ingestao: IngestionResult;
  /**
   * Retorno do RPC `promote_contacts_from_bronze()` repassado verbatim
   * (contadores inseridos/preenchidos). `null` quando `ingestOnly`.
   */
  promocao: PromoteResultRow[] | null;
}

/** Nome do RPC de promoção bronze → silver (definido no banco). */
const PROMOTE_RPC = "promote_contacts_from_bronze";

/** Vai pro `ingestion_log.triggered_by`. */
const TRIGGERED_BY = "cron:sync";

/**
 * Recursos do Iddas que o sync recorrente puxa: só os de OPERAÇÃO (núcleo +
 * transacionais + sub-recursos de orçamento + lead). Os de REFERÊNCIA (canal,
 * situação, aeroporto, companhia, …) ficam de fora e rodam manual quando preciso
 * — varrê-los a cada sync estoura o rate limit da API à toa.
 *
 * Tipado como `readonly IddasResource[]`: como `IddasResource` é união de
 * literais, um typo aqui é erro de compilação — não some silencioso no filtro
 * `only` da lib (que ignora nome desconhecido sem avisar).
 */
const IDDAS_OPERATIONAL_RESOURCES: readonly IddasResource[] = [
  "pessoa",
  "orcamento",
  "venda",
  "receita",
  "despesa",
  "tarefa",
  "voo",
  "cruzeiro",
  "hospedagem",
  "seguro",
  "transporte",
  "solicitacao",
];

/** Contagens por recurso pro `ingestion_log` — mesmo critério da lib (insert real, senão would). */
function countsFromResult(result: IngestionResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [resource, r] of Object.entries(result.resources)) {
    counts[resource] = r.actual_inserted ?? r.would_insert;
  }
  return counts;
}

/** Erros acumulados da run viram uma string única (igual à lib). `null` se não há. */
function errorsToMessage(result: IngestionResult): string | null {
  if (result.errors.length === 0) return null;
  return result.errors.map((e) => `[${e.resource}] ${e.message}`).join("; ");
}

function errToMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Abre a linha `ingestion_log` (status `running`) ANTES da ingestão. A FK do
 * bronze (`ingestion_run_id → ingestion_log.id`) exige esta linha primeiro. NÃO
 * best-effort: se o INSERT falhar, lança (sem ela a ingestão nem grava bronze).
 */
async function openIngestionLog(
  runId: string,
  source: SyncSource,
  startedAt: string,
): Promise<void> {
  const { error } = await supabaseAdmin().from("ingestion_log").insert({
    id: runId,
    source_system: source,
    ingestion_type: "sync",
    status: "running",
    started_at: startedAt,
    triggered_by: TRIGGERED_BY,
  });
  if (error) {
    throw new Error(`ingestion_log INSERT (running) falhou (run ${runId}): ${error.message}`);
  }
}

/**
 * Fecha a linha `ingestion_log` com o status terminal e os contadores. Duração
 * vai dentro de `counts._duration_ms` (não há coluna `duration_ms` — decisão
 * D055). NÃO best-effort: se o PATCH falhar, lança.
 */
async function closeIngestionLog(args: {
  runId: string;
  status: IngestionStatus;
  counts: Record<string, number>;
  durationMs: number;
  errorMessage: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ingestion_log")
    .update({
      status: args.status,
      finished_at: new Date().toISOString(),
      counts: { ...args.counts, _duration_ms: args.durationMs },
      error_message: args.errorMessage,
    })
    .eq("id", args.runId);
  if (error) {
    throw new Error(
      `ingestion_log PATCH (${args.status}) falhou (run ${args.runId}): ${error.message}`,
    );
  }
}

export async function runSync(source: SyncSource, opts: RunSyncOptions = {}): Promise<SyncResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  // 1. Abre a auditoria ANTES da ingestão (FK do bronze). Se falhar aqui, nem
  //    adianta ingerir — propaga.
  await openIngestionLog(runId, source, startedAt);

  // 2. Ingestão API → bronze. A lib usa NOSSO runId e não escreve o log (nós
  //    fechamos). Qualquer exceção (config/login/rede) cai no catch e ainda fecha
  //    a linha como `failed` — toda run gera registro.
  let ingestao: IngestionResult;
  try {
    const ingestOpts = {
      mode: "sync" as const,
      apply: true,
      writeIngestionLog: false,
      runId,
      triggeredBy: TRIGGERED_BY,
      logger: silentLogger,
    };
    ingestao =
      source === "clickmassa"
        ? await ingestClickMassa(ingestOpts)
        : await ingestIddas({ ...ingestOpts, only: [...IDDAS_OPERATIONAL_RESOURCES] });
  } catch (err) {
    try {
      await closeIngestionLog({
        runId,
        status: "failed",
        counts: {},
        durationMs: Date.now() - startMs,
        errorMessage: errToMessage(err),
      });
    } catch (logErr) {
      // Não mascarar o erro original; tornar a falha de auditoria visível.
      console.error(
        `[runSync:${source}] FALHA AO FECHAR ingestion_log de erro (run ${runId}):`,
        logErr instanceof Error ? (logErr.stack ?? logErr.message) : logErr,
      );
    }
    throw err;
  }

  // 3. Promoção bronze → silver ANTES de fechar a auditoria. Pulada quando
  //    ingestOnly. A promoção é parte do ciclo: se ela estoura, a run NÃO
  //    completou — mesmo com o bronze já gravado. Fechar o log antes escondia
  //    promoção morta atrás de runs verdes.
  let promocao: PromoteResultRow[] | null = null;
  if (opts.ingestOnly !== true) {
    const { data, error } = await supabaseAdmin().rpc(PROMOTE_RPC);
    if (error) {
      // Promoção estourou → run `failed`, com a mensagem da RPC no
      // `error_message`. O bronze está salvo, mas o ciclo não fechou: é
      // exatamente o que queremos enxergar. Fecha o log e propaga.
      const rpcError = `RPC ${PROMOTE_RPC} falhou: ${error.message}`;
      try {
        await closeIngestionLog({
          runId,
          status: "failed",
          counts: countsFromResult(ingestao),
          durationMs: Date.now() - startMs,
          errorMessage: rpcError,
        });
      } catch (logErr) {
        // Não mascarar o erro original; tornar a falha de auditoria visível.
        console.error(
          `[runSync:${source}] FALHA AO FECHAR ingestion_log de erro de promoção (run ${runId}):`,
          logErr instanceof Error ? (logErr.stack ?? logErr.message) : logErr,
        );
      }
      throw new Error(rpcError);
    }
    // supabaseAdmin() é criado sem o generic de Database, então rpc() devolve
    // `any`. Tipamos pelo contrato conhecido do RPC em vez de propagar `any`.
    promocao = (data as PromoteResultRow[] | null) ?? null;
  }

  // 4. Fecha a auditoria DEPOIS da promoção. Status reflete a ingestão
  //    (completed/partial/failed); a promoção, quando rodou, foi bem-sucedida
  //    aqui (falha dela já fechou como `failed` e propagou acima).
  await closeIngestionLog({
    runId,
    status: ingestao.status,
    counts: countsFromResult(ingestao),
    durationMs: Date.now() - startMs,
    errorMessage: errorsToMessage(ingestao),
  });

  return { source, ingestao, promocao };
}
