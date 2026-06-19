import type { Contact } from "./types";

/**
 * Gold operacional — segmentos de GAP sobre a silver de contatos.
 *
 * Função pura (sem IO): monta, por contato, em quais gaps ele cai + as contagens
 * pros 3 cards do topo da lista. Nunca lê bronze.
 *
 *  - semEmail            → `email` null/vazio. Contagem do card vem de um COUNT
 *                          no banco (`getSemEmailCount`); a membresia da lista é
 *                          o mesmo critério sobre os contatos carregados.
 *  - possivelDuplicado   → está no conjunto da RPC `gold_contatos_duplicados`
 *                          (mesmo whatsapp, detectado no Postgres). Contagem =
 *                          tamanho do conjunto; lista = esses mesmos ids. UMA
 *                          fonte só — editar campo que não é o whatsapp não muda
 *                          a membresia (mata o desync do #8).
 *  - clickmassaSemIddas  → está no conjunto da RPC `gold_contatos_sem_iddas`
 *                          (tem ClickMassa, sem cadastro no Iddas). Mesma
 *                          mecânica: contagem = tamanho, lista = mesmos ids.
 */

export type GapSegment = "semEmail" | "possivelDuplicado" | "clickmassaSemIddas";

export type ContactGapFlags = Record<GapSegment, boolean>;

export type GapCounts = Record<GapSegment, number>;

export type GapResult = {
  flags: Record<string, ContactGapFlags>;
  counts: GapCounts;
};

function hasEmail(contact: Contact): boolean {
  return !!contact.email && contact.email.trim().length > 0;
}

export function computeGapSegments(
  contacts: Contact[],
  duplicateIds: Set<string>,
  semIddasIds: Set<string>,
  semEmailCount: number,
): GapResult {
  const flags: Record<string, ContactGapFlags> = {};

  for (const c of contacts) {
    flags[c.id] = {
      semEmail: !hasEmail(c),
      // Membresia vem dos conjuntos server-side (RPC), não de recálculo local.
      possivelDuplicado: duplicateIds.has(c.id),
      clickmassaSemIddas: semIddasIds.has(c.id),
    };
  }

  // Contagens dos cards: dup/sem-Iddas são o tamanho do conjunto que o Postgres
  // já filtrou; sem-email é o COUNT do banco. Nenhuma é varredura no JS.
  const counts: GapCounts = {
    semEmail: semEmailCount,
    possivelDuplicado: duplicateIds.size,
    clickmassaSemIddas: semIddasIds.size,
  };

  return { flags, counts };
}
