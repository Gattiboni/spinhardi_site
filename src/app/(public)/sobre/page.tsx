import type { Metadata } from "next";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Divider from "@/components/ui/Divider";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import { SpinhardiImage } from "@/components/ui/SpinhardiImage";

export const metadata: Metadata = {
  title: "Sobre", // vira "Sobre | Spinhardi Turismo"
  description:
    "Uma agência construída à mão. Por quase quatro décadas. Começamos com uma viagem à Itália em 1987. Crescemos por indicação, nome a nome, viagem a viagem.",
};

export default function Sobre() {
  return (
    <>
      {/* Bloco 1 · Cabeçalho da página */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: "Sobre" }]}
            className="mb-6"
          />
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Nossa história
          </p>
          <h1 className="mb-6 max-w-4xl font-display text-5xl leading-tight text-navy md:text-6xl lg:text-7xl">
            Uma agência construída à mão.
            <br className="hidden md:block" />
            Por quase quatro décadas.
          </h1>
          <p className="max-w-2xl font-body text-lg leading-relaxed text-dark/80 lg:text-xl">
            Começamos com uma viagem à Itália em 1987. Crescemos por indicação, nome a nome, viagem
            a viagem. Esta é a nossa história.
          </p>
        </Container>
      </Section>

      {/* Bloco 2 · Linha do tempo (navy) */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Linha do tempo
          </p>

          <Divider tone="light" className="mb-12 mt-8" />

          <div className="divide-y divide-white/10">
            {/* Item 1 */}
            <div className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-3">
                <p className="font-display text-3xl text-gold lg:text-4xl">1987</p>
              </div>
              <div className="lg:col-span-9">
                <h3 className="mb-3 font-display text-2xl text-white">O começo</h3>
                <p className="max-w-2xl font-body text-base leading-relaxed text-white/70">
                  Uma viagem à Itália com 40 pessoas. Foi aí que tudo começou. O que seria um grupo
                  de amigos se tornou o primeiro projeto de uma agência que nunca deixou de cuidar.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-3">
                <p className="font-display text-3xl text-gold lg:text-4xl">1987 – 2012</p>
              </div>
              <div className="lg:col-span-9">
                <h3 className="mb-3 font-display text-2xl text-white">Lilian e Dudu</h3>
                <p className="max-w-2xl font-body text-base leading-relaxed text-white/70">
                  Por quase trinta anos, a Spinhardi foi construída com dedicação, atenção aos
                  detalhes e cuidado com cada cliente. Uma reputação construída por indicação, em
                  Serra Negra e além.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-3">
                <p className="font-display text-3xl text-gold lg:text-4xl">2024</p>
              </div>
              <div className="lg:col-span-9">
                <h3 className="mb-3 font-display text-2xl text-white">Nina assume o sonho</h3>
                <p className="max-w-2xl font-body text-base leading-relaxed text-white/70">
                  Nina assumiu a Spinhardi não para reinventá-la, mas para dar continuidade. A mesma
                  essência, os mesmos valores, com novas ferramentas, novos destinos e uma visão
                  clara do futuro.
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-3">
                <p className="font-display text-3xl text-gold lg:text-4xl">Atualmente</p>
              </div>
              <div className="lg:col-span-9">
                <h3 className="mb-3 font-display text-2xl text-white">A Spinhardi de hoje</h3>
                <p className="max-w-2xl font-body text-base leading-relaxed text-white/70">
                  A Spinhardi estrutura sua presença digital para comunicar externamente o que já
                  acontece internamente há décadas. A agência que cresceu no boca a boca agora
                  aparece para quem ainda não a conhece.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Bloco 3 · Nosso time hoje (miolo entre história e valores) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Quem cuida da sua viagem
          </p>
          <h2 className="mb-6 max-w-3xl font-display text-4xl leading-tight text-navy md:text-5xl">
            Nosso time hoje
          </h2>
          <p className="mb-12 max-w-2xl font-body text-base leading-relaxed text-dark/80 lg:text-lg">
            Quem conduz a Spinhardi hoje é um time formado por especialistas em diferentes frentes —
            Itália, Portugal, África, Disney, entre outros destinos. Cada viagem que sai daqui
            carrega esse conhecimento reunido, do início ao fim da sua viagem.
          </p>

          <div className="mx-auto max-w-2xl">
            <div className="grid grid-cols-2 gap-8 md:gap-12">
              <figure className="flex flex-col items-center">
                <SpinhardiImage
                  src="/equipe-spinhardi-01-nina.jpg"
                  alt="Angelina Saragiotto, sócia da Spinhardi Turismo"
                  aspect="3/4"
                  className="max-w-50 rounded-md"
                  sizes="(max-width: 768px) 40vw, 200px"
                />
                <figcaption className="mt-4 font-display text-base text-dark">
                  Angelina Saragiotto
                </figcaption>
              </figure>
              <figure className="flex flex-col items-center">
                <SpinhardiImage
                  src="/equipe-spinhardi-02-julia.jpg"
                  alt="Julia Scappini, sócia da Spinhardi Turismo"
                  aspect="3/4"
                  className="max-w-50 rounded-md"
                  sizes="(max-width: 768px) 40vw, 200px"
                />
                <figcaption className="mt-4 font-display text-base text-dark">
                  Julia Scappini
                </figcaption>
              </figure>
            </div>
          </div>
        </Container>
      </Section>

      {/* Bloco 4 · Valores (4 colunas) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Como trabalhamos
          </p>
          <h2 className="mb-12 max-w-3xl font-display text-4xl leading-tight text-navy md:text-5xl">
            Há valores que não mudam.
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            <div>
              <span className="mb-4 block font-display text-5xl text-gold">01</span>
              <h3 className="mb-3 font-display text-2xl text-navy">Presença Real</h3>
              <p className="font-body text-sm leading-relaxed text-dark/70">
                Você fala com quem vai resolver. Não com um atendente, não com um bot. Com quem
                conhece cada detalhe do que foi combinado.
              </p>
            </div>

            <div>
              <span className="mb-4 block font-display text-5xl text-gold">02</span>
              <h3 className="mb-3 font-display text-2xl text-navy">Cuidado com o Detalhe</h3>
              <p className="font-body text-sm leading-relaxed text-dark/70">
                Cada viagem tem uma mão humana por trás. Da passagem aérea avulsa à viagem sob
                medida, o cuidado com o cliente não muda.
              </p>
            </div>

            <div>
              <span className="mb-4 block font-display text-5xl text-gold">03</span>
              <h3 className="mb-3 font-display text-2xl text-navy">Transparência</h3>
              <p className="font-body text-sm leading-relaxed text-dark/70">
                A confiança do cliente é preservada porque não há surpresas no orçamento.
              </p>
            </div>

            <div>
              <span className="mb-4 block font-display text-5xl text-gold">04</span>
              <h3 className="mb-3 font-display text-2xl text-navy">História e confiança</h3>
              <p className="font-body text-sm leading-relaxed text-dark/70">
                Quase quatro décadas construídas nome a nome, viagem a viagem.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Bloco 5 · CTA Final */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-6 font-display text-4xl leading-tight text-navy md:text-5xl">
              Quer conversar com a gente?
            </h2>
            <p className="mb-12 font-body text-lg leading-relaxed text-dark/80">
              A conversa não compromete nada. Conta pra gente o que tem em mente?
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
