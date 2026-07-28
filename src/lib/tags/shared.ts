/**
 * Tags — tipos e validação PUROS. Sem `server-only`, sem Supabase: a ficha e a
 * lista (Client Components) importam daqui, e as server actions importam O
 * MESMO. Uma regra, dois consumidores; o servidor é a autoridade.
 *
 * DUAS COLUNAS, UM ESCRITOR CADA (T1) — não existe merge:
 *  • `contacts.clickmassa_tags_id` (integer[]) — dona é o sync. READ-ONLY aqui.
 *  • `contacts.tags` (text[]) — dona é a operadora. O sync nunca escreve nela.
 *
 * `contacts.tags` guarda SLUG (T5), nunca id, nunca name: todo consumidor já
 * trata o elemento como texto legível, e slug é estável sob rename de `name`.
 */

/** Tag do catálogo interno (`tags`), o que a operadora edita em Configurações. */
export type TagInterna = {
  id: string;
  name: string;
  slug: string;
  cor: string;
  grupo: string | null;
  isActive: boolean;
};

/** Tag do ClickMassa, resolvida pela view `clickmassa_tags_catalogo`. */
export type TagClickMassa = {
  id: number;
  nome: string;
  cor: string | null;
  ativa: boolean;
};

/** O que a ficha e a lista precisam pra desenhar os dois blocos de um contato. */
export type TagsDoContato = {
  /** Resolvidas contra o catálogo CM. */
  clickmassa: TagClickMassa[];
  /**
   * Ids em `clickmassa_tags_id` que NÃO existem no catálogo. Contados e nunca
   * renderizados crus (T3): "3 tags do ClickMassa não reconhecidas" é
   * informação; "17, 42, 88" na tela é lixo.
   */
  clickmassaOrfaos: number;
  /**
   * Slugs internos do contato, resolvidos quando possível. Slug órfão (tag
   * apagada do catálogo) é exibido NORMALMENTE e não invalida a leitura (T6).
   */
  internas: { slug: string; name: string; cor: string | null; orfao: boolean }[];
};

/** Resolve `integer[]` → nome+cor, contando (e escondendo) os órfãos. */
export function resolverTagsClickMassa(
  ids: number[] | null | undefined,
  catalogo: TagClickMassa[],
): { tags: TagClickMassa[]; orfaos: number } {
  const porId = new Map(catalogo.map((t) => [t.id, t]));
  const tags: TagClickMassa[] = [];
  let orfaos = 0;
  for (const id of ids ?? []) {
    const achada = porId.get(id);
    if (achada) tags.push(achada);
    else orfaos++;
  }
  return { tags, orfaos };
}

/** Resolve slugs contra o catálogo interno, marcando os órfãos (T6). */
export function resolverTagsInternas(
  slugs: string[] | null | undefined,
  catalogo: TagInterna[],
): TagsDoContato["internas"] {
  const porSlug = new Map(catalogo.map((t) => [t.slug, t]));
  return (slugs ?? []).map((slug) => {
    const achada = porSlug.get(slug);
    return achada
      ? { slug, name: achada.name, cor: achada.cor, orfao: false }
      : { slug, name: slug, cor: null, orfao: true };
  });
}

// ─────────────────────────────────────────────────────────────────
// Validação da escrita de `contacts.tags`
// ─────────────────────────────────────────────────────────────────

export type ValidacaoTags = { ok: true; slugs: string[] } | { ok: false; erro: string };

/**
 * Valida e NORMALIZA a lista que vai substituir `contacts.tags`.
 *
 * A escrita é SUBSTITUIÇÃO INTEGRAL do array (mesma disciplina de T4 pro lado
 * do sync): a operadora manda o conjunto final, não um delta.
 *
 * Regras:
 *  • cada slug precisa existir no catálogo E estar `is_active` (T6);
 *  • sem duplicata;
 *  • gravação ORDENADA (alfabética) — array com ordem estável não gera diff
 *    falso em `updated_at` nem confunde comparação.
 *
 * Slug órfão já gravado NÃO é validado aqui porque nunca chega aqui: o editor
 * manda o conjunto escolhido no catálogo. Se um órfão for reenviado, ele é
 * recusado — que é o comportamento certo pra ESCRITA (a leitura segue exibindo).
 */
export function validarTagsInternas(slugs: string[], catalogo: TagInterna[]): ValidacaoTags {
  const ativos = new Map(catalogo.filter((t) => t.isActive).map((t) => [t.slug, t]));
  const vistos = new Set<string>();

  for (const bruto of slugs) {
    const slug = bruto.trim();
    if (!slug) return { ok: false, erro: "Tag em branco na lista." };
    if (vistos.has(slug)) return { ok: false, erro: `A tag "${slug}" está repetida.` };
    if (!ativos.has(slug)) {
      return { ok: false, erro: `A tag "${slug}" não existe ou está desativada.` };
    }
    vistos.add(slug);
  }

  return { ok: true, slugs: [...vistos].sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

/**
 * União pra ação em massa "adicionar": mantém o que o contato já tinha,
 * inclusive slug órfão (não é a hora de limpar o histórico de ninguém).
 */
export function unirTags(atuais: string[], novo: string): string[] {
  if (atuais.includes(novo)) return atuais;
  return [...atuais, novo].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Remoção pra ação em massa. Não mexe em nada além do slug pedido. */
export function removerTag(atuais: string[], alvo: string): string[] {
  return atuais.filter((t) => t !== alvo);
}

/**
 * Mesma geração de slug de Configurações. Duplicada AQUI de propósito? Não —
 * ela vive lá e é usada por lá. Esta cópia existe só pro cliente PREVER o slug
 * enquanto digita (conveniência de UI). Quem grava é a action de Configurações.
 */
export function preverSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
