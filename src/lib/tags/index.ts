import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validarTagsInternas, unirTags, removerTag } from "./shared";
import type { TagClickMassa, TagInterna } from "./shared";

/**
 * Leitura dos dois catálogos e escrita de `contacts.tags`.
 *
 * O catálogo do ClickMassa vem SEMPRE da view `clickmassa_tags_catalogo` —
 * nenhuma linha deste lote lê `bronze_clickmassa_tags` direto. O catálogo
 * interno vem de `tags`, que só Configurações cria e edita (T7).
 *
 * ESCRITA: este módulo toca EXCLUSIVAMENTE a coluna `contacts.tags`.
 * `clickmassa_tags_id` é intocável — dona é o sync (T1).
 */

type LinhaTagInterna = {
  id: string;
  name: string;
  slug: string;
  cor: string;
  grupo: string | null;
  is_active: boolean;
};

type LinhaTagCm = {
  id: number | null;
  nome: string | null;
  cor: string | null;
  ativa: boolean | null;
};

export async function getCatalogoInterno(): Promise<TagInterna[]> {
  const { data, error } = await supabaseAdmin()
    .from("tags")
    .select("id, name, slug, cor, grupo, is_active")
    .order("name", { ascending: true });

  if (error) throw new Error(`Erro ao ler o catálogo de tags: ${error.message}`);
  return ((data as LinhaTagInterna[]) ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    cor: t.cor,
    grupo: t.grupo,
    isActive: t.is_active,
  }));
}

export async function getCatalogoClickMassa(): Promise<TagClickMassa[]> {
  const { data, error } = await supabaseAdmin()
    .from("clickmassa_tags_catalogo")
    .select("id, nome, cor, ativa")
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao ler as tags do ClickMassa: ${error.message}`);
  return ((data as LinhaTagCm[]) ?? [])
    .filter((t): t is LinhaTagCm & { id: number; nome: string } => t.id != null && !!t.nome)
    .map((t) => ({ id: t.id, nome: t.nome, cor: t.cor, ativa: t.ativa ?? true }));
}

/** Os dois catálogos numa chamada — é sempre assim que as telas consomem. */
export async function getCatalogos(): Promise<{
  internas: TagInterna[];
  clickmassa: TagClickMassa[];
}> {
  const [internas, clickmassa] = await Promise.all([getCatalogoInterno(), getCatalogoClickMassa()]);
  return { internas, clickmassa };
}

// ─────────────────────────────────────────────────────────────────
// Escrita — SÓ `contacts.tags`
// ─────────────────────────────────────────────────────────────────

/**
 * Substitui integralmente as tags internas de UM contato. Valida contra o
 * catálogo antes de gravar (a validação é a mesma do cliente, importada do
 * módulo puro).
 */
export async function definirTagsDoContato(
  contactId: string,
  slugs: string[],
): Promise<{ ok: true; slugs: string[] } | { ok: false; erro: string }> {
  const catalogo = await getCatalogoInterno();
  const validacao = validarTagsInternas(slugs, catalogo);
  if (!validacao.ok) return validacao;

  const { error } = await supabaseAdmin()
    .from("contacts")
    .update({ tags: validacao.slugs })
    .eq("id", contactId);

  if (error) return { ok: false, erro: "Não foi possível salvar as tags." };
  return { ok: true, slugs: validacao.slugs };
}

/**
 * Ação em massa: adiciona (união) ou remove UMA tag interna nos contatos
 * escolhidos. Uma validação só, no começo — o slug é o mesmo pra todo mundo.
 *
 * A escrita é em lote de leitura + upsert por id: `contacts.tags` é array e o
 * PostgREST não tem `array_append` sem RPC (restrição dura 1). Como o teto de
 * seleção é a PÁGINA (máx. 50 linhas), ler e reescrever cabe folgado.
 *
 * "Adicionar" preserva o que cada contato já tinha, inclusive slug órfão — não
 * é a hora de limpar histórico de ninguém.
 */
export async function tagEmMassa(
  contactIds: string[],
  slug: string,
  operacao: "adicionar" | "remover",
): Promise<{ ok: true; afetados: number } | { ok: false; erro: string }> {
  if (contactIds.length === 0) return { ok: false, erro: "Nenhum contato selecionado." };

  // "Remover" não exige tag ativa — dá pra tirar uma tag que foi desativada
  // depois. "Adicionar" exige, porque escrever slug inativo é criar órfão novo.
  if (operacao === "adicionar") {
    const catalogo = await getCatalogoInterno();
    const validacao = validarTagsInternas([slug], catalogo);
    if (!validacao.ok) return validacao;
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("contacts").select("id, tags").in("id", contactIds);
  if (error) return { ok: false, erro: "Não foi possível ler os contatos." };

  const linhas = (data as { id: string; tags: string[] | null }[]) ?? [];
  let afetados = 0;

  for (const linha of linhas) {
    const atuais = linha.tags ?? [];
    const proximas = operacao === "adicionar" ? unirTags(atuais, slug) : removerTag(atuais, slug);

    // Nada mudou? Não escreve — `updated_at` é o carimbo que a Nina usa pra
    // saber onde parou a revisão, e subir por escrita vazia atrapalha ela.
    if (proximas.length === atuais.length && proximas.every((t, i) => t === atuais[i])) {
      continue;
    }

    const { error: eU } = await sb.from("contacts").update({ tags: proximas }).eq("id", linha.id);
    if (eU) {
      console.error(`[tags.tagEmMassa] contato ${linha.id}:`, eU);
      continue;
    }
    afetados++;
  }

  return { ok: true, afetados };
}
