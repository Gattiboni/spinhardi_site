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
 * Volume boutique (~1154 linhas): puxa tudo e agrupa em memória, mesma filosofia
 * de `getContacts`.
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

// Limite padrão do PostgREST por request. Como há >1000 vínculos (1154 na
// migração do Passo A), uma única query trunca silenciosamente e contatos
// parecem "sem iddas" — inflando o card de gap. Paginamos até esgotar.
const PAGE_SIZE = 1000;

/** Todos os vínculos externos (pra agregação da lista de contatos). */
export async function getAllExternalLinks(): Promise<ContactExternalLink[]> {
  const rows: ContactExternalLinkRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin()
      .from("contact_external_links")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao buscar vínculos externos: ${error.message}`);
    }

    const page = data as ContactExternalLinkRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows.map(rowToLink);
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
