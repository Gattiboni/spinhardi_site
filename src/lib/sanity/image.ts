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
