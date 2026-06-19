import type { Contact } from "./types";
import type { ContactExternalLink } from "./external-links-shared";
import { indexLinksByContact } from "./external-links-shared";

/**
 * Gold operacional — segmentos de GAP sobre a silver de contatos.
 *
 * Função pura (sem IO): recebe os contatos (silver) e os vínculos externos já
 * lidos, e devolve, por contato, em quais gaps ele cai + as contagens totais
 * pros 3 cards do topo da lista. Nunca lê bronze; só silver/vínculo.
 *
 *  - semEmail            → `email` null/vazio.
 *  - possivelDuplicado   → divide o mesmo telefone (dígitos) com outro contato.
 *  - clickmassaSemIddas  → tem vínculo `clickmassa` e NÃO tem `iddas` (gente que
 *                          a Nina fala no WhatsApp mas não está no ERP). Segmento
 *                          de consciência: leva pra lista filtrada e para aí.
 */

export type GapSegment = "semEmail" | "possivelDuplicado" | "clickmassaSemIddas";

export type ContactGapFlags = Record<GapSegment, boolean>;

export type GapCounts = Record<GapSegment, number>;

export type GapResult = {
  flags: Record<string, ContactGapFlags>;
  counts: GapCounts;
};

/** Só os dígitos do telefone — base estrutural pra detectar telefone repetido. */
function phoneDigits(whatsapp: string): string {
  return whatsapp.replace(/\D/g, "");
}

function hasEmail(contact: Contact): boolean {
  return !!contact.email && contact.email.trim().length > 0;
}

export function computeGapSegments(
  contacts: Contact[],
  links: ContactExternalLink[],
): GapResult {
  const linksByContact = indexLinksByContact(links);

  // Telefones (em dígitos) que aparecem em 2+ contatos — detecção estrutural.
  const phoneCount = new Map<string, number>();
  for (const c of contacts) {
    const digits = phoneDigits(c.whatsapp);
    if (!digits) continue;
    phoneCount.set(digits, (phoneCount.get(digits) ?? 0) + 1);
  }

  const flags: Record<string, ContactGapFlags> = {};
  const counts: GapCounts = { semEmail: 0, possivelDuplicado: 0, clickmassaSemIddas: 0 };

  for (const c of contacts) {
    const cLinks = linksByContact.get(c.id) ?? [];
    const temClickmassa = cLinks.some((l) => l.provider === "clickmassa");
    const temIddas = cLinks.some((l) => l.provider === "iddas");

    const digits = phoneDigits(c.whatsapp);

    const f: ContactGapFlags = {
      semEmail: !hasEmail(c),
      possivelDuplicado: digits.length > 0 && (phoneCount.get(digits) ?? 0) > 1,
      clickmassaSemIddas: temClickmassa && !temIddas,
    };

    flags[c.id] = f;
    if (f.semEmail) counts.semEmail += 1;
    if (f.possivelDuplicado) counts.possivelDuplicado += 1;
    if (f.clickmassaSemIddas) counts.clickmassaSemIddas += 1;
  }

  return { flags, counts };
}
