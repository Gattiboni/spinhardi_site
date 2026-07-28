import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EXCLUSOES_ZERO, type Exclusoes, type PublicoResolvido } from "./types";

/**
 * Resolução de público. A elegibilidade tem definição ÚNICA e ela é a view
 * `contatos_elegiveis_email` (E1): status ativo + e-mail presente +
 * `email_marketing_status` fora de descadastrado/inválido. Nenhuma linha deste
 * arquivo reimplementa esse filtro — todas leem a view.
 *
 * Elegibilidade sempre por cima do público (E2): grupo pode conter gente sem
 * e-mail e gente descadastrada; a interseção com a view é quem manda. As
 * contagens de exclusão existem pra tela explicar o buraco, não pra decidir.
 */

const TETO_LEITURA = 5000; // volume boutique (205 elegíveis hoje); teto defensivo

type LinhaElegivel = { id: string; name: string; email: string };

async function lerElegiveis(): Promise<LinhaElegivel[]> {
  const { data, error } = await supabaseAdmin()
    .from("contatos_elegiveis_email")
    .select("id, name, email")
    .limit(TETO_LEITURA);

  if (error) throw new Error(`Erro ao ler contatos elegíveis: ${error.message}`);
  return ((data as LinhaElegivel[]) ?? []).filter((l) => !!l.email);
}

/** Contagem de elegíveis sem trazer linha — pro contador ao vivo da tela. */
export async function contarElegiveis(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("contatos_elegiveis_email")
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(`Erro ao contar elegíveis: ${error.message}`);
  return count ?? 0;
}

type LinhaContato = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  email_marketing_status: string;
};

/** Classifica por que cada contato NÃO passou na elegibilidade. */
function classificarExclusoes(linhas: LinhaContato[], elegiveis: Set<string>): Exclusoes {
  const ex = { ...EXCLUSOES_ZERO };
  for (const c of linhas) {
    if (elegiveis.has(c.id)) continue;
    if (c.status !== "ativo") ex.inativo++;
    else if (!c.email?.trim()) ex.semEmail++;
    else if (c.email_marketing_status === "descadastrado") ex.descadastrado++;
    else if (c.email_marketing_status === "invalido") ex.invalido++;
    else ex.inativo++; // sobra teórica: fora da view por motivo não mapeado
  }
  return ex;
}

/**
 * Público de "todos os elegíveis". As exclusões são medidas sobre os contatos
 * ATIVOS (a base que a operadora enxerga na lista) — contato arquivado não
 * entra na conta, senão o número assusta sem significar nada.
 */
async function resolverTodos(): Promise<PublicoResolvido> {
  const sb = supabaseAdmin();

  const [elegiveis, { data, error }] = await Promise.all([
    lerElegiveis(),
    sb
      .from("contacts")
      .select("id, name, email, status, email_marketing_status")
      .eq("status", "ativo")
      .limit(TETO_LEITURA),
  ]);

  if (error) throw new Error(`Erro ao ler contatos ativos: ${error.message}`);

  const idsElegiveis = new Set(elegiveis.map((e) => e.id));
  const exclusoes = classificarExclusoes((data as LinhaContato[]) ?? [], idsElegiveis);

  return {
    destinatarios: elegiveis.map((e) => ({
      contactId: e.id,
      email: e.email,
      nome: e.name,
    })),
    exclusoes,
    totalGrupo: null,
  };
}

/** Público de um grupo: membros ∩ view de elegibilidade. */
async function resolverGrupo(grupoId: string): Promise<PublicoResolvido> {
  const sb = supabaseAdmin();

  const { data: membros, error: eM } = await sb
    .from("grupo_contatos")
    .select("contact_id")
    .eq("grupo_id", grupoId)
    .limit(TETO_LEITURA);

  if (eM) throw new Error(`Erro ao ler membros do grupo: ${eM.message}`);
  const ids = ((membros as { contact_id: string }[]) ?? []).map((m) => m.contact_id);

  if (ids.length === 0) {
    return { destinatarios: [], exclusoes: { ...EXCLUSOES_ZERO }, totalGrupo: 0 };
  }

  const [elegiveis, { data: contatos, error: eC }] = await Promise.all([
    lerElegiveis(),
    sb.from("contacts").select("id, name, email, status, email_marketing_status").in("id", ids),
  ]);

  if (eC) throw new Error(`Erro ao ler contatos do grupo: ${eC.message}`);

  const idsGrupo = new Set(ids);
  const doGrupoElegiveis = elegiveis.filter((e) => idsGrupo.has(e.id));
  const idsElegiveis = new Set(doGrupoElegiveis.map((e) => e.id));

  return {
    destinatarios: doGrupoElegiveis.map((e) => ({
      contactId: e.id,
      email: e.email,
      nome: e.name,
    })),
    exclusoes: classificarExclusoes((contatos as LinhaContato[]) ?? [], idsElegiveis),
    totalGrupo: ids.length,
  };
}

/**
 * Resolve o público AGORA (E3). O número que vale é o deste instante, não o da
 * hora em que a operadora escolheu — por isso a tela de revisão e a confirmação
 * final chamam esta mesma função, e a confirmação mostra o número recontado.
 */
export async function resolverPublico(
  publicoTipo: "todos_elegiveis" | "grupo",
  grupoId: string | null,
): Promise<PublicoResolvido> {
  if (publicoTipo === "grupo") {
    if (!grupoId) throw new Error("Campanha de grupo sem grupo escolhido.");
    return resolverGrupo(grupoId);
  }
  return resolverTodos();
}

/** Só a contagem — pro passo 2 e pro resumo, sem trazer a lista inteira à toa. */
export async function contarPublico(
  publicoTipo: "todos_elegiveis" | "grupo",
  grupoId: string | null,
): Promise<{ total: number; exclusoes: Exclusoes; totalGrupo: number | null }> {
  if (publicoTipo === "todos_elegiveis") {
    const resolvido = await resolverTodos();
    return {
      total: resolvido.destinatarios.length,
      exclusoes: resolvido.exclusoes,
      totalGrupo: null,
    };
  }
  const resolvido = await resolverGrupo(grupoId!);
  return {
    total: resolvido.destinatarios.length,
    exclusoes: resolvido.exclusoes,
    totalGrupo: resolvido.totalGrupo,
  };
}
