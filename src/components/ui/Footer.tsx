import Link from "next/link";
import Container from "@/components/ui/Container";
import Logo from "@/components/ui/Logo";
import Divider from "@/components/ui/Divider";
import { FOOTER_PAGE_LINKS, FOOTER_SERVICE_LINKS } from "@/lib/navigation";
import { buildWhatsAppURL } from "@/lib/whatsapp/constants";

const INSTAGRAM_URL = "https://instagram.com/spinharditurismo";

/** Texto da coluna de marca (copy aprovado — mapa de copies). */
const BRAND_TEXT =
  "SPINHARDI · Turismo · Quase quarenta anos cuidando de quem viaja. Atendimento próximo, " +
  "roteiros pensados nos detalhes, alguém real do outro lado. Antes, durante e depois de cada viagem.";

/** Título de coluna: Montserrat uppercase pequeno em gold. */
function ColumnTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-4 font-body text-xs font-medium uppercase tracking-widest text-gold">
      {children}
    </h2>
  );
}

/** Estilo compartilhado dos links/itens das colunas. */
const linkClass =
  "font-body text-sm text-white/70 transition-colors duration-short hover:text-white";

/**
 * Footer
 *
 * Rodapé global em 4 colunas (Marca · Páginas · Serviços · Contato) + barra de
 * copyright. Fundo navy sólido, texto branco com opacidade.
 *
 * Server Component: conteúdo estático, sem estado nem interatividade.
 */
export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      <Container>
        <div className="grid grid-cols-1 gap-8 py-16 md:grid-cols-2 lg:grid-cols-4 lg:gap-12 lg:py-20">
          {/* Coluna 1 — Marca */}
          <div>
            <Logo variant="clara" width={170} height={57} />
            <p className="mt-6 max-w-xs font-body text-sm leading-relaxed text-white/70">
              {BRAND_TEXT}
            </p>
          </div>

          {/* Coluna 2 — Páginas */}
          <div>
            <ColumnTitle>Páginas</ColumnTitle>
            <ul className="list-none space-y-3">
              {FOOTER_PAGE_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3 — Serviços */}
          <div>
            <ColumnTitle>Serviços</ColumnTitle>
            <ul className="list-none space-y-3">
              {FOOTER_SERVICE_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4 — Contato */}
          <div>
            <ColumnTitle>Contato</ColumnTitle>
            <ul className="list-none space-y-3">
              <li>
                <a
                  href={buildWhatsAppURL()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Instagram
                </a>
              </li>
              <li className="font-body text-sm text-white/70">Serra Negra, SP</li>
            </ul>
          </div>
        </div>

        {/* Rodapé inferior */}
        <Divider tone="light" />
        <div className="py-8">
          <p className="text-center font-body text-xs text-white/50 md:text-left">
            © 2026 Spinhardi Turismo · Todos os direitos reservados ·{" "}
            <Link
              href="/politica-de-privacidade"
              className="transition-colors duration-short hover:text-white/80"
            >
              Política de privacidade
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
