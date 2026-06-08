"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Logo from "@/components/ui/Logo";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import MobileMenu from "@/components/ui/MobileMenu";
import { NAV_LINKS } from "@/lib/navigation";

/**
 * Rotas que renderizam em fundo claro/branco — o Header começa já sólido nelas.
 * Quando criarmos páginas internas (Sobre, Viagens, Blog, Contato) que tenham
 * fundo claro, adicionar aqui. Páginas com hero navy NÃO entram nesta lista.
 */
const LIGHT_ROUTES = ["/dev/components", "/sobre", "/viagens", "/contato", "/blog"];

/** Scroll (px) a partir do qual o Header ganha fundo sólido. */
const SCROLL_THRESHOLD = 80;

/**
 * Header
 *
 * Barra de navegação fixa no topo, sempre acima do conteúdo (z-50).
 * - Rotas com hero navy: fundo transparente no topo → navy sólido + sombra
 *   após ~80px de scroll, com transição suave.
 * - Rotas claras (ver `LIGHT_ROUTES`): já começa navy sólido desde o pixel 0,
 *   sem passar pela fase transparente (detecção via `usePathname`).
 *
 * Em desktop (lg+) mostra a navegação completa + CTA; abaixo de lg mostra o
 * botão hamburger que abre o MobileMenu.
 *
 * "use client" JUSTIFICADO: depende de `window.scrollY` e de estado React
 * (scroll dinâmico + abertura do menu mobile). Scroll é estado do navegador,
 * impossível em Server Component. `usePathname` também só roda em Client.
 */
export default function Header() {
  const pathname = usePathname();
  const isLightRoute = LIGHT_ROUTES.some((route) => pathname.startsWith(route));
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Em rota clara o Header já está sólido — não precisa escutar scroll.
    if (isLightRoute) return;

    const handleScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // executa uma vez no mount pra capturar o estado inicial
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLightRoute]);

  // Sólido se a rota é clara OU se rolou além do threshold em rota navy.
  const isSolid = isLightRoute || scrolled;

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 h-20 transition-all duration-medium ease-smooth ${
        isSolid ? "bg-navy shadow-lg shadow-dark/20" : "bg-transparent"
      }`}
    >
      <Container className="flex h-full items-center justify-between">
        {/* Logo → Home */}
        <Link href="/" aria-label="Spinhardi Turismo — página inicial">
          <Logo variant="clara" width={150} height={50} priority />
        </Link>

        {/* Navegação desktop (lg+) */}
        <nav aria-label="Navegação principal" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-body text-xs uppercase tracking-widest text-white transition-colors duration-short hover:text-gold"
            >
              {label}
            </Link>
          ))}
          <CTAWhatsApp variant="secondary" size="sm" label="Fale com a gente" />
        </nav>

        {/* Botão hamburger (< lg) */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors duration-short hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:hidden"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </Container>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
