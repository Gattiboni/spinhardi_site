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
  date: string; // ISO date YYYY-MM-DD — usado só para display
  /** Timestamp ISO completo da publicação, cru do Sanity (`publishedAt`). Alimenta
   *  `og:published_time` e o `datePublished` do JSON-LD, que precisam da hora real:
   *  derivar de `date` (YYYY-MM-DD) emitiria meia-noite UTC = 21h do dia anterior no
   *  Brasil, declarando uma hora que nunca existiu. `undefined` em post sem data. */
  publishedAt?: string;
  body: string; // texto-leve (admin/mock); fallback quando não há richBody
  /** PortableText vindo da Sanity. Quando presente, o site público renderiza
   *  o corpo rico via `<PortableText>`; senão usa `body` (markdown-leve). */
  richBody?: PortableTextBlock[] | null;
  thumbnail: string | null;
  /** Texto alternativo da capa (`mainImage.alt`). `null` quando não há imagem
   *  ou alt. Nunca cai pro título como fallback — repetir o título no alt faz o
   *  leitor de tela ler a mesma frase duas vezes. */
  thumbnailAlt: string | null;
  status: "rascunho" | "publicado";
  /** Admin-only: slug da versão PUBLICADA (não o de exibição, que pode ser o do
   *  draft). É o único slug com página pública real — alvo do botão "Ver no site".
   *  `null` quando o post nunca foi publicado. Só as leituras do admin preenchem. */
  publishedSlug?: string | null;
  /** Admin-only: `true` quando há um rascunho por cima de uma versão publicada
   *  (edições ainda não republicadas). Usado pra avisar que o "Ver no site" abre a
   *  versão publicada, não as alterações pendentes. */
  hasPendingDraft?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  /** URL absoluta da imagem de compartilhamento (og:image), já resolvida em 1200x630
   *  cropada. Precedência na origem: `ogImage` do Sanity se preenchido, senão a capa
   *  (`mainImage`). `null`/ausente em post sem capa — o metadata omite o `og:image`
   *  em vez de emitir uma URL quebrada. NÃO é o objeto de imagem cru do Sanity (esse
   *  se chama `ogImage` no `SanityPost`); aqui é só a URL pronta pro metadata. */
  shareImage?: string;
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
  /** Texto alternativo da capa. Conteúdo serializável, então viaja no input (o
   *  arquivo, não). Obrigatório junto com a imagem para PUBLICAR (regra da action). */
  imageAlt?: string;
  /** `true` quando a Nina clicou em "Remover imagem" — distingue "não mandou
   *  arquivo novo" de "quer apagar a capa". O `File` em si vai por fora, em FormData. */
  removeImage?: boolean;
};

/** Resultado serializável das server actions de escrita (para o form exibir).
 *  No caso de falha, `field` (quando presente) nomeia o campo culpado, pro form
 *  colar o erro inline nele — mesmo padrão do ContactForm. `"image"` é o campo de
 *  arquivo (fora do `PostInput`); erros de alt usam a chave `imageAlt`. */
export type SaveResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string; field?: keyof PostInput | "image" };

export const CATEGORIES: PostCategory[] = [
  "Destinos",
  "Bastidores",
  "Dicas de Viagem",
  "História da Agência",
];

/** Limite de tamanho da capa (3 MB). Validado no client (antes de mandar) e no
 *  servidor (de novo, sem confiar no client). Margem confortável contra o corte
 *  de ~4.5MB da Vercel no runtime serverless. */
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/** Formatos aceitos para a capa. Mesma lista nos dois lados da validação. */
export const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
