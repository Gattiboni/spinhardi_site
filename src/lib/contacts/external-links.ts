import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ContactExternalLink } from "./external-links-shared";

/**
 * Vínculos externos do contato — silver `contact_external_links` (Passo A).
 *
 * Cada fonte externa vira uma LINHA (não coluna): `provider` + `external_kind`
 * + `external_id`. É a fonte ÚNICA de ESCRITA do vínculo e a fonte de LEITURA
 * pra montar deep-links e detectar canais disponíveis. As colunas
 * `contacts.clickmassa_contact_id`/`iddas_pessoa_id` são PROJEÇÃO desta tabela,
 * mantidas por trigger — nenhum código de aplicação escreve nelas.
 *
 * Server-only (importa `supabaseAdmin`). O tipo e os helpers puros ficam em
 * `external-links-shared.ts`, importáveis por Client Components.
 */

type ContactExternalLinkRow = {
  id: string;
  contact_id: string;
  provider: string;
  external_kind: string;
  external_id: string | null;
  external_ref: string | null;
  sync_status: string;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToLink(row: ContactExternalLinkRow): ContactExternalLink {
  return {
    id: row.id,
    contactId: row.contact_id,
    provider: row.provider,
    externalKind: row.external_kind,
    externalId: row.external_id,
    externalRef: row.external_ref,
    syncStatus: row.sync_status,
    lastSyncAt: row.last_sync_at,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Grava (upsert idempotente) o vínculo externo de um contato. Fonte ÚNICA de
 * escrita do vínculo: a coluna projetada em `contacts` é mantida por trigger.
 *
 * Idempotente sobre `(provider, external_kind, external_id)` — a mesma unicidade
 * do índice da tabela. Re-sincronizar o mesmo contato externo atualiza a linha
 * (sync_status/last_sync_at) em vez de duplicar.
 */
export async function upsertContactExternalLink(input: {
  contactId: string;
  provider: string;
  externalKind: string;
  externalId: string;
  syncStatus?: string;
  lastSyncAt?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("contact_external_links")
    .upsert(
      {
        contact_id: input.contactId,
        provider: input.provider,
        external_kind: input.externalKind,
        external_id: input.externalId,
        sync_status: input.syncStatus ?? "synced",
        last_sync_at: input.lastSyncAt ?? new Date().toISOString(),
      },
      { onConflict: "provider,external_kind,external_id" },
    );

  if (error) {
    throw new Error(
      `Erro ao gravar vínculo externo (${input.provider}/${input.externalKind}/${input.externalId}): ${error.message}`,
    );
  }
}

/** Vínculos externos de um contato (pra detalhe / deep-link). */
export async function getContactExternalLinks(
  contactId: string,
): Promise<ContactExternalLink[]> {
  const { data, error } = await supabaseAdmin()
    .from("contact_external_links")
    .select("*")
    .eq("contact_id", contactId);

  if (error) {
    throw new Error(`Erro ao buscar vínculos do contato ${contactId}: ${error.message}`);
  }

  return (data as ContactExternalLinkRow[]).map(rowToLink);
}
