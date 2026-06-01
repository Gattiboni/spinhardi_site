import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";

export const metadata: Metadata = {
  title: "Pacotes e Roteiros",
  description:
    "Pacotes pensados para quem quer ir e voltar tranquilo. Cruzeiros, circuitos e pacotes completos para os principais destinos.",
};

export default function Pacotes() {
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
            <span>Pacotes e Roteiros</span>
          </nav>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-navy leading-tight mb-6 max-w-4xl">
            Pacotes pensados para quem quer
            <br className="hidden md:block" />
            ir e voltar tranquilo.
          </h1>
          <p className="font-body text-lg lg:text-xl text-dark/80 max-w-2xl leading-relaxed">
            Cruzeiros, circuitos e pacotes completos para os principais destinos. Cuidamos de todo o
            planejamento e a logística para que você só precise aproveitar.
          </p>
        </Container>
      </Section>

      {/* Bloco 2 · Grid 2 colunas (lista + card destacado navy) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Coluna esquerda: lista numerada */}
            <div className="lg:col-span-7">
              <p className="text-gold uppercase tracking-widest text-sm font-body mb-8">
                O que está incluído
              </p>

              <div className="divide-y divide-dark/10">
                {/* Item 01 */}
                <div className="grid grid-cols-12 gap-4 py-8 first:pt-0">
                  <span className="col-span-2 font-display text-3xl text-gold">01</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Passagem aérea
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Monitoramos tarifas e escolhemos o melhor momento para emitir. Com as melhores
                      conexões para o seu destino.
                    </p>
                  </div>
                </div>

                {/* Item 02 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">02</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">Hospedagem</h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Hotéis selecionados de acordo com o seu perfil e orçamento. Confirmação
                      garantida antes da viagem.
                    </p>
                  </div>
                </div>

                {/* Item 03 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">03</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Transfers e traslados
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Chegada e saída sem complicação. Coordenamos do aeroporto ao hotel e a volta.
                    </p>
                  </div>
                </div>

                {/* Item 04 */}
                <div className="grid grid-cols-12 gap-4 py-8">
                  <span className="col-span-2 font-display text-3xl text-gold">04</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Seguro viagem
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Cobertura adequada para cada destino. Explicamos o que está incluso e o que
                      não está.
                    </p>
                  </div>
                </div>

                {/* Item 05 */}
                <div className="grid grid-cols-12 gap-4 py-8 last:pb-0">
                  <span className="col-span-2 font-display text-3xl text-gold">05</span>
                  <div className="col-span-10">
                    <h3 className="font-display text-xl lg:text-2xl text-navy mb-2">
                      Suporte durante a viagem
                    </h3>
                    <p className="font-body text-base text-dark/70 leading-relaxed">
                      Estamos disponíveis se algo precisar ser ajustado no caminho.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita: card destacado navy sticky */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-32 bg-navy text-white rounded-md p-8 lg:p-10">
                <p className="text-gold uppercase tracking-widest text-sm font-body mb-4">
                  Próximos destinos disponíveis
                </p>
                <p className="font-display text-2xl lg:text-3xl leading-tight mb-8">
                  Fale conosco para saber os destinos disponíveis
                </p>
                <CTAWhatsApp variant="primary" size="md" label="Quero saber mais" />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
