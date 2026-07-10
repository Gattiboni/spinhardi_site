import { createClient } from "@sanity/client";

/**
 * Cliente Sanity para leitura pública do blog.
 *
 * Leitura SEM token: o dataset `production` é público por default no plano free,
 * então drafts não vazam e não precisamos de `SANITY_API_TOKEN` aqui. Se um dia
 * formos ler drafts ou um dataset privado, o token entra — não antes.
 *
 * `useCdn: false` de propósito: o cache/escala fica com o Next (ISR das páginas,
 * `export const revalidate = 60`, + `revalidatePath` no publish do admin). Com
 * `useCdn: true`, um post recém-publicado podia sumir do público por até o TTL da
 * CDN de edge da Sanity — e o `revalidatePath` da action NÃO purga essa CDN (só o
 * cache do Next). Lendo live, todo render/revalidação reflete o estado real na
 * hora, igual ao que o admin já enxerga (o write client também é `useCdn: false`).
 *
 * `perspective: "published"` fixa o escopo em documentos publicados, em vez de
 * depender do default que varia por `apiVersion` (para < v2025-02-19 o default é
 * `raw`; fixar evita surpresa se a versão for bumpada e mantém a intenção clara).
 */
export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: false,
  perspective: "published",
});
