import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTagsPorContato } from "@/lib/tags";
import type {
  Jornada,
  JornadaComContato,
  JornadaCard,
  EstagioJornada,
  FollowUpTarefa,
  TarefaInterna,
} from "./types";
import { ESTAGIOS_FECHADOS } from "./types";

/**
 * Acesso a jornadas — Supabase (D072).
 *
 * O estágio do funil vive aqui (1 contato → N jornadas). Leitura via Server
 * Components, escrita via Server Actions; ambos passam por este módulo com o
 * client server-only de service role (`supabaseAdmin`).
 *
 * As leituras de LISTA degradam pra vazio em erro (console.error) — mesmo padrão
 * resiliente do gold: o admin não quebra. As ESCRITAS lançam — o caller (action)
 * captura e devolve mensagem ao usuário.
 */

// ─────────────────────────────────────────────────────────────────
// Mappers (snake_case ↔ camelCase, explícito por campo)
// ─────────────────────────────────────────────────────────────────

type JornadaRow = {
  id: string;
  contact_id: string | null;
  estagio: EstagioJornada;
  estagio_atualizado_em: string;
  aberta: boolean;
  aprovacao_status: "pendente" | "aprovada";
  titulo_jornada: string | null;
  valor: number | string | null;
  origem_dado: string;
  bronze_ref: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToJornada(row: JornadaRow): Jornada {
  return {
    id: row.id,
    contactId: row.contact_id,
    estagio: row.estagio,
    estagioAtualizadoEm: row.estagio_atualizado_em,
    aberta: row.aberta,
    aprovacaoStatus: row.aprovacao_status,
    tituloJornada: row.titulo_jornada,
    valor: row.valor == null ? null : Number(row.valor),
    origemDado: row.origem_dado,
    bronzeRef: row.bronze_ref,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLS =
  "id, contact_id, estagio, estagio_atualizado_em, aberta, aprovacao_status, titulo_jornada, valor, origem_dado, bronze_ref, closed_at, created_at, updated_at";

// ─────────────────────────────────────────────────────────────────
// Resolução de nome do contato (join leve em memória)
// ─────────────────────────────────────────────────────────────────

async function resolveContatoNomes(contactIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(contactIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabaseAdmin().from("contacts").select("id, name").in("id", ids);

  if (error) throw error;

  return new Map((data as { id: string; name: string }[]).map((c) => [c.id, c.name]));
}

// ─────────────────────────────────────────────────────────────────
// Follow-up — tarefa futura mais próxima por jornada (bronze_iddas_tarefa)
//
// O vínculo é bronze_iddas_tarefa.id_orcamento = jornadas.bronze_ref. "Futura" =
// data >= hoje. O badge mostra a MAIS PRÓXIMA (menor data >= hoje). Ao abrir o
// card, `getTarefasDaJornada` lista todas (passadas e futuras) daquela jornada.
// ─────────────────────────────────────────────────────────────────

type TarefaRow = {
  id: string;
  assunto: string | null;
  descricao: string | null;
  data: string | null;
  hora: string | null;
  id_orcamento: string | null;
};

function rowToTarefa(row: TarefaRow): FollowUpTarefa {
  return {
    id: row.id,
    assunto: row.assunto,
    descricao: row.descricao,
    data: row.data,
    hora: row.hora,
  };
}

// Nota: o "próxima tarefa futura mais próxima" por jornada (badge do kanban) é
// resolvido agora no Postgres pela RPC `gold_kanban_jornadas` (LEFT JOIN LATERAL).
// O helper antigo `proximasTarefasPorRef` (.in("id_orcamento", [...])) foi removido
// junto com a migração do getKanbanJornadas — recuperável via git se o badge
// precisar ser montado em memória noutra tela.

/** Todas as tarefas de uma jornada (detalhe do card), mais próximas primeiro. */
export async function getTarefasDaJornada(bronzeRef: string | null): Promise<FollowUpTarefa[]> {
  if (!bronzeRef) return [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("bronze_iddas_tarefa")
      .select("id, assunto, descricao, data, hora, id_orcamento")
      .eq("id_orcamento", bronzeRef)
      .order("data", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data as TarefaRow[]) ?? []).map(rowToTarefa);
  } catch (err) {
    console.error("[jornadas] getTarefasDaJornada:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────

/** Uma linha da RPC `gold_kanban_jornadas` (JOIN já resolvido no Postgres). */
type KanbanRpcRow = {
  id: string;
  estagio: EstagioJornada;
  aberta: boolean;
  aprovacao_status: "pendente" | "aprovada";
  titulo_jornada: string | null;
  valor: number | string | null;
  bronze_ref: string | null;
  estagio_atualizado_em: string;
  closed_at: string | null;
  created_at: string;
  contact_id: string | null;
  contato_nome: string | null;
  proxima_tarefa_assunto: string | null;
  proxima_tarefa_data: string | null;
};

/**
 * Kanban: TODAS as jornadas aprovadas (abertas e fechadas), com nome do contato
 * e badge de follow-up. Cada uma vai pra coluna do seu estágio — coluna fechada
 * (aprovado/reprovado) segue visível. O filtro `aberta` saiu de propósito: o
 * quadro mostra tudo; `aberta` só alimenta os agregados do topo e relatórios.
 *
 * O JOIN (nome do contato + próxima tarefa futura) é feito no Postgres pela RPC
 * `gold_kanban_jornadas` — antes resolvíamos em memória com `.in("id", [...])`,
 * o que estourava a URL (HeadersOverflowError) com ~586 jornadas. Uma chamada,
 * zero `.in()`.
 *
 * PONTO DE EXTENSÃO (T8): `gold_kanban_jornadas(p_tags text[])`, pra quando o
 * quadro paginar no servidor. Hoje as 614 jornadas vêm inteiras e o filtro por
 * tag roda no cliente. Troca de assinatura exige `DROP FUNCTION` antes do
 * `CREATE`.
 *
 * O mapa `contactId → slugs` que decora (e agora filtra) os cards saiu deste
 * módulo pra `lib/tags`: o calendário passou a precisar do MESMO mapa pro filtro
 * por tag, e uma query com duas cópias vira duas queries divergentes na primeira
 * mudança. A disciplina de não usar `.in(...)` foi junto, documentada lá.
 */
export async function getKanbanJornadas(): Promise<JornadaCard[]> {
  try {
    const [{ data, error }, tagsPorContato] = await Promise.all([
      supabaseAdmin().rpc("gold_kanban_jornadas"),
      getTagsPorContato(),
    ]);
    if (error) throw error;

    return ((data as KanbanRpcRow[]) ?? []).map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      estagio: r.estagio,
      estagioAtualizadoEm: r.estagio_atualizado_em,
      aberta: r.aberta,
      aprovacaoStatus: r.aprovacao_status,
      tituloJornada: r.titulo_jornada,
      valor: r.valor == null ? null : Number(r.valor),
      origemDado: "", // não usado no card; RPC não retorna
      bronzeRef: r.bronze_ref,
      closedAt: r.closed_at,
      createdAt: r.created_at,
      updatedAt: r.estagio_atualizado_em,
      contatoNome: r.contato_nome,
      tagsInternas: (r.contact_id && tagsPorContato.get(r.contact_id)) || [],
      proximaTarefa:
        r.proxima_tarefa_data == null
          ? null
          : {
              id: "",
              assunto: r.proxima_tarefa_assunto,
              descricao: null,
              data: r.proxima_tarefa_data,
              hora: null,
            },
    }));
  } catch (err) {
    console.error("[jornadas] getKanbanJornadas:", err);
    return [];
  }
}

/** Jornadas pendentes de aprovação (tela de aprovação). */
export async function getJornadasPendentes(): Promise<JornadaComContato[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("jornadas")
      .select(COLS)
      .eq("aprovacao_status", "pendente")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const jornadas = (data as JornadaRow[]).map(rowToJornada);
    const nomes = await resolveContatoNomes(jornadas.map((j) => j.contactId));
    return jornadas.map((j) => ({
      ...j,
      contatoNome: j.contactId ? (nomes.get(j.contactId) ?? null) : null,
    }));
  } catch (err) {
    console.error("[jornadas] getJornadasPendentes:", err);
    return [];
  }
}

/** Jornadas de um contato, separadas em abertas e fechadas (ficha do contato). */
export async function getJornadasDoContato(
  contactId: string,
): Promise<{ abertas: Jornada[]; fechadas: Jornada[] }> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("jornadas")
      .select(COLS)
      .eq("contact_id", contactId)
      .order("estagio_atualizado_em", { ascending: false });
    if (error) throw error;

    const jornadas = (data as JornadaRow[]).map(rowToJornada);
    return {
      abertas: jornadas.filter((j) => j.aberta),
      fechadas: jornadas.filter((j) => !j.aberta),
    };
  } catch (err) {
    console.error("[jornadas] getJornadasDoContato:", err);
    return { abertas: [], fechadas: [] };
  }
}

export async function getJornadaById(id: string): Promise<JornadaComContato | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("jornadas")
      .select(COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const jornada = rowToJornada(data as JornadaRow);
    const nomes = await resolveContatoNomes([jornada.contactId]);
    return {
      ...jornada,
      contatoNome: jornada.contactId ? (nomes.get(jornada.contactId) ?? null) : null,
    };
  } catch (err) {
    console.error("[jornadas] getJornadaById:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Escrita (lança em erro — a action captura)
// ─────────────────────────────────────────────────────────────────

/**
 * Cria uma jornada já aprovada e aberta em "primeiro contato" — entra direto no
 * kanban. Um único caminho de INSERT parametrizado: o "novo atendimento" da ficha
 * usa os defaults (origem "manual", sem título); a captura do site passa
 * `origemDado: "site"` + o título automático. `origemDado` tem default "manual"
 * pra preservar o comportamento dos chamadores existentes.
 */
export async function createJornadaManual(
  contactId: string,
  opts?: { tituloJornada?: string | null; valor?: number | null; origemDado?: string },
): Promise<Jornada> {
  const { data, error } = await supabaseAdmin()
    .from("jornadas")
    .insert({
      contact_id: contactId,
      estagio: "primeiro contato",
      estagio_atualizado_em: new Date().toISOString(),
      aberta: true,
      aprovacao_status: "aprovada",
      origem_dado: opts?.origemDado ?? "manual",
      titulo_jornada: opts?.tituloJornada ?? null,
      valor: opts?.valor ?? null,
    })
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao criar jornada: ${error.message}`);
  return rowToJornada(data as JornadaRow);
}

/** Move a jornada entre colunas abertas do kanban (bumpa estagio_atualizado_em). */
export async function moverJornada(id: string, estagio: EstagioJornada): Promise<Jornada> {
  if ((ESTAGIOS_FECHADOS as string[]).includes(estagio)) {
    throw new Error(`moverJornada não fecha jornada (estágio "${estagio}"). Use fecharJornada.`);
  }
  const { data, error } = await supabaseAdmin()
    .from("jornadas")
    .update({ estagio, estagio_atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao mover jornada: ${error.message}`);
  return rowToJornada(data as JornadaRow);
}

/**
 * Fecha a jornada (some do kanban): set estágio fechado + aberta=false +
 * closed_at=now. `estagio` precisa ser um dos fechados (aprovado | reprovado).
 */
export async function fecharJornada(id: string, estagio: EstagioJornada): Promise<Jornada> {
  if (!(ESTAGIOS_FECHADOS as string[]).includes(estagio)) {
    throw new Error(`Estágio de fechamento inválido: ${estagio}`);
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("jornadas")
    .update({
      estagio,
      aberta: false,
      closed_at: now,
      estagio_atualizado_em: now,
    })
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao fechar jornada: ${error.message}`);
  return rowToJornada(data as JornadaRow);
}

/**
 * Aprova uma jornada pendente (entra no kanban). Permite corrigir o estágio
 * sugerido pelo mapper antes de aprovar.
 */
export async function aprovarJornada(id: string, estagio: EstagioJornada): Promise<Jornada> {
  const { data, error } = await supabaseAdmin()
    .from("jornadas")
    .update({
      aprovacao_status: "aprovada",
      estagio,
      estagio_atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao aprovar jornada: ${error.message}`);
  return rowToJornada(data as JornadaRow);
}

/**
 * Edita o valor único da jornada (campo editável da operação no detalhe). O
 * significado (cotação/ganho/perda) vem do estágio — aqui só sobrescreve o número.
 */
export async function updateValor(id: string, valor: number | null): Promise<Jornada> {
  const { data, error } = await supabaseAdmin()
    .from("jornadas")
    .update({ valor })
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao salvar valor: ${error.message}`);
  return rowToJornada(data as JornadaRow);
}

// ─────────────────────────────────────────────────────────────────
// Tarefas internas da jornada (tarefas_jornada) — to-do editável
// ─────────────────────────────────────────────────────────────────

type TarefaInternaRow = {
  id: string;
  jornada_id: string;
  assunto: string;
  descricao: string | null;
  data: string | null;
  hora: string | null;
  concluida: boolean;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
};

function rowToTarefaInterna(row: TarefaInternaRow): TarefaInterna {
  return {
    id: row.id,
    jornadaId: row.jornada_id,
    assunto: row.assunto,
    descricao: row.descricao,
    data: row.data,
    hora: row.hora,
    concluida: row.concluida,
    concluidaEm: row.concluida_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TAREFA_COLS =
  "id, jornada_id, assunto, descricao, data, hora, concluida, concluida_em, created_at, updated_at";

/** Tarefas internas de uma jornada — pendentes primeiro, depois por data. */
export async function getTarefasInternas(jornadaId: string): Promise<TarefaInterna[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("tarefas_jornada")
      .select(TAREFA_COLS)
      .eq("jornada_id", jornadaId)
      .order("concluida", { ascending: true })
      .order("data", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data as TarefaInternaRow[]) ?? []).map(rowToTarefaInterna);
  } catch (err) {
    console.error("[jornadas] getTarefasInternas:", err);
    return [];
  }
}

/** Cria uma tarefa interna (assunto obrigatório; data opcional). */
export async function criarTarefaInterna(
  jornadaId: string,
  input: { assunto: string; data?: string | null },
): Promise<TarefaInterna> {
  const { data, error } = await supabaseAdmin()
    .from("tarefas_jornada")
    .insert({
      jornada_id: jornadaId,
      assunto: input.assunto,
      data: input.data ?? null,
      concluida: false,
    })
    .select(TAREFA_COLS)
    .single();

  if (error) throw new Error(`Erro ao criar tarefa: ${error.message}`);
  return rowToTarefaInterna(data as TarefaInternaRow);
}

/** Marca/desmarca uma tarefa interna como concluída (seta concluida_em). */
export async function setTarefaConcluida(id: string, concluida: boolean): Promise<TarefaInterna> {
  const { data, error } = await supabaseAdmin()
    .from("tarefas_jornada")
    .update({
      concluida,
      concluida_em: concluida ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select(TAREFA_COLS)
    .single();

  if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
  return rowToTarefaInterna(data as TarefaInternaRow);
}
