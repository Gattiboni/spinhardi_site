"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpinhardiImage } from "@/components/ui/SpinhardiImage";
import FotoLightbox from "@/components/ui/FotoLightbox";
// `import type`: o tipo some na compilação, então o array DESTINOS inteiro NÃO
// entra no bundle do cliente por causa deste import.
import type { DestinoFoto } from "@/content/destinos";

/** Tom conforme o fundo do card. Mesma convenção do DestinoCard. */
type Tone = "light" | "dark";

type DestinoFotoCarrosselProps = {
  /** Fotos do destino, na ordem de exibição. Lista vazia => componente some. */
  fotos: DestinoFoto[];
  /** Nome do destino, pro `aria-label` dos slides e do dialog. Ex.: "Portugal". */
  destinoNome: string;
  /** Tom do card que o contém. Default: "light". */
  tone?: Tone;
};

/**
 * DestinoFotoCarrossel
 *
 * Imagem de topo do card de destino: carrossel cíclico das fotos, com setas,
 * pontos e arrasto. Clicar na foto abre o `FotoLightbox` (o mesmo da página
 * interna) naquela foto.
 *
 * "use client" JUSTIFICADO: scroll programático, `IntersectionObserver` e
 * estado do slide atual são coisas de navegador.
 *
 * --- POR QUE SCROLL-SNAP E NÃO UM CARROSSEL DE VERDADE ---
 * O container é um scroller horizontal com `scroll-snap-type: x mandatory` e um
 * slide por página. O arrasto no touch e o gesto de duas dedos no trackpad vêm
 * DE GRAÇA do scroll nativo, com a física certa de cada plataforma — nenhuma
 * lib de gesto, nenhum `transform` animado à mão, nada de `touchstart`. As
 * setas e os pontos só empurram o mesmo scroller. A barra de rolagem some com
 * o `scrollbar-none` do Tailwind MAIS `[&::-webkit-scrollbar]:hidden`: o
 * utilitário canônico só emite `scrollbar-width: none` (conferido no CSS do
 * build), que o Safari anterior ao 18.2 não entende. Nada disso toca o
 * `globals.css`.
 *
 * --- POR QUE IntersectionObserver E NÃO scrollLeft ---
 * Ler `scrollLeft` e dividir pela largura erra durante o scroll suave e no
 * "borracha" do iOS, e obriga a ouvir `scroll` (evento de alta frequência). O
 * observer com `threshold: 0.6` sobre os slides responde uma vez por troca, já
 * depois do snap assentar, e é o que mantém os pontos honestos.
 *
 * --- POR QUE scrollTo E NÃO scrollBy NAS SETAS ---
 * O contrato pedia `scrollBy(±largura)`, mas a navegação é CIRCULAR e um
 * deslocamento relativo não dá a volta: da última pra primeira o salto é de
 * -2 larguras, não +1. Calcula-se o índice alvo com módulo e vai-se direto nele
 * com `scrollTo`, que é o mesmo movimento suave e acerta os dois casos.
 *
 * --- DECISÕES LOCAIS (ambiguidade do lote, escolha simples e documentada) ---
 * - Setas: círculo de 36px, `bg-navy/70`, chevron SVG inline branco (não há lib
 *   de ícone no repo e o lote proíbe adicionar uma). Iguais nos dois tons: o
 *   navy translúcido sobre a foto tem contraste suficiente em qualquer card, e
 *   um tom por `tone` só daria duas aparências pro mesmo botão.
 * - Visibilidade das setas: em ponteiro fino somem e aparecem no hover do card
 *   (`@media (hover: hover)` + `group-hover`); em touch ficam sempre visíveis,
 *   que é o default fora da media query. O `group` é o `<article>` do card.
 * - Pontos: 6px, ativo em gold, inativos em branco/60, com sombra pra não
 *   sumirem sobre foto clara. Alvo de toque de 24px via padding, mantendo o
 *   ponto visualmente pequeno.
 * - `sizes`: o card ocupa a largura toda no mobile, metade em `md` e 1/4 em
 *   `lg` (grid do lote), com o container em ~1280px — daí `100vw`, `50vw` e
 *   `300px`. Sem isso o next/image serviria variante grande demais.
 */
export default function DestinoFotoCarrossel({
  fotos,
  destinoNome,
  tone = "light",
}: DestinoFotoCarrosselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [atual, setAtual] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [indiceLightbox, setIndiceLightbox] = useState(0);

  const total = fotos.length;

  const irPara = useCallback((i: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
  }, []);

  const navegar = useCallback(
    (passo: number) => {
      // Circular: da última volta pra primeira e vice-versa.
      irPara((atual + passo + total) % total);
    },
    [atual, total, irPara],
  );

  // Slide visível => ponto aceso. Ver "POR QUE IntersectionObserver" no docblock.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || total === 0) return;

    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const i = slidesRef.current.indexOf(entrada.target as HTMLButtonElement);
          if (i >= 0) setAtual(i);
        }
      },
      { root: scroller, threshold: 0.6 },
    );

    for (const slide of slidesRef.current) {
      if (slide) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [total]);

  if (total === 0) return null;

  const setaBase =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center " +
    "rounded-full bg-navy/70 text-white transition-opacity duration-medium " +
    "hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold " +
    // Em touch ficam sempre visíveis; em ponteiro fino, só no hover do card.
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 " +
    "[@media(hover:hover)]:group-focus-within:opacity-100";

  return (
    <div className={`relative ${tone === "dark" ? "border-white/10" : "border-dark/10"} border-b`}>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            ref={(el) => {
              slidesRef.current[i] = el;
            }}
            type="button"
            onClick={(event) => {
              // Foca antes de abrir pro FotoLightbox ter pra onde devolver o
              // foco (nem todo navegador foca <button> no clique).
              event.currentTarget.focus();
              setIndiceLightbox(i);
              setAberto(true);
            }}
            aria-label={`Ampliar foto ${i + 1} de ${total} de ${destinoNome}: ${foto.alt}`}
            className="w-full flex-none cursor-pointer snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
          >
            <SpinhardiImage
              src={foto.src}
              alt={foto.alt}
              aspect="4/3"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 300px"
            />
          </button>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => navegar(-1)}
            aria-label="Foto anterior"
            className={`${setaBase} left-2`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            aria-label="Próxima foto"
            className={`${setaBase} right-2`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <div className="absolute inset-x-0 bottom-1 z-10 flex justify-center">
            {fotos.map((foto, i) => (
              <button
                key={foto.src}
                type="button"
                onClick={() => irPara(i)}
                aria-label={`Ir para a foto ${i + 1}`}
                aria-current={i === atual ? "true" : undefined}
                // Alvo de toque de 24px (p-2 + 6px), ponto visualmente pequeno.
                className="cursor-pointer p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <span
                  // O halo escuro não é enfeite: o ponto inativo é branco/60 e
                  // some sobre foto clara (o miradouro de Lisboa, com prédios
                  // bege, faz os três desaparecerem). `shadow-sm` é fraco demais
                  // num ponto de 6px, então a sombra é um anel preto explícito.
                  className={`block h-1.5 w-1.5 rounded-full shadow-[0_0_3px_rgba(0,0,0,0.9)] transition-colors duration-medium ${
                    i === atual ? "bg-gold" : "bg-white/60"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}

      <FotoLightbox
        fotos={fotos}
        indiceInicial={indiceLightbox}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        rotuloDialog={`Fotos de ${destinoNome}`}
      />
    </div>
  );
}
