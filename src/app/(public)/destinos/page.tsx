import type { Metadata } from "next";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DestinoCard from "@/components/ui/DestinoCard";
import { DESTINOS, DESTINOS_SECAO_APOIO, DESTINOS_SECAO_TITULO } from "@/content/destinos";

export const metadata: Metadata = {
  title: "Destinos", // vira "Destinos | Spinhardi Turismo"
  description: DESTINOS_SECAO_APOIO,
  alternates: { canonical: "/destinos" },
};

/**
 * Índice `/destinos`
 *
 * Página utilitária: existe pra URL não dar 404 e pra listar os 4 cards. A
 * entrada "oficial" pros destinos é a seção da home; este índice NÃO está no
 * Header, no MobileMenu nem no Footer (decisão do lote). Cabeçalho no padrão
 * das internas do site (bloco branco, breadcrumb, eyebrow, H1) e o MESMO grid
 * de cards da home, em tom claro.
 */
export default function Destinos() {
  return (
    <>
      {/* Bloco 1 · Cabeçalho da página */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: "Destinos" }]}
            className="mb-6"
          />
          <p className="mb-4 font-body text-sm uppercase tracking-widest text-gold">Destinos</p>
          <h1 className="mb-6 max-w-4xl font-display text-5xl leading-tight text-navy md:text-6xl lg:text-7xl">
            {DESTINOS_SECAO_TITULO}
          </h1>
          <p className="max-w-2xl font-body text-lg leading-relaxed text-dark/80 lg:text-xl">
            {DESTINOS_SECAO_APOIO}
          </p>
        </Container>
      </Section>

      {/* Bloco 2 · Grid de cards (mesmo grid da home) */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {DESTINOS.map((destino) => (
              <DestinoCard key={destino.slug} destino={destino} tone="light" />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
