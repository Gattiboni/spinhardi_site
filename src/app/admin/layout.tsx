import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

/**
 * Layout admin mínimo (Fase 1.4).
 *
 * Sem autenticação ainda — o middleware de proteção de `/admin/*` vem na
 * Fase 1.7, junto de um layout completo (com sidebar). Por enquanto as rotas
 * ficam acessíveis publicamente em dev: dívida temporária explícita.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Section spacing="md" className="bg-dark/5 text-dark min-h-screen pt-32 lg:pt-40">
      <Container>
        <div className="mb-8">
          <p className="text-gold uppercase tracking-widest text-sm font-body mb-2">
            Painel administrativo
          </p>
          <p className="font-body text-sm text-dark/60">
            Sessão sem autenticação por enquanto. Login virá na Fase 1.7.
          </p>
        </div>
        {children}
      </Container>
    </Section>
  );
}
