import { Post, PostCategory } from "./types";
import { getAllSanityPosts, getSanityPostBySlug } from "@/lib/sanity/queries";
import { sanityPostToPost } from "@/lib/sanity/mappers";

/**
 * Acesso a posts do blog.
 *
 * Fonte de dados: Sanity (dataset público `production`, leitura sem token).
 * As páginas consomem `Post` (interface canônica do app) — o adapter
 * `sanityPostToPost` faz a tradução. ISR nas páginas (`revalidate: 60`) cuida
 * do cache; mudança no Studio aparece no site em até ~60s.
 */

export async function getPosts(opts?: {
  category?: PostCategory | "Todos";
  status?: "rascunho" | "publicado";
}): Promise<Post[]> {
  const sanityPosts = await getAllSanityPosts();
  let posts = sanityPosts.map(sanityPostToPost);

  // Leitura pública só traz publicados; o filtro é mantido por simetria de API.
  if (opts?.status) {
    posts = posts.filter((p) => p.status === opts.status);
  }
  if (opts?.category && opts.category !== "Todos") {
    posts = posts.filter((p) => p.category === opts.category);
  }

  // A GROQ já ordena por publishedAt desc; reafirmamos para robustez.
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const sanityPost = await getSanityPostBySlug(slug);
  return sanityPost ? sanityPostToPost(sanityPost) : null;
}

// Stubs pra CRUD (admin) — não funcionais nesta fase. Escrita via Sanity Studio.
export async function createPost(_post: Omit<Post, "slug">): Promise<Post> {
  throw new Error("Escrita de posts é feita pelo Sanity Studio");
}

export async function updatePost(_slug: string, _post: Partial<Post>): Promise<Post> {
  throw new Error("Escrita de posts é feita pelo Sanity Studio");
}

export async function deletePost(_slug: string): Promise<void> {
  throw new Error("Escrita de posts é feita pelo Sanity Studio");
}
