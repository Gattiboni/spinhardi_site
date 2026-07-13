/**
 * Constantes canônicas do site — fonte ÚNICA de verdade para origem e descrição.
 *
 * `SITE_URL` alimenta o `metadataBase` (layout), o `sitemap.ts`, o `robots.ts` e o
 * JSON-LD da home. Antes ela vivia inline no layout e o `robots.ts` tinha o domínio
 * hardcoded (e sem www, divergindo do canônico). Centralizar aqui garante que
 * sitemap, robots e canonical apontem todos para o MESMO host.
 *
 * Domínio canônico com www: o sem-www redireciona 308 → www, então www serve 200.
 * Lido de env (mesma var do resto do app) com fallback pro canônico de produção.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.spinharditurismo.com.br";

/** Descrição institucional global. Reusada no metadata do layout e no JSON-LD. */
export const SITE_DESCRIPTION =
  "Agência boutique de viagens em Serra Negra, SP. Desde 1987, curadoria personalizada para quem viaja de verdade.";
