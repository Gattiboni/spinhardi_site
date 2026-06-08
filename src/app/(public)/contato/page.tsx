import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ContactForm from "@/components/ui/ContactForm";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Vamos conversar. Sem compromisso. Sem pressão. Me conte o que você tem em mente e a gente pensa juntos.",
};

const CONTATOS = [
  {
    label: "WhatsApp",
    principal: "+55 19 99776-1226",
    secundaria: "Atendimento próximo, resposta no mesmo dia.",
    href: "https://wa.me/5519997761226",
    external: true,
  },
  {
    label: "Instagram",
    principal: "@spinharditurismo",
    secundaria: "Bastidores, destinos e novidades.",
    href: "https://instagram.com/spinharditurismo",
    external: true,
  },
  {
    label: "Localização",
    principal: "Serra Negra, SP",
    secundaria: "Atendimento em todo o Brasil, presencial em Serra Negra.",
    href: null,
    external: false,
  },
  {
    label: "Horário",
    principal: "Segunda a sábado · 9h às 19h",
    secundaria: null,
    href: null,
    external: false,
  },
];

export default function Contato() {
  return (
    <>
      {/* Bloco 1 - Cabeçalho */}
      <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
        <Container>
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: "Contato" }]}
            className="mb-6"
          />
          <p className="text-gold uppercase tracking-widest text-sm font-body mb-4">Contato</p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-navy leading-tight mb-6 max-w-4xl">
            Vamos conversar
          </h1>
          <p className="font-body text-lg lg:text-xl text-dark/80 max-w-2xl leading-relaxed">
            Sem compromisso. Sem pressão. Me conte o que você tem em mente e a gente pensa juntos.
          </p>
        </Container>
      </Section>

      {/* Bloco 2 - Grid 2 colunas */}
      <Section spacing="lg" className="bg-white text-dark">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Coluna esquerda: lista de contatos */}
            <div className="lg:col-span-5">
              <p className="text-gold uppercase tracking-widest text-sm font-body mb-8">
                Como falar com a gente
              </p>

              <div className="space-y-10">
                {CONTATOS.map((contato) => (
                  <div key={contato.label}>
                    <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">
                      {contato.label}
                    </p>
                    {contato.href ? (
                      <Link
                        href={contato.href}
                        target={contato.external ? "_blank" : undefined}
                        rel={contato.external ? "noopener noreferrer" : undefined}
                        className="font-display text-2xl text-navy hover:text-gold transition-colors duration-short block mb-2"
                      >
                        {contato.principal}
                      </Link>
                    ) : (
                      <p className="font-display text-2xl text-navy mb-2">{contato.principal}</p>
                    )}
                    {contato.secundaria && (
                      <p className="font-body text-sm text-dark/70 leading-relaxed">
                        {contato.secundaria}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita: formulário */}
            <div className="lg:col-span-7">
              <p className="text-gold uppercase tracking-widest text-sm font-body mb-8">
                Conte sobre sua viagem
              </p>
              <ContactForm />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
