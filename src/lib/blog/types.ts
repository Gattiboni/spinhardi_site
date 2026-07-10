import type { PortableTextBlock } from "@portabletext/types";

export type PostCategory = "Destinos" | "Bastidores" | "Dicas de Viagem" | "História da Agência";

export type Post = {
  /** ID base do documento na Sanity (sem o prefixo `drafts.`). Só é preenchido
   *  nas leituras do admin (write client); nas leituras públicas fica undefined. */
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  author: string;
  date: string; // ISO date YYYY-MM-DD
  body: string; // texto-leve (admin/mock); fallback quando não há richBody
  /** PortableText vindo da Sanity. Quando presente, o site público renderiza
   *  o corpo rico via `<PortableText>`; senão usa `body` (markdown-leve). */
  richBody?: PortableTextBlock[] | null;
  thumbnail: string | null;
  status: "rascunho" | "publicado";
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
};

/**
 * Payload que o formulário do admin manda pras server actions de escrita.
 * `body` é md-leve; a conversão pro Portable Text acontece na gravação.
 */
export type PostInput = {
  title: string;
  slug: string;
  category: PostCategory;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
};

/** Resultado serializável das server actions de escrita (para o form exibir).
 *  No caso de falha, `field` (quando presente) nomeia o campo culpado, pro form
 *  colar o erro inline nele — mesmo padrão do ContactForm. */
export type SaveResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; field?: keyof PostInput };

export const CATEGORIES: PostCategory[] = [
  "Destinos",
  "Bastidores",
  "Dicas de Viagem",
  "História da Agência",
];
