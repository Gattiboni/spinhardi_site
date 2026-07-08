"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * HomeHeroBackdrop
 *
 * Camada de fundo do hero da Home. É Client Component por causa do parallax,
 * que depende de `window.scrollY` — estado do navegador, impossível no server.
 *
 * A fronteira "use client" é MÍNIMA de propósito: só a foto + os overlays vivem
 * aqui. O título, o parágrafo e os CTAs do hero continuam no Server Component
 * (page.tsx), renderizados no servidor sem hidratação extra.
 *
 * --- TRÊS CAMADAS (de trás pra frente), TODAS atrás da copy ---
 *  1. Foto com parallax  — ÚNICA camada que se move (translate3d no wrapper).
 *  2. Overlay navy/60    — legibilidade da copy branca. Estática.
 *  3. Fade para navy     — funde o rodapé do hero na seção navy abaixo. Estática.
 * A copy fica ACIMA de tudo isso (fora deste componente) e nunca se move.
 *
 * --- GEOMETRIA DO PARALLAX (números aprovados no mockup) ---
 *  - O wrapper da imagem tem 132% da altura do hero, deslocado `top: -32%`.
 *    No repouso, isso ancora o recorte visível no RODAPÉ da foto e "reserva"
 *    os 32% do topo escondidos acima do corte.
 *  - No scroll: translateY = min(scrollY * 0.45, alturaHero * 0.32). O teto de
 *    0.32 × altura garante que o topo do wrapper nunca desça abaixo do topo do
 *    hero — ou seja, nunca aparece faixa vazia no rodapé no deslocamento máximo.
 *  - translate3d + will-change + requestAnimationFrame (com flag `ticking`) +
 *    listener passivo. Nenhuma propriedade que dispare layout/reflow.
 *  - prefers-reduced-motion: nenhuma transformação, foto 100% estática.
 */
export default function HomeHeroBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respeita prefers-reduced-motion: sem transform, foto fica estática.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = rootRef.current;
    const image = imageRef.current;
    if (!root || !image) return;

    let ticking = false;

    const update = () => {
      ticking = false;
      const heroHeight = root.offsetHeight;
      const translateY = Math.min(window.scrollY * 0.45, heroHeight * 0.32);
      image.style.transform = `translate3d(0, ${translateY}px, 0)`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // posição inicial (reload no meio da página já entra deslocado)

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Camada 1 — foto com parallax (ÚNICA camada que se move) */}
      <div
        ref={imageRef}
        className="absolute inset-x-0"
        style={{ top: "-32%", height: "132%", willChange: "transform" }}
      >
        <Image
          src="/hero-principal-01.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
      </div>

      {/* Camada 2 — overlay navy p/ legibilidade da copy branca (estática) */}
      <div className="absolute inset-0 bg-navy/60" />

      {/* Camada 3 — fade p/ navy no rodapé; funde na seção navy abaixo (estática) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(26,43,74,0) 0%, rgba(26,43,74,0.35) 55%, rgba(26,43,74,0.85) 85%, #1A2B4A 100%)",
        }}
      />
    </div>
  );
}
