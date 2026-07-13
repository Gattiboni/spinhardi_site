import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAllSanityPosts } from "@/lib/sanity/queries";

/**
 * sitemap.xml — API nativa do Next (sem lib).
 *
 * URLs derivadas do `SITE_URL` (mesma origem do `metadataBase`): nada hardcoded,
 * então sitemap e canonical nunca divergem de host.
 *
 * Estáticas: todas as rotas públicas do site (`/dev/components` fica de fora — é o
 * design system interno, já bloqueado no robots). Dinâmicas: os posts publicados,
 * lidos pelo CLIENT PÚBLICO (`getAllSanityPosts` → `perspective: "published"`).
 * Rascunho não vaza porque essa leitura não usa o write client. `/admin/*` nunca
 * entra aqui. `lastModified` de post = `_updatedAt` do documento.
 */
// ISR: sem isto, o sitemap prerenderiza no build e CONGELA — post publicado após
// o deploy não entraria até o próximo build. 60s espelha a cadência do `/blog`
// (que também revalida a cada 1min), então listagem e sitemap ficam em sincronia.
export const revalidate = 60;

const STATIC_PATHS = [
  "/",
  "/sobre",
  "/viagens",
  "/viagens/pacotes",
  "/viagens/sob-medida",
  "/contato",
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));

  const posts = await getAllSanityPosts();
  const postEntries: MetadataRoute.Sitemap = posts
    .filter((post) => post.slug)
    .map((post) => ({
      url: new URL(`/blog/${post.slug}`, SITE_URL).toString(),
      lastModified: post._updatedAt,
    }));

  return [...staticEntries, ...postEntries];
}
