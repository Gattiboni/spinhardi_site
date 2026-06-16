import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import { getPostBySlug, getPosts } from "@/lib/blog";
import { formatDate } from "@/lib/utils/date";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PortableText } from "@portabletext/react";

// ISR: revalida o conteúdo do Studio a cada 60s.
export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post não encontrado" };
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
  };
}

export async function generateStaticParams() {
  const posts = await getPosts({ status: "publicado" });
  return posts.map((p) => ({ slug: p.slug }));
}

/**
 * Componentes do PortableText (corpo rico vindo da Sanity), estilizados para
 * casar com a tipografia do artigo (mesmo visual do `renderBody` legado).
 */
const portableComponents = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="font-display text-3xl text-navy mt-12 mb-4">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="font-display text-2xl text-navy mt-12 mb-4">{children}</h3>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-2 border-gold pl-6 italic text-dark/70">
        {children}
      </blockquote>
    ),
  },
  marks: {
    link: ({ children, value }: { children?: React.ReactNode; value?: { href?: string } }) => (
      <a
        href={value?.href}
        className="text-gold underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
  },
};

/**
 * Renderização markdown-leve manual (fallback quando não há PortableText):
 * blocos separados por linha em branco; prefixo "## " vira h3 e "# " vira h2;
 * o resto vira parágrafo.
 */
function renderBody(body: string) {
  return body.split("\n\n").map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="font-display text-2xl text-navy mt-12 mb-4">
          {trimmed.replace(/^## /, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={i} className="font-display text-3xl text-navy mt-12 mb-4">
          {trimmed.replace(/^# /, "")}
        </h2>
      );
    }
    return <p key={i}>{trimmed}</p>;
  });
}

export default async function Post({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      {/* Bloco 1 - Cabeçalho do post */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <div className="max-w-3xl mx-auto">
            <Breadcrumb
              levels={[
                { label: "Home", href: "/" },
                { label: "Blog", href: "/blog" },
                { label: post.title },
              ]}
              className="mb-6"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 font-body text-sm">
              <span className="px-3 py-1 bg-gold/10 text-gold uppercase tracking-widest rounded-full text-xs">
                {post.category}
              </span>
              <span className="text-dark/60">{post.author}</span>
              <span className="text-dark/30">·</span>
              <time className="text-dark/60" dateTime={post.date}>
                {formatDate(post.date)}
              </time>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-navy leading-tight mb-8">
              {post.title}
            </h1>

            <p className="font-body text-lg lg:text-xl text-dark/80 italic leading-relaxed">
              {post.excerpt}
            </p>
          </div>
        </Container>
      </Section>

      {/* Bloco 2 - Conteúdo */}
      <Section spacing="md" className="bg-white text-dark">
        <Container>
          <article className="max-w-3xl mx-auto font-body text-base lg:text-lg text-dark/80 leading-relaxed space-y-6">
            {post.richBody?.length ? (
              <PortableText value={post.richBody} components={portableComponents} />
            ) : (
              renderBody(post.body)
            )}
          </article>
        </Container>
      </Section>

      {/* Bloco 3 - CTA Final */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl text-navy mb-6 leading-tight">
              Quer planejar uma viagem que faça sentido pra você?
            </h2>
            <p className="font-body text-lg text-dark/80 mb-12 leading-relaxed">
              Sem pressa, sem lista pronta, sem destino empurrado. Só uma boa conversa.
            </p>
            <CTAWhatsApp variant="primary" size="lg" label="Falar com a Spinhardi" />
          </div>
        </Container>
      </Section>
    </>
  );
}
