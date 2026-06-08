export type PostCategory = "Destinos" | "Bastidores" | "Dicas de Viagem" | "História da Agência";

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  author: string;
  date: string; // ISO date YYYY-MM-DD
  body: string;
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
