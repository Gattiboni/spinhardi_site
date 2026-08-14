import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { iniciaisDe, type CalendarEvent, type EventType, type Pessoa } from "./types";
import type { DataISO, HoraISO } from "./datas";

/**
 * Acesso a dados do calendário.
 *
 * LEITURA DE EXIBIÇÃO: exclusivamente `calendar_events_between` (contrato C4). É
 * a definição única do que aparece no calendário — mesma postura da view de
 * elegibilidade de e-mail. Nenhuma tela consulta bronze ou `tarefas` direto pra
 * exibir; se faltasse algo, o lugar de consertar seria a RPC, não a UI.
 *
 * A única leitura FORA da RPC é `getPessoasAprovadas()`, e ela não é exibição de
 * evento: é o elenco do seletor de escopo (C5), que vem de `user_profiles`.
 *
 * Mesmo padrão do módulo de jornadas: leitura degrada pra vazio (console.error —
 * o admin não quebra), escrita LANÇA (a action captura e devolve mensagem).
 */

// ─────────────────────────────────────────────────────────────────
// Leitura — RPC
// ─────────────────────────────────────────────────────────────────

type CalendarEventRow = {
  event_type: EventType;
  source_type: string;
  source_id: string;
  titulo: string | null;
  data_inicio: string;
  hora_inicio: string | null;
  data_fim: string | null;
  multi_dia: boolean | null;
  editavel: boolean | null;
  concluida: boolean | null;
  responsavel_user_id: string | null;
  contact_id: string | null;
  cliente_nome: string | null;
  meta: Record<string, unknown> | null;
  source_updated_at: string | null;
};

function rowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    eventType: row.event_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    // A RPC monta título pra tudo, mas `tarefa_iddas` puxa `bt.assunto`, que é
    // nullable na bronze. Um chip sem rótulo seria um retângulo colorido mudo.
    titulo: row.titulo?.trim() || "(sem título)",
    dataInicio: row.data_inicio,
    horaInicio: row.hora_inicio,
    dataFim: row.data_fim,
    multiDia: row.multi_dia ?? false,
    editavel: row.editavel ?? false,
    concluida: row.concluida,
    responsavelUserId: row.responsavel_user_id,
    contactId: row.contact_id,
    clienteNome: row.cliente_nome,
    meta: row.meta ?? {},
    sourceUpdatedAt: row.source_updated_at,
  };
}

/**
 * Eventos entre duas datas (inclusive) — a ÚNICA leitura de exibição.
 *
 * O range é o da visão corrente: a grade de 42 dias no Mês, os 7 dias na Semana,
 * hoje−60/hoje+30 na Agenda. Quem monta o range é o chamador (`page.tsx`).
 */
export async function getCalendarEvents(inicio: DataISO, fim: DataISO): Promise<CalendarEvent[]> {
  try {
    const { data, error } = await supabaseAdmin().rpc("calendar_events_between", {
      p_inicio: inicio,
      p_fim: fim,
    });
    if (error) throw error;
    return ((data as CalendarEventRow[]) ?? []).map(rowToEvent);
  } catch (err) {
    console.error("[calendario] getCalendarEvents:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Leitura — elenco do seletor (C5)
// ─────────────────────────────────────────────────────────────────

type PerfilRow = { id: string; name: string; role: string | null };

/**
 * Pessoas aprovadas, em ordem alfabética. Fonte única do seletor de escopo e do
 * campo "responsável" do composer.
 *
 * Entrou usuário aprovado → aparece. Mudou de role → o comportamento muda. Saiu
 * → some. Nenhum nome, id ou role em código (C5.1).
 */
export async function getPessoasAprovadas(): Promise<Pessoa[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("user_profiles")
      .select("id, name, role")
      .eq("status", "approved")
      .order("name", { ascending: true });
    if (error) throw error;

    return ((data as PerfilRow[]) ?? []).map((p) => ({
      id: p.id,
      nome: p.name,
      iniciais: iniciaisDe(p.name),
      ehAdmin: p.role === "admin",
    }));
  } catch (err) {
    console.error("[calendario] getPessoasAprovadas:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Leitura — vínculos do formulário completo (contato e jornada)
// ─────────────────────────────────────────────────────────────────

/**
 * Busca de contato pro campo de vínculo da tarefa. NÃO é leitura de exibição de
 * evento (C4 segue intacto): é o autocomplete de um formulário.
 *
 * `ilike` + `limit` no Postgres em vez de `getContacts({search})`, que carrega a
 * tabela inteira e filtra em memória — aceitável numa lista paginada, caro num
 * campo que dispara a cada tecla.
 */
export async function buscarContatosParaVinculo(
  termo: string,
): Promise<{ id: string; nome: string }[]> {
  const limpo = termo.trim();
  if (limpo.length < 2) return [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("contacts")
      .select("id, name")
      .eq("status", "ativo")
      .ilike("name", `%${limpo}%`)
      .order("name", { ascending: true })
      .limit(10);
    if (error) throw error;
    return ((data as { id: string; name: string }[]) ?? []).map((c) => ({
      id: c.id,
      nome: c.name,
    }));
  } catch (err) {
    console.error("[calendario] buscarContatosParaVinculo:", err);
    return [];
  }
}

/** Jornadas ABERTAS de um contato — alimenta o select de vínculo do formulário. */
export async function getJornadasParaVinculo(
  contactId: string,
): Promise<{ id: string; titulo: string }[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("jornadas")
      .select("id, titulo_jornada, estagio")
      .eq("contact_id", contactId)
      .eq("aberta", true)
      .order("estagio_atualizado_em", { ascending: false });
    if (error) throw error;

    return ((data as { id: string; titulo_jornada: string | null; estagio: string }[]) ?? []).map(
      (j) => ({ id: j.id, titulo: j.titulo_jornada?.trim() || `Jornada · ${j.estagio}` }),
    );
  } catch (err) {
    console.error("[calendario] getJornadasParaVinculo:", err);
    return [];
  }
}

/** Guarda de escrita: o responsável precisa existir E estar aprovado (C2). */
export async function ehResponsavelValido(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(`Erro ao validar responsável: ${error.message}`);
  return !!data;
}

// ─────────────────────────────────────────────────────────────────
// Escrita — `tarefas` (escritor único: as actions do back-office)
// ─────────────────────────────────────────────────────────────────

export type NovaTarefa = {
  titulo: string;
  data: DataISO;
  hora: HoraISO | null;
  tipo: number | null;
  descricao: string | null;
  responsavelId: string;
  contactId: string | null;
  jornadaId: string | null;
  criadoPor: string;
};

export async function criarTarefa(input: NovaTarefa): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin()
    .from("tarefas")
    .insert({
      titulo: input.titulo,
      data: input.data,
      hora: input.hora,
      tipo: input.tipo,
      descricao: input.descricao,
      responsavel_id: input.responsavelId,
      contact_id: input.contactId,
      jornada_id: input.jornadaId,
      created_by: input.criadoPor,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao criar tarefa: ${error.message}`);
  return { id: (data as { id: string }).id };
}

export type EdicaoTarefa = {
  titulo: string;
  data: DataISO;
  hora: HoraISO | null;
  tipo: number | null;
  descricao: string | null;
  responsavelId: string;
  contactId: string | null;
  jornadaId: string | null;
};

export async function atualizarTarefa(id: string, input: EdicaoTarefa): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("tarefas")
    .update({
      titulo: input.titulo,
      data: input.data,
      hora: input.hora,
      tipo: input.tipo,
      descricao: input.descricao,
      responsavel_id: input.responsavelId,
      contact_id: input.contactId,
      jornada_id: input.jornadaId,
    })
    .eq("id", id);

  if (error) throw new Error(`Erro ao salvar tarefa: ${error.message}`);
}

/** Reagendamento por arrasto — muda SÓ a data, preservando a hora. */
export async function reagendarTarefa(id: string, data: DataISO): Promise<void> {
  const { error } = await supabaseAdmin().from("tarefas").update({ data }).eq("id", id);
  if (error) throw new Error(`Erro ao reagendar: ${error.message}`);
}

/**
 * Conclui ou reabre. O estado é DERIVADO de `concluida_em` (C2) — não existe
 * booleano paralelo. Reabrir limpa data e autor juntos: autoria de conclusão sem
 * conclusão seria um rastro mentindo.
 */
export async function setTarefaConcluida(
  id: string,
  concluida: boolean,
  usuarioId: string,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("tarefas")
    .update({
      concluida_em: concluida ? new Date().toISOString() : null,
      concluida_por: concluida ? usuarioId : null,
    })
    .eq("id", id);

  if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
}

/** Hard delete — tarefa local não é histórico de origem externa (C2). */
export async function excluirTarefa(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("tarefas").delete().eq("id", id);
  if (error) throw new Error(`Erro ao excluir tarefa: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────
// Escrita — `calendar_checkins` (C3)
// ─────────────────────────────────────────────────────────────────

/**
 * Marca o check-in como feito. A tabela é "zero linha até alguém concluir": a
 * existência da linha É o estado. Upsert (e não insert) porque dois cliques
 * rápidos no mesmo check-in não podem virar erro de chave duplicada — a segunda
 * gravação só reafirma quem confirmou por último.
 */
export async function confirmarCheckin(vooBronzeId: string, usuarioId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("calendar_checkins").upsert(
    {
      voo_bronze_id: vooBronzeId,
      concluido_por: usuarioId,
      concluido_em: new Date().toISOString(),
    },
    { onConflict: "voo_bronze_id" },
  );

  if (error) throw new Error(`Erro ao confirmar check-in: ${error.message}`);
}

/** Desfaz o check-in: apaga a linha e o evento volta a pendente na próxima leitura. */
export async function desfazerCheckin(vooBronzeId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("calendar_checkins")
    .delete()
    .eq("voo_bronze_id", vooBronzeId);

  if (error) throw new Error(`Erro ao desfazer check-in: ${error.message}`);
}

/** Uma tarefa local existe? Guarda das actions que operam por id. */
export async function tarefaExiste(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("tarefas")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Erro ao localizar tarefa: ${error.message}`);
  return !!data;
}
