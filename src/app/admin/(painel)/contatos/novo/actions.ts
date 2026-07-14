"use server";

import { revalidatePath } from "next/cache";
import { createContact } from "@/lib/contacts";
import { draftContactFromForm, type ContactFormInput } from "@/lib/contacts/from-form";
import { whatsappValidationError } from "@/lib/contacts/phone";
import { requireSession } from "@/lib/auth/session";

export type CreateContactResult = {
  success: boolean;
  error?: string;
};

/**
 * Cadastro manual de contato no back office.
 *
 * Cria com `origem: "manual"` — sem interação `form_submission` e sem chamar
 * sync externo (`sync_status` fica `pending`). A lista é revalidada pra refletir
 * o novo contato.
 */
export async function createManualContact(data: ContactFormInput): Promise<CreateContactResult> {
  try {
    await requireSession();

    // WhatsApp é OPCIONAL no cadastro manual (U1): vazio passa (vira null no
    // draft). Se preenchido, valida o formato — não gravamos telefone lixo.
    const whatsapp = data.whatsapp?.trim() ?? "";
    if (whatsapp) {
      const waErr = whatsappValidationError(whatsapp);
      if (waErr) return { success: false, error: waErr };
    }

    const draft = draftContactFromForm(data, { origem: "manual", hadInteraction: false });
    await createContact(draft);
    revalidatePath("/admin/contatos");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[createManualContact] erro ao criar contato manual:", err);
    return { success: false, error: "Não foi possível salvar o contato. Tente novamente." };
  }
}
