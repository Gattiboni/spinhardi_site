import "server-only";
import { clickMassaFetch } from "./http";
import type { PipelineStep } from "./types";
import { supabaseAdmin } from "@/lib/supabase/server";

// ─── Tipos internos ────────────────────────────────────────────────────────

type PipelineStepDbRow = {
  id: number;
  name: string;
  color: string | null;
  ordem: number;
  is_active: boolean;
  synced_at: string;
};

// ─── Mappers DB <-> TS ────────────────────────────────────────────────────

// snake_case (DB) -> camelCase (TS), campo a campo (D029)
function rowToPipelineStep(row: PipelineStepDbRow): PipelineStep {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? "",
    order: row.ordem,
  };
}

// API raw -> PipelineStep (intencionalmente duplicado de index.ts para
// evitar importacao circular: pipeline-steps-cache <- http <- [index nao importado])
function mapPipelineStepFromApi(raw: unknown): PipelineStep {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    color: String(r.color ?? ""),
    order: Number(r.order ?? 0),
  };
}

function extractStepsFromApiResponse(response: unknown): PipelineStep[] {
  if (Array.isArray(response)) {
    return (response as unknown[]).map(mapPipelineStepFromApi);
  }
  const obj = response as Record<string, unknown>;
  if (Array.isArray(obj.data)) {
    return (obj.data as unknown[]).map(mapPipelineStepFromApi);
  }
  return [];
}

// ─── Leitura interna (sem filtro de frescor) ───────────────────────────────

async function readAllFromCache(): Promise<{
  steps: PipelineStep[];
  syncedAt: Date | null;
}> {
  const { data, error } = await supabaseAdmin()
    .from("bronze_clickmassa_pipeline_steps")
    .select("*")
    .order("ordem", { ascending: true });

  if (error || !data || (data as PipelineStepDbRow[]).length === 0) {
    return { steps: [], syncedAt: null };
  }

  const rows = data as PipelineStepDbRow[];
  const maxSyncedAt = rows.reduce<Date | null>((max, r) => {
    const d = new Date(r.synced_at);
    return max === null || d > max ? d : max;
  }, null);

  return { steps: rows.map(rowToPipelineStep), syncedAt: maxSyncedAt };
}

// ─── API publica ──────────────────────────────────────────────────────────

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Le pipeline steps do cache local (tabela `bronze_clickmassa_pipeline_steps`),
 * ordenados por `ordem ASC`. Retorna [] se vazio ou mais velho que `maxAgeMs`.
 */
export async function getCachedPipelineSteps(opts?: {
  maxAgeMs?: number;
}): Promise<PipelineStep[]> {
  const maxAge = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const { steps, syncedAt } = await readAllFromCache();
  if (!syncedAt) return [];
  if (Date.now() - syncedAt.getTime() > maxAge) return [];
  return steps;
}

/**
 * Chama a API ClickMassa e atualiza o cache via UPSERT em batch.
 * Captura erros internamente -- nunca lanca excecao.
 */
export async function refreshPipelineStepsCache(): Promise<{
  updated: number;
  error?: string;
}> {
  try {
    const res = await clickMassaFetch<unknown>("/pipeline-steps");
    const steps = extractStepsFromApiResponse(res);

    if (steps.length === 0) {
      return { updated: 0, error: "API retornou lista vazia de pipeline steps" };
    }

    const now = new Date().toISOString();
    const rows = steps.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || null,
      ordem: s.order,
      is_active: true,
      synced_at: now,
    }));

    const { error: upsertError } = await supabaseAdmin()
      .from("bronze_clickmassa_pipeline_steps")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      return { updated: 0, error: upsertError.message };
    }

    return { updated: steps.length };
  } catch (err) {
    return {
      updated: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Orquestrador resiliente para pipeline steps.
 *
 * Fluxo:
 * 1. Cache fresco (< 24h) -> retorna steps, source: 'cache'
 * 2. Cache stale ou vazio -> tenta refresh via API
 * 3. API ok -> UPSERT cache, source: 'fresh'
 * 4. API falhou + cache stale existe -> source: 'stale-cache' + error
 * 5. API falhou + sem cache -> steps: [], source: 'stale-cache' + error
 *
 * Projetado para absorver o Quirk 2 do ClickMassa (500 intermitente em /pipeline-steps).
 */
export async function listPipelineStepsResilient(): Promise<{
  steps: PipelineStep[];
  source: "cache" | "fresh" | "stale-cache";
  error?: string;
}> {
  const { steps: cachedSteps, syncedAt } = await readAllFromCache();
  const isFresh =
    syncedAt !== null &&
    Date.now() - syncedAt.getTime() <= DEFAULT_MAX_AGE_MS;

  if (isFresh && cachedSteps.length > 0) {
    return { steps: cachedSteps, source: "cache" };
  }

  // Cache stale ou vazio -- tenta API
  const refreshResult = await refreshPipelineStepsCache();

  if (!refreshResult.error) {
    const { steps: freshSteps } = await readAllFromCache();
    return { steps: freshSteps, source: "fresh" };
  }

  // API falhou
  if (cachedSteps.length > 0) {
    return {
      steps: cachedSteps,
      source: "stale-cache",
      error: refreshResult.error,
    };
  }

  return { steps: [], source: "stale-cache", error: refreshResult.error };
}
