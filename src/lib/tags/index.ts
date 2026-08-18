import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  validarTagsInternas,
  unirTags,
  removerTag,
  validarEntradaTag,
  ehErroDeUnicidade,
  mensagemSlugEmUso,
} from "./shared";
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

/**
 * PONTO DE EXTENSÃO (T8): `tags.iddas_etiqueta_id`, no molde da ponte dormente
 * `clickmassa_tag_id` (UNIQUE, hoje 100% nula). É por onde o vocabulário das
 * etiquetas do Iddas se ligaria ao catálogo interno quando aquele lote rodar.
 * NÃO implementado aqui: etiqueta do Iddas é de ORÇAMENTO, não de contato, e o
 * vínculo vive em tabela própria — nada neste módulo bloqueia (frente E da
 * investigação α).
 */
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

/**
 * Slugs de `contacts.tags` por contato — mapa `contactId → slugs`.
 *
 * Uma query só, sem `.in(...)`: filtrar pelos contatos de uma tela exigiria a
 * lista de ids na URL, exatamente o que estourou o header do kanban antes
 * (`UND_ERR_HEADERS_OVERFLOW`). A tabela toda são ~1k linhas de duas colunas, e
 * só as com tag entram no mapa. Degrada pra mapa vazio em erro: tag é decoração
 * e filtro, nunca motivo pra uma tela cair.
 *
 * Nasceu privada em `lib/jornadas` (decoração do card) e subiu pra cá quando o
 * calendário passou a precisar do mesmo mapa pro filtro por tag — dois
 * consumidores, uma query.
 */
export async function getTagsPorContato(): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  try {
    const { data, error } = await supabaseAdmin()
      .from("contacts")
      .select("id, tags")
      .not("tags", "is", null);
    if (error) throw error;

    for (const linha of (data as { id: string; tags: string[] | null }[]) ?? []) {
      if (linha.tags && linha.tags.length > 0) mapa.set(linha.id, linha.tags);
    }
  } catch (err) {
    console.error("[tags] getTagsPorContato:", err);
  }
  return mapa;
}

// ─────────────────────────────────────────────────────────────────
// Escrita — catálogo `tags` (criação no ponto de uso)
// ─────────────────────────────────────────────────────────────────

/**
 * Cria uma tag no catálogo a partir do ponto de uso (T2/T3).
 *
 * Diferenças que justificam existir ao lado do `createTag` de Configurações:
 *
 *  • DEVOLVE a tag criada. O chamador antigo tinha que adivinhar o slug com uma
 *    segunda cópia da normalização e esperar um `router.refresh()` pra ver a tag
 *    aparecer no catálogo. Com o retorno, ela já entra aplicada na hora.
 *  • Cor OPCIONAL, resolvida pela paleta — a criação inline não tem seletor.
 *  • Sem `grupo`: campo de curadoria, vive em Configurações.
 *
 * A guarda de permissão NÃO está aqui: este módulo é acesso a dados. Quem exige
 * sessão é a action (`./actions`), como no resto do repo.
 */
export async function criarTagInterna(entrada: {
  name: string;
  cor?: string | null;
}): Promise<{ ok: true; tag: TagInterna } | { ok: false; erro: string }> {
  const catalogo = await getCatalogoInterno();
  const validacao = validarEntradaTag(entrada, catalogo);
  if (!validacao.ok) return { ok: false, erro: validacao.erro };

  const { name, slug, cor } = validacao.valor;

  const { data, error } = await supabaseAdmin()
    .from("tags")
    .insert({ name, slug, cor, grupo: null, is_active: true })
    .select("id, name, slug, cor, grupo, is_active")
    .single();

  if (error) {
    if (ehErroDeUnicidade(error.message)) return { ok: false, erro: mensagemSlugEmUso(slug) };
    console.error("[tags.criarTagInterna]", error);
    return { ok: false, erro: "Não foi possível criar a tag." };
  }

  const linha = data as LinhaTagInterna;
  return {
    ok: true,
    tag: {
      id: linha.id,
      name: linha.name,
      slug: linha.slug,
      cor: linha.cor,
      grupo: linha.grupo,
      isActive: linha.is_active,
    },
  };
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
