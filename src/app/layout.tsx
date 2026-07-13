import type { Metadata } from "next";
import { Fraunces, Montserrat } from "next/font/google";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const SITE_TITLE = "Spinhardi Turismo — Cada viagem, uma vez. Feita para você.";
// og:image provisória do site: foto hero existente (Portofino). Arte dedicada
// 1200x630 é pendência de design (Amanda), não trava o SEO. Exportada porque
// `/blog` reusa a MESMA constante (Next substitui `openGraph` inteiro quando a
// página redeclara, então a listagem precisa apontar pra cá — não copiar o path).
export const OG_IMAGE = "/hero-principal-02.jpg";

// `SITE_URL`/`SITE_DESCRIPTION` vêm de `@/lib/site` (fonte única, compartilhada com
// sitemap/robots/JSON-LD). Sem `metadataBase`, canonical/og relativos não resolvem
// e o Next reclama no build.
export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | Spinhardi Turismo",
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Spinhardi Turismo",
    images: [{ url: OG_IMAGE, alt: "Spinhardi Turismo" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
