"use client";

import { useState } from "react";
import { SpinhardiImage } from "@/components/ui/SpinhardiImage";
import FotoLightbox from "@/components/ui/FotoLightbox";
// `import type`: o tipo some na compilação, então o array DESTINOS inteiro NÃO
// entra no bundle do cliente por causa deste import. A forma da foto é definida
// uma vez só, no módulo de conteúdo que é dono dela.
import type { DestinoFoto } from "@/content/destinos";

type DestinoGaleriaProps = {
  /** Fotos do destino, na ordem de exibição. Lista vazia => componente some. */
  fotos: DestinoFoto[];
  /** Nome do destino, usado no `aria-label` do dialog. Ex.: "Argentina". */
  destinoNome: string;
};

/**
 * DestinoGaleria
 *
 * Fileira de miniaturas compactas na página do destino; clique abre a foto
 * inteira no `FotoLightbox`. Desde a parte 2 do lote este componente é SÓ as
 * miniaturas: todo o lightbox (dialog, navegação, Esc, trava de scroll, foco de
 * volta) mora em `FotoLightbox`, compartilhado com o carrossel do card.
 *
 * "use client" JUSTIFICADO: guarda qual miniatura abriu o lightbox e foca o
 * botão clicado antes de abrir (ver abaixo).
 *
 * Destino sem foto (Itália) retorna `null`: nem título, nem espaço, nem dialog
 * no HTML. É o que permite a galeria entrar na página de TODOS os destinos sem
 * condicional no chamador.
 *
 * --- POR QUE O `focus()` EXPLÍCITO NO CLIQUE ---
 * O `FotoLightbox` devolve o foco pro `document.activeElement` de quando abriu.
 * Nem todo navegador foca um `<button>` ao clicar (o Safari não foca), então
 * sem este `focus()` o `activeElement` seria o `<body>` e o foco se perderia ao
 * fechar. Focar explicitamente torna a devolução determinística.
 *
 * --- DECISÕES LOCAIS (ambiguidade do lote, escolha simples e documentada) ---
 * - Gap das miniaturas: `gap-2` no mobile, `gap-3` a partir de sm. Mantém as 3
 *   colunas confortáveis em 375px sem overflow.
 * - Raio: `rounded-md`, o mesmo do Button e dos cards do repo.
 * - `sizes` das miniaturas: cada uma ocupa ~1/3 da coluna de texto, que na
 *   página do destino é `max-w-3xl` (768px) — com o gap dá ~250px por miniatura.
 *   Daí `30vw` no mobile e `250px` a partir do ponto em que a coluna para de
 *   crescer. Sem isso o next/image serviria variante grande demais pro slot.
 */
export default function DestinoGaleria({ fotos, destinoNome }: DestinoGaleriaProps) {
  const [indice, setIndice] = useState(0);
  const [aberto, setAberto] = useState(false);

  const total = fotos.length;
  if (total === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {fotos.map((foto, i) => (
          <li key={foto.src}>
            <button
              type="button"
              onClick={(event) => {
                // Ver "POR QUE O `focus()` EXPLÍCITO" no docblock.
                event.currentTarget.focus();
                setIndice(i);
                setAberto(true);
              }}
              aria-label={`Ampliar foto ${i + 1} de ${total}: ${foto.alt}`}
              className="group block w-full cursor-pointer overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              <SpinhardiImage
                src={foto.src}
                alt={foto.alt}
                aspect="4/3"
                sizes="(max-width: 640px) 30vw, 250px"
                className="transition-transform duration-medium ease-smooth group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <FotoLightbox
        fotos={fotos}
        indiceInicial={indice}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        rotuloDialog={`Fotos de ${destinoNome}`}
      />
    </>
  );
}
