import "server-only";
import { sanityWriteClient } from "./write-client";
import { sanityPostToPost, type SanityPost } from "./mappers";
import type { Post, PostCategory } from "@/lib/blog/types";

/**
 * Camada de leitura/consulta do back-office via WRITE client (`perspective:
 * "raw"`), que enxerga drafts E publicados. Complementa `queries.ts`, que é a
 * leitura PÚBLICA (sem token, só publicados). Nada aqui pode ser importado por
 * client component — `write-client` traz `import "server-only"`.
 */

export const DRAFT_PREFIX = "drafts.";

const ADMIN_POST_PROJECTION = `{
  _id,
  _createdAt,
  _updatedAt,
  title,
  "slug": slug.current,
  publishedAt,
  excerpt,
  mainImage,
  ogImage,
  body,
  author->{name, image},
  categories[]->{title},
  seoTitle,
  seoDescription
}`;

/** Remove o prefixo `drafts.` — o ID base é o mesmo do draft e do publicado. */
export function baseId(id: string): string {
  return id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id;
}

/**
 * Um documento lógico agrupa suas duas faces: o draft (`drafts.<id>`) e o
 * publicado (`<id>`). Qualquer uma pode faltar.
 */
type DocGroup = { id: string; draft?: SanityPost; published?: SanityPost };

function groupByBase(docs: SanityPost[]): DocGroup[] {
  const groups = new Map<string, DocGroup>();
  for (const doc of docs) {
    const id = baseId(doc._id);
    const group = groups.get(id) ?? { id };
    if (doc._id.startsWith(DRAFT_PREFIX)) group.draft = doc;
    else group.published = doc;
    groups.set(id, group);
  }
  return [...groups.values()];
}

/**
 * Projeta um grupo no `Post` canônico do admin:
 *  - conteúdo exibido/editado = o draft se existir, senão o publicado;
 *  - status REAL = "publicado" sse há versão publicada, senão "rascunho"
 *    (um post publicado com edições pendentes continua "publicado");
 *  - `id` = ID base, pra as actions saberem qual documento gravar;
 *  - `publishedSlug` = slug da versão publicada (o de exibição pode ser o do
 *    draft, que não tem página pública); `hasPendingDraft` = draft por cima de
 *    publicado. Ambos vêm dos docs já projetados, sem heurística no client.
 */
function toAdminPost(group: DocGroup): Post {
  const display = group.draft ?? group.published;
  if (!display) throw new Error(`Grupo de post sem documento: ${group.id}`);
  return {
    ...sanityPostToPost(display),
    id: group.id,
    status: group.published ? "publicado" : "rascunho",
    publishedSlug: group.published?.slug ?? null,
    hasPendingDraft: !!(group.draft && group.published),
  };
}

/** Lista TODOS os posts do admin (rascunhos e publicados), mais recentes primeiro. */
export async function getAdminPosts(): Promise<Post[]> {
  const docs = await sanityWriteClient.fetch<SanityPost[]>(
    `*[_type == "post" && defined(slug.current)] ${ADMIN_POST_PROJECTION}`,
  );
  return groupByBase(docs)
    .map(toAdminPost)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Carrega um post do admin por slug: draft se existir, senão publicado. */
export async function getAdminPostBySlug(slug: string): Promise<Post | null> {
  const docs = await sanityWriteClient.fetch<SanityPost[]>(
    `*[_type == "post" && slug.current == $slug] ${ADMIN_POST_PROJECTION}`,
    { slug },
  );
  if (!docs.length) return null;
  const groups = groupByBase(docs);
  return groups.length ? toAdminPost(groups[0]) : null;
}

/** True se o slug já pertence a OUTRO post (draft ou publicado). Exclui o próprio
 *  documento (ambas as faces) quando `excludeBaseId` é passado — pra reeditar sem
 *  colidir consigo mesmo. `perspective: "raw"` garante contar também os drafts. */
export async function isSlugTaken(slug: string, excludeBaseId?: string): Promise<boolean> {
  const exclude = excludeBaseId ? [excludeBaseId, `${DRAFT_PREFIX}${excludeBaseId}`] : [];
  const count = await sanityWriteClient.fetch<number>(
    `count(*[_type == "post" && slug.current == $slug && !(_id in $exclude)])`,
    { slug, exclude },
  );
  return count > 0;
}

/**
 * Resolve o `_id` do documento de categoria pelo `title`. As 4 categorias já
 * existem publicadas no dataset; cache simples em memória evita reconsultar.
 */
const categoryIdCache = new Map<PostCategory, string>();

export async function resolveCategoryId(title: PostCategory): Promise<string> {
  const cached = categoryIdCache.get(title);
  if (cached) return cached;
  const id = await sanityWriteClient.fetch<string | null>(
    `*[_type == "category" && title == $title][0]._id`,
    { title },
  );
  if (!id) throw new Error(`Categoria "${title}" não encontrada no Sanity.`);
  categoryIdCache.set(title, id);
  return id;
}
