import type { MetadataRoute } from "next";

/**
 * robots.txt — bloqueia indexação de áreas não-públicas.
 *
 * `/admin/` fica fora do Google enquanto a auth ainda é mock (mitigação do D030
 * nesta fase; resolução completa via Supabase Auth no próximo lote). `/dev/`
 * esconde a página de design system (`/dev/components`).
 *
 * O `sitemap` aponta para uma URL que ainda não existe (SEO é fase futura) —
 * crawlers ignoram silenciosamente.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dev/"],
    },
    sitemap: "https://spinharditurismo.com.br/sitemap.xml",
  };
}
