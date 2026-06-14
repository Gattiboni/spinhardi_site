"use server";

import { createContact, addInteraction } from "@/lib/contacts";
import { draftContactFromForm, type ContactFormInput } from "@/lib/contacts/from-form";

// Mesmos campos coletados pelo formulário do site (shape compartilhado com o
// cadastro manual). Mantido como `ContactFormData` pra não mudar o consumidor.
export type ContactFormData = ContactFormInput;

export type ContactFormResult = {
  success: boolean;
  error?: string;
};

/**
 * Captura do formulário do site (`captureContact`).
 *
 * Cria o contato real no Supabase com `origem: "site_contato"` e registra uma
 * interação `form_submission`. O contato é salvo ANTES de qualquer outra coisa —
 * zero perda de lead (se a interação falhar, o contato já está salvo).
 *
 * Iddas/ClickMassa continuam STUB: `sync_status` fica `pending`, nada é enviado
 * pra fora. A sync real é Fase 4.
 */
export async function submitContact(data: ContactFormData): Promise<ContactFormResult> {
  let contactId: string;

  try {
    const draft = draftContactFromForm(data, { origem: "site_contato", hadInteraction: true });
    const contact = await createContact(draft);
    contactId = contact.id;
  } catch (err) {
    console.error("[submitContact] erro ao criar contato:", err);
    return { success: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }

  // Contato já salvo — uma falha aqui não deve fazer o cliente reenviar (evita
  // duplicar o lead). Loga e segue.
  try {
    await addInteraction(contactId, {
      tipo: "form_submission",
      descricao: "Captura via site (formulário de contato)",
      metadata: { origem: "site_contato", destino: data.destinoTipo },
      criadoPor: "sistema",
    });
  } catch (err) {
    console.error("[submitContact] contato criado, mas falhou ao registrar a interação:", err);
  }

  return { success: true };
}
