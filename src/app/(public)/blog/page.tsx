import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { getPosts } from "@/lib/blog";
import BlogClient from "./BlogClient";
import { OG_IMAGE } from "@/app/layout";
import type { Metadata } from "next";

// ISR: revalida a listagem a cada 60s para refletir o Studio.
export const revalidate = 60;

const BLOG_TITLE = "Blog";
const BLOG_DESCRIPTION =
  "Histórias, destinos e bastidores de quem viaja. Dicas reais, experiências de clientes e bastidores do nosso trabalho.";

export const metadata: Metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    url: "/blog",
    siteName: "Spinhardi Turismo",
    locale: "pt_BR",
    // Next SUBSTITUI o openGraph do root (não mescla): sem declarar images aqui, a
    // og do site some e /blog fica sem imagem. Reusa a MESMA constante do root
    // (importada, não copiada) — hero provisória até a arte 1200x630 dedicada.
    images: [{ url: OG_IMAGE, alt: "Spinhardi Turismo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default async function Blog() {
  const posts = await getPosts({ status: "publicado" });

  return (
    <>
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb levels={[{ label: "Home", href: "/" }, { label: "Blog" }]} className="mb-6" />
          <p className="text-gold uppercase tracking-widest text-sm font-body mb-4">Blog</p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-navy leading-tight mb-6 max-w-4xl">
            Histórias, destinos e bastidores
            <br className="hidden md:block" /> de quem viaja.
          </h1>
          <p className="font-body text-lg lg:text-xl text-dark/80 max-w-2xl leading-relaxed">
            Dicas reais, experiências de clientes e bastidores do nosso trabalho. Conteúdo escrito
            por quem vive isso todo dia.
          </p>
        </Container>
      </Section>

      <BlogClient posts={posts} />
    </>
  );
}
