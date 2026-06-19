/**
 * Tipos e helpers PUROS de vínculo externo — sem IO, seguros pro client.
 *
 * A leitura do banco (server-only, via `supabaseAdmin`) fica em
 * `external-links.ts`. Este módulo só tem tipo + funções puras, então pode ser
 * importado por Client Components (ex: o detalhe do contato) sem arrastar o
 * client server-only pro bundle do browser.
 */

export type ExternalProvider = "clickmassa" | "iddas" | (string & {});

export type ContactExternalLink = {
  id: string;
  contactId: string;
  provider: ExternalProvider;
  externalKind: string;
  externalId: string | null;
  externalRef: string | null;
  syncStatus: string;
  lastSyncAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Agrupa uma lista achatada de vínculos por `contactId`. */
export function indexLinksByContact(
  links: ContactExternalLink[],
): Map<string, ContactExternalLink[]> {
  const map = new Map<string, ContactExternalLink[]>();
  for (const link of links) {
    const list = map.get(link.contactId);
    if (list) list.push(link);
    else map.set(link.contactId, [link]);
  }
  return map;
}

/** Acha o primeiro vínculo de um provider numa lista (ex: o link ClickMassa). */
export function findLink(
  links: ContactExternalLink[],
  provider: ExternalProvider,
): ContactExternalLink | null {
  return links.find((l) => l.provider === provider) ?? null;
}
