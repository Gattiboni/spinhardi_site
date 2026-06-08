"use client";

import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 600;

/**
 * Botão flutuante "Voltar ao topo".
 *
 * Aparece após o usuário rolar mais de 600px da página. Posicionado
 * no canto inferior direito. Scroll suave ao topo ao clicar.
 *
 * Self-contained: gerencia próprio scroll listener e estado de visibilidade.
 * Não depende de contexto externo. Adicionado ao layout global pra aparecer
 * em todas as páginas (públicas e admin).
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // captura estado inicial
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Voltar ao topo"
      className={`fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-gold shadow-lg shadow-dark/30 transition-all duration-medium ease-smooth hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 lg:bottom-8 lg:right-8 ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
