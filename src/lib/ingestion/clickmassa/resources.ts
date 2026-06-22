/**
 * Os 13 runners de recurso do ClickMassa, lift verbatim de
 * scripts/backfill-clickmassa.ts. Cada runner faz seu próprio fetch+map+upsert
 * (alguns em streaming por página) — a estrutura imperativa foi preservada de
 * propósito pra garantir comportamento idêntico.
 *
 * Globais do script viraram campos de `CmCtx`.
 */

import type { SupabaseRest } from "../supabase-rest";
import type { IngestionSource, Logger, ResourceResult, RunError } from "../types";
import { buildMeta } from "../meta";
import type { ClickMassaConfig } from "../config";
import type { ClickMassaTransport } from "./transport";

export type CmResource =
  | "tags"
  | "users"
  | "queues"
  | "settings"
  | "whatsapp"
  | "api-config"
  | "funnels"
  | "lead-status"
  | "pipeline-steps"
  | "products"
  | "opportunities"
  | "contacts"
  | "contacts-dashboard";

export interface PipelineStep {
  id: number;
  name: string;
  color: string;
  order: number;
}

/** Contexto do run: tudo que era global no script. */
export interface CmCtx {
  runId: string;
  source: IngestionSource;
  dryRun: boolean;
  cfg: ClickMassaConfig;
  transport: ClickMassaTransport;
  rest: SupabaseRest;
  logger: Logger;
  shouldRun(resource: CmResource): boolean;
  results: Record<string, ResourceResult>;
  runErrors: RunError[];
}

function recordResult(ctx: CmCtx, resource: string, r: ResourceResult): void {
  ctx.results[resource] = r;
}

function extractArray(body: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(body)) return body as unknown[];
  const obj = body as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

// ─── Tags (passo 2) ───────────────────────────────────────────────────────────

export async function runTags(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Tags (2/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/tags");
    raw = extractArray(body, "data", "tags");
  } catch (err) {
    const msg = `Falha ao buscar tags: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "tags", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.tag ?? ""), // renomeia tag → name
      color: String(item.color ?? ""),
      is_active: Boolean(item.isActive ?? true),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} tags`);
  recordResult(ctx, "tags", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("tags")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_tags", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert tags: ${r.error}`); ctx.runErrors.push({ resource: "tags", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_tags`); }
    ctx.results["tags"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} tags seriam upsertadas`);
  }
}

// ─── Users (passo 3) ──────────────────────────────────────────────────────────

export async function runUsers(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Users (3/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    // Tenta API interna primeiro (shape mais rico com profilePic, canViewDepartmentTickets, etc.)
    const body = await ctx.transport.internalGet("/users");
    raw = extractArray(body, "users", "data");
  } catch {
    // Fallback: API externa (Quirk 1 — path invertido)
    ctx.logger.log("API interna falhou, tentando API externa (Quirk 1)...");
    try {
      const body = await ctx.transport.externalGet(ctx.cfg.usersExternalUrl);
      raw = extractArray(body, "users", "data");
    } catch (err) {
      const msg = `Falha ao buscar users: ${String(err)}`;
      ctx.logger.log(`ERRO: ${msg}`);
      ctx.runErrors.push({ resource: "users", message: msg });
      return;
    }
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      email: item.email != null ? String(item.email) : null,
      phone: item.phone != null ? String(item.phone) : null,
      profile: String(item.profile ?? ""),
      profile_pic: item.profilePic != null ? String(item.profilePic) : null,
      uid: item.uid != null ? String(item.uid) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      is_disable_autodistribution:
        item.isDisableAutodistribution != null ? Boolean(item.isDisableAutodistribution) : null,
      can_view_department_tickets:
        item.canViewDepartmentTickets != null ? Boolean(item.canViewDepartmentTickets) : null,
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} users`);
  recordResult(ctx, "users", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("users")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_users", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert users: ${r.error}`); ctx.runErrors.push({ resource: "users", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_users`); }
    ctx.results["users"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} users seriam upsertados`);
  }
}

// ─── Queues (passo 4) ─────────────────────────────────────────────────────────

export async function runQueues(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Queues (4/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/queue"); // SINGULAR, confirmado H.1
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar queues: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "queues", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      queue: String(item.queue ?? ""),
      is_active: Boolean(item.isActive ?? true),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      message_default_contact: item.messageDefaultContact != null ? String(item.messageDefaultContact) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} queues`);
  recordResult(ctx, "queues", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("queues")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_queues", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert queues: ${r.error}`); ctx.runErrors.push({ resource: "queues", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_queues`); }
    ctx.results["queues"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} queues seriam upsertadas`);
  }
}

// ─── Settings (passo 5) ───────────────────────────────────────────────────────

export async function runSettings(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Settings (5/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/settings");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar settings: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "settings", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      key: String(item.key ?? ""),
      value: item.value != null ? String(item.value) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} settings`);
  recordResult(ctx, "settings", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("settings")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_settings", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert settings: ${r.error}`); ctx.runErrors.push({ resource: "settings", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_settings`); }
    ctx.results["settings"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} settings seriam upsertadas`);
  }
}

// ─── WhatsApp Sessions (passo 6) ──────────────────────────────────────────────

export async function runWhatsapp(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("WhatsApp Sessions (6/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/whatsapp");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar whatsapp sessions: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "whatsapp", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      number: item.number != null ? String(item.number) : null,
      status: item.status != null ? String(item.status) : null,
      type: item.type != null ? String(item.type) : null,
      is_active: Boolean(item.isActive ?? false),
      is_default: Boolean(item.isDefault ?? false),
      provider: item.provider != null ? String(item.provider) : null,
      uid: item.uid != null ? String(item.uid) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} whatsapp sessions`);
  recordResult(ctx, "whatsapp", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("whatsapp")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_whatsapp_sessions", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert whatsapp: ${r.error}`); ctx.runErrors.push({ resource: "whatsapp", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_whatsapp_sessions`); }
    ctx.results["whatsapp"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} whatsapp sessions seriam upsertadas`);
  }
}

// ─── API Configs (passo 7) ────────────────────────────────────────────────────

export async function runApiConfig(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("API Config (7/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/api-config");
    raw = extractArray(body, "apis", "data");
  } catch (err) {
    const msg = `Falha ao buscar api-config: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "api-config", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = { ...(r as Record<string, unknown>) };
    // SEGURANÇA: REMOVER token antes do INSERT
    delete item.token;
    if ("token" in item) {
      ctx.logger.log("AVISO CRÍTICO: token ainda presente após delete — abortando este item");
      throw new Error("token não removido do api-config payload");
    }
    return {
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      session_id: item.sessionId != null ? Number(item.sessionId) : null,
      is_active: Boolean(item.isActive ?? false),
      ticket_action: item.ticketAction != null ? String(item.ticketAction) : null,
      queue_id: item.queueId != null ? Number(item.queueId) : null,
      user_id: item.userId != null ? Number(item.userId) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      webhook_url: item.webhookUrl != null ? String(item.webhookUrl) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item, // clone sem token
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} api-configs (token removido: ${!ctx.dryRun ? "SIM" : "dry-run"})`);
  recordResult(ctx, "api-config", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("api-config")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_api_configs", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert api-config: ${r.error}`); ctx.runErrors.push({ resource: "api-config", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_api_configs`); }
    ctx.results["api-config"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} api-configs seriam upsertados (sem token)`);
  }
}

// ─── Funnels + Funnel Steps (passo 8) ──────────────────────────────────────────

export async function runFunnels(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Funnels + Funnel Steps (8/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/funnel");
    raw = extractArray(body, "funnels", "data");
  } catch (err) {
    const msg = `Falha ao buscar funnels: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "funnels", message: msg });
    return;
  }

  const funnelRows: Record<string, unknown>[] = [];
  const stepRows: Record<string, unknown>[] = [];

  for (const r of raw) {
    const funnel = r as Record<string, unknown>;
    const funnelId = Number(funnel.id ?? 0);
    const steps = Array.isArray(funnel.steps) ? (funnel.steps as Record<string, unknown>[]) : [];

    funnelRows.push({
      id: funnelId,
      name: String(funnel.name ?? ""),
      action: funnel.action != null ? String(funnel.action) : null,
      session_id: funnel.sessionId != null ? Number(funnel.sessionId) : null,
      queue_id: funnel.queueId != null ? Number(funnel.queueId) : null,
      user_id: funnel.userId != null ? Number(funnel.userId) : null,
      tenant_id: funnel.tenantId != null ? Number(funnel.tenantId) : null,
      schedule_enabled: Boolean(funnel.scheduleEnabled ?? false),
      total_contacts: funnel.totalContacts != null ? parseInt(String(funnel.totalContacts), 10) : null,
      source_created_at: String(funnel.createdAt ?? m.ingested_at),
      source_updated_at: String(funnel.updatedAt ?? m.ingested_at),
      raw_payload: funnel, // inclui steps no raw_payload
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    });

    for (const step of steps) {
      stepRows.push({
        id: Number(step.id ?? 0),
        funnel_id: funnelId,
        tenant_id: step.tenantId != null ? Number(step.tenantId) : null,
        user_id: step.userId != null ? Number(step.userId) : null,
        step_order: Number(step.order ?? 0),
        message: step.message != null ? String(step.message) : null,
        minutes_later: step.minutesLater != null ? Number(step.minutesLater) : null,
        lead_status_id: step.leadStatusId != null ? Number(step.leadStatusId) : null,
        total_contacts: step.totalContacts != null ? parseInt(String(step.totalContacts), 10) : null,
        total_sents: step.totalSents != null ? parseInt(String(step.totalSents), 10) : null,
        source_created_at: String(step.createdAt ?? m.ingested_at),
        source_updated_at: String(step.updatedAt ?? m.ingested_at),
        raw_payload: step,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      });
    }
  }

  ctx.logger.log(`API: ${funnelRows.length} funnels, ${stepRows.length} funnel_steps`);
  recordResult(ctx, "funnels", { fetched: funnelRows.length, mapped: funnelRows.length, would_insert: funnelRows.length, sample: funnelRows[0] });
  recordResult(ctx, "funnel_steps", { fetched: stepRows.length, mapped: stepRows.length, would_insert: stepRows.length, sample: stepRows[0] });

  if (!ctx.dryRun && ctx.shouldRun("funnels")) {
    const r1 = await ctx.rest.sbUpsert("bronze_clickmassa_funnels", funnelRows, "id");
    if (r1.error) { ctx.logger.log(`ERRO upsert funnels: ${r1.error}`); ctx.runErrors.push({ resource: "funnels", message: r1.error }); }
    else { ctx.logger.log(`Upsert: ${r1.inserted} rows em bronze_clickmassa_funnels`); }
    ctx.results["funnels"].actual_inserted = r1.inserted;

    if (stepRows.length > 0) {
      const r2 = await ctx.rest.sbUpsert("bronze_clickmassa_funnel_steps", stepRows, "id");
      if (r2.error) { ctx.logger.log(`ERRO upsert funnel_steps: ${r2.error}`); ctx.runErrors.push({ resource: "funnel_steps", message: r2.error }); }
      else { ctx.logger.log(`Upsert: ${r2.inserted} rows em bronze_clickmassa_funnel_steps`); }
      ctx.results["funnel_steps"].actual_inserted = r2.inserted;
    }
  } else {
    ctx.logger.log(`[dry-run] ${funnelRows.length} funnels + ${stepRows.length} steps seriam upsertados`);
  }
}

// ─── Lead Statuses (passo 9) ──────────────────────────────────────────────────

export async function runLeadStatuses(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Lead Statuses (9/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.internalGet("/lead-status");
    raw = extractArray(body, "data");
  } catch (err) {
    const msg = `Falha ao buscar lead-status: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "lead-status", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      status: String(item.status ?? ""),
      color: item.color != null ? String(item.color) : null,
      active: Boolean(item.active ?? true),
      user_id: item.userId != null ? Number(item.userId) : null,
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      funnel_id: item.funnelId != null ? Number(item.funnelId) : null,
      source_created_at: String(item.createdAt ?? m.ingested_at),
      source_updated_at: String(item.updatedAt ?? m.ingested_at),
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} lead_statuses`);
  recordResult(ctx, "lead-status", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("lead-status")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_lead_statuses", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert lead-status: ${r.error}`); ctx.runErrors.push({ resource: "lead-status", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_lead_statuses`); }
    ctx.results["lead-status"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} lead_statuses seriam upsertados`);
  }
}

// ─── Pipeline Steps (passo 10) ─────────────────────────────────────────────────

export async function runPipelineSteps(ctx: CmCtx): Promise<PipelineStep[]> {
  ctx.logger.sep("Pipeline Steps (10/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let steps: PipelineStep[] = [];

  try {
    const body = await ctx.transport.externalGet("/pipeline-steps");
    const raw = extractArray(body, "data");
    steps = raw.map((r) => {
      const item = r as Record<string, unknown>;
      return {
        id: Number(item.id ?? 0),
        name: String(item.name ?? ""),
        color: String(item.color ?? ""),
        order: Number(item.order ?? 0),
      };
    });
    ctx.logger.log(`API: ${steps.length} pipeline steps`);
  } catch (err) {
    ctx.logger.log(`API externa falhou (Quirk 2): ${String(err)}`);
    ctx.logger.log("Tentando cache Supabase...");
    try {
      const { status, body } = await ctx.rest.sbFetch("/bronze_clickmassa_pipeline_steps", {
        queryParams: { order: "ordem.asc" },
      });
      if (status === 200 && Array.isArray(body)) {
        steps = (body as Record<string, unknown>[]).map((r) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          color: String(r.color ?? ""),
          order: Number(r.ordem ?? 0),
        }));
        ctx.logger.log(`Cache Supabase: ${steps.length} pipeline steps`);
      }
    } catch (cacheErr) {
      ctx.logger.log(`Cache Supabase falhou: ${String(cacheErr)}`);
    }
  }

  if (steps.length === 0) {
    ctx.runErrors.push({ resource: "pipeline-steps", message: "Nenhum step disponível (API + cache)" });
    return [];
  }

  recordResult(ctx, "pipeline-steps", { fetched: steps.length, mapped: steps.length, would_insert: steps.length, sample: steps[0] });

  if (!ctx.dryRun && ctx.shouldRun("pipeline-steps")) {
    const now = m.ingested_at;
    const rows = steps.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || null,
      ordem: s.order,
      is_active: true,
      synced_at: now,
      ingestion_run_id: ctx.runId,
    }));
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_pipeline_steps", rows, "id");
    if (r.error) { ctx.logger.log(`ERRO upsert pipeline-steps: ${r.error}`); ctx.runErrors.push({ resource: "pipeline-steps", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_pipeline_steps`); }
    ctx.results["pipeline-steps"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${steps.length} pipeline steps seriam upsertados`);
  }

  return steps;
}

// ─── Products (passo 11) ───────────────────────────────────────────────────────

export async function runProducts(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Products (11/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let raw: unknown[];
  try {
    const body = await ctx.transport.externalGet("/products");
    raw = extractArray(body, "data", "products");
  } catch (err) {
    const msg = `Falha ao buscar products: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "products", message: msg });
    return;
  }

  const rows = raw.map((r) => {
    const item = r as Record<string, unknown>;
    return {
      id: Number(item.id ?? 0),
      name: String(item.name ?? ""),
      description: item.description != null ? String(item.description) : null,
      is_active: Boolean(item.isActive ?? true),
      value: String(item.value ?? "0"),
      tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
      raw_payload: item,
      ingested_at: m.ingested_at,
      ingestion_run_id: m.ingestion_run_id,
      ingestion_source: m.ingestion_source,
    };
  });

  ctx.logger.log(`API: ${rows.length} products`);
  recordResult(ctx, "products", { fetched: rows.length, mapped: rows.length, would_insert: rows.length, sample: rows[0] });

  if (!ctx.dryRun && ctx.shouldRun("products")) {
    const r = await ctx.rest.sbUpsert("bronze_clickmassa_products", rows as Record<string, unknown>[], "id");
    if (r.error) { ctx.logger.log(`ERRO upsert products: ${r.error}`); ctx.runErrors.push({ resource: "products", message: r.error }); }
    else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_products`); }
    ctx.results["products"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] ${rows.length} products seriam upsertados`);
  }
}

// ─── Opportunities (passo 12) ──────────────────────────────────────────────────

export async function runOpportunities(ctx: CmCtx, steps: PipelineStep[]): Promise<void> {
  ctx.logger.sep("Opportunities (12/14)");
  const m = buildMeta(ctx.runId, ctx.source);

  if (steps.length === 0) {
    ctx.logger.log("Nenhum pipeline step disponível — pulando opportunities");
    recordResult(ctx, "opportunities", { fetched: 0, mapped: 0, would_insert: 0 });
    return;
  }

  const oppRows: Record<string, unknown>[] = [];
  const contactRowsFromOpps: Map<number, Record<string, unknown>> = new Map();

  for (const step of steps) {
    ctx.logger.log(`Step ${step.id} "${step.name}"...`);
    let opps: Record<string, unknown>[];
    try {
      const body = await ctx.transport.externalGet("/opportunities", { pipelineStepId: String(step.id) });
      opps = extractArray(body, "data", "opportunities") as Record<string, unknown>[];
      ctx.logger.verbose(`  ${opps.length} opps no step ${step.id}`);
    } catch (err) {
      const msg = `Falha ao listar opps do step ${step.id}: ${String(err)}`;
      ctx.logger.log(`ERRO: ${msg}`);
      ctx.runErrors.push({ resource: "opportunities", message: msg });
      continue;
    }

    for (const opp of opps) {
      const oppId = Number(opp.id ?? 0);
      if (!oppId) continue;

      oppRows.push({
        id: oppId,
        tenant_id: Number(opp.tenantId ?? 0),
        contact_id: Number(opp.contactId ?? 0),
        user_id: Number(opp.userId ?? 0),
        responsible_id: Number(opp.responsibleId ?? 0),
        pipeline_step_id: Number(opp.pipelineStepId ?? step.id),
        status: String(opp.status ?? "open"),
        value: String(opp.value ?? "0"),
        expected_close_date: opp.expectedCloseDate != null ? String(opp.expectedCloseDate) : null,
        close_date: opp.closeDate != null ? String(opp.closeDate) : null,
        pipeline_updated_at: opp.pipelineUpdatedAt != null ? String(opp.pipelineUpdatedAt) : null,
        source_created_at: String(opp.createdAt ?? m.ingested_at),
        source_updated_at: String(opp.updatedAt ?? m.ingested_at),
        raw_payload: opp,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      });

      // Contact embed (bronze contact light — será sobrescrito pelo /contacts do passo 13)
      const contactRaw = opp.contact;
      if (contactRaw && typeof contactRaw === "object" && !Array.isArray(contactRaw)) {
        const c = contactRaw as Record<string, unknown>;
        const contactId = Number(c.id ?? 0);
        if (contactId && !contactRowsFromOpps.has(contactId)) {
          contactRowsFromOpps.set(contactId, {
            id: contactId,
            tenant_id: Number(c.tenantId ?? 0),
            name: String(c.name ?? ""),
            number: String(c.number ?? ""),
            pushname: c.pushname != null ? String(c.pushname) : null,
            email: c.email != null ? String(c.email) : null,
            channel: String(c.channel ?? "whatsapp"),
            company: c.company != null ? String(c.company) : null,
            gender: c.gender != null ? String(c.gender) : null,
            birth_date: c.birthDate != null ? String(c.birthDate) : null,
            cep: c.cep != null ? String(c.cep) : null,
            pais: c.pais != null ? String(c.pais) : null,
            estado: c.estado != null ? String(c.estado) : null,
            cidade: c.cidade != null ? String(c.cidade) : null,
            bairro: c.bairro != null ? String(c.bairro) : null,
            logradouro: c.logradouro != null ? String(c.logradouro) : null,
            numero_endereco: c.numero != null ? String(c.numero) : null,
            complemento: c.complemento != null ? String(c.complemento) : null,
            is_number: Boolean(c.isNumber ?? false),
            is_user: Boolean(c.isUser ?? false),
            is_wa_contact: Boolean(c.isWAContact ?? false),
            is_group: Boolean(c.isGroup ?? false),
            is_blacklisted: false,
            tags: [],
            lead_status: null,
            lead_status_id: c.leadStatusId != null ? Number(c.leadStatusId) : null,
            profile_pic_url: c.profilePicUrl != null ? String(c.profilePicUrl) : null,
            pic_is_object_storage: c.picIsObjectStorage != null ? Boolean(c.picIsObjectStorage) : null,
            wallet_id: null,
            funnels: null,
            lid: c.lid != null ? String(c.lid) : null,
            first_connection: c.firstConnection != null ? Number(c.firstConnection) : null,
            deleted_at: c.deletedAt != null ? String(c.deletedAt) : null,
            source_created_at: String(c.createdAt ?? m.ingested_at),
            source_updated_at: String(c.updatedAt ?? m.ingested_at),
            raw_payload: c,
            ingested_at: m.ingested_at,
            ingestion_run_id: m.ingestion_run_id,
            ingestion_source: m.ingestion_source,
          });
        }
      }
    }
  }

  ctx.logger.log(`Total: ${oppRows.length} opportunities, ${contactRowsFromOpps.size} contacts (de embed)`);
  recordResult(ctx, "opportunities", { fetched: oppRows.length, mapped: oppRows.length, would_insert: oppRows.length, sample: oppRows[0] });

  if (!ctx.dryRun && ctx.shouldRun("opportunities")) {
    if (oppRows.length > 0) {
      const r = await ctx.rest.sbUpsert("bronze_clickmassa_opportunities", oppRows, "id");
      if (r.error) { ctx.logger.log(`ERRO upsert opportunities: ${r.error}`); ctx.runErrors.push({ resource: "opportunities", message: r.error }); }
      else { ctx.logger.log(`Upsert: ${r.inserted} rows em bronze_clickmassa_opportunities`); }
      ctx.results["opportunities"].actual_inserted = r.inserted;
    }
    // Contacts from embed (light upsert — passo 13 vai sobrescrever com dados mais ricos)
    if (contactRowsFromOpps.size > 0) {
      const contactBatch = Array.from(contactRowsFromOpps.values());
      const rc = await ctx.rest.sbUpsert("bronze_clickmassa_contacts", contactBatch, "id");
      if (rc.error) { ctx.logger.log(`ERRO upsert contacts (embed opps): ${rc.error}`); }
      else { ctx.logger.log(`Upsert: ${rc.inserted} contacts de embed em bronze_clickmassa_contacts`); }
    }
  } else {
    ctx.logger.log(`[dry-run] ${oppRows.length} opps + ${contactRowsFromOpps.size} contacts (embed) seriam upsertados`);
  }
}

// ─── Contacts paginado (passo 13) ───────────────────────────────────────────────

export async function runContacts(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Contacts paginado (13/14)");
  const m = buildMeta(ctx.runId, ctx.source);

  let pageNumber = 1;
  let totalFetched = 0;
  let totalMapped = 0;
  let totalInserted = 0;
  let pages = 0;
  let sampleRow: unknown = undefined;

  while (true) {
    let body: unknown;
    try {
      body = await ctx.transport.internalGet("/contacts", { pageNumber: String(pageNumber) });
    } catch (err) {
      const msg = `Falha na página ${pageNumber}: ${String(err)}`;
      ctx.logger.log(`ERRO: ${msg}`);
      ctx.runErrors.push({ resource: "contacts", message: msg });
      break;
    }

    const resp = body as Record<string, unknown>;
    const contacts = extractArray(resp.contacts ?? resp, "contacts");
    const count = parseInt(String(resp.count ?? "0"), 10); // Quirk: count é STRING
    const hasMore = Boolean(resp.hasMore ?? false);

    if (pageNumber === 1) {
      ctx.logger.log(`Total contacts declarado: ${count} (string parse: ${count})`);
      if (ctx.source === "backfill" && count !== 1483) {
        ctx.logger.log(`BANDEIRA: esperado 1483, API retornou ${count}`);
        ctx.runErrors.push({ resource: "contacts", message: `count inesperado: ${count} (esperado 1483)` });
      }
    }

    totalFetched += contacts.length;
    pages++;

    const rows = contacts.map((c) => {
      const item = c as Record<string, unknown>;
      return {
        id: Number(item.id ?? 0),
        tenant_id: item.tenantId != null ? Number(item.tenantId) : null,
        name: String(item.name ?? ""),
        number: String(item.number ?? ""),
        pushname: item.pushname != null ? String(item.pushname) : null,
        email: item.email != null ? String(item.email) : null,
        channel: String(item.channel ?? "whatsapp"),
        company: null,
        gender: null,
        birth_date: null,
        cep: null,
        pais: null,
        estado: null,
        cidade: null,
        bairro: null,
        logradouro: null,
        numero_endereco: null,
        complemento: null,
        is_number: Boolean(item.isNumber ?? false),
        is_user: Boolean(item.isUser ?? false),
        is_wa_contact: Boolean(item.isWAContact ?? false),
        is_group: Boolean(item.isGroup ?? false),
        is_blacklisted: Boolean(item.isBlacklisted ?? false),
        deleted_at: null,
        profile_pic_url: item.profilePicUrl != null ? String(item.profilePicUrl) : null,
        pic_is_object_storage: item.picIsObjectStorage != null ? Boolean(item.picIsObjectStorage) : null,
        lead_status: item.leadStatus != null ? String(item.leadStatus) : null,
        lead_status_id: null, // não disponível no /contacts list (só no embed da opp)
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
        wallet_id: item.walletId != null ? Number(item.walletId) : null,
        funnels: item.funnels != null ? (item.funnels as Record<string, unknown>) : null,
        lid: item.lid != null ? String(item.lid) : null,
        first_connection: item.firstConnection != null ? Number(item.firstConnection) : null,
        source_created_at: String(item.createdAt ?? m.ingested_at),
        source_updated_at: String(item.updatedAt ?? m.ingested_at),
        raw_payload: item,
        ingested_at: m.ingested_at,
        ingestion_run_id: m.ingestion_run_id,
        ingestion_source: m.ingestion_source,
      };
    });

    totalMapped += rows.length;
    if (!sampleRow && rows.length > 0) sampleRow = rows[0];

    ctx.logger.verbose(`  Página ${pageNumber}: ${contacts.length} contacts (hasMore=${hasMore})`);

    if (!ctx.dryRun && ctx.shouldRun("contacts")) {
      const r = await ctx.rest.sbUpsert("bronze_clickmassa_contacts", rows as Record<string, unknown>[], "id");
      if (r.error) {
        ctx.logger.log(`ERRO upsert contacts página ${pageNumber}: ${r.error}`);
        ctx.runErrors.push({ resource: "contacts", message: `page ${pageNumber}: ${r.error}` });
      } else {
        totalInserted += r.inserted;
      }
    }

    if (!hasMore || contacts.length === 0) break;
    pageNumber++;
  }

  ctx.logger.log(`Contacts: ${totalFetched} fetchados, ${totalMapped} mapeados em ${pages} páginas`);
  recordResult(ctx, "contacts", {
    fetched: totalFetched,
    mapped: totalMapped,
    would_insert: totalMapped,
    actual_inserted: totalInserted,
    pages,
    sample: sampleRow,
  });

  if (ctx.dryRun) {
    ctx.logger.log(`[dry-run] ${totalMapped} contacts seriam upsertados`);
  } else {
    ctx.logger.log(`Upsert: ${totalInserted} rows em bronze_clickmassa_contacts`);
  }
}

// ─── Contacts Dashboard (passo 14) ─────────────────────────────────────────────

export async function runContactsDashboard(ctx: CmCtx): Promise<void> {
  ctx.logger.sep("Contacts Dashboard (14/14)");
  const m = buildMeta(ctx.runId, ctx.source);
  let dashBody: unknown;
  try {
    dashBody = await ctx.transport.internalGet("/contacts-dashboard");
  } catch (err) {
    const msg = `Falha ao buscar contacts-dashboard: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource: "contacts-dashboard", message: msg });
    return;
  }

  const dash = dashBody as Record<string, unknown>;
  const recency = (dash.recency ?? {}) as Record<string, number>;

  const row: Record<string, unknown> = {
    snapshot_at: m.ingested_at,
    total: Number(dash.total ?? 0),
    weekly_new: dash.weeklyNew != null ? Number(dash.weeklyNew) : null,
    recency_d30: recency.d30 != null ? Number(recency.d30) : null,
    recency_d90: recency.d90 != null ? Number(recency.d90) : null,
    recency_d180: recency.d180 != null ? Number(recency.d180) : null,
    recency_d360: recency.d360 != null ? Number(recency.d360) : null,
    recency_d360plus: recency.d360plus != null ? Number(recency.d360plus) : null,
    raw_payload: dash,
    ingested_at: m.ingested_at,
    ingestion_run_id: m.ingestion_run_id,
    ingestion_source: m.ingestion_source,
  };

  ctx.logger.log(`API: dashboard total=${row.total}, weekly_new=${row.weekly_new}`);
  recordResult(ctx, "contacts-dashboard", { fetched: 1, mapped: 1, would_insert: 1, sample: row });

  if (!ctx.dryRun && ctx.shouldRun("contacts-dashboard")) {
    const r = await ctx.rest.sbInsert("bronze_clickmassa_contacts_dashboard", [row]);
    if (r.error) {
      ctx.logger.log(`ERRO insert contacts-dashboard: ${r.error}`);
      ctx.runErrors.push({ resource: "contacts-dashboard", message: r.error });
    } else {
      ctx.logger.log(`Insert: ${r.inserted} row em bronze_clickmassa_contacts_dashboard`);
    }
    ctx.results["contacts-dashboard"].actual_inserted = r.inserted;
  } else {
    ctx.logger.log(`[dry-run] 1 snapshot seria inserido em bronze_clickmassa_contacts_dashboard`);
  }
}
