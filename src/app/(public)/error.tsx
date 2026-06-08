"use client";

import { useEffect } from "react";
import Link from "next/link";
import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro — em produção vai pra serviço de monitoramento (Sentry, etc).
    // Por enquanto, console.
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <Section
      spacing="lg"
      className="bg-navy text-white min-h-[70vh] flex items-center pt-32 lg:pt-40"
    >
      <Container>
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-white mb-6 leading-tight">
            Algo deu errado.
          </h1>
          <p className="font-body text-lg text-white/80 mb-12 leading-relaxed">
            Aconteceu um erro inesperado da nossa parte. A gente já foi notificado. Enquanto isso,
            você pode tentar de novo ou voltar pra Home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => reset()} variant="primary" size="lg">
              Tentar de novo
            </Button>
            <Link href="/">
              <Button variant="secondary" size="lg">
                Voltar pra Home
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
