/**
 * Critério de aceite (β) do lote TAGS TRANSVERSAIS — provas determinísticas.
 *
 * ZERO REDE, ZERO BANCO. Todo check exercita função REAL do repo, importada de
 * `@/lib/tags/shared` — nada é reimplementado aqui. Onde a lógica de produção
 * mora num módulo `server-only` (criação de tag, escrita), o que se prova é a
 * parte PURA que ela usa: validação de entrada, geração de slug, cor da paleta e
 * tradução do erro de unicidade. A ida ao banco fica pro β de UI, no navegador.
 *
 * O que cada bloco cobre:
 *   1. Slug — tabela de casos com acento/espaço/símbolo, com as saídas medidas
 *      na implementação ANTIGA (`slugify` de configuracoes/actions, lida do
 *      arquivo em 18/08/2026 antes da consolidação). É a prova de que o refactor
 *      não renomeou o slug de ninguém.
 *   2. Paleta — contraste WCAG 2.1 de cada cor contra branco ≥ 4,5:1, e a regra
 *      de escolha da cor default.
 *   3. Criação — validação de nome, hex, default de paleta, mensagem de colisão.
 *   4. Editor da ficha — situação de tag ativa/inativa/órfã (o impasse do save).
 *   5. Filtros — predicado do kanban e do calendário, incluindo o evento sem
 *      contato sob filtro ativo (semântica estrita do T5).
 *   6. Regras puras que NÃO podiam mudar — `validarTagsInternas`, `unirTags`,
 *      `removerTag`, `resolverTagsInternas`.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/beta-tags.ts
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

import {
  normalizarSlug,
  corPadraoParaNovaTag,
  validarEntradaTag,
  mensagemSlugEmUso,
  ehErroDeUnicidade,
  situacaoDaTag,
  casaFiltroPorSlugs,
  casaFiltroPorContato,
  validarTagsInternas,
  unirTags,
  removerTag,
  resolverTagsInternas,
  PALETA_TAGS,
  COR_TAG_PADRAO,
  FILTRO_TAG_TODAS,
  type TagInterna,
} from "@/lib/tags/shared";

const resultados: { n: string; ok: boolean; nota: string }[] = [];

function check(n: string, ok: boolean, nota: string) {
  resultados.push({ n, ok, nota });
  console.log(`[${ok ? "PASSOU" : "NÃO PASSOU"}] ${n} — ${nota}`);
}

function tag(over: Partial<TagInterna> & { slug: string }): TagInterna {
  return {
    id: `id-${over.slug}`,
    name: over.name ?? over.slug,
    slug: over.slug,
    cor: over.cor ?? "#1A2B4A",
    grupo: over.grupo ?? null,
    isActive: over.isActive ?? true,
  };
}

// ─────────────────────────────────────────────────────────────────
// 1. Slug — byte a byte contra o comportamento ANTIGO
// ─────────────────────────────────────────────────────────────────

/**
 * Saídas medidas na `slugify` privada de `configuracoes/actions.ts` ANTES da
 * consolidação (18/08/2026). Se alguma linha desta tabela mudar, o slug de
 * contatos já gravados mudou junto — e `contacts.tags` guarda slug.
 */
const SLUGS_ESPERADOS: [string, string][] = [
  ["Indicação de Cliente", "indicacao-de-cliente"],
  ["  Alto Potencial / Alto Ticket  ", "alto-potencial-alto-ticket"],
  ["VIP", "vip"],
  ["Lua-de-Mel 2026", "lua-de-mel-2026"],
  ["ÁÉÍÓÚ ÀÂÃÇ", "aeiou-aaac"],
  ["Tag   com    espaços", "tag-com-espacos"],
  ["---traço---", "traco"],
  ["Ação", "acao"],
  ["Ações", "acoes"],
  ["Café & Cia", "cafe-cia"],
  ["50+", "50"],
  ["Ñandu", "nandu"],
  ["emoji 🎉 tag", "emoji-tag"],
  ["", ""],
  ["   ", ""],
  ["R$ 1.000", "r-1-000"],
  ["São Paulo/SP", "sao-paulo-sp"],
];

let slugsOk = 0;
for (const [entrada, esperado] of SLUGS_ESPERADOS) {
  const obtido = normalizarSlug(entrada);
  if (obtido === esperado) slugsOk++;
  else
    console.log(
      `   ✗ ${JSON.stringify(entrada)} → ${JSON.stringify(obtido)} (esperado ${JSON.stringify(esperado)})`,
    );
}
check(
  "1.1 slug byte a byte",
  slugsOk === SLUGS_ESPERADOS.length,
  `${slugsOk}/${SLUGS_ESPERADOS.length} casos batem com a implementação anterior`,
);

check(
  "1.2 slug é idempotente",
  SLUGS_ESPERADOS.every(([, esperado]) => normalizarSlug(esperado) === esperado),
  "aplicar de novo sobre o slug não muda nada",
);

check(
  "1.3 nomes diferentes podem colidir no slug",
  normalizarSlug("Lua de Mel") === normalizarSlug("Lua-de-Mel"),
  `"Lua de Mel" e "Lua-de-Mel" → ${normalizarSlug("Lua de Mel")} (a razão de a mensagem de erro falar em slug)`,
);

// ─────────────────────────────────────────────────────────────────
// 2. Paleta — contraste e cor default
// ─────────────────────────────────────────────────────────────────

/** WCAG 2.1 relative luminance. */
function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function contrasteComBranco(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const l =
    0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return 1.05 / (l + 0.05);
}

const MIN_CONTRASTE = 4.5;
const reprovadas = PALETA_TAGS.filter((c) => contrasteComBranco(c.hex) < MIN_CONTRASTE);
const pior = [...PALETA_TAGS].sort(
  (a, b) => contrasteComBranco(a.hex) - contrasteComBranco(b.hex),
)[0];

check(
  "2.1 paleta passa AA como badge vazada",
  reprovadas.length === 0,
  reprovadas.length === 0
    ? `${PALETA_TAGS.length} cores ≥ ${MIN_CONTRASTE}:1 sobre branco (menor: ${pior.nome} ${contrasteComBranco(pior.hex).toFixed(2)}:1)`
    : `reprovadas: ${reprovadas.map((c) => `${c.nome} ${contrasteComBranco(c.hex).toFixed(2)}`).join(", ")}`,
);

check(
  "2.2 paleta ancorada na identidade",
  PALETA_TAGS.some((c) => c.hex === "#1A2B4A") && PALETA_TAGS.some((c) => c.hex === "#3F5B30"),
  "navy e verde-pinheiro entram como são; o ouro de marca #AD8330 fica de fora " +
    `(${contrasteComBranco("#AD8330").toFixed(2)}:1, abaixo de ${MIN_CONTRASTE})`,
);

check(
  "2.3 hexes únicos e no formato #RRGGBB",
  new Set(PALETA_TAGS.map((c) => c.hex)).size === PALETA_TAGS.length &&
    PALETA_TAGS.every((c) => /^#[0-9A-F]{6}$/.test(c.hex)),
  `${PALETA_TAGS.length} cores distintas, todas #RRGGBB em caixa alta`,
);

check(
  "2.4 catálogo vazio → primeira cor",
  corPadraoParaNovaTag([]) === COR_TAG_PADRAO && COR_TAG_PADRAO === PALETA_TAGS[0].hex,
  `${COR_TAG_PADRAO}`,
);

const catalogoComPrimeira = [tag({ slug: "a", cor: PALETA_TAGS[0].hex })];
check(
  "2.5 cor já usada cede a vez",
  corPadraoParaNovaTag(catalogoComPrimeira) === PALETA_TAGS[1].hex,
  `com ${PALETA_TAGS[0].nome} em uso, a próxima é ${PALETA_TAGS[1].nome}`,
);

const catalogoCheio = PALETA_TAGS.map((c, i) => tag({ slug: `t${i}`, cor: c.hex }));
check(
  "2.6 paleta esgotada volta ao começo",
  corPadraoParaNovaTag(catalogoCheio) === PALETA_TAGS[0].hex,
  "todas com uso 1 → desempate pela ordem da paleta",
);

check(
  "2.7 cor fora da paleta não conta como uso",
  corPadraoParaNovaTag([tag({ slug: "x", cor: "#B89D5A" })]) === PALETA_TAGS[0].hex,
  "o antigo default de Configurações não desloca a escolha",
);

// ─────────────────────────────────────────────────────────────────
// 3. Criação de tag — validação pura
// ─────────────────────────────────────────────────────────────────

const vCurto = validarEntradaTag({ name: "a" });
check("3.1 nome com 1 letra é recusado", !vCurto.ok, vCurto.ok ? "aceitou" : vCurto.erro);

const vSimbolo = validarEntradaTag({ name: "###" });
check(
  "3.2 nome sem letra nem número é recusado",
  !vSimbolo.ok,
  vSimbolo.ok ? "aceitou ###" : vSimbolo.erro,
);

const vHex = validarEntradaTag({ name: "Teste", cor: "vermelho" });
check("3.3 cor fora de #RRGGBB é recusada", !vHex.ok, vHex.ok ? "aceitou" : vHex.erro);

const vDefault = validarEntradaTag({ name: "  Alto Ticket  " });
check(
  "3.4 sem cor → paleta, e nome/slug normalizados",
  vDefault.ok &&
    vDefault.valor.cor === COR_TAG_PADRAO &&
    vDefault.valor.name === "Alto Ticket" &&
    vDefault.valor.slug === "alto-ticket",
  vDefault.ok
    ? `${vDefault.valor.name} / ${vDefault.valor.slug} / ${vDefault.valor.cor}`
    : "recusou",
);

const vCor = validarEntradaTag({ name: "Teste", cor: "#0F5F66" });
check(
  "3.5 cor explícita é respeitada",
  vCor.ok && vCor.valor.cor === "#0F5F66",
  vCor.ok ? vCor.valor.cor : "recusou",
);

check(
  "3.6 erro de unicidade do Postgres é reconhecido",
  ehErroDeUnicidade('duplicate key value violates unique constraint "tags_slug_key"') &&
    !ehErroDeUnicidade("connection refused"),
  "casa duplicate key/unique e ignora o resto",
);

const msg = mensagemSlugEmUso("lua-de-mel");
check(
  "3.7 mensagem de colisão fala em identificador, não em nome",
  msg.includes("lua-de-mel") && !/esse nome/i.test(msg),
  msg,
);

// ─────────────────────────────────────────────────────────────────
// 4. Editor da ficha — o impasse da tag desativada
// ─────────────────────────────────────────────────────────────────

const catalogo: TagInterna[] = [
  tag({ slug: "vip", name: "VIP", isActive: true }),
  tag({ slug: "antiga", name: "Antiga", isActive: false }),
];

check(
  "4.1 três situações distinguidas",
  situacaoDaTag("vip", catalogo) === "ativa" &&
    situacaoDaTag("antiga", catalogo) === "inativa" &&
    situacaoDaTag("sumiu", catalogo) === "orfa",
  "ativa / inativa / orfa",
);

// O bug do α: tag desativada era resolvida com `orfao: false`, não entrava no
// bloco "Fora do catálogo" e não tinha ✕ — e `validarTagsInternas` a recusava,
// travando o save da ficha inteira sem saída pela UI.
const resolvidas = resolverTagsInternas(["vip", "antiga", "sumiu"], catalogo);
const inativaResolvida = resolvidas.find((t) => t.slug === "antiga")!;
const foraDoCatalogo = resolvidas.filter((t) => situacaoDaTag(t.slug, catalogo) !== "ativa");

check(
  "4.2 inativa continua não sendo órfã na resolução",
  inativaResolvida.orfao === false && inativaResolvida.name === "Antiga",
  "resolverTagsInternas segue como sempre foi (regra pura intocada)",
);

check(
  "4.3 mas o editor agora a oferece com ✕",
  foraDoCatalogo.length === 2 &&
    foraDoCatalogo
      .map((t) => t.slug)
      .sort()
      .join(",") === "antiga,sumiu",
  "bloco 'Fora do catálogo' = inativa + órfã (era só órfã)",
);

const salvarComInativa = validarTagsInternas(["vip", "antiga"], catalogo);
const salvarSemInativa = validarTagsInternas(["vip"], catalogo);
check(
  "4.4 escrita segue recusando inativa (regra pura não mudou)",
  !salvarComInativa.ok && salvarSemInativa.ok,
  !salvarComInativa.ok ? salvarComInativa.erro : "aceitou inativa",
);

// ─────────────────────────────────────────────────────────────────
// 5. Filtros
// ─────────────────────────────────────────────────────────────────

check(
  "5.1 kanban: sem filtro passa tudo",
  casaFiltroPorSlugs([], FILTRO_TAG_TODAS) && casaFiltroPorSlugs(null, FILTRO_TAG_TODAS),
  "inclusive jornada sem tag nenhuma",
);

check(
  "5.2 kanban: filtro casa por slug",
  casaFiltroPorSlugs(["vip", "recorrente"], "vip") &&
    !casaFiltroPorSlugs(["recorrente"], "vip") &&
    !casaFiltroPorSlugs(null, "vip"),
  "tem / não tem / sem tag",
);

const mapaTags = new Map<string, string[]>([
  ["c1", ["vip"]],
  ["c2", ["recorrente"]],
]);

check(
  "5.3 calendário: sem filtro passa tudo, inclusive sem contato",
  casaFiltroPorContato(null, FILTRO_TAG_TODAS, mapaTags) &&
    casaFiltroPorContato("c1", FILTRO_TAG_TODAS, mapaTags),
  "filtro desligado não esconde nada",
);

check(
  "5.4 calendário: filtro ESTRITO esconde evento sem contato (T5)",
  casaFiltroPorContato("c1", "vip", mapaTags) === true &&
    casaFiltroPorContato("c2", "vip", mapaTags) === false &&
    casaFiltroPorContato(null, "vip", mapaTags) === false &&
    casaFiltroPorContato("desconhecido", "vip", mapaTags) === false,
  "com tag passa; outra tag, sem contato e contato fora do mapa somem",
);

// ─────────────────────────────────────────────────────────────────
// 6. Regras puras que NÃO podiam mudar
// ─────────────────────────────────────────────────────────────────

const ordenada = validarTagsInternas(["vip", "vip2"], [...catalogo, tag({ slug: "vip2" })]);
check(
  "6.1 gravação ordenada e sem duplicata",
  ordenada.ok &&
    ordenada.slugs.join(",") === "vip,vip2" &&
    !validarTagsInternas(["vip", "vip"], catalogo).ok,
  ordenada.ok ? ordenada.slugs.join(",") : "recusou",
);

check(
  "6.2 união preserva órfão e ordena",
  unirTags(["zumbi", "alfa"], "beta").join(",") === "alfa,beta,zumbi" &&
    unirTags(["vip"], "vip").join(",") === "vip",
  "adicionar não limpa histórico e não duplica",
);

check(
  "6.3 remoção mexe só no alvo",
  removerTag(["a", "b", "c"], "b").join(",") === "a,c" &&
    removerTag(["a"], "inexistente").join(",") === "a",
  "sem efeito colateral",
);

const orfaResolvida = resolverTagsInternas(["sumiu"], catalogo)[0];
check(
  "6.4 órfã exibida com o slug como rótulo, sem cor",
  orfaResolvida.orfao === true && orfaResolvida.name === "sumiu" && orfaResolvida.cor === null,
  "T6 do contrato anterior segue de pé",
);

// ─────────────────────────────────────────────────────────────────

const falhas = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - falhas.length}/${resultados.length} checks passaram.` +
    (falhas.length ? ` FALHAS: ${falhas.map((f) => f.n).join(", ")}` : " Nenhuma falha."),
);
process.exit(falhas.length === 0 ? 0 : 1);
