import "server-only";
import { clickMassaFetch, getBaseUrl, ClickMassaError } from "./http";
import { listPipelineStepsResilient } from "./pipeline-steps-cache";
import type {
  Opportunity,
  PipelineStep,
  Tag,
  Product,
  ExternalUser,
  SendMessageInput,
  SendMessageResponse,
  CreateOpportunityInput,
  SyncContactInput,
  SyncContactResult,
} from "./types";

export type {
  Opportunity,
  PipelineStep,
  Tag,
  Product,
  ExternalUser,
  SendMessageInput,
  SendMessageResponse,
  CreateOpportunityInput,
  SyncContactInput,
  SyncContactResult,
};
export type { SyncContactStatus } from "./types";
export { ClickMassaError } from "./http";
export { listPipelineStepsResilient, refreshPipelineStepsCache, getCachedPipelineSteps } from "./pipeline-steps-cache";

// ─── Helpers de URL ────────────────────────────────────────────────────────

// O endpoint de usuarios tem estrutura diferente: /v1/api/external/users/{apiId}
// enquanto o base URL e /v1/api/external/{apiId}
function usersUrl(): string {
  const base = getBaseUrl();
  const lastSlash = base.lastIndexOf("/");
  const apiId = base.slice(lastSlash + 1);
  const parent = base.slice(0, lastSlash);
  return `${parent}/users/${apiId}`;
}

// ─── Mappers explícitos (D029) ─────────────────────────────────────────────

function mapPipelineStep(raw: unknown): PipelineStep {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    color: String(r.color ?? ""),
    order: Number(r.order ?? 0),
  };
}

function mapContact(
  raw: unknown,
): { id: number; name: string; phone?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    name: String(r.name ?? ""),
    phone: r.phone != null ? String(r.phone) : undefined,
  };
}

function mapResponsible(raw: unknown): { id: number; name: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return { id: Number(r.id ?? 0), name: String(r.name ?? "") };
}

function mapOpportunity(raw: unknown): Opportunity {
  const r = raw as Record<string, unknown>;
  const stepRaw = r.pipelineStep ?? null;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: (r.description as string | null | undefined) ?? null,
    value: r.value != null ? Number(r.value) : null,
    expectedCloseDate: (r.expectedCloseDate as string | null | undefined) ?? null,
    contactId: Number(r.contactId ?? 0),
    contact: mapContact(r.contact),
    responsibleId: (r.responsibleId as string | null | undefined) ?? null,
    responsible: mapResponsible(r.responsible),
    pipelineStepId: Number(r.pipelineStepId ?? 0),
    pipelineStep:
      stepRaw && typeof stepRaw === "object" ? mapPipelineStep(stepRaw) : null,
    status: (r.status as "open" | "won" | "lost") ?? "open",
    gainOrLossReasonId:
      (r.gainOrLossReasonId as string | null | undefined) ?? null,
    productsOpportunity: Array.isArray(r.productsOpportunity)
      ? (r.productsOpportunity as Array<{
          productId: number;
          amount: number;
          value: number;
        }>)
      : undefined,
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

function mapTag(raw: unknown): Tag {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id != null ? Number(r.id) : 0,
    tag: String(r.tag ?? ""),
    color: String(r.color ?? ""),
  };
}

function mapProduct(raw: unknown): Product {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: r.description != null ? String(r.description) : undefined,
    isActive: Boolean(r.isActive ?? true),
    value: Number(r.value ?? 0),
  };
}

function mapUser(raw: unknown): ExternalUser {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    phone: r.phone != null ? String(r.phone) : undefined,
    email: r.email != null ? String(r.email) : undefined,
    profile: String(r.profile ?? ""),
  };
}

// Extrai array de respostas que podem vir como array direto ou envolto em objeto.
function extractArray<T>(
  response: unknown,
  mapper: (raw: unknown) => T,
  ...keys: string[]
): T[] {
  if (Array.isArray(response)) {
    return (response as unknown[]).map(mapper);
  }
  const obj = response as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).map(mapper);
    }
  }
  return [];
}

// ─── Funções públicas ──────────────────────────────────────────────────────

// Delega ao cache resiliente (Quirk 2: /pipeline-steps tem 500 intermitente).
// Mantem assinatura compativel com consumidores existentes.
export async function listPipelineSteps(): Promise<PipelineStep[]> {
  const { steps } = await listPipelineStepsResilient();
  return steps;
}

/**
 * Lista oportunidades filtradas por step ou contato.
 *
 * A API exige obrigatoriamente um dos filtros abaixo; sem filtro retorna
 * 404 ERR_CONTACT_PIPELINE_NOT_FOUND (confirmado empiricamente, Turno A).
 */
export async function listOpportunities(
  filter: { pipelineStepId: number } | { contactId: number },
): Promise<Opportunity[]> {
  const param =
    "pipelineStepId" in filter
      ? `pipelineStepId=${filter.pipelineStepId}`
      : `contactId=${filter.contactId}`;
  const res = await clickMassaFetch<unknown>(`/opportunities?${param}`);
  return extractArray(res, mapOpportunity, "data", "opportunities");
}

export async function getOpportunity(id: number): Promise<Opportunity> {
  const res = await clickMassaFetch<unknown>(`/opportunities/${id}`);
  // Pode vir direto como objeto ou envolto em { data: ... }
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const obj = res as Record<string, unknown>;
    const raw = obj.data ?? obj.opportunity ?? res;
    return mapOpportunity(raw);
  }
  return mapOpportunity(res);
}

export async function updateOpportunity(
  id: number,
  patch: Partial<Opportunity>,
): Promise<Opportunity> {
  const res = await clickMassaFetch<unknown>(`/opportunities/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const obj = res as Record<string, unknown>;
    const raw = obj.data ?? obj.opportunity ?? res;
    return mapOpportunity(raw);
  }
  return mapOpportunity(res);
}

export async function updateOpportunityStatus(
  id: number,
  status: "won" | "lost",
  opts?: {
    gainOrLossReasonId?: string;
    pipelineStepId?: number;
    note?: string;
    userId: string;
  },
): Promise<Opportunity> {
  const body: Record<string, unknown> = {
    status,
    userId: opts?.userId ?? "",
    pipelineStepId: opts?.pipelineStepId ?? null,
    gainOrLossReasonId: opts?.gainOrLossReasonId ?? null,
    note: opts?.note ?? null,
  };
  const res = await clickMassaFetch<unknown>(`/opportunities/${id}/status`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const obj = res as Record<string, unknown>;
    const raw = obj.data ?? obj.opportunity ?? res;
    return mapOpportunity(raw);
  }
  return mapOpportunity(res);
}

export async function listTags(): Promise<Tag[]> {
  const res = await clickMassaFetch<unknown>("/tags");
  return extractArray(res, mapTag, "data", "tags");
}

export async function listProducts(): Promise<Product[]> {
  const res = await clickMassaFetch<unknown>("/products");
  return extractArray(res, mapProduct, "data", "products");
}

export async function listUsers(): Promise<ExternalUser[]> {
  const res = await clickMassaFetch<unknown>(usersUrl());
  return extractArray(res, mapUser, "users", "data");
}

// ─── G.2: Helpers privados ────────────────────────────────────────────────

// Extrai o codigo de erro da API do payload da ClickMassaError.
// A spec usa { error: string } como ErrorResponse; fallback pro code HTTP.
function extractPayloadCode(err: ClickMassaError): string {
  if (err.payload && typeof err.payload === "object") {
    const p = err.payload as Record<string, unknown>;
    if (typeof p.error === "string" && p.error) return p.error;
  }
  return err.code;
}

// Remove tudo que nao e digito e prefixa 55 se parecer numero brasileiro sem DDI.
// Heuristica: starts with DDD 11-99 e tem 10-11 digitos -> prefixa 55.
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (digits.length >= 10 && digits.length <= 11 && ddd >= 11 && ddd <= 99) {
    return `55${digits}`;
  }
  return digits;
}

// Monta o texto da mensagem de boas-vindas. Se nome vazio/null, omite o vocativo.
function buildWelcomeMessageBody(name: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Olá, ${firstName}! 🌎` : "Olá! 🌎";
  return (
    `${greeting}\n\n` +
    "Aqui é da Spinhardi Turismo. Recebemos seu contato pelo site e já estamos com a sua mensagem em mãos. Em instantes uma das nossas consultoras vai te chamar pra entender sua viagem dos sonhos.\n\n" +
    "Até já! ✨"
  );
}

function mapSendMessageMessage(raw: unknown): SendMessageResponse["message"] {
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    id: String(r.id ?? ""),
    messageId: r.messageId != null ? String(r.messageId) : undefined,
    body: String(r.body ?? ""),
    ticketId: Number(r.ticketId ?? 0),
    contactId: Number(r.contactId ?? 0),
    externalKey: String(r.externalKey ?? ""),
    createdAt: String(r.createdAt ?? ""),
    status: String(r.status ?? ""),
  };
}

// ─── G.2: Funcoes publicas ────────────────────────────────────────────────

// Envia mensagem via WhatsApp. POST no URL base (/{apiId}).
export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResponse> {
  const body: Record<string, unknown> = {
    number: input.number,
    body: input.body,
    externalKey: input.externalKey,
  };
  if (input.mediaUrl) body.mediaUrl = input.mediaUrl;

  const res = await clickMassaFetch<unknown>(getBaseUrl(), {
    method: "POST",
    body: JSON.stringify(body),
  });

  const obj = res as Record<string, unknown>;
  const msgRaw = obj.message ?? res;
  return { message: mapSendMessageMessage(msgRaw) };
}

// Cria oportunidade no funil. POST /opportunities.
export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<Opportunity> {
  const body: Record<string, unknown> = {
    name: input.name,
    value: input.value,
    expectedCloseDate: input.expectedCloseDate,
    contactId: input.contactId,
    responsibleId: input.responsibleId,
    pipelineStepId: input.pipelineStepId,
    userId: input.userId,
  };
  if (input.description != null) body.description = input.description;
  if (input.productsOpportunity) body.productsOpportunity = input.productsOpportunity;

  const res = await clickMassaFetch<unknown>("/opportunities", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (res && typeof res === "object" && !Array.isArray(res)) {
    const obj = res as Record<string, unknown>;
    const raw = obj.data ?? obj.opportunity ?? res;
    return mapOpportunity(raw);
  }
  return mapOpportunity(res);
}

// Orquestra o fluxo de sync de um lead do site: envia boas-vindas + cria opp.
// Funcao pura: nao grava no Supabase. Quem chama e responsavel por persistir.
export async function syncContactFlow(
  input: SyncContactInput,
): Promise<SyncContactResult> {
  const phone = normalizePhone(input.phone);

  // 1. Envia mensagem de boas-vindas
  let sendRes: SendMessageResponse;
  try {
    sendRes = await sendMessage({
      number: phone,
      body: buildWelcomeMessageBody(input.name),
      externalKey: input.id,
    });
  } catch (err) {
    if (err instanceof ClickMassaError) {
      return {
        status: "failed",
        clickmassaContactId: null,
        clickmassaTicketId: null,
        clickmassaOpportunityId: null,
        clickmassaPipelineStepId: null,
        error: err.message,
        errorCode: extractPayloadCode(err),
      };
    }
    return {
      status: "failed",
      clickmassaContactId: null,
      clickmassaTicketId: null,
      clickmassaOpportunityId: null,
      clickmassaPipelineStepId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const clickmassaContactId = sendRes.message.contactId;
  const clickmassaTicketId = sendRes.message.ticketId;

  // 2. Busca o primeiro pipeline step (menor order)
  let steps: PipelineStep[];
  try {
    steps = await listPipelineSteps();
  } catch (err) {
    return {
      status: "failed",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: null,
      clickmassaPipelineStepId: null,
      error: err instanceof Error ? err.message : String(err),
      errorCode: err instanceof ClickMassaError ? extractPayloadCode(err) : undefined,
    };
  }

  const firstStep = [...steps].sort((a, b) => a.order - b.order)[0] ?? null;
  if (!firstStep) {
    return {
      status: "failed",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: null,
      clickmassaPipelineStepId: null,
      error: "Nenhum pipeline step disponivel no ClickMassa",
    };
  }

  const pipelineStepId = firstStep.id;
  const agentId = process.env.CLICKMASSA_DEFAULT_AGENT_ID ?? "";
  const firstName = input.name?.trim().split(/\s+/)[0] ?? null;
  const displayName = firstName ?? phone;

  // expectedCloseDate: hoje + 30 dias
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 30);
  const expectedCloseDate = closeDate.toISOString().slice(0, 10);

  // 3. Cria oportunidade
  try {
    const opp = await createOpportunity({
      name: `Lead via Site - ${displayName}`,
      value: 0,
      expectedCloseDate,
      contactId: clickmassaContactId,
      responsibleId: agentId,
      pipelineStepId,
      userId: agentId,
    });
    return {
      status: "opportunity_created",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: opp.id,
      clickmassaPipelineStepId: pipelineStepId,
    };
  } catch (err) {
    if (err instanceof ClickMassaError) {
      const errorCode = extractPayloadCode(err);
      const isBlocked =
        errorCode === "ERR_CONTACT_PIPELINE_NOT_FOUND" ||
        err.message.includes("ERR_CONTACT_PIPELINE_NOT_FOUND");
      if (isBlocked) {
        return {
          status: "blocked",
          clickmassaContactId,
          clickmassaTicketId,
          clickmassaOpportunityId: null,
          clickmassaPipelineStepId: pipelineStepId,
          error: "Módulo de Oportunidades não configurado no ClickMassa",
          errorCode,
        };
      }
      return {
        status: "failed",
        clickmassaContactId,
        clickmassaTicketId,
        clickmassaOpportunityId: null,
        clickmassaPipelineStepId: pipelineStepId,
        error: err.message,
        errorCode,
      };
    }
    return {
      status: "failed",
      clickmassaContactId,
      clickmassaTicketId,
      clickmassaOpportunityId: null,
      clickmassaPipelineStepId: pipelineStepId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Compat: export { clickmassa } usado no dashboard ─────────────────────

export const clickmassa = {
  async getStats(): Promise<{
    ticketsAbertos: number;
    oportunidadesAtivas: number;
  }> {
    try {
      const { steps } = await listPipelineStepsResilient();
      if (steps.length === 0) return { ticketsAbertos: 0, oportunidadesAtivas: 0 };
      const results = await Promise.allSettled(
        steps.map((s) => listOpportunities({ pipelineStepId: s.id })),
      );
      const opps = results
        .filter(
          (r): r is PromiseFulfilledResult<Opportunity[]> => r.status === "fulfilled",
        )
        .flatMap((r) => r.value);
      const abertas = opps.filter((o) => o.status === "open");
      return { ticketsAbertos: abertas.length, oportunidadesAtivas: abertas.length };
    } catch {
      return { ticketsAbertos: 0, oportunidadesAtivas: 0 };
    }
  },
};
