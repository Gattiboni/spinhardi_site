import "server-only";
import type { SyncContactResult, SyncContactStatus } from "@/lib/integrations/clickmassa";

// Colunas ClickMassa da tabela contacts (snake_case, subset do ContactRow).
// clickmassa_sync_status restrito ao CHECK constraint do DB: 'synced' | 'pending' | 'failed'.
// A perna de oportunidade saiu do fluxo (Lote 2), então este patch NÃO toca mais
// em clickmassa_oportunidade_id / clickmassa_pipeline_step (ficam intocados no DB).
export type ContactUpdateRow = {
  clickmassa_contact_id: string | null;
  clickmassa_ticket_ids: string[];
  clickmassa_ultimo_sync: string;
  clickmassa_sync_status: "synced" | "pending" | "failed";
  clickmassa_sync_error: string | null;
};

/**
 * Traduz o status interno da lib para o enum do DB.
 *
 * DB CHECK: contacts_clickmassa_sync_status_check aceita APENAS 'synced', 'pending', 'failed'
 * (verificado pelo Claudinho). Com a oportunidade removida, mensagem enviada É o
 * sucesso terminal → 'synced'. `pending` vira só estado transitório entre o INSERT
 * e este desfecho, nunca terminal.
 */
export function mapSyncStatusToDb(
  status: SyncContactStatus,
): "synced" | "pending" | "failed" {
  switch (status) {
    case "message_sent":
      // Mensagem de boas-vindas enviada: sucesso terminal do fluxo de captura.
      return "synced";
    case "failed":
      return "failed";
  }
}

// Converte SyncContactResult no patch snake_case pronto pro UPDATE do Supabase.
// Mapper explicito campo a campo (D029).
export function syncResultToContactPatch(result: SyncContactResult): ContactUpdateRow {
  const dbStatus = mapSyncStatusToDb(result.status);

  const syncError: string | null =
    result.status === "failed" ? `[failed]: ${result.error ?? "sem detalhes"}` : null;

  return {
    clickmassa_contact_id:
      result.clickmassaContactId !== null ? String(result.clickmassaContactId) : null,
    clickmassa_ticket_ids:
      result.clickmassaTicketId !== null ? [String(result.clickmassaTicketId)] : [],
    clickmassa_ultimo_sync: new Date().toISOString(),
    clickmassa_sync_status: dbStatus,
    clickmassa_sync_error: syncError,
  };
}
