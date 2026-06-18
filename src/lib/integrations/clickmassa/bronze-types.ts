/**
 * Bronze layer — tipos fiéis ao payload da API ClickMassa.
 *
 * Sem `import "server-only"`. Pode ser importado por scripts CLI e mappers puros.
 * Cada interface espelha uma tabela `bronze_clickmassa_*` no Supabase (DDL via Claudinho).
 */

export type IngestionSource = "backfill" | "sync" | "webhook";

/** Metadata de ingestão presente em todas as linhas bronze. */
export interface BronzeIngestionMeta {
  ingested_at: string; // ISO datetime
  ingestion_run_id: string; // UUID v4
  ingestion_source: IngestionSource;
}

// ─── Opportunities ────────────────────────────────────────────────────────────

/**
 * bronze_clickmassa_opportunities
 *
 * Campos planos-chave do payload Opportunity + raw_payload completo.
 * `value` preservado como string (API retorna "0.00" — Turno A confirmou).
 */
export interface BronzeClickMassaOpportunityRow extends BronzeIngestionMeta {
  id?: number; // PK gerado pelo Supabase

  source_id: number; // opp.id
  tenant_id: number; // opp.tenantId
  contact_id: number; // opp.contactId
  user_id: number; // opp.userId
  responsible_id: number; // opp.responsibleId
  pipeline_step_id: number; // opp.pipelineStepId
  status: "open" | "won" | "lost";
  value: string; // API retorna string ("0.00"), preservado em bronze
  expected_close_date: string | null;
  close_date: string | null;
  pipeline_updated_at: string | null;
  source_created_at: string; // opp.createdAt
  source_updated_at: string; // opp.updatedAt

  raw_payload: Record<string, unknown>;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * bronze_clickmassa_contacts
 *
 * Populado a partir do objeto `contact` embedado nas respostas de Opportunity.
 * GET /contacts não existe na API externa (confirmado Turno A).
 * Campos de endereço duplicados (top-level + address object): usamos top-level.
 * `numero_endereco` = contact.numero para evitar colisão com ID do banco.
 */
export interface BronzeClickMassaContactRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // contact.id
  tenant_id: number; // contact.tenantId
  name: string; // contact.name (pode ser número de telefone se sem nome)
  number: string; // contact.number (WhatsApp E.164)
  pushname: string | null; // contact.pushname (nome do WhatsApp após primeiro reply)
  email: string | null;
  channel: string; // "whatsapp"
  company: string | null;
  gender: string | null;
  birth_date: string | null; // contact.birthDate

  // Endereço (campos top-level do contact)
  cep: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero_endereco: string | null; // contact.numero (nº do imóvel)
  complemento: string | null;

  // Flags de status
  is_number: boolean; // contact.isNumber
  is_user: boolean; // contact.isUser
  is_wa_contact: boolean; // contact.isWAContact
  is_group: boolean; // contact.isGroup
  is_blacklisted: boolean; // contact.isBlacklisted (NOT NULL, default false)
  deleted_at: string | null;
  first_connection: number | null; // contact.firstConnection (ID do canal WA)

  // Campos novos Lote H.2
  profile_pic_url: string | null; // contact.profilePicUrl
  pic_is_object_storage: boolean | null; // contact.picIsObjectStorage
  lead_status: string | null; // contact.leadStatus (label)
  lead_status_id: number | null; // contact.leadStatusId (apenas no embed da opp)
  tags: string[]; // contact.tags (NOT NULL, default [])
  wallet_id: number | null; // contact.walletId
  funnels: Record<string, unknown> | null; // contact.funnels
  lid: string | null; // contact.lid

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/**
 * bronze_clickmassa_tags
 *
 * GET /tags retorna array direto. Campos extras além da spec:
 * isActive, tenantId, createdAt, updatedAt (confirmado Turno C).
 */
export interface BronzeClickMassaTagRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // tag.id
  tenant_id: number; // tag.tenantId
  tag: string; // tag.tag (texto da etiqueta)
  color: string;
  is_active: boolean;
  user_id: number | null; // tag.userId

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * bronze_clickmassa_users
 *
 * GET /users/{apiId} → { users: ExternalUser[], count: number }
 * Atenção: URL invertida (Quirk 1) — ver clickmassa-endpoints.md.
 */
export interface BronzeClickMassaUserRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // user.id
  tenant_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  profile: string; // "admin" | "user" | etc.
  profile_pic: string | null; // user.profilePic (novo Lote H.2)
  uid: string | null;
  is_disable_autodistribution: boolean | null;
  can_view_department_tickets: boolean | null;

  raw_payload: Record<string, unknown>;
}

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * bronze_clickmassa_products
 *
 * GET /products → { success, data: Product[] }
 */
export interface BronzeClickMassaProductRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // product.id
  tenant_id: number | null;
  name: string;
  description: string | null;
  is_active: boolean;
  value: string; // preservado como string para fidelidade (padrão da opp.value)

  raw_payload: Record<string, unknown>;
}

// ─── Shapes da API ClickMassa (para uso em mappers e scripts) ─────────────────

/** Shape de Tag retornado pela API (campos além da spec confirmados Turno C). */
export interface ClickMassaTagApiShape {
  id: number;
  tag: string;
  color: string;
  isActive: boolean;
  userId: number;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape de ExternalUser retornado pela API. */
export interface ClickMassaUserApiShape {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  profile: string;
  profilePic: string | null; // novo Lote H.2
  tenantId: number | null;
  uid: string | null;
  isDisableAutodistribution: boolean | null;
  canViewDepartmentTickets: boolean | null;
}

/** Shape de Product retornado pela API. */
export interface ClickMassaProductApiShape {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  value: string | number;
  tenantId: number | null;
}

// ─── Novas interfaces Lote H.2 ────────────────────────────────────────────────

/** bronze_clickmassa_queues */
export interface BronzeClickMassaQueueRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // queue.id
  tenant_id: number | null;
  queue: string; // queue.queue (nome da fila)
  is_active: boolean;
  user_id: number | null;
  message_default_contact: string | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/** bronze_clickmassa_lead_statuses */
export interface BronzeClickMassaLeadStatusRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // leadStatus.id
  tenant_id: number | null;
  status: string; // label do status
  color: string | null;
  active: boolean;
  user_id: number | null;
  funnel_id: number | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/** bronze_clickmassa_settings */
export interface BronzeClickMassaSettingRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // setting.id
  tenant_id: number | null;
  key: string;
  value: string | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/** bronze_clickmassa_whatsapp_sessions */
export interface BronzeClickMassaWhatsappSessionRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // whatsapp.id
  tenant_id: number | null;
  name: string;
  number: string | null;
  status: string | null; // "CONNECTED" | "DISCONNECTED" | etc.
  type: string | null; // "whatsapp" | "telegram" | etc.
  is_active: boolean;
  is_default: boolean;
  provider: string | null;
  uid: string | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/**
 * bronze_clickmassa_api_configs
 *
 * ATENÇÃO: campo `token` é REMOVIDO pelo mapper antes do INSERT.
 * CHECK constraint no DB rejeita qualquer raw_payload com chave top-level "token".
 */
export interface BronzeClickMassaApiConfigRow extends BronzeIngestionMeta {
  id?: number;

  source_id: string; // api.id (UUID — string, não number)
  tenant_id: number | null;
  name: string;
  session_id: number | null;
  is_active: boolean;
  ticket_action: string | null;
  queue_id: number | null;
  user_id: number | null;
  webhook_url: string | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>; // SEM campo token
}

/** bronze_clickmassa_funnels */
export interface BronzeClickMassaFunnelRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // funnel.id
  tenant_id: number | null;
  name: string;
  action: string | null;
  session_id: number | null;
  queue_id: number | null;
  user_id: number | null;
  schedule_enabled: boolean;
  total_contacts: number | null; // API retorna como string "1" — parseInt

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/** bronze_clickmassa_funnel_steps */
export interface BronzeClickMassaFunnelStepRow extends BronzeIngestionMeta {
  id?: number;

  source_id: number; // step.id
  funnel_id: number; // FK para bronze_clickmassa_funnels.source_id
  tenant_id: number | null;
  user_id: number | null;
  step_order: number; // step.order
  message: string | null;
  minutes_later: number | null;
  lead_status_id: number | null;
  total_contacts: number | null;
  total_sents: number | null;

  source_created_at: string;
  source_updated_at: string;

  raw_payload: Record<string, unknown>;
}

/**
 * bronze_clickmassa_contacts_dashboard
 *
 * INSERT PURO (não upsert). Cada run cria 1 row nova com snapshot_at = NOW().
 * snapshot_id é BIGSERIAL gerado pelo banco.
 */
export interface BronzeClickMassaContactsDashboardRow extends BronzeIngestionMeta {
  snapshot_id?: number; // BIGSERIAL, gerado pelo banco
  snapshot_at: string; // ISO datetime do momento da captura

  total: number;
  weekly_new: number | null;
  recency_d30: number | null;
  recency_d90: number | null;
  recency_d180: number | null;
  recency_d360: number | null;
  recency_d360plus: number | null;

  raw_payload: Record<string, unknown>; // payload completo do /contacts-dashboard
}

// ─── API shapes novos (Lote H.2) ─────────────────────────────────────────────

export interface ClickMassaQueueApiShape {
  id: number;
  queue: string;
  isActive: boolean;
  userId: number | null;
  tenantId: number | null;
  messageDefaultContact: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClickMassaLeadStatusApiShape {
  id: number;
  status: string;
  color: string | null;
  active: boolean;
  userId: number | null;
  tenantId: number | null;
  funnelId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClickMassaSettingApiShape {
  id: number;
  key: string;
  value: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClickMassaWhatsappSessionApiShape {
  id: number;
  name: string;
  number: string | null;
  status: string | null;
  type: string | null;
  isActive: boolean;
  isDefault: boolean;
  provider: string | null;
  uid: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClickMassaApiConfigApiShape {
  id: string; // UUID
  sessionId: number | null;
  name: string;
  isActive: boolean;
  ticketAction: string | null;
  queueId: number | null;
  userId: number | null;
  tenantId: number | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // token é propositalmente omitido — removido pelo mapper
}

export interface ClickMassaFunnelStepApiShape {
  id: number;
  message: string | null;
  minutesLater: number | null;
  order: number;
  funnelId: number;
  leadStatusId: number | null;
  userId: number | null;
  tenantId: number | null;
  totalContacts: string | null;
  totalSents: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClickMassaFunnelApiShape {
  id: number;
  name: string;
  action: string | null;
  sessionId: number | null;
  userId: number | null;
  queueId: number | null;
  tenantId: number | null;
  scheduleEnabled: boolean;
  totalContacts: string | null;
  createdAt: string;
  updatedAt: string;
  steps: ClickMassaFunnelStepApiShape[];
}

/** Contact retornado pelo endpoint interno GET /contacts (shape mais rico que o embed). */
export interface ClickMassaInternalContactApiShape {
  id: number;
  name: string;
  number: string;
  email: string | null;
  profilePicUrl: string | null;
  picIsObjectStorage: boolean;
  channel: string;
  pushname: string | null;
  isUser: boolean;
  isWAContact: boolean;
  isGroup: boolean;
  isBlacklisted: boolean;
  tenantId: number;
  walletId: number | null;
  tags: string[]; // array de labels
  leadStatus: string | null; // label do status
  firstConnection: number | null;
  funnels: Record<string, unknown> | null;
  lid: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Contact embedado dentro de Opportunity. */
export interface ClickMassaContactEmbed {
  id: number;
  name: string;
  number: string;
  lid: string;
  isNumber: boolean;
  email: string | null;
  pushname: string | null;
  observations: string | null;
  channel: string;
  isUser: boolean;
  isWAContact: boolean;
  isGroup: boolean;
  deletedAt: string | null;
  negotiatedValue: string | null;
  leadStatusId: number | null;
  leadOriginId: number | null;
  queueId: number | null;
  tenantId: number;
  birthDate: string | null;
  gender: string | null;
  company: string | null;
  cep: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  customFields: Record<string, unknown>;
  agentMemory: Record<string, unknown>;
  tags: unknown[];
  firstConnection: number | null;
  profilePicId: number | null;
  picIsObjectStorage: boolean;
  profilePicUrl: string;
  address: {
    cep: string | null;
    pais: string | null;
    estado: string | null;
    cidade: string | null;
    bairro: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/** Opportunity completa retornada pela API (shape real — Turno A + C). */
export interface ClickMassaOpportunityApiShape {
  id: number;
  tenantId: number;
  contactId: number;
  userId: number;
  responsibleId: number;
  pipelineStepId: number;
  gainOrLossReasonId: number | null;
  name: string;
  description: string | null;
  note: string | null;
  expectedCloseDate: string | null;
  closeDate: string | null;
  pipelineUpdatedAt: string | null;
  value: string; // retorna string "0.00"
  status: "open" | "won" | "lost";
  createdAt: string;
  updatedAt: string;
  contact: ClickMassaContactEmbed | null;
  user: { name: string; email: string } | null;
  responsible: { name: string; email: string } | null;
  pipelineStep: { name: string; color: string } | null;
  gainOrLossReason: null | Record<string, unknown>;
  productsOpportunity: unknown[];
  tasksCount: {
    countSchendule: number; // typo intencional do backend
    countDelayed: number;
    countComplete: number;
    countRequiredPending: number;
  };
}
