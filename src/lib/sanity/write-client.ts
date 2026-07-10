import "server-only";
import { createClient } from "@sanity/client";

/**
 * Cliente Sanity para ESCRITA (e leitura autenticada) do back-office.
 *
 * Separado do cliente público de leitura (`client.ts`, sem token): aqui usamos
 * `SANITY_API_WRITE_TOKEN` — um token com permissão de escrita, server-only. O
 * `import "server-only"` acima garante erro de build se este módulo (e portanto
 * o token) vazar pra qualquer client component.
 *
 * `useCdn: false` porque escrita nunca passa por CDN e leitura do admin precisa
 * ser fresca (sem cache de edge). `perspective: "raw"` faz as queries enxergarem
 * TODOS os documentos — drafts (`drafts.*`) E publicados — que é exatamente o
 * que a lista/edição do admin precisam; o site público continua no cliente sem
 * token, que só devolve publicados.
 */
export const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
  perspective: "raw",
});
