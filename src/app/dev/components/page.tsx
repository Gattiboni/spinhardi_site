import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import Divider from "@/components/ui/Divider";

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
    </main>
  );
}
