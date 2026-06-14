"use server";

import { revalidatePath } from "next/cache";
import { getContactById, updateContact } from "@/lib/contacts";
import type { Contact, EstagioFunil } from "@/lib/contacts/types";

export type SaveGestaoInternaResult = {
  success: boolean;
  error?: string;
};

/**
 * Salva a Gestão Interna da visão 360 (estágio, follow-up, notas).
 *
 * `estagioAtualizadoEm` só é tocado quando o estágio realmente muda — comparado
 * contra o valor atual no banco (autoridade do servidor, não do cliente).
 * `updated_at` é cuidado pelo trigger, não entra no patch.
 */
export async function saveGestaoInterna(
  id: string,
  data: { estagio: EstagioFunil; proximoFollowUp: string | null; notasInternas: string },
): Promise<SaveGestaoInternaResult> {
  try {
    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const patch: Partial<Contact> = {
      estagio: data.estagio,
      proximoFollowUp: data.proximoFollowUp,
      notasInternas: data.notasInternas,
    };
    if (data.estagio !== current.estagio) {
      patch.estagioAtualizadoEm = new Date().toISOString();
    }

    await updateContact(id, patch);

    revalidatePath(`/admin/contatos/${id}`);
    revalidatePath("/admin/contatos");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[saveGestaoInterna] erro ao salvar gestão interna:", err);
    return { success: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
