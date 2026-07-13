import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt — bloqueia indexação de áreas não-públicas.
 *
 * `/admin/` fica fora do Google enquanto a auth ainda é mock (mitigação do D030
 * nesta fase; resolução completa via Supabase Auth no próximo lote). `/dev/`
 * esconde a página de design system (`/dev/components`). `/api/` tira as rotas
 * internas (cron/sync, revalidate) do índice.
 *
 * O sitemap é derivado do `SITE_URL` (mesma origem do `metadataBase`) — antes era
 * uma string hardcoded SEM www, divergindo do domínio canônico com www.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dev/", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
