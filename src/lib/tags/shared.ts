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

// ─────────────────────────────────────────────────────────────────
// Slug — normalização CANÔNICA (T3)
// ─────────────────────────────────────────────────────────────────

/**
 * Nome → slug. Implementação ÚNICA do sistema.
 *
 * Antes existiam duas: `slugify` privada em `configuracoes/actions.ts` (que
 * gravava) e `preverSlug` aqui (que o cliente usava pra adivinhar o que a outra
 * ia gravar). Duas cópias da mesma regra, uma delas invisível pra quem chamava —
 * o contrato v1 mata a duplicação: esta função é a regra, e Configurações
 * importa dela. Serve `tags` e `capture_origins` (o slug de origem sempre saiu
 * da mesma normalização).
 *
 * A classe do segundo `replace` é o bloco de diacríticos combinantes (U+0300 a
 * U+036F) que o `NFD` separa da letra. Copiada CARACTERE A CARACTERE das duas
 * implementações antigas, não reescrita como escape: a saída desta função é
 * identidade gravada em `contacts.tags`, e aqui um typo silencioso renomearia
 * o slug de 418 contatos.
 *
 * O `trim()` vem DEPOIS do `toLowerCase()` e ANTES do colapso de separadores,
 * exatamente como nas versões antigas: a ordem é preservada porque a saída é
 * identidade gravada em `contacts.tags` — mudar de ordem renomearia slug de
 * quem já existe.
 */
export function normalizarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────────
// Paleta (T3/T7)
// ─────────────────────────────────────────────────────────────────

/**
 * Paleta fixa da tag interna — 10 cores, ancoradas na identidade.
 *
 * POR QUE UMA PALETA. Antes havia dois defaults hardcoded pra mesma coisa
 * (`#B89D5A` em Configurações, `#1A2B4A` na criação inline da lista): a tag
 * nascia de uma cor ou de outra conforme a porta de entrada. A paleta é a
 * resposta do contrato (T7, achado #2).
 *
 * REGRA DE CONTRASTE. A badge interna é VAZADA — a cor é texto e contorno sobre
 * branco (`TagInternaBadge`). Então cada hex daqui precisa de ≥ 4,5:1 contra
 * branco, e o β prova isso calculando WCAG 2.1 em cima desta constante.
 * Consequência que vale registrar: o ouro de marca `#AD8330` dá 3,46:1 e NÃO
 * entra — quem entra é `#8A6520`, o mesmo matiz escurecido até passar (5,30:1).
 * Navy e verde-pinheiro entram como são, os dois passam folgado.
 *
 * RESTRIÇÃO CRÍTICA DA IDENTIDADE (verde-pinheiro nunca adjacente a navy):
 * respeitada por construção. Duas badges vazadas vizinhas são contorno + texto
 * sobre branco, com `gap` entre elas — há branco respirando no meio, que é
 * exatamente o que a identidade pede. O calendário precisou excluir o
 * verde-pinheiro porque os chips dele são PREENCHIDOS (bloco de cor encostando
 * em bloco de cor); aqui o problema não existe.
 */
export const PALETA_TAGS: readonly { hex: string; nome: string }[] = [
  { hex: "#1A2B4A", nome: "Navy" },
  { hex: "#8A6520", nome: "Ouro escuro" },
  { hex: "#3F5B30", nome: "Verde-pinheiro" },
  { hex: "#0F5F66", nome: "Petróleo" },
  { hex: "#1F5F9E", nome: "Azul" },
  { hex: "#5B3E8E", nome: "Roxo" },
  { hex: "#8C2F39", nome: "Bordô" },
  { hex: "#A34A16", nome: "Terracota" },
  { hex: "#9B2B6E", nome: "Magenta" },
  { hex: "#4A5568", nome: "Ardósia" },
];

export const COR_TAG_PADRAO = PALETA_TAGS[0].hex;

/**
 * Cor da próxima tag criada no ponto de uso: a MENOS USADA no catálogo, com
 * empate desempatado pela ordem da paleta.
 *
 * Escolhida entre as duas opções que o contrato deixou abertas ("cicla ou
 * primeira livre") porque é a única das duas que é PURA — não depende de
 * quantas tags foram criadas antes nem de estado guardado em lugar nenhum, só
 * do catálogo que o chamador já tem em mãos. Catálogo vazio devolve a primeira
 * cor; catálogo com todas as 10 em uso volta a distribuir pela menos frequente.
 * Cor fora da paleta (herdada do color picker de Configurações) não conta.
 */
export function corPadraoParaNovaTag(catalogo: readonly TagInterna[]): string {
  const uso = new Map(PALETA_TAGS.map((c) => [c.hex, 0]));
  for (const t of catalogo) {
    const hex = t.cor?.trim().toUpperCase();
    if (hex && uso.has(hex)) uso.set(hex, (uso.get(hex) ?? 0) + 1);
  }
  let escolhida = PALETA_TAGS[0].hex;
  let menor = Infinity;
  for (const { hex } of PALETA_TAGS) {
    const n = uso.get(hex) ?? 0;
    if (n < menor) {
      menor = n;
      escolhida = hex;
    }
  }
  return escolhida;
}

// ─────────────────────────────────────────────────────────────────
// Validação da CRIAÇÃO de tag (catálogo)
// ─────────────────────────────────────────────────────────────────

/** `#RRGGBB`, seis dígitos. Mesma régua que Configurações sempre aplicou. */
export const HEX_TAG_RE = /^#[0-9a-fA-F]{6}$/;

export type EntradaTag = { name: string; cor?: string | null };

export type ValidacaoEntradaTag =
  | { ok: true; valor: { name: string; slug: string; cor: string } }
  | { ok: false; erro: string };

/**
 * Valida e normaliza o que vira uma linha nova em `tags`.
 *
 * Roda no SERVIDOR (autoridade) e pode rodar no cliente (conveniência), como o
 * resto deste módulo. `cor` ausente cai na paleta — é o que faz a criação
 * inline não precisar de seletor de cor nenhum.
 *
 * Não checa colisão de slug: isso é o UNIQUE do banco, e quem traduz o erro é
 * `mensagemSlugEmUso`.
 */
export function validarEntradaTag(
  entrada: EntradaTag,
  catalogo: readonly TagInterna[] = [],
): ValidacaoEntradaTag {
  const name = entrada.name?.trim() ?? "";
  if (name.length < 2) return { ok: false, erro: "Informe um nome com ao menos 2 caracteres." };

  const slug = normalizarSlug(name);
  // Nome só de símbolo ("###", "+++") passa no teste de tamanho e some no slug.
  // Sem slug não há identidade pra gravar em `contacts.tags`.
  if (!slug) return { ok: false, erro: "Use ao menos uma letra ou número no nome da tag." };

  const cor = entrada.cor?.trim() || corPadraoParaNovaTag(catalogo);
  if (!HEX_TAG_RE.test(cor)) return { ok: false, erro: "Cor inválida (use #RRGGBB)." };

  return { ok: true, valor: { name, slug, cor } };
}

/** Erro do Postgres que significa "esse slug já existe". */
export function ehErroDeUnicidade(mensagem: string): boolean {
  return /duplicate key|unique/i.test(mensagem);
}

/**
 * Mensagem da colisão. O UNIQUE de `tags` é em SLUG, não em `name` (o banco não
 * tem unique em nome) — dizer "já existe uma tag com esse nome" mandava a
 * operadora procurar um nome idêntico que não existe. "Lua de Mel" e
 * "Lua-de-Mel" são nomes diferentes e o mesmo `lua-de-mel`. T7, achado #4.
 */
export function mensagemSlugEmUso(slug: string): string {
  return `Já existe uma tag com o identificador "${slug}". Mude o nome pra gerar outro.`;
}

// ─────────────────────────────────────────────────────────────────
// Situação de um slug aplicado, e filtro por tag
// ─────────────────────────────────────────────────────────────────

/**
 * Onde um slug já gravado está em relação ao catálogo.
 *
 *  • `ativa`   — existe e está ligada: o editor a oferece como opção.
 *  • `inativa` — existe e está desligada.
 *  • `orfa`    — não existe mais (tag apagada do catálogo).
 *
 * `inativa` e `orfa` compartilham o destino na UI (bloco "Fora do catálogo",
 * com ✕): as duas são recusadas por `validarTagsInternas` na escrita, e antes
 * do contrato v1 a `inativa` não tinha botão pra sair — travava o save da ficha
 * inteira sem saída (achado §A.2 da investigação). Distinguir as duas aqui é o
 * que deixa o texto do badge honesto em cada caso.
 */
export type SituacaoTag = "ativa" | "inativa" | "orfa";

export function situacaoDaTag(slug: string, catalogo: readonly TagInterna[]): SituacaoTag {
  const achada = catalogo.find((t) => t.slug === slug);
  if (!achada) return "orfa";
  return achada.isActive ? "ativa" : "inativa";
}

/** Sentinela de "sem filtro" — o mesmo valor que a lista de contatos já usa. */
export const FILTRO_TAG_TODAS = "todas";

/** Filtro por tag sobre uma lista de slugs (kanban: `jornada.tagsInternas`). */
export function casaFiltroPorSlugs(
  slugs: readonly string[] | null | undefined,
  filtro: string,
): boolean {
  if (!filtro || filtro === FILTRO_TAG_TODAS) return true;
  return (slugs ?? []).includes(filtro);
}

/**
 * Filtro por tag sobre uma entidade que só carrega o CONTATO (calendário).
 *
 * Semântica ESTRITA do contrato (T5): com filtro ligado, some quem não tem
 * contato resolvido — não é "sem contato passa por não ter como julgar". Na
 * janela medida na investigação isso é 13,6% dos eventos, e a decisão de 18/08
 * foi "menos é mais". Filtro desligado devolve tudo.
 */
export function casaFiltroPorContato(
  contactId: string | null | undefined,
  filtro: string,
  tagsPorContato: ReadonlyMap<string, string[]>,
): boolean {
  if (!filtro || filtro === FILTRO_TAG_TODAS) return true;
  if (!contactId) return false;
  return (tagsPorContato.get(contactId) ?? []).includes(filtro);
}
