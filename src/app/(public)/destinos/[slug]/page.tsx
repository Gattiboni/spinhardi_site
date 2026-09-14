import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import Divider from "@/components/ui/Divider";
import TestimonialCard from "@/components/ui/TestimonialCard";
import DestinoGaleria from "@/components/ui/DestinoGaleria";
import { DESTINOS, getDestino, primeiraFrase } from "@/content/destinos";

type Props = {
  params: Promise<{ slug: string }>;
};

/** Os 4 slugs vêm do array: sem rede, sem CMS. Slug fora da lista → 404. */
export function generateStaticParams() {
  return DESTINOS.map((destino) => ({ slug: destino.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destino = getDestino(slug);
  if (!destino) return { title: "Destino não encontrado" };

  const canonical = `/destinos/${destino.slug}`;
  const title = destino.nome; // vira "<nome> | Spinhardi Turismo" pelo template do layout
  const description = primeiraFrase(destino.intro[0]);

  // Destino SEM foto não declara `openGraph`: herda inteiro o do layout (og:image
  // padrão do site). Declarar aqui só pra passar `images: []` apagaria a imagem
  // herdada e o link sairia sem foto nenhuma — pior que o default.
  if (destino.fotos.length === 0) {
    return { title, description, alternates: { canonical } };
  }

  // Com foto, a CAPA (posição 0 do array, não a `-01` do nome do arquivo) vira a
  // og:image. O caminho é relativo de propósito: o `metadataBase` do layout o
  // resolve pra URL absoluta, que é o que o WhatsApp exige pra montar o card.
  //
  // O bloco `openGraph` vai completo porque o Next SUBSTITUI o objeto inteiro
  // quando a página o redeclara — passar só `images` derrubaria siteName, locale
  // e type herdados do layout.
  const capa = destino.fotos[0];
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: "Spinhardi Turismo",
      locale: "pt_BR",
      images: [{ url: capa.src, alt: capa.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [capa.src],
    },
  };
}

/**
 * Página `/destinos/[slug]`
 *
 * Tudo vem de `@/content/destinos` (fonte única). Estrutura, de cima pra baixo:
 *  1. Cabeçalho no padrão das internas do site (bloco branco, `pt-32 lg:pt-40`,
 *     breadcrumb `Home / <nome>`, eyebrow "Destinos", H1, parágrafos de intro).
 *     O breadcrumb NÃO aponta pra `/destinos`: o índice é utilitário.
 *  2. Bloco branco com a lista de 6 itens (`list-disc` com `marker:text-gold`,
 *     o marcador dourado sem ícone novo).
 *  3. Bloco depoimento: SÓ renderiza se `depoimento` não for `null`. Sem
 *     depoimento não há seção, nem placeholder no DOM.
 *  4. Bloco CTA navy, centralizado, com UM `CTAWhatsApp` e mais nada: sem
 *     segundo botão, sem link, sem formulário. Sem preço, sem "a partir de",
 *     sem urgência em lugar nenhum — é contrato de conteúdo.
 */
export default async function DestinoPage({ params }: Props) {
  const { slug } = await params;
  const destino = getDestino(slug);
  if (!destino) notFound();

  return (
    <>
      {/* Bloco 1 · Cabeçalho com breadcrumb */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: destino.nome }]}
            className="mb-6"
          />
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">Destinos</p>
          <h1 className="mb-8 max-w-4xl font-display text-5xl leading-tight text-navy md:text-6xl lg:text-7xl">
            {destino.h1}
          </h1>
          <div className="max-w-3xl space-y-6">
            {destino.intro.map((paragrafo) => (
              <p
                key={paragrafo}
                className="font-body text-lg leading-relaxed text-dark/80 lg:text-xl"
              >
                {paragrafo}
              </p>
            ))}
            {/* Galeria DENTRO do `space-y-6` da intro, como último filho: o
                espaçamento vira o mesmo que separa os parágrafos, e destino sem
                foto não deixa rastro. Um wrapper com margem própria aqui fora
                somaria espaço em branco na Itália, que não renderiza galeria. */}
            <DestinoGaleria fotos={destino.fotos} destinoNome={destino.nome} />
          </div>
        </Container>
      </Section>

      {/* Bloco 2 · Lista */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="max-w-3xl">
            <h2 className="mb-8 font-display text-3xl leading-tight text-navy md:text-4xl">
              {destino.listaTitulo}
            </h2>
            <ul className="list-disc space-y-4 pl-5 marker:text-gold">
              {destino.lista.map((item) => (
                <li
                  key={item}
                  className="pl-2 font-body text-base leading-relaxed text-dark/80 lg:text-lg"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Bloco 3 · Depoimento (só com dado real) */}
      {destino.depoimento && (
        <Section spacing="lg" className="bg-white text-dark">
          <Container>
            <div className="max-w-3xl">
              <TestimonialCard
                tone="light"
                quote={destino.depoimento.quote}
                author={destino.depoimento.author}
                context={destino.depoimento.context}
              />
            </div>
          </Container>
        </Section>
      )}

      {/* Bloco 4 · CTA único */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <Divider tone="light" className="mb-16" />
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
              Vamos conversar
            </p>
            <h2 className="mb-10 font-display text-4xl leading-tight md:text-5xl">
              Conta o que você tem em mente.
            </h2>
            <CTAWhatsApp
              variant="primary"
              size="lg"
              label={destino.ctaLabel}
              message={destino.whatsappMensagem}
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
