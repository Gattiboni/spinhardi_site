import "server-only";
import type { SyncContactResult, SyncContactStatus } from "@/lib/integrations/clickmassa";

// Colunas ClickMassa da tabela contacts (snake_case, subset do ContactRow).
// clickmassa_sync_status restrito ao CHECK constraint do DB: 'synced' | 'pending' | 'failed'.
export type ContactUpdateRow = {
  clickmassa_contact_id: string | null;
  clickmassa_ticket_ids: string[];
  clickmassa_oportunidade_id: string | null;
  clickmassa_pipeline_step: string | null;
  clickmassa_ultimo_sync: string;
  clickmassa_sync_status: "synced" | "pending" | "failed";
  clickmassa_sync_error: string | null;
};

/**
 * Traduz o status interno da lib (4 valores) para o enum do DB (3 valores).
 *
 * DB CHECK: contacts_clickmassa_sync_status_check aceita APENAS 'synced', 'pending', 'failed'.
 * Sem esta traducao, o UPDATE quebra silenciosamente (RLS nao levanta excecao para
 * violacoes de CHECK no service role -- o erro e engolido pelo fire-and-forget).
 */
export function mapSyncStatusToDb(
  status: SyncContactStatus,
): "synced" | "pending" | "failed" {
  switch (status) {
    case "opportunity_created":
      return "synced";
    case "message_sent":
      // Mensagem enviada mas oportunidade ainda nao criada: ainda em processamento
      return "pending";
    case "blocked":
      // Criacao da opp bloqueada (modulo nao configurado no ClickMassa): falha definitiva
      return "failed";
    case "failed":
      return "failed";
  }
}

// Converte SyncContactResult no patch snake_case pronto pro UPDATE do Supabase.
// Mapper explicito campo a campo (D029).
export function syncResultToContactPatch(result: SyncContactResult): ContactUpdateRow {
  const dbStatus = mapSyncStatusToDb(result.status);

  // O campo clickmassa_sync_error carrega o status interno como prefixo para
  // preservar rastreabilidade apesar da reducao de 4 para 3 valores no DB.
  let syncError: string | null = null;
  switch (result.status) {
    case "opportunity_created":
      // Happy path: sem erro, prefixo desnecessario
      syncError = null;
      break;
    case "message_sent":
      // Mensagem enviada, opp pendente -- preserva contexto no campo de erro
      syncError = "[message_sent]";
      break;
    case "blocked":
      syncError = `[blocked]: ${result.error ?? "sem detalhes"}`;
      break;
    case "failed":
      syncError = `[failed]: ${result.error ?? "sem detalhes"}`;
      break;
  }

  return {
    clickmassa_contact_id:
      result.clickmassaContactId !== null ? String(result.clickmassaContactId) : null,
    clickmassa_ticket_ids:
      result.clickmassaTicketId !== null ? [String(result.clickmassaTicketId)] : [],
    clickmassa_oportunidade_id:
      result.clickmassaOpportunityId !== null
        ? String(result.clickmassaOpportunityId)
        : null,
    clickmassa_pipeline_step:
      result.clickmassaPipelineStepId !== null
        ? String(result.clickmassaPipelineStepId)
        : null,
    clickmassa_ultimo_sync: new Date().toISOString(),
    clickmassa_sync_status: dbStatus,
    clickmassa_sync_error: syncError,
  };
}
