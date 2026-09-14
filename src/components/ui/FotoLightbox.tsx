"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { buttonStyles } from "@/components/ui/Button";
// `import type`: o tipo some na compilação, então o array DESTINOS inteiro NÃO
// entra no bundle do cliente por causa deste import.
import type { DestinoFoto } from "@/content/destinos";

type FotoLightboxProps = {
  /** Fotos navegáveis, na ordem de exibição. Lista vazia => componente some. */
  fotos: DestinoFoto[];
  /** Índice que abre em foco. Lido a cada abertura, não a cada render. */
  indiceInicial: number;
  /** Estado de abertura, controlado pelo chamador. */
  aberto: boolean;
  /** Chamado quando o lightbox se fecha por Esc, botão ou clique no fundo. */
  aoFechar: () => void;
  /** `aria-label` do dialog. Ex.: "Fotos de Portugal". */
  rotuloDialog: string;
};

/**
 * FotoLightbox
 *
 * Visualizador de foto em tela cheia: `<dialog>` nativo, foto inteira, legenda,
 * contador e navegação circular. É o ÚNICO lightbox do site — usado pelas
 * miniaturas da página de destino (`DestinoGaleria`) e pelo carrossel do card
 * (`DestinoFotoCarrossel`). Extraído do `DestinoGaleria` na parte 2 do lote,
 * sem mudança de comportamento.
 *
 * "use client" JUSTIFICADO: `showModal()`, listener de teclado, trava de scroll
 * do body e devolução de foco são side-effects de navegador.
 *
 * --- POR QUE `<dialog>` NATIVO E NENHUMA LIB ---
 * O `<dialog>` aberto com `showModal()` já entrega focus-trap, Esc, inerte no
 * resto da página e top layer (não é recortado por `overflow-hidden` de
 * ancestral, o que importa porque o card do carrossel recorta o conteúdo). Uma
 * lib de lightbox só reimplementaria isso pior e com peso.
 *
 * --- POR QUE <Image> DIRETO, E NÃO SpinhardiImage ---
 * O SpinhardiImage é pra slot de conteúdo com aspect FIXO e recorte (lei do
 * projeto, D031). Aqui é o oposto: a foto precisa aparecer INTEIRA
 * (`object-fit: contain`), sem aspect imposto pelo container. É o caso
 * especializado que a doc do próprio SpinhardiImage ressalva.
 *
 * --- COMO O FOCO VOLTA ---
 * Na abertura, guarda o `document.activeElement` e devolve o foco pra ele ao
 * fechar. Por isso os chamadores focam explicitamente o elemento clicado antes
 * de abrir: nem todo navegador foca `<button>` no clique (Safari não foca), e
 * sem isso o `activeElement` seria o `<body>` e o foco se perderia.
 *
 * --- DECISÕES LOCAIS (documentadas, herdadas da parte 1) ---
 * - Altura da foto: em vez de fixar `h-[90vh]` (que empurraria a legenda pra
 *   fora da tela), a área da foto é `flex-1` dentro da coluna com padding —
 *   fica naturalmente dentro do teto de 90vh/90vw e sobra espaço pra legenda.
 * - Botões: `buttonStyles("primary")`, a mesma variante que o CTAWhatsApp usa
 *   nos blocos navy do site (ouro sobre navy).
 * - Trava de scroll: salva e restaura `document.body.style.overflow`, como o
 *   MobileMenu já faz, em vez de adicionar/remover classe — não briga com quem
 *   já tenha mexido no overflow.
 * - Fechar no clique de fundo NÃO usa `event.target === event.currentTarget`
 *   (aprovado em 14/09/2026): com `object-fit: contain` o <img> continua
 *   preenchendo a CAIXA inteira, então as faixas vazias ao lado de uma foto
 *   retrato — as três da Argentina — ainda SÃO o <img>. O teste de alvo
 *   deixaria justamente a área que o usuário lê como "fora da foto" sem fechar.
 *   Aqui o clique fecha em tudo que borbulha até o fundo, e só os controles e a
 *   legenda cortam a propagação.
 */
export default function FotoLightbox({
  fotos,
  indiceInicial,
  aberto,
  aoFechar,
  rotuloDialog,
}: FotoLightboxProps) {
  const [indice, setIndice] = useState(indiceInicial);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Elemento que tinha o foco quando abriu — o foco volta pra ele ao fechar,
  // mesmo que o usuário tenha navegado pra outra foto no meio.
  const origemRef = useRef<HTMLElement | null>(null);

  const total = fotos.length;

  const navegar = useCallback(
    (passo: number) => {
      // Navegação circular: da última volta pra primeira e vice-versa.
      setIndice((atual) => (atual + passo + total) % total);
    },
    [total],
  );

  // Abertura/fechamento. Depende SÓ de `aberto`: se `indiceInicial` entrasse
  // aqui, navegar pela seta (que não muda a prop) seria inofensivo, mas um
  // chamador que trocasse o índice com o lightbox aberto faria o efeito
  // limpar — fechando o dialog e devolvendo o foco no meio da navegação.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !aberto) return;

    origemRef.current = document.activeElement as HTMLElement | null;
    dialog.showModal();

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
      if (dialog.open) dialog.close();
      origemRef.current?.focus();
    };
  }, [aberto]);

  // O índice inicial é lido a cada ABERTURA — e só nela, pra que navegar pelas
  // setas (que não mexem na prop) não seja desfeito no próximo render.
  //
  // Ajuste DURANTE O RENDER, não num efeito: é o padrão do React pra derivar
  // estado de uma prop que mudou, e evita o render intermediário com o índice
  // velho que um `useEffect` produziria (a foto anterior piscaria por um quadro
  // ao reabrir). O `react-hooks/set-state-in-effect` proíbe a versão com efeito
  // exatamente por isso.
  const [abertoAnterior, setAbertoAnterior] = useState(aberto);
  if (aberto !== abertoAnterior) {
    setAbertoAnterior(aberto);
    if (aberto) setIndice(indiceInicial);
  }

  if (total === 0) return null;

  // Foto e número de exibição viajam juntos porque o índice sozinho não
  // sobrevive ao clamp: `fotos` pode encolher entre renders.
  const seguro = Math.min(indice, total - 1);
  const foto = fotos[seguro];

  return (
    <dialog
      ref={dialogRef}
      aria-label={rotuloDialog}
      onClose={aoFechar}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navegar(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          navegar(-1);
        }
        // Esc é tratado nativamente pelo <dialog> e cai no onClose.
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-navy/95 p-0 text-white backdrop:bg-navy/95"
    >
      {aberto && (
        <div
          // Clique no fundo fecha — ver "Fechar no clique de fundo" no docblock.
          onClick={aoFechar}
          className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-4 pt-20 pb-8 sm:px-16"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              aoFechar();
            }}
            aria-label="Fechar"
            className={buttonStyles("primary", "sm", "absolute top-6 right-4 z-10 sm:right-6")}
          >
            Fechar
          </button>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navegar(-1);
                }}
                aria-label="Foto anterior"
                className={buttonStyles(
                  "primary",
                  "sm",
                  "absolute top-1/2 left-2 z-10 -translate-y-1/2 sm:left-4",
                )}
              >
                <span aria-hidden="true">&#8249;</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navegar(1);
                }}
                aria-label="Próxima foto"
                className={buttonStyles(
                  "primary",
                  "sm",
                  "absolute top-1/2 right-2 z-10 -translate-y-1/2 sm:right-4",
                )}
              >
                <span aria-hidden="true">&#8250;</span>
              </button>
            </>
          )}

          {/* `flex-1` + `min-h-0`: a área da foto ocupa a altura que sobra da
              coluna, sempre dentro dos tetos de 90vh/90vw. */}
          <div className="relative max-h-[90vh] w-full max-w-[90vw] min-h-0 flex-1">
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="90vw"
              priority={false}
              style={{ objectFit: "contain" }}
            />
          </div>

          <p
            onClick={(event) => event.stopPropagation()}
            className="font-body max-w-2xl text-center text-sm text-white/80"
          >
            {foto.alt}{" "}
            <span className="whitespace-nowrap text-white/60">
              &middot; {seguro + 1} / {total}
            </span>
          </p>
        </div>
      )}
    </dialog>
  );
}
