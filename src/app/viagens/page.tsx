import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";

export const metadata: Metadata = {
  title: "Viagens", // vira "Viagens | Spinhardi Turismo"
  description:
    "Como podemos ajudar na sua próxima viagem. Atendemos do viajante que quer uma passagem ao que quer delegar uma viagem inteira.",
};

export default function Viagens() {
  return (
    <>
      {/* Bloco 1 · Cabeçalho da página */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: "Viagens" }]}
            className="mb-6"
          />
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">Viagens</p>
          <h1 className="mb-6 max-w-4xl font-display text-5xl leading-tight text-navy md:text-6xl lg:text-7xl">
            Como podemos ajudar
            <br className="hidden md:block" />
            na sua próxima viagem.
          </h1>
          <p className="max-w-2xl font-body text-lg leading-relaxed text-dark/80 lg:text-xl">
            Atendemos do viajante que quer uma passagem ao que quer delegar uma viagem inteira.
            Escolha o que faz mais sentido para você.
          </p>
        </Container>
      </Section>

      {/* Bloco 2 · 2 cards grandes */}
      <Section spacing="lg" className="bg-white">
        <Container>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
            {/* Card 01 · Pacotes e Roteiros */}
            <Link
              href="/viagens/pacotes"
              className="group block overflow-hidden rounded-md border border-dark/10 bg-white transition-all duration-medium ease-smooth hover:border-gold/30 hover:shadow-lg"
            >
              {/* Placeholder de imagem */}
              <div className="flex aspect-[4/3] items-center justify-center border-b border-dark/10 bg-dark/5">
                <p className="px-4 text-center font-body text-xs uppercase tracking-wide text-dark/40">
                  Imagem ilustrativa
                  <br />
                  Pacotes e Roteiros
                  <br />A definir com Nina e Julia
                </p>
              </div>

              {/* Conteúdo */}
              <div className="p-8 lg:p-10">
                <span className="mb-4 block font-display text-4xl text-gold">01</span>
                <h3 className="mb-4 font-display text-3xl text-navy transition-colors duration-short group-hover:text-gold">
                  Pacotes e Roteiros
                </h3>
                <p className="mb-6 font-body text-base leading-relaxed text-dark/70">
                  Cruzeiros, circuitos e pacotes completos. Coordenamos tudo para quem quer viajar
                  com segurança e sem complicação.
                </p>
                <p className="inline-flex items-center gap-2 font-body text-sm uppercase tracking-widest text-gold">
                  Ver mais
                  <span className="transition-transform duration-short group-hover:translate-x-1">
                    →
                  </span>
                </p>
              </div>
            </Link>

            {/* Card 02 · Viagem Sob Medida */}
            <Link
              href="/viagens/sob-medida"
              className="group block overflow-hidden rounded-md border border-dark/10 bg-white transition-all duration-medium ease-smooth hover:border-gold/30 hover:shadow-lg"
            >
              {/* Placeholder de imagem */}
              <div className="flex aspect-[4/3] items-center justify-center border-b border-dark/10 bg-dark/5">
                <p className="px-4 text-center font-body text-xs uppercase tracking-wide text-dark/40">
                  Imagem ilustrativa
                  <br />
                  Viagem Sob Medida
                  <br />A definir com Nina e Julia
                </p>
              </div>

              {/* Conteúdo */}
              <div className="p-8 lg:p-10">
                <span className="mb-4 block font-display text-4xl text-gold">02</span>
                <h3 className="mb-4 font-display text-3xl text-navy transition-colors duration-short group-hover:text-gold">
                  Viagem Sob Medida
                </h3>
                <p className="mb-6 font-body text-base leading-relaxed text-dark/70">
                  Curadoria completa desenhada do zero. Briefing, proposta personalizada e
                  acompanhamento em cada etapa.
                </p>
                <p className="inline-flex items-center gap-2 font-body text-sm uppercase tracking-widest text-gold">
                  Ver mais
                  <span className="transition-transform duration-short group-hover:translate-x-1">
                    →
                  </span>
                </p>
              </div>
            </Link>
          </div>
        </Container>
      </Section>

      {/* Bloco 3 · CTA Final */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-6 font-display text-4xl leading-tight text-navy md:text-5xl">
              Não sabe por onde começar?
            </h2>
            <p className="mb-12 font-body text-lg leading-relaxed text-dark/80">
              Me conta o que você tem em mente.
            </p>
            <div className="flex justify-center">
              <CTAWhatsApp variant="primary" size="lg" label="Fale com a gente" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
