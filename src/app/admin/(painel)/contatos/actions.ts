"use server";

import { revalidatePath } from "next/cache";
import { getContactById, updateContact } from "@/lib/contacts";
import { requireSession } from "@/lib/auth/session";
import type { Contact, EstagioFunil, ContactStatus } from "@/lib/contacts/types";

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type QuickEditInput = {
  name: string;
  whatsapp: string;
  email: string | null;
  estagio: EstagioFunil;
  status: ContactStatus;
};

/**
 * Edição rápida inline da lista de contatos — campos básicos sem entrar no
 * cadastro completo. Passa pelo MESMO `updateContact` da visão 360.
 *
 * Sobre o desync contagem-vs-lista de "possível duplicado": a detecção é
 * estrutural (whatsapp compartilhado) e tem fonte ÚNICA — a RPC
 * `gold_contatos_duplicados`, da qual saem TANTO a contagem do card QUANTO a
 * membresia da lista (ver gold-operacional.ts). Este action não recalcula
 * duplicado em lugar nenhum; ao revalidar `/admin/contatos`, a página re-roda a
 * RPC e contagem e lista voltam coerentes da mesma fonte. Salvar um campo que
 * não é o whatsapp não muda o conjunto; salvar o whatsapp muda — e muda
 * igualmente nos dois, porque é uma fonte só.
 *
 * `estagioAtualizadoEm` só muda quando o estágio realmente muda (autoridade do
 * servidor). `updated_at` fica com o trigger.
 */
export async function quickUpdateContact(
  id: string,
  input: QuickEditInput,
): Promise<ActionResult> {
  try {
    await requireSession();

    const name = input.name.trim();
    const whatsapp = input.whatsapp.trim();
    if (!name) return { success: false, error: "O nome não pode ficar vazio." };
    if (!whatsapp) return { success: false, error: "O WhatsApp não pode ficar vazio." };

    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const email = input.email?.trim() ? input.email.trim() : null;

    const patch: Partial<Contact> = {
      name,
      whatsapp,
      email,
      estagio: input.estagio,
      status: input.status,
    };
    if (input.estagio !== current.estagio) {
      patch.estagioAtualizadoEm = new Date().toISOString();
    }

    await updateContact(id, patch);

    // Revalida lista (+ cards de gap, mesma página), detalhe e dashboard.
    revalidatePath("/admin/contatos");
    revalidatePath(`/admin/contatos/${id}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[quickUpdateContact] erro ao salvar edição rápida:", err);
    return { success: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
