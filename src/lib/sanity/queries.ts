import { sanityClient } from "./client";
import type { SanityPost } from "./mappers";

/**
 * GROQ para o schema `post` do template `blog` default da Sanity.
 *
 * Só posts com slug definido entram. Drafts não aparecem na leitura pública sem
 * token, então tudo que retorna aqui é, na prática, publicado.
 */
const POST_PROJECTION = `{
  _id,
  _createdAt,
  _updatedAt,
  title,
  "slug": slug.current,
  publishedAt,
  excerpt,
  mainImage,
  body,
  author->{name, image},
  categories[]->{title}
}`;

export async function getAllSanityPosts(): Promise<SanityPost[]> {
  return sanityClient.fetch<SanityPost[]>(
    `*[_type == "post" && defined(slug.current)] | order(coalesce(publishedAt, _createdAt) desc) ${POST_PROJECTION}`,
  );
}

export async function getSanityPostBySlug(slug: string): Promise<SanityPost | null> {
  return sanityClient.fetch<SanityPost | null>(
    `*[_type == "post" && slug.current == $slug][0] ${POST_PROJECTION}`,
    { slug },
  );
}
