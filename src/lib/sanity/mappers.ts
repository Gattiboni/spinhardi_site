import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";
import type { Post, PostCategory } from "@/lib/blog/types";
import { CATEGORIES } from "@/lib/blog/types";
import { urlForImage } from "./image";

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
  mainImage: SanityImageSource | null;
  body: PortableTextBlock[] | null;
  author: { name: string | null; image: SanityImageSource | null } | null;
  categories: { title: string | null }[] | null;
};

/** Serializa PortableText em texto-leve (com `#`/`##` para títulos) — fallback
 *  para `Post.body` (string canônica usada pelo admin/mock e como excerpt). */
function portableTextToPlainText(blocks: PortableTextBlock[] | null): string {
  if (!blocks?.length) return "";
  return blocks
    .filter((block) => block._type === "block")
    .map((block) => {
      const text = (block.children ?? [])
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("");
      if (block.style === "h1" || block.style === "h2") return `# ${text}`;
      if (block.style === "h3" || block.style === "h4") return `## ${text}`;
      return text;
    })
    .filter(Boolean)
    .join("\n\n");
}

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
export function sanityPostToPost(sanityPost: SanityPost): Post {
  const plain = portableTextToPlainText(sanityPost.body);
  const publishedAt = sanityPost.publishedAt ?? sanityPost._createdAt;

  return {
    slug: sanityPost.slug ?? sanityPost._id,
    title: sanityPost.title ?? "(sem título)",
    excerpt: sanityPost.excerpt ?? plain.slice(0, 200),
    category: mapCategory(sanityPost.categories),
    author: sanityPost.author?.name ?? "Spinhardi Turismo",
    date: publishedAt.slice(0, 10),
    body: plain,
    richBody: sanityPost.body ?? null,
    thumbnail: urlForImage(sanityPost.mainImage),
    // Leitura pública sem token só retorna posts publicados.
    status: "publicado",
  };
}
