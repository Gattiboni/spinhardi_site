import Link from "next/link";

import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import Divider from "@/components/ui/Divider";
import Section from "@/components/ui/Section";
import ServiceCard from "@/components/ui/ServiceCard";
import TestimonialCard from "@/components/ui/TestimonialCard";

/** Os 4 valores do Bloco 2 — dados inline, sem componente próprio. */
const VALORES = [
  {
    number: "01",
    title: "Presença real",
    description: "Você fala com quem vai resolver. Antes, durante e depois da viagem.",
  },
  {
    number: "02",
    title: "Cuidado com o detalhe",
    description: "Cada roteiro tem uma mão humana por trás. Nada sai do automático.",
  },
  {
    number: "03",
    title: "Transparência",
    description: "Orçamento claro, tudo explicado. Sem surpresas.",
  },
  {
    number: "04",
    title: "História e confiança",
    description: "Quase quatro décadas construídas nome a nome, viagem a viagem.",
  },
];

export default function Home() {
  return (
    <>
      {/* Bloco 1 · Hero */}
      <Section spacing="lg" className="bg-navy text-white pt-32 lg:pt-40">
        <Container>
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Desde 1987 · Serra Negra, SP
          </p>
          <h1 className="mb-6 max-w-4xl font-display text-5xl leading-tight md:text-6xl lg:text-7xl">
            Cada viagem, uma história sua.
            <br className="hidden md:block" /> Feita para você.
          </h1>
          <p className="mb-12 max-w-2xl font-body text-lg leading-relaxed text-white/80 lg:text-xl">
            Quase quarenta anos cuidando de quem viaja. Atendimento próximo, roteiros pensados nos
            detalhes, alguém real do outro lado. Antes, durante e depois de cada viagem.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <CTAWhatsApp variant="primary" size="lg" label="Vamos conversar" />
            <Link href="/sobre">
              <Button variant="secondary" size="lg">
                Nossa história
              </Button>
            </Link>
          </div>
        </Container>
      </Section>

      {/* Bloco 2 · Posicionamento + 4 valores */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <Divider tone="light" className="mb-16" />

          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">Quem somos</p>
          <h2 className="mb-6 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Uma agência que cresceu por indicação. Há quase quatro décadas.
          </h2>
          <p className="mb-8 max-w-3xl font-body text-base leading-relaxed text-white/80 lg:text-lg">
            A Spinhardi vende mais do que pacote. Entrega a certeza de que tem alguém cuidando, do
            primeiro contato ao retorno a casa. Atendemos desde o viajante que quer somente uma
            passagem até quem quer delegar uma viagem inteira.
          </p>
          <Link href="/sobre">
            <Button variant="ghost" size="md" className="text-white hover:text-gold">
              Conheça a história →
            </Button>
          </Link>

          <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            {VALORES.map((valor) => (
              <div key={valor.number}>
                <span className="mb-4 block font-display text-5xl text-gold">{valor.number}</span>
                <h3 className="mb-3 font-display text-2xl text-white">{valor.title}</h3>
                <p className="font-body text-sm leading-relaxed text-white/70">
                  {valor.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Bloco 3 · Serviços */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <Divider tone="light" className="mb-16" />

          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            O que oferecemos
          </p>
          <h2 className="mb-4 font-display text-4xl leading-tight md:text-5xl">
            Como podemos ajudar na sua próxima viagem
          </h2>
          <p className="mb-12 max-w-2xl font-body text-base leading-relaxed text-white/80 lg:text-lg">
            Cada viajante recebe, com atenção, o que precisa.
          </p>

          <div className="mt-12">
            <ServiceCard
              tone="dark"
              number="01"
              title="Passagens e Serviços Avulsos"
              description="Passagens aéreas, seguro viagem, hospedagem e transfers para quem já sabe o que quer."
              href="/viagens"
            />
            <ServiceCard
              tone="dark"
              number="02"
              title="Pacotes e Roteiros"
              description="Cruzeiros, circuitos e pacotes completos para os principais destinos. Coordenamos tudo para você."
              href="/viagens/pacotes"
            />
            <ServiceCard
              tone="dark"
              number="03"
              title="Viagem Sob Medida"
              description="Curadoria completa desenhada do zero com você. Briefing, proposta e acompanhamento total."
              href="/viagens/sob-medida"
            />
          </div>
        </Container>
      </Section>

      {/* Bloco 4 · História / Legado (1987) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-16">
            <div className="lg:col-span-2">
              <p className="font-display text-7xl leading-none text-navy md:text-8xl lg:text-9xl">
                1987
              </p>
            </div>

            <div className="lg:col-span-3">
              <h2 className="mb-6 font-display text-3xl leading-tight text-navy md:text-4xl">
                Uma viagem com 40 pessoas deu início a tudo isso.
              </h2>
              <p className="mb-6 font-body text-base leading-relaxed text-dark/80 lg:text-lg">
                Em 1987, uma viagem à Itália com 40 pessoas se transformou no primeiro projeto de
                uma agência que nunca mais parou. Lilian e Dudu construíram a Spinhardi em Serra
                Negra com dedicação, atenção aos detalhes e cuidado com cada cliente, por quase
                trinta anos.
              </p>
              <p className="mb-8 font-body text-base leading-relaxed text-dark/80 lg:text-lg">
                Quando Nina assumiu esse sonho, não foi um recomeço. Foi uma continuidade. A mesma
                essência, com novas ferramentas e uma visão clara do que a Spinhardi pode se tornar.
              </p>

              <TestimonialCard
                tone="light"
                quote="Cada viagem que criamos carrega um pouco da nossa história, e passa a fazer parte da sua."
                author="Spinhardi · 2026"
              />

              <div className="mt-8">
                <Link href="/sobre">
                  <Button variant="ghost" size="md">
                    Ver história completa →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Bloco 5 · Depoimentos */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <Divider tone="light" className="mb-16" />

          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            O que dizem nossos clientes
          </p>
          <h2 className="mb-12 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Quase quarenta anos de indicações. Não por acaso.
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            <TestimonialCard
              tone="dark"
              quote="Nina, gostaria de agradecer imensamente pelo excelente trabalho e dedicação durante toda a organização da nossa viagem. Sua atenção aos detalhes, profissionalismo e cuidado tornaram tudo muito mais fácil e prazeroso. Foi um prazer contar com seu apoio. Até a próxima viagem. Muito obrigada!"
              author="Heloisa & Luiz Sérgio"
            />
            <TestimonialCard
              tone="dark"
              quote="Já estou no meu portão de embarque pra voltar. Foi tudo maravilhoso, curtimos e aproveitamos demais! Obrigada por todo planejamento e auxílio de sempre, você é top demais! Ansiosa pra próxima, tá?"
              author="Karoline Soares e Daniel Famula"
            />
            <TestimonialCard
              tone="dark"
              quote="Passando pra agradecer por todo suporte e atenção que a Spinhardi Turismo nos deu pra realizarmos essa viagem incrível, superou todas as nossas expectativas, foi a realização de um sonho. Obrigada por todo carinho e atenção, já estamos ansiosos pra próxima viagem e com toda certeza será com vocês novamente."
              author="Vanessa e Matheus"
            />
          </div>
        </Container>
      </Section>

      {/* Bloco 6 · CTA Final */}
      <Section spacing="lg" className="bg-navy text-white">
        <Container>
          <Divider tone="light" className="mb-16" />

          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
              Pronto para planejar?
            </p>
            <h2 className="mb-6 font-display text-4xl leading-tight md:text-5xl lg:text-6xl">
              Quando quiser começar, a gente está aqui.
            </h2>
            <p className="mb-12 font-body text-lg leading-relaxed text-white/80">
              Sem compromisso. Sem pressão. Conte o que você quer viver e a gente pensa juntos.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <CTAWhatsApp variant="primary" size="lg" label="Vamos conversar" />
              <Link href="/blog">
                <Button variant="ghost" size="lg" className="text-white hover:text-gold">
                  Nosso blog
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
