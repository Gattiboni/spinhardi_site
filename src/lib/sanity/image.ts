import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { sanityClient } from "./client";

const builder = createImageUrlBuilder(sanityClient);

/**
 * Resolve uma referência de imagem da Sanity para uma URL absoluta (cdn.sanity.io).
 * Retorna `null` quando não há imagem — o consumer trata o placeholder.
 */
export function urlForImage(source: SanityImageSource | null | undefined): string | null {
  if (!source) return null;
  return builder.image(source).fit("max").auto("format").url();
}

/**
 * Resolve uma imagem da Sanity para a URL da imagem de compartilhamento (og:image):
 * 1200x630 (proporção ~1.91:1 que o Open Graph pede), cropada. A capa é 16:9, então
 * o crop é inevitável — mas o builder respeita o `hotspot` do Sanity, então corta
 * ao redor do ponto de interesse em vez de cegamente pelo centro.
 *
 * Separada de `urlForImage` de propósito: aquela serve a capa/os cards (`fit: max`,
 * sem dimensão fixa) e não pode mudar. Retorna `null` sem imagem — o metadata omite
 * o `og:image` em vez de emitir uma URL quebrada.
 */
export function urlForOgImage(source: SanityImageSource | null | undefined): string | null {
  if (!source) return null;
  return builder.image(source).width(1200).height(630).fit("crop").auto("format").url();
}
