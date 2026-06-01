import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Divider from "@/components/ui/Divider";
import Button from "@/components/ui/Button";
import ServiceCard from "@/components/ui/ServiceCard";
import TestimonialCard from "@/components/ui/TestimonialCard";
import BlogCard from "@/components/ui/BlogCard";
import Logo from "@/components/ui/Logo";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";

/**
 * Página privada de validação visual do design system.
 * Rota: /dev/components — referência interna, não é página de produto.
 *
 * As bordas dashed coloridas existem APENAS aqui, como auxílio visual para
 * enxergar os limites de cada componente. Não fazem parte dos componentes.
 */

const containerExample = `<Container as="section">
  <h2>Conteúdo</h2>
</Container>`;

const sectionExample = `<Section spacing="lg">
  <Container>
    <h2>Título</h2>
  </Container>
</Section>`;

const dividerExample = `<Divider tone="light" />
<Divider tone="dark" className="my-8" />`;

const buttonExample = `<Button variant="primary" size="md">Fale com a gente</Button>
<Button variant="secondary">Ver viagens</Button>
<Button variant="ghost">Saiba mais</Button>
<Button disabled>Indisponível</Button>`;

const serviceCardExample = `<ServiceCard
  number="01"
  title="Itália sob medida"
  description="Roteiros desenhados nota a nota."
  href="/viagens/sob-medida"
/>`;

const testimonialCardExample = `<TestimonialCard
  quote="Spinhardi não vendeu uma viagem..."
  author="Maria Helena"
  context="Cliente Itália · Mar/2026"
/>`;

const blogCardExample = `<BlogCard
  slug="curadoria-de-roteiros"
  title="O que é, de fato, uma viagem sob medida"
  category="Bastidores"
  date="12 Jan 2026"
  excerpt="Por que cada roteiro começa de uma página em branco."
  thumbnail=""
/>`;

const logoExample = `<Logo variant="clara" />          {/* sobre fundo navy */}
<Logo variant="escura" priority />  {/* sobre fundo branco — default */}
<Logo variant="icone" />            {/* favicon / contextos compactos */}
<Logo variant="escura" width={360} height={120} />  {/* custom maior */}`;

const ctaWhatsAppExample = `<CTAWhatsApp />                                  {/* "Vamos conversar" */}
<CTAWhatsApp variant="secondary" size="lg" />
<CTAWhatsApp variant="ghost" label="Fale com a gente" />
<CTAWhatsApp
  label="Quero meu roteiro"
  message="Oi! Quero montar um roteiro sob medida pela Itália."
/>`;

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-6 overflow-x-auto rounded bg-dark px-4 py-3 text-sm leading-relaxed text-white/90">
      <code className="font-mono">{code}</code>
    </pre>
  );
}

function BlockHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <h2 className="font-display text-3xl text-dark">{title}</h2>
      <p className="mt-1 font-body text-sm text-dark/60">{description}</p>
    </header>
  );
}

/** Rótulo curto abaixo de um exemplo isolado, só para esta página de validação. */
function DemoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {children}
      <span className="font-mono text-xs text-dark/50">{label}</span>
    </div>
  );
}

export default function DevComponentsPage() {
  return (
    <main className="min-h-screen bg-white text-dark">
      {/* Cabeçalho da página */}
      <Section spacing="md">
        <Container>
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">
            Validação de componentes · Design System
          </p>
          <h1 className="font-display text-5xl text-dark md:text-6xl">Design System Spinhardi</h1>
          <p className="mt-4 max-w-xl font-body text-base text-dark/70">
            Inspeção visual dos componentes atômicos. As bordas tracejadas marcam os limites de cada
            componente — são apenas auxílio desta página, não fazem parte dos componentes.
          </p>
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 1. Container */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="1. Container"
            description="Limita a largura máxima (max-w-7xl) e aplica padding horizontal responsivo (px-4 → lg:px-12), centralizando o conteúdo."
          />
        </Container>
        {/* Demo: o Container abaixo recebe uma borda tracejada só para visualização. */}
        <Container className="border-2 border-dashed border-navy/40 py-6">
          <div className="rounded bg-navy/5 p-4 font-body text-sm text-dark/70">
            Este conteúdo está dentro de um <strong>Container</strong>. A borda tracejada é o limite
            do componente; repare no padding horizontal interno e na largura máxima centralizada.
          </div>
        </Container>
        <Container>
          <CodeBlock code={containerExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 2. Section */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="2. Section (sm · md · lg)"
            description="Aplica espaçamento vertical padronizado. sm = py-12, md = py-20, lg = py-32. Não aplica padding horizontal."
          />

          <div className="space-y-4">
            {(
              [
                { spacing: "sm", label: 'spacing="sm" · py-12 (~48px)' },
                { spacing: "md", label: 'spacing="md" · py-20 (~80px) · padrão' },
                { spacing: "lg", label: 'spacing="lg" · py-32 (~128px)' },
              ] as const
            ).map(({ spacing, label }) => (
              <Section
                key={spacing}
                spacing={spacing}
                className="border-2 border-dashed border-gold/60 bg-gold/5 text-center"
              >
                <span className="font-body text-sm text-dark/70">{label}</span>
              </Section>
            ))}
          </div>

          <CodeBlock code={sectionExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 3. Divider */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="3. Divider (light · dark)"
            description="Linha divisória sutil. tone=light para fundo escuro (border-white/10), tone=dark para fundo claro (border-dark/10)."
          />

          {/* tone="light" sobre fundo escuro */}
          <div className="rounded border-2 border-dashed border-green/50 bg-navy p-8">
            <p className="mb-4 font-body text-sm text-white/70">
              tone=&quot;light&quot; sobre fundo navy
            </p>
            <Divider tone="light" />
            <p className="mt-4 font-body text-sm text-white/70">conteúdo abaixo da linha</p>
          </div>

          {/* tone="dark" sobre fundo claro */}
          <div className="mt-6 rounded border-2 border-dashed border-green/50 bg-white p-8">
            <p className="mb-4 font-body text-sm text-dark/70">
              tone=&quot;dark&quot; sobre fundo branco
            </p>
            <Divider tone="dark" />
            <p className="mt-4 font-body text-sm text-dark/70">conteúdo abaixo da linha</p>
          </div>

          <CodeBlock code={dividerExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 4. Button */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="4. Button (primary · secondary · ghost)"
            description="3 variantes, 3 tamanhos e estado disabled. Hover, active e focus-visible são CSS. Interaja para validar (Tab para focar, hover para a cor)."
          />

          <div className="space-y-8 border-2 border-dashed border-navy/40 p-6">
            {/* Variantes */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Variantes (size md)
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label='variant="primary"'>
                  <Button variant="primary">Fale com a gente</Button>
                </DemoItem>
                <DemoItem label='variant="secondary"'>
                  <Button variant="secondary">Ver viagens</Button>
                </DemoItem>
                <DemoItem label='variant="ghost"'>
                  <Button variant="ghost">Saiba mais</Button>
                </DemoItem>
              </div>
            </div>

            {/* Tamanhos */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Tamanhos (variant primary)
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label='size="sm"'>
                  <Button size="sm">Botão sm</Button>
                </DemoItem>
                <DemoItem label='size="md"'>
                  <Button size="md">Botão md</Button>
                </DemoItem>
                <DemoItem label='size="lg"'>
                  <Button size="lg">Botão lg</Button>
                </DemoItem>
              </div>
            </div>

            {/* Disabled */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Estado disabled
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label="primary · disabled">
                  <Button variant="primary" disabled>
                    Indisponível
                  </Button>
                </DemoItem>
                <DemoItem label="secondary · disabled">
                  <Button variant="secondary" disabled>
                    Indisponível
                  </Button>
                </DemoItem>
              </div>
            </div>
          </div>

          <CodeBlock code={buttonExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 5. ServiceCard */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="5. ServiceCard"
            description="Item de lista numerada de viagens (seção 4 das referências). Empilhados formam a grade de serviços. Hover satura o número e leva o título para gold."
          />

          <div className="border-2 border-dashed border-navy/40 px-6">
            <ServiceCard
              number="01"
              title="Itália sob medida"
              description="Roteiros desenhados nota a nota, do norte ao sul."
              href="#"
            />
            <ServiceCard
              number="02"
              title="Pacotes e roteiros"
              description="Seleção curada de experiências prontas para partir."
              href="#"
            />
            <ServiceCard number="03" title="Viagem sob medida" href="#" />
          </div>

          <CodeBlock code={serviceCardExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 6. TestimonialCard */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="6. TestimonialCard"
            description="Depoimento em <blockquote>, border-left gold, aspas decorativas e quote em Fraunces italic. O fundo escuro abaixo é só para destacar o card branco."
          />

          {/* Fundo de apoio só para destacar o bg-white do card nesta página. */}
          <div className="rounded border-2 border-dashed border-navy/40 bg-dark/5 p-8">
            <TestimonialCard
              quote="Spinhardi não vendeu uma viagem. Eles desenharam um momento que ainda hoje, três anos depois, eu lembro com saudade."
              author="Maria Helena"
              context="Cliente Itália · Mar/2026"
              className="max-w-2xl"
            />
          </div>

          <CodeBlock code={testimonialCardExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 7. BlogCard */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="7. BlogCard"
            description="Card de listagem do blog (seção 6 das referências). Grid de 3 colunas no desktop, 1 no mobile. Sem imagem real ainda — placeholders bg-dark/10 com hover scale."
          />

          <div className="border-2 border-dashed border-navy/40 p-6">
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3">
              <BlogCard
                slug="curadoria-de-roteiros"
                title="O que é, de fato, uma viagem sob medida"
                category="Bastidores"
                date="12 Jan 2026"
                excerpt="Por que cada roteiro Spinhardi começa de uma página em branco, e não de um catálogo."
                thumbnail=""
              />
              <BlogCard
                slug="cinco-cidades-italianas"
                title="Cinco cidades italianas fora do óbvio"
                category="Destinos"
                date="28 Fev 2026"
                excerpt="Para além de Roma e Veneza: lugares que cabem melhor em uma viagem sem pressa."
                thumbnail=""
              />
              <BlogCard
                slug="historia-spinhardi"
                title="1987: como tudo começou em Serra Negra"
                category="Bastidores"
                date="15 Mar 2026"
                excerpt="A história de uma agência boutique que cresceu por indicação, uma viagem de cada vez."
                thumbnail=""
              />
            </div>
          </div>

          <CodeBlock code={blogCardExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 8. Logo */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="8. Logo (clara · escura · icone)"
            description="3 variantes via next/image. clara para fundo navy, escura para fundo branco (default), icone para contextos compactos. Dívida conhecida: os SVGs atuais embutem PNG (export raster), então ampliar demais pixeliza — trocar por SVG vetorial não exige mudar o componente."
          />

          <div className="space-y-6 border-2 border-dashed border-navy/40 p-6">
            {/* clara sobre navy */}
            <DemoItem label='variant="clara" · sobre bg-navy'>
              <div className="flex items-center justify-center rounded bg-navy p-12">
                <Logo variant="clara" />
              </div>
            </DemoItem>

            {/* escura sobre branco */}
            <DemoItem label='variant="escura" · sobre fundo branco · default'>
              <div className="flex items-center justify-center rounded border-2 border-dashed border-navy/50 bg-white p-12">
                <Logo variant="escura" />
              </div>
            </DemoItem>

            {/* icone sobre neutro */}
            <DemoItem label='variant="icone" · sobre fundo neutro'>
              <div className="flex items-center justify-center rounded bg-dark/5 p-12">
                <Logo variant="icone" />
              </div>
            </DemoItem>

            {/* escala custom maior */}
            <DemoItem label='variant="escura" · width={360} height={120} · valida escala'>
              <div className="flex items-center justify-center rounded border-2 border-dashed border-navy/50 bg-white p-12">
                <Logo variant="escura" width={360} height={120} />
              </div>
            </DemoItem>
          </div>

          <CodeBlock code={logoExample} />
        </Container>
      </Section>

      <Container>
        <Divider tone="dark" />
      </Container>

      {/* 9. CTAWhatsApp */}
      <Section spacing="md">
        <Container>
          <BlockHeader
            title="9. CTAWhatsApp (primary · secondary · ghost)"
            description="Link <a> que abre a conversa no WhatsApp da Spinhardi (wa.me, nova aba). Reaproveita o estilo do Button via buttonStyles(). Nesta página o clique está desabilitado (pointer-events-none) para não abrir o WhatsApp acidentalmente — em produção, clicar abre a conversa."
          />

          {/* pointer-events-none impede a abertura acidental do WhatsApp nesta página de validação. */}
          <div className="pointer-events-none space-y-8 border-2 border-dashed border-navy/40 p-6">
            <p className="font-body text-xs uppercase tracking-widest text-green">
              🔒 Demonstração visual — clique desabilitado aqui · em produção abre o WhatsApp
            </p>

            {/* Variantes */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Variantes (size md)
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label='variant="primary"'>
                  <CTAWhatsApp variant="primary" />
                </DemoItem>
                <DemoItem label='variant="secondary"'>
                  <CTAWhatsApp variant="secondary" />
                </DemoItem>
                <DemoItem label='variant="ghost"'>
                  <CTAWhatsApp variant="ghost" />
                </DemoItem>
              </div>
            </div>

            {/* Tamanhos */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Tamanhos (variant primary)
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label='size="sm"'>
                  <CTAWhatsApp size="sm" />
                </DemoItem>
                <DemoItem label='size="md"'>
                  <CTAWhatsApp size="md" />
                </DemoItem>
                <DemoItem label='size="lg"'>
                  <CTAWhatsApp size="lg" />
                </DemoItem>
              </div>
            </div>

            {/* Label + message custom */}
            <div>
              <p className="mb-3 font-body text-xs uppercase tracking-widest text-dark/50">
                Label e message customizados
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <DemoItem label="label + message custom">
                  <CTAWhatsApp
                    label="Quero meu roteiro"
                    message="Oi! Quero montar um roteiro sob medida pela Itália."
                  />
                </DemoItem>
              </div>
            </div>
          </div>

          <CodeBlock code={ctaWhatsAppExample} />
        </Container>
      </Section>
    </main>
  );
}
