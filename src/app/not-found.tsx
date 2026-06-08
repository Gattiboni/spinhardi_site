import Link from "next/link";
import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";

export default function NotFound() {
  return (
    <Section
      spacing="lg"
      className="bg-navy text-white min-h-[70vh] flex items-center pt-32 lg:pt-40"
    >
      <Container>
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-display text-8xl lg:text-9xl text-gold leading-none mb-6">404</p>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-white mb-6 leading-tight">
            Página não encontrada
          </h1>
          <p className="font-body text-lg text-white/80 mb-12 leading-relaxed">
            A página que você procurou não existe ou pode ter sido movida.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button variant="primary" size="lg">
                Voltar pra Home
              </Button>
            </Link>
            <CTAWhatsApp variant="secondary" size="lg" label="Falar com a gente" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
