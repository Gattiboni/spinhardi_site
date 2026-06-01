import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";

export const metadata: Metadata = {
  title: "Viagem Sob Medida",
  description:
    "Cada detalhe de acordo com o que você quer viver. Curadoria completa desenhada do zero.",
};

export default function SobMedida() {
  return (
    <>
      {/* Bloco 1 · Cabeçalho com breadcrumb */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 font-body text-sm text-dark/50">
            <Link href="/viagens" className="hover:text-gold transition-colors duration-short">
              Viagens
            </Link>
            <span className="mx-2">/</span>
            <span>Viagem Sob Medida</span>
          </nav>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-navy leading-tight mb-6 max-w-4xl">
            Cada detalhe de acordo com
            <br className="hidden md:block" />o que você quer viver.
          </h1>
          <p className="font-body text-lg lg:text-xl text-dark/80 max-w-2xl leading-relaxed">
            Curadoria completa desenhada do zero. Para quem quer delegar e receber de volta uma
            viagem que não existe em lugar nenhum.
          </p>
        </Container>
      </Section>

      {/* Bloco 2 · Grid 2 colunas (lista + card destacado gold border) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Coluna esquerda: lista numerada */}
            <div className="lg:col-span-7">
              <p className="text-gold uppercase tracking-widest text-sm font-body mb-8">
                Como funciona
              </p>

              <div className="divide-y divide-dark/10">
                {/* Etapa 01 */}
                <div className="grid grid-cols-12 gap-4 py-8 first:pt-0">
                  <span className="col-span-2 font-display text-3xl text-gold">01</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Conversa inicial
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Me conte o que você quer viver. Não o destino, a experiência. A partir daí a
                      gente começa a desenhar.
                    </p>
                  </div>
                </div>

                {/* Etapa 02 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">02</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Briefing e sinal
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Formalizamos o que foi conversado. Um sinal é pago e damos início ao seu
                      roteiro.
                    </p>
                  </div>
                </div>

                {/* Etapa 03 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">03</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Proposta personalizada
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Roteiro dia a dia, com acomodações, experiências e logística.
                    </p>
                  </div>
                </div>

                {/* Etapa 04 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">04</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Aprovação e emissão
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Você aprova, a gente emite. Tudo documentado e confirmado antes da viagem.
                    </p>
                  </div>
                </div>

                {/* Etapa 05 */}
                <div className="grid grid-cols-12 gap-4 py-8 last:pb-0">
                  <span className="col-span-2 font-display text-3xl text-gold">05</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Suporte ativo
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Durante a viagem, estamos disponíveis para o que você precisar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita: card destacado branco com border gold, sticky */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-32 bg-white text-dark border-2 border-gold rounded-md p-8 lg:p-10">
                <p className="text-gold uppercase tracking-widest text-sm font-body mb-4">
                  Para quem é
                </p>
                <p className="font-body text-base lg:text-lg text-dark/80 leading-relaxed mb-8">
                  Para quem tem um orçamento em mente e quer ajuda para montar tudo do zero. Para
                  quem quer delegar e receber de volta uma viagem pensada especificamente para si.
                  Para quem já viajou, mas quer algo diferente desta vez.
                </p>
                <CTAWhatsApp variant="primary" size="md" label="Quero minha viagem sob medida" />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
