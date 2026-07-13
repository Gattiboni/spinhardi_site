import "server-only";
import { sanityWriteClient } from "./write-client";
import { FieldError } from "@/lib/blog/errors";
import { IMAGE_ALLOWED_TYPES, IMAGE_MAX_BYTES } from "@/lib/blog/types";

/**
 * Gestão de assets de imagem do blog (upload + garbage collection).
 *
 * Server-only: usa o write client (token de escrita, `perspective: "raw"`, então
 * enxerga também drafts). O upload acontece no MOMENTO DE SALVAR/PUBLICAR, dentro
 * da action — nunca na seleção do arquivo — pra não criar asset órfão se a Nina
 * abandonar o post. A Sanity deduplica asset por hash do conteúdo, então subir o
 * mesmo arquivo duas vezes resulta num único asset; não tentamos evitar duplicata
 * na mão.
 */

/**
 * Sobe um arquivo de imagem e devolve o `_id` do asset criado.
 *
 * Revalida mime e tamanho no servidor (o client já valida, mas não confiamos
 * nele). Falha vira `FieldError` no campo `"image"`, pra action colar inline.
 */
export async function uploadImageAsset(file: File): Promise<string> {
  if (!(IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new FieldError("Formato inválido. Envie JPG, PNG ou WebP.", "image");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new FieldError("A imagem passa de 3 MB. Escolha um arquivo menor.", "image");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await sanityWriteClient.assets.upload("image", buffer, {
    filename: file.name,
    contentType: file.type,
  });
  return asset._id;
}

/**
 * Garbage collection best-effort de um asset: apaga se — e só se — ninguém mais
 * o referencia. NUNCA pode derrubar a ação da Nina.
 *
 * - Checa referência de verdade com o write client (`perspective: "raw"` enxerga
 *   drafts também), via `count(*[references($assetId)])`.
 * - `> 0`: alguém ainda usa → não faz nada.
 * - `=== 0`: tenta apagar.
 * - Tudo em try/catch que ENGOLE qualquer erro (só `console.warn`). O 409 do
 *   Content Lake ("asset is still referenced") é esperado, não é bug: é a rede de
 *   segurança final caso a checagem de referência erre.
 */
export async function deleteAssetIfOrphan(assetId: string): Promise<void> {
  try {
    const refs = await sanityWriteClient.fetch<number>(`count(*[references($assetId)])`, {
      assetId,
    });
    if (refs > 0) return;
    await sanityWriteClient.delete(assetId);
  } catch (err) {
    console.warn(`[deleteAssetIfOrphan] não removeu o asset ${assetId} (segue o baile):`, err);
  }
}

/**
 * Extrai os `_ref` de asset de imagem de um documento de post (draft ou
 * publicado), cobrindo `mainImage` E `ogImage`. O `ogImage` ainda não é editável
 * (escopo do B3), mas o GC já nasce cobrindo ele pra não ter que ser reescrito.
 */
export function collectImageAssetIds(doc: unknown): string[] {
  const record = doc as Record<string, unknown> | null | undefined;
  if (!record) return [];

  const ids: string[] = [];
  for (const key of ["mainImage", "ogImage"] as const) {
    const field = record[key] as { asset?: { _ref?: unknown } } | undefined;
    const ref = field?.asset?._ref;
    if (typeof ref === "string" && ref) ids.push(ref);
  }
  return ids;
}
