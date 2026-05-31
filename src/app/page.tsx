import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function Home() {
  return (
    <main className="min-h-screen bg-navy text-white">
      <Section spacing="lg">
        <Container>
          <p className="text-gold uppercase tracking-widest text-sm mb-4 font-body">
            Spinhardi Turismo
          </p>
          <h1 className="font-display text-6xl md:text-7xl mb-6 leading-tight">
            Cada viagem, uma vez.
            <br />
            Feita para você.
          </h1>
          <p className="font-body text-lg text-white/80 max-w-xl mb-12">
            Agência boutique em Serra Negra desde 1987. Curadoria personalizada para quem viaja de
            verdade.
          </p>

          <div className="border-t border-white/10 pt-12 mt-20">
            <p className="text-gold uppercase tracking-widest text-xs mb-4 font-body">
              Validação de tokens · Fase 1.2
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="aspect-square bg-navy border border-white/20 flex items-end p-2">
                <span className="text-xs font-body">navy</span>
              </div>
              <div className="aspect-square bg-gold flex items-end p-2">
                <span className="text-xs font-body text-dark">gold</span>
              </div>
              <div className="aspect-square bg-green flex items-end p-2">
                <span className="text-xs font-body text-dark">green</span>
              </div>
              <div className="aspect-square bg-dark flex items-end p-2">
                <span className="text-xs font-body text-white">dark</span>
              </div>
              <div className="aspect-square bg-white flex items-end p-2">
                <span className="text-xs font-body text-dark">white</span>
              </div>
            </div>
            <p className="font-display text-2xl mb-2">Fraunces (display) · este é o título</p>
            <p className="font-body text-base">
              Montserrat (body) · este é o corpo de texto regular usado em parágrafos comuns do
              site.
            </p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
