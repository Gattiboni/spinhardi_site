import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { getPosts } from "@/lib/blog";
import BlogClient from "./BlogClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Histórias, destinos e bastidores de quem viaja. Dicas reais, experiências de clientes e bastidores do nosso trabalho.",
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
