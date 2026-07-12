import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PortableTextBlock } from "@portabletext/types";
import { Post, PostCategory, PostInput } from "./types";
import { FieldError } from "./errors";
import { mdLightToPortableText } from "./portable-text";
import { getAllSanityPosts, getSanityPostBySlug } from "@/lib/sanity/queries";
import { sanityPostToPost } from "@/lib/sanity/mappers";
import { sanityWriteClient } from "@/lib/sanity/write-client";
import {
  uploadImageAsset,
  deleteAssetIfOrphan,
  collectImageAssetIds,
} from "@/lib/sanity/assets";
import {
  DRAFT_PREFIX,
  isSlugTaken,
  resolveCategoryId,
} from "@/lib/sanity/admin";

/**
 * Acesso a posts do blog.
 *
 * LEITURA PÚBLICA (site): Sanity via cliente sem token (`queries.ts`), só
 * publicados. ESCRITA e leitura do admin: write client (`SANITY_API_WRITE_TOKEN`),
 * enxergando drafts. Este módulo importa o write client, então é server-only —
 * nenhum client component pode importá-lo (só páginas/actions server).
 *
 * As leituras do admin vivem em `@/lib/sanity/admin`; reexportadas aqui pra que
 * as páginas do admin continuem importando tudo de `@/lib/blog`.
 */
export { getAdminPosts, getAdminPostBySlug } from "@/lib/sanity/admin";

export async function getPosts(opts?: {
  category?: PostCategory | "Todos";
  status?: "rascunho" | "publicado";
}): Promise<Post[]> {
  const sanityPosts = await getAllSanityPosts();
  let posts = sanityPosts.map(sanityPostToPost);

  // Leitura pública só traz publicados; o filtro é mantido por simetria de API.
  if (opts?.status) {
    posts = posts.filter((p) => p.status === opts.status);
  }
  if (opts?.category && opts.category !== "Todos") {
    posts = posts.filter((p) => p.category === opts.category);
  }

  // A GROQ já ordena por publishedAt desc; reafirmamos para robustez.
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const sanityPost = await getSanityPostBySlug(slug);
  return sanityPost ? sanityPostToPost(sanityPost) : null;
}

// ---------------------------------------------------------------------------
// Escrita (admin) — implementação real via write client.
// ---------------------------------------------------------------------------

/** Kebab-case sem acento: normaliza, tira diacríticos e colapsa não-alfanum. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug final: usa o do form se preenchido, senão gera do título. Sempre
 *  normalizado. Vazio após normalizar (título só com símbolos) → erro amigável. */
function ensureSlug(input: PostInput): string {
  const source = input.slug.trim() ? input.slug : input.title;
  const slug = slugify(source);
  if (!slug) {
    throw new Error("Não foi possível gerar um slug — informe um título ou slug válido.");
  }
  return slug;
}

async function assertSlugFree(slug: string, excludeBaseId?: string): Promise<void> {
  if (await isSlugTaken(slug, excludeBaseId)) {
    throw new Error(`O slug "${slug}" já está em uso por outro post. Escolha outro.`);
  }
}

/** Campos que o admin GERE (title/slug/excerpt/body/seo/categorias). Nunca inclui
 *  `_id`/`_type` (pra poder ir num `patch.set`) nem mainImage/author (fora do B1;
 *  preservados por merge/patch). `body` md-leve vira Portable Text aqui. */
type ManagedFields = {
  title: string;
  slug: { _type: "slug"; current: string };
  excerpt: string;
  body: PortableTextBlock[];
  seoTitle: string;
  seoDescription: string;
  categories: { _type: "reference"; _key: string; _ref: string }[];
};

function buildManagedFields(input: PostInput, slug: string, categoryId: string): ManagedFields {
  return {
    title: input.title.trim(),
    slug: { _type: "slug", current: slug },
    excerpt: input.excerpt.trim(),
    body: mdLightToPortableText(input.body),
    seoTitle: input.seoTitle.trim(),
    seoDescription: input.seoDescription.trim(),
    categories: [{ _type: "reference", _key: "category-0", _ref: categoryId }],
  };
}

/** Revalida as rotas do blog na hora (estamos dentro do Next). Espelha o webhook
 *  `/api/revalidate` (o route group `(public)` faz parte do match do dynamic
 *  route). O webhook continua existindo pro caso de edição via Studio.
 *
 *  Inclui a lista do admin (`/admin/blog`): ela é `force-dynamic`, mas o Router
 *  Cache do CLIENT guarda o RSC da última visita — sem invalidar aqui, o
 *  `router.push` de volta do form mostraria a lista sem o post recém-salvo. */
function revalidateBlog(slug?: string): void {
  revalidatePath("/blog");
  revalidatePath("/(public)/blog/[slug]", "page");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
}

/** Descarta campos de sistema de um doc existente antes de reusá-lo como base
 *  (preservando conteúdo não-gerido como mainImage/author). */
function stripSystemFields(doc: Record<string, unknown> | null): Record<string, unknown> {
  if (!doc) return {};
  const { _id, _rev, _createdAt, _updatedAt, ...rest } = doc;
  void _id;
  void _rev;
  void _createdAt;
  void _updatedAt;
  return rest;
}

// ---------------------------------------------------------------------------
// Capa (mainImage): escrita EXPLÍCITA + garbage collection do asset.
// O B1 preservava o mainImage passivamente (buildManagedFields não o incluía).
// Aqui ele passa a ser escrito de propósito, seguindo a matriz do B2.
// ---------------------------------------------------------------------------

/** Intenção do form sobre a capa nesta gravação. O `File` só é subido dentro
 *  destas funções (após validar slug/categoria), pra não gerar asset órfão. */
type ImageMutation = { file: File | null; alt?: string; remove?: boolean };

type SanityMainImage = {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
  alt?: string;
  [key: string]: unknown;
};

/** Valor final do `mainImage` a partir do estado atual + intenção + asset novo.
 *
 *  - asset novo → escreve capa nova (com o alt do form);
 *  - remover    → `undefined` (o caller faz unset);
 *  - senão      → preserva o existente, aplicando o alt do form se veio.
 *
 *  Preserva hotspot/crop do objeto atual via spread. */
function resolveMainImage(
  current: unknown,
  image: ImageMutation | undefined,
  newAssetId: string | null,
): SanityMainImage | undefined {
  const cur = current as SanityMainImage | undefined;

  if (newAssetId) {
    return {
      _type: "image",
      asset: { _type: "reference", _ref: newAssetId },
      ...(image?.alt !== undefined ? { alt: image.alt } : {}),
    };
  }
  if (image?.remove) return undefined;
  if (cur && image?.alt !== undefined) return { ...cur, alt: image.alt };
  return cur;
}

/** Regra de negócio do publish: capa obrigatória, e alt obrigatório junto com a
 *  capa. Roda ANTES do upload, pra abortar sem gerar asset órfão. Erros sobem
 *  como `FieldError` (a action cola inline). */
function assertPublishImage(willHaveImage: boolean, finalAlt: string): void {
  if (!willHaveImage) {
    throw new FieldError("Para publicar, escolha uma imagem de capa.", "image");
  }
  if (!finalAlt.trim()) {
    throw new FieldError(
      "Para publicar, descreva a imagem no texto alternativo.",
      "imageAlt",
    );
  }
}

/** Roda o GC (best-effort) para cada asset que ESTAVA no post antes da mutação.
 *  `deleteAssetIfOrphan` recheca referência, então passar assets ainda em uso é
 *  seguro (viram no-op). Nunca lança. */
async function collectGarbage(oldAssetIds: string[]): Promise<void> {
  for (const assetId of [...new Set(oldAssetIds)]) {
    await deleteAssetIfOrphan(assetId);
  }
}

/**
 * Cria um post novo. `publish=false` grava como DRAFT (`drafts.<novoId>`);
 * `publish=true` grava direto como publicado, com `publishedAt = agora`.
 */
export async function createPost(
  input: PostInput,
  { publish }: { publish: boolean },
  image?: ImageMutation,
): Promise<{ slug: string }> {
  const slug = ensureSlug(input);
  await assertSlugFree(slug);
  const categoryId = await resolveCategoryId(input.category);
  const fields = buildManagedFields(input, slug, categoryId);
  const id = randomUUID();

  // Post novo: não há capa existente, então "tem imagem" = veio arquivo.
  const hasFile = !!image?.file;
  if (publish) {
    assertPublishImage(hasFile, image?.alt ?? "");
  }

  const newAssetId = hasFile ? await uploadImageAsset(image!.file!) : null;
  const mainImage = resolveMainImage(undefined, image, newAssetId);
  // Tipar como opcional único (não `{mainImage} | {}`) mantém a inferência do
  // `create` limpa quando espalhado.
  const imagePart: { mainImage?: SanityMainImage } = mainImage ? { mainImage } : {};

  if (publish) {
    await sanityWriteClient.create({
      _id: id,
      _type: "post",
      ...fields,
      ...imagePart,
      publishedAt: new Date().toISOString(),
    });
    revalidateBlog(slug);
  } else {
    await sanityWriteClient.create({
      _id: `${DRAFT_PREFIX}${id}`,
      _type: "post",
      ...fields,
      ...imagePart,
    });
  }

  return { slug };
}

/**
 * Atualiza um post existente (por ID base).
 *
 * `publish=false` (salvar rascunho): grava em `drafts.<id>`, preservando campos
 * não-geridos (mainImage/author) do doc atual — a versão publicada, se houver,
 * continua no ar. `publish=true`: escreve a versão publicada `<id>`, apaga o
 * draft e seta `publishedAt` na PRIMEIRA publicação (senão preserva o existente).
 */
export async function updatePost(
  id: string,
  input: PostInput,
  { publish }: { publish: boolean },
  image?: ImageMutation,
): Promise<{ slug: string }> {
  const slug = ensureSlug(input);
  await assertSlugFree(slug, id);
  const categoryId = await resolveCategoryId(input.category);
  const fields = buildManagedFields(input, slug, categoryId);
  const draftId = `${DRAFT_PREFIX}${id}`;

  // Lê as duas faces ANTES de mutar: os assetIds atuais alimentam o GC pós-commit.
  const [draft, published] = await Promise.all([
    sanityWriteClient.getDocument(draftId),
    sanityWriteClient.getDocument(id),
  ]);
  const oldAssetIds = [...collectImageAssetIds(draft), ...collectImageAssetIds(published)];

  const hasFile = !!image?.file;

  // Valida imagem/alt no publish ANTES do upload (aborta sem gerar asset órfão).
  // "Fonte" da capa atual = o que seria exibido/editado (draft se houver).
  if (publish) {
    const source = (draft ?? published) as { mainImage?: SanityMainImage } | null;
    const currentImage = source?.mainImage;
    const willHaveImage = hasFile ? true : image?.remove ? false : !!currentImage;
    const finalAlt = hasFile
      ? image?.alt ?? ""
      : image?.alt ?? currentImage?.alt ?? "";
    assertPublishImage(willHaveImage, finalAlt);
  }

  const newAssetId = hasFile ? await uploadImageAsset(image!.file!) : null;

  if (publish) {
    const base = stripSystemFields(draft ?? published ?? null);
    const publishedAt =
      published?.publishedAt ?? draft?.publishedAt ?? new Date().toISOString();
    const mainImage = resolveMainImage(base.mainImage, image, newAssetId);
    // Tira o mainImage antigo do base e recompõe via imagePart: o createOrReplace
    // troca o doc inteiro, então NÃO incluir mainImage = unset (caso "remover").
    const { mainImage: _oldImage, ...baseNoImage } = base;
    void _oldImage;
    const imagePart: { mainImage?: SanityMainImage } = mainImage ? { mainImage } : {};
    const doc = { ...baseNoImage, _id: id, _type: "post" as const, ...fields, ...imagePart, publishedAt };

    const tx = sanityWriteClient.transaction().createOrReplace(doc);
    if (draft) tx.delete(draftId);
    await tx.commit();
    revalidateBlog(slug);
  } else if (draft) {
    const mainImage = resolveMainImage(
      (draft as { mainImage?: unknown }).mainImage,
      image,
      newAssetId,
    );
    const patch = sanityWriteClient.patch(draftId).set(fields);
    if (mainImage) patch.set({ mainImage });
    else patch.unset(["mainImage"]);
    await patch.commit();
  } else {
    // Sem draft: parte do publicado (se houver) pra não perder author etc.
    const base = stripSystemFields(published ?? null);
    const mainImage = resolveMainImage(base.mainImage, image, newAssetId);
    const { mainImage: _oldImage, ...baseNoImage } = base;
    void _oldImage;
    const imagePart: { mainImage?: SanityMainImage } = mainImage ? { mainImage } : {};
    const doc = { ...baseNoImage, _id: draftId, _type: "post" as const, ...fields, ...imagePart };
    await sanityWriteClient.createOrReplace(doc);
  }

  // GC só depois do commit: enquanto o published referenciar a capa velha, o
  // delete toma 409 de propósito; é no publish que ela de fato fica órfã.
  await collectGarbage(oldAssetIds);

  return { slug };
}

/** Remove o post por completo — draft e publicado. Apagar ID inexistente é
 *  no-op na Sanity, então cobrir as duas faces é seguro. */
export async function deletePost(id: string): Promise<void> {
  const draftId = `${DRAFT_PREFIX}${id}`;
  // Coleta os assetIds das duas faces ANTES de apagar — depois de deletadas não dá
  // mais pra saber quais assets ficaram órfãos.
  const [draft, published] = await Promise.all([
    sanityWriteClient.getDocument(draftId),
    sanityWriteClient.getDocument(id),
  ]);
  const oldAssetIds = [...collectImageAssetIds(draft), ...collectImageAssetIds(published)];

  await sanityWriteClient.transaction().delete(id).delete(draftId).commit();
  revalidateBlog();

  await collectGarbage(oldAssetIds);
}
