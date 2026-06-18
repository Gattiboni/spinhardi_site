export interface Opportunity {
  id: number;
  name: string;
  description?: string | null;
  // API retorna "0.00" (string) em vez de number -- confirmado empiricamente (Turno A).
  // O mapper converte para number; o tipo aceita ambos para fidelidade ao contrato real.
  value?: number | string | null;
  expectedCloseDate?: string | null;
  contactId: number;
  contact?: { id: number; name: string; phone?: string } | null;
  responsibleId?: string | null;
  responsible?: { id: number; name: string } | null;
  pipelineStepId: number;
  pipelineStep?: PipelineStep | null;
  status: "open" | "won" | "lost";
  gainOrLossReasonId?: string | null;
  productsOpportunity?: Array<{ productId: number; amount: number; value: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStep {
  id: number;
  name: string;
  color: string;
  order: number;
}

// A spec nao define id na Tag -- o smoke test vai confirmar; id=0 se ausente.
export interface Tag {
  id: number;
  tag: string;
  color: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  value: number;
}

export interface ExternalUser {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  profile: string;
}

// ─── G.2: Mensagens e sync de leads ───────────────────────────────────────

export interface SendMessageInput {
  number: string;
  body: string;
  externalKey: string;
  mediaUrl?: string;
}

export interface SendMessageResponse {
  message: {
    id: string;
    messageId?: string;
    body: string;
    ticketId: number;
    contactId: number;
    externalKey: string;
    createdAt: string;
    status: string;
    // outros campos do schema Message nao usados ficam como unknown
    [key: string]: unknown;
  };
}

export interface CreateOpportunityInput {
  name: string;
  description?: string;
  value: number;
  expectedCloseDate: string; // YYYY-MM-DD
  contactId: number;
  responsibleId: string;
  pipelineStepId: number;
  userId: string;
  productsOpportunity?: Array<{ productId: number; amount: number; value: number }>;
}

export interface SyncContactInput {
  id: string; // UUID Supabase, vira externalKey
  name: string | null;
  phone: string; // deve estar normalizado apos passar por normalizePhone
  email?: string | null;
}

export type SyncContactStatus =
  | "opportunity_created"
  | "message_sent"
  | "blocked"
  | "failed";

export interface SyncContactResult {
  status: SyncContactStatus;
  clickmassaContactId: number | null;
  clickmassaTicketId: number | null;
  clickmassaOpportunityId: number | null;
  clickmassaPipelineStepId: number | null;
  error?: string;
  errorCode?: string;
}
