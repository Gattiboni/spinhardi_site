import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";
import type { Post, PostCategory } from "@/lib/blog/types";
import { CATEGORIES } from "@/lib/blog/types";
import { portableTextToMdLight } from "@/lib/blog/portable-text";
import { urlForImage, urlForOgImage } from "./image";

/**
 * Imagem da Sanity com o `alt` aninhado (schema do `mainImage`). Tipada de
 * verdade — em vez do `SanityImageSource` opaco — pra podermos ler `.alt` no
 * mapper. `urlForImage` continua aceitando este objeto (o cast no call site).
 */
export type SanityImage = {
  _type?: "image";
  asset?: { _ref?: string; _type?: string };
  alt?: string | null;
  hotspot?: unknown;
  crop?: unknown;
};

/**
 * Shape cru que a GROQ (`queries.ts`) entrega para um post do template `blog`.
 * Campos podem vir `null` quando não preenchidos no Studio.
 */
export type SanityPost = {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  title: string | null;
  slug: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  mainImage: SanityImage | null;
  /** Imagem de compartilhamento (og:image) opcional. Setável só via Studio (não há
   *  campo no form do admin). Quando preenchida, tem prioridade sobre `mainImage`. */
  ogImage: SanityImage | null;
  body: PortableTextBlock[] | null;
  author: { name: string | null; image: SanityImageSource | null } | null;
  categories: { title: string | null }[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** Mapeia a categoria da Sanity (string livre) para a união canônica do app.
 *  Sem correspondência, cai em "Destinos" (imperfeição aceita nesta fase). */
function mapCategory(categories: SanityPost["categories"]): PostCategory {
  const title = categories?.find((c) => c.title)?.title;
  return (CATEGORIES as string[]).includes(title ?? "") ? (title as PostCategory) : "Destinos";
}

/**
 * Adapter explícito Sanity → Post (mesmo princípio do mapper Supabase do Lote C).
 * O type `Post` é a interface canônica; a Sanity é uma fonte específica.
 *
 * `richBody` carrega o PortableText para renderização rica no site público;
 * `body` mantém o texto-leve para compatibilidade com o admin (que edita string).
 */
/** Só considera uma imagem do Sanity "presente" se tiver asset ref — um objeto de
 *  imagem vazio (quirk do Studio) não vira URL quebrada. */
function hasAsset(image: SanityImage | null | undefined): boolean {
  return !!image?.asset?._ref;
}

/** Dia-calendário de DISPLAY (YYYY-MM-DD) do instante ISO, no fuso de Brasília.
 *
 *  `publishedAt.slice(0, 10)` cortava a string UTC sem converter fuso: um post
 *  publicado às 21h34 BRT (00h34 UTC do dia seguinte) exibia o dia seguinte. Aqui
 *  o `Intl` com `timeZone` converte de verdade. `en-CA` formata como YYYY-MM-DD.
 *  Roda no server (o mapper é server-only), então a conversão de fuso acontece uma
 *  vez só; `formatDate` depois renderiza essa data-só sem depender de fuso. */
function displayDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function sanityPostToPost(sanityPost: SanityPost): Post {
  const plain = portableTextToMdLight(sanityPost.body);
  const publishedAt = sanityPost.publishedAt ?? sanityPost._createdAt;

  // Imagem de compartilhamento: `ogImage` do Studio tem prioridade; senão a capa.
  // Resolvida já em 1200x630 cropada e absoluta (CDN da Sanity), pronta pro metadata.
  const shareSource = hasAsset(sanityPost.ogImage) ? sanityPost.ogImage : sanityPost.mainImage;
  const shareImage = urlForOgImage(shareSource as SanityImageSource | null);

  return {
    // `_id` de um draft vem prefixado (`drafts.<baseId>`); o admin repõe `id`
    // com o baseId limpo. Aqui só interessa o slug pra rota/URL.
    slug: sanityPost.slug ?? sanityPost._id,
    title: sanityPost.title ?? "(sem título)",
    excerpt: sanityPost.excerpt ?? plain.slice(0, 200),
    category: mapCategory(sanityPost.categories),
    author: sanityPost.author?.name ?? "Spinhardi Turismo",
    date: displayDate(publishedAt),
    publishedAt,
    body: plain,
    richBody: sanityPost.body ?? null,
    thumbnail: urlForImage(sanityPost.mainImage as SanityImageSource | null),
    thumbnailAlt: sanityPost.mainImage?.alt ?? null,
    seoTitle: sanityPost.seoTitle || undefined,
    seoDescription: sanityPost.seoDescription || undefined,
    shareImage: shareImage ?? undefined,
    // Leitura pública sem token só retorna posts publicados.
    status: "publicado",
  };
}
