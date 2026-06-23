"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { moverJornada, fecharJornada, aprovarJornada } from "@/lib/jornadas";
import {
  ESTAGIOS_ABERTOS,
  ESTAGIOS_FECHADOS,
  type EstagioJornada,
} from "@/lib/jornadas/types";
import { ESTAGIOS_OPTIONS } from "@/lib/contacts/types";

export type ActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Move uma jornada entre as colunas abertas do kanban (drag-and-drop).
 * Só aceita estágios ABERTOS — fechar é pelas ações dedicadas (aprovado/reprovado).
 */
export async function moverJornadaAction(
  id: string,
  estagio: EstagioJornada,
): Promise<ActionResult> {
  try {
    await requireSession();
    if (!(ESTAGIOS_ABERTOS as string[]).includes(estagio)) {
      return { success: false, error: "Estágio inválido pro kanban." };
    }
    await moverJornada(id, estagio);
    revalidatePath("/admin/jornadas");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[moverJornadaAction] erro:", err);
    return { success: false, error: "Não foi possível mover a jornada." };
  }
}

/** Marca a jornada como aprovada e fecha (some do quadro, vai pro histórico). */
export async function marcarAprovadoAction(id: string): Promise<ActionResult> {
  return fecharComEstagio(id, "aprovado");
}

/** Marca a jornada como reprovada e fecha. */
export async function marcarReprovadoAction(id: string): Promise<ActionResult> {
  return fecharComEstagio(id, "reprovado");
}

async function fecharComEstagio(
  id: string,
  estagio: EstagioJornada,
): Promise<ActionResult> {
  try {
    await requireSession();
    if (!(ESTAGIOS_FECHADOS as string[]).includes(estagio)) {
      return { success: false, error: "Estágio de fechamento inválido." };
    }
    await fecharJornada(id, estagio);
    revalidatePath("/admin/jornadas");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[fecharComEstagio] erro:", err);
    return { success: false, error: "Não foi possível fechar a jornada." };
  }
}

/**
 * Aprova uma jornada pendente (tela de aprovação). Permite confirmar ou corrigir
 * o estágio sugerido antes de aprovar — entra no kanban como aberta+aprovada.
 */
export async function aprovarJornadaAction(
  id: string,
  estagio: EstagioJornada,
): Promise<ActionResult> {
  try {
    await requireSession();
    if (!(ESTAGIOS_OPTIONS as string[]).includes(estagio)) {
      return { success: false, error: "Estágio inválido." };
    }
    await aprovarJornada(id, estagio);
    revalidatePath("/admin/jornadas/aprovacao");
    revalidatePath("/admin/jornadas");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[aprovarJornadaAction] erro:", err);
    return { success: false, error: "Não foi possível aprovar a jornada." };
  }
}
