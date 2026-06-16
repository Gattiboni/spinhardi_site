import type { PortableTextBlock } from "@portabletext/types";

export type PostCategory = "Destinos" | "Bastidores" | "Dicas de Viagem" | "História da Agência";

export type Post = {
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

export const CATEGORIES: PostCategory[] = [
  "Destinos",
  "Bastidores",
  "Dicas de Viagem",
  "História da Agência",
];
