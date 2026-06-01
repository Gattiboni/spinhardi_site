"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Logo from "@/components/ui/Logo";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import { NAV_LINKS } from "@/lib/navigation";

type MobileMenuProps = {
  /** Estado do overlay, controlado pelo Header. */
  isOpen: boolean;
  /** Callback para fechar (botão X, Escape, clique em link). */
  onClose: () => void;
};

/**
 * MobileMenu
 *
 * Overlay full-screen de navegação para viewports < lg. O estado de abertura é
 * controlado pelo Header (props `isOpen`/`onClose`), mantendo uma única fonte de
 * verdade para o menu.
 *
 * "use client" JUSTIFICADO: side-effects de navegador (trava de scroll do body,
 * listener de teclado para Escape, foco gerenciado e focus-trap com Tab) que só
 * existem no cliente.
 *
 * Permanece montado sempre: quando fechado fica `opacity-0 pointer-events-none`
 * e `inert` (fora da ordem de tabulação e da árvore de acessibilidade), o que
 * permite a transição de fade/slide tanto na entrada quanto na saída. Quando
 * aberto, um focus-trap mantém o Tab circulando apenas pelos elementos do menu.
 */
export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Trava o scroll do conteúdo atrás do overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foca o botão de fechar ao abrir (ponto de entrada do focus-trap).
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = overlayRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup: restaura o scroll do body e remove o listener ao fechar/desmontar.
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={overlayRef}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegação"
      inert={!isOpen}
      className={`fixed inset-0 z-60 bg-navy transition-all duration-short ease-out lg:hidden ${
        isOpen ? "opacity-100 translate-y-0" : "pointer-events-none -translate-y-4 opacity-0"
      }`}
    >
      <Container className="flex h-full flex-col">
        {/* Topo: logo + botão fechar */}
        <div className="flex h-20 items-center justify-between">
          <Logo variant="clara" width={150} height={50} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors duration-short hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Centro: links empilhados, tipografia grande */}
        <nav
          aria-label="Navegação principal (mobile)"
          className="flex flex-1 flex-col items-start justify-center gap-8"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="font-display text-4xl text-white transition-colors duration-short hover:text-gold"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Fim: CTA WhatsApp */}
        <div className="pb-12">
          <CTAWhatsApp variant="secondary" label="Fale com a gente" />
        </div>
      </Container>
    </div>
  );
}
