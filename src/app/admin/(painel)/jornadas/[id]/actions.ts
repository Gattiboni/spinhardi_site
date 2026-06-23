"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  updateValor,
  criarTarefaInterna,
  setTarefaConcluida,
  fecharJornada,
} from "@/lib/jornadas";
import { ESTAGIOS_FECHADOS, type EstagioJornada } from "@/lib/jornadas/types";

export type ActionResult = { success: boolean; error?: string };

function revalidarJornada(id: string): void {
  revalidatePath(`/admin/jornadas/${id}`);
  revalidatePath("/admin/jornadas");
  revalidatePath("/admin");
}

/** Salva o valor único editado no detalhe (campo da operação). */
export async function salvarValorAction(
  id: string,
  valor: number | null,
): Promise<ActionResult> {
  try {
    await requireSession();
    if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
      return { success: false, error: "Valor inválido." };
    }
    await updateValor(id, valor);
    revalidatePath(`/admin/jornadas/${id}`);
    revalidatePath("/admin/jornadas");
    return { success: true };
  } catch (err) {
    console.error("[salvarValorAction] erro:", err);
    return { success: false, error: "Não foi possível salvar o valor." };
  }
}

/** Cria uma tarefa interna (assunto obrigatório, data opcional). */
export async function criarTarefaAction(
  jornadaId: string,
  assunto: string,
  data: string | null,
): Promise<ActionResult> {
  try {
    await requireSession();
    const limpo = assunto.trim();
    if (!limpo) return { success: false, error: "O assunto não pode ficar vazio." };
    await criarTarefaInterna(jornadaId, { assunto: limpo, data: data || null });
    revalidatePath(`/admin/jornadas/${jornadaId}`);
    return { success: true };
  } catch (err) {
    console.error("[criarTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível criar a tarefa." };
  }
}

/** Marca/desmarca uma tarefa interna como concluída. */
export async function toggleTarefaAction(
  jornadaId: string,
  tarefaId: string,
  concluida: boolean,
): Promise<ActionResult> {
  try {
    await requireSession();
    await setTarefaConcluida(tarefaId, concluida);
    revalidatePath(`/admin/jornadas/${jornadaId}`);
    return { success: true };
  } catch (err) {
    console.error("[toggleTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível atualizar a tarefa." };
  }
}

/** Fecha a jornada pelo desfecho (aprovado = ganhou, reprovado = perdeu). */
async function fecharComEstagio(id: string, estagio: EstagioJornada): Promise<ActionResult> {
  try {
    await requireSession();
    if (!(ESTAGIOS_FECHADOS as string[]).includes(estagio)) {
      return { success: false, error: "Estágio de fechamento inválido." };
    }
    await fecharJornada(id, estagio);
    revalidarJornada(id);
    return { success: true };
  } catch (err) {
    console.error("[fecharComEstagio detalhe] erro:", err);
    return { success: false, error: "Não foi possível fechar a jornada." };
  }
}

export async function marcarGanhouAction(id: string): Promise<ActionResult> {
  return fecharComEstagio(id, "aprovado");
}

export async function marcarPerdeuAction(id: string): Promise<ActionResult> {
  return fecharComEstagio(id, "reprovado");
}
