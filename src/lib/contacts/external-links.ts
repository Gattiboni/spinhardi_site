import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ContactExternalLink } from "./external-links-shared";

/**
 * Vínculos externos do contato — silver `contact_external_links` (Passo A).
 *
 * Cada fonte externa vira uma LINHA (não coluna): `provider` + `external_kind`
 * + `external_id`. É a fonte de LEITURA pra montar deep-links e detectar canais
 * disponíveis. As colunas `clickmassa_*`/`iddas_*` no `contacts` continuam vivas
 * (o sync do form público ainda escreve nelas) — aqui só lemos do vínculo.
 *
 * Server-only (importa `supabaseAdmin`). O tipo e os helpers puros ficam em
 * `external-links-shared.ts`, importáveis por Client Components.
 *
 * Hoje só a leitura por contato (detalhe / deep-link). A agregação da lista NÃO
 * lê os vínculos inteiros — os segmentos de gap saem de funções no Postgres.
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
