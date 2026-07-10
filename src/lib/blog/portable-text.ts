import type { PortableTextBlock } from "@portabletext/types";

/**
 * Conversor md-leve ⇄ Portable Text — hand-rolled, zero lib nova.
 *
 * O "md-leve" é o formato que o textarea do admin edita e que a interface
 * canônica `Post.body` carrega: parágrafos separados por linha em branco, com
 * `# ` no início da linha para um título de seção (h2) e `## ` para um
 * subtítulo (h3). É deliberadamente pobre — só heading + parágrafo.
 *
 * Fidelidade do round-trip (md → PT → md): PRESERVA parágrafos e os dois níveis
 * de heading. NÃO representa (e portanto PERDE no caminho PT → md) qualquer
 * riqueza criada direto no Studio: negrito/itálico e outras `marks`, links,
 * blockquotes, listas, imagens e demais blocos não-texto. Isso é esperado — o
 * md-leve não tem sintaxe pra esses elementos. A perda é sempre PT → md; o
 * caminho md → PT nunca inventa o que o md-leve não sabe expressar.
 */

const H2_PREFIX = "# ";
const H3_PREFIX = "## ";

/**
 * md-leve → Portable Text.
 *
 * Blocos são separados por uma ou mais linhas em branco. Uma linha iniciada por
 * `## ` vira h3; por `# ` vira h2; o resto vira parágrafo (`normal`). Cada bloco
 * carrega um único span de texto sem marcas.
 *
 * `_key`s são determinísticos por índice (`b0`, `s0`, …): basta serem únicos
 * dentro do documento, e o índice garante isso sem depender de aleatoriedade.
 */
export function mdLightToPortableText(md: string): PortableTextBlock[] {
  if (!md.trim()) return [];

  return md
    .split(/\n\s*\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      let style: "normal" | "h2" | "h3" = "normal";
      let text = chunk;

      // `## ` é checado antes de `# ` porque "## x" também começa com "# "?
      // Não: "## x"[1] é '#', não ' ', então não colide. Ainda assim ordenamos
      // do prefixo mais longo pro mais curto por clareza.
      if (chunk.startsWith(H3_PREFIX)) {
        style = "h3";
        text = chunk.slice(H3_PREFIX.length);
      } else if (chunk.startsWith(H2_PREFIX)) {
        style = "h2";
        text = chunk.slice(H2_PREFIX.length);
      }

      // Um parágrafo pode ter quebras de linha simples internas; o Portable Text
      // não tem "soft break", então normalizamos pra espaço (o md-leve trata
      // parágrafo como fluxo contínuo — a separação semântica é a linha branca).
      text = text.replace(/\s*\n\s*/g, " ");

      return {
        _type: "block",
        _key: `b${i}`,
        style,
        markDefs: [],
        children: [{ _type: "span", _key: `s${i}`, text, marks: [] }],
      } as unknown as PortableTextBlock;
    });
}

/**
 * Portable Text → md-leve.
 *
 * Só blocos `block` de texto são serializados. `h1`/`h2` viram `# `; `h3`/`h4`
 * viram `## `; o resto vira parágrafo. As `marks` dos spans (negrito, itálico,
 * links) são descartadas — ver nota de fidelidade no topo do arquivo. Blocos
 * não-texto (imagens etc.) são ignorados.
 */
export function portableTextToMdLight(blocks: PortableTextBlock[] | null | undefined): string {
  if (!blocks?.length) return "";

  return blocks
    .filter((block) => block._type === "block")
    .map((block) => {
      const children = (block as { children?: { text?: unknown }[] }).children ?? [];
      const text = children
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("");
      const style = (block as { style?: string }).style;
      if (style === "h1" || style === "h2") return `${H2_PREFIX}${text}`;
      if (style === "h3" || style === "h4") return `${H3_PREFIX}${text}`;
      return text;
    })
    .filter(Boolean)
    .join("\n\n");
}
