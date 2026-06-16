import Image from "next/image";

type SpinhardiImageProps = {
  /** Caminho da imagem (em `/public`, começa com "/"). */
  src: string;
  /** Texto alternativo. Use "" para imagens puramente decorativas (ex.: fundo de hero). */
  alt: string;
  /** Aspect-ratio do slot, ex.: "5/3", "4/5", "16/9", "3/2". Aplicado via style inline. */
  aspect: string;
  /** Posição do recorte quando a foto não bate exatamente com o aspect. Default "center". */
  objectPosition?: string;
  /** `priority` do next/image — só `true` para imagens above-the-fold (hero). Default false. */
  priority?: boolean;
  /** `sizes` do next/image. Refinar quando o slot é uma coluna. Default "100vw". */
  sizes?: string;
  /** Classes extras para o wrapper (ex.: posicionamento, largura máxima). */
  className?: string;
};

/**
 * SpinhardiImage
 *
 * --- LEI DO PROJETO ---
 * Todo slot de imagem de CONTEÚDO no site usa <SpinhardiImage>. O <Image> direto
 * do next/image fica reservado para casos especializados (logo, ícones, componentes
 * com comportamento próprio como o BlogCard). Nenhum <img> solto. Nenhum
 * `background-image` CSS para foto de conteúdo.
 *
 * --- POR QUE ESTE COMPONENTE EXISTE ---
 * A Spinhardi não tem produção fotográfica profissional. As fotos chegam em
 * qualquer orientação e dimensão. Engessar o slot numa orientação fixa cria
 * fricção operacional permanente. Aqui o CONTAINER define o aspect-ratio do slot
 * e a imagem se adapta via object-fit: cover + object-position ajustável.
 *
 * --- POR QUE STYLE INLINE EM VEZ DE CLASSES TAILWIND ---
 * `aspectRatio`, `objectFit` e `objectPosition` recebem valores DINÂMICOS. O purge
 * do Tailwind v4 não captura classes geradas via template string (`aspect-[${x}]`,
 * `object-position-[${y}]`), então elas seriam removidas do CSS final. Style inline
 * é a forma correta para valor dinâmico — não é dívida técnica.
 *
 * --- POR QUE `fill` ---
 * O container já define o tamanho (aspect-ratio + largura do pai); `fill` faz a
 * imagem preenchê-lo exatamente, sem precisar conhecer width/height do arquivo.
 *
 * --- POR QUE `w-full` POR DEFAULT ---
 * O wrapper aplica `w-full` por default, garantindo que o `aspect-ratio` resolva
 * a altura corretamente em qualquer contexto (grid, flex, fluxo normal). Sem isso,
 * dentro de um item de CSS Grid a largura intrínseca colapsa pra 0 (o único filho
 * real é `<Image fill>`, que é `position: absolute`), e a altura calculada pelo
 * aspect-ratio vira 0px — a imagem fica invisível. Para limitar tamanho, passe
 * `max-w-*` via `className` (max-width vence width quando menor).
 */
export function SpinhardiImage({
  src,
  alt,
  aspect,
  objectPosition = "center",
  priority = false,
  sizes = "100vw",
  className,
}: SpinhardiImageProps) {
  return (
    <div
      className={["relative w-full overflow-hidden", className].filter(Boolean).join(" ")}
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        style={{ objectFit: "cover", objectPosition }}
      />
    </div>
  );
}
