import { Post, PostCategory } from "./types";
import { MOCK_POSTS } from "./mock-posts";

/**
 * Acesso a posts do blog.
 *
 * MOCK na Fase 1: dados estáticos em `mock-posts.ts`.
 * Vira integração com Sanity na Fase 3 — apenas a implementação destas
 * funções muda. As páginas que consomem continuam idênticas.
 */

export async function getPosts(opts?: {
  category?: PostCategory | "Todos";
  status?: "rascunho" | "publicado";
}): Promise<Post[]> {
  let posts = MOCK_POSTS;

  if (opts?.status) {
    posts = posts.filter((p) => p.status === opts.status);
  }
  if (opts?.category && opts.category !== "Todos") {
    posts = posts.filter((p) => p.category === opts.category);
  }

  // Ordenar por data desc (mais recente primeiro).
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return MOCK_POSTS.find((p) => p.slug === slug) ?? null;
}

// Stubs pra CRUD (admin) — não funcionais na Fase 1. Implementação real com
// Sanity na Fase 3.
export async function createPost(_post: Omit<Post, "slug">): Promise<Post> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}

export async function updatePost(_slug: string, _post: Partial<Post>): Promise<Post> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}

export async function deletePost(_slug: string): Promise<void> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}
