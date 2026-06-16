import { createClient } from "@sanity/client";

/**
 * Cliente Sanity para leitura pública do blog.
 *
 * Leitura SEM token: o dataset `production` é público por default no plano free,
 * então drafts não vazam e não precisamos de `SANITY_API_TOKEN` aqui. Se um dia
 * formos ler drafts ou um dataset privado, o token entra — não antes.
 *
 * `useCdn: true` usa o edge CDN da Sanity (ótimo para leitura pública). A
 * revalidação fica a cargo do ISR das páginas (`export const revalidate = 60`).
 */
export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: true,
});
