"use server";

import { revalidatePath } from "next/cache";
import { getContactById, updateContact, addInteraction } from "@/lib/contacts";
import { requireSession } from "@/lib/auth/session";
import { sendWelcomeMessage, ClickMassaError } from "@/lib/integrations/clickmassa";
import { createNegocio, createLancamento } from "@/lib/financeiro";
import type { NovoNegocioInput, NovoLancamentoInput } from "@/lib/financeiro/types";
import type { Contact, EstagioFunil } from "@/lib/contacts/types";

export type SaveGestaoInternaResult = {
  success: boolean;
  error?: string;
};

export type ActionResult = {
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
    await requireSession();
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

/**
 * Ação por canal: manda a mensagem inicial de WhatsApp via ClickMassa.
 *
 * Usa a abstração `sendWelcomeMessage` do lib (que chama `sendMessage` por baixo)
 * — não toca na API direto. Só faz sentido pra contato com vínculo ClickMassa;
 * o botão só aparece nesse caso. Registra uma interação `whatsapp_enviado` na
 * timeline (best-effort: a mensagem já saiu).
 */
export async function sendWhatsAppWelcome(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const contact = await getContactById(id);
    if (!contact) {
      return { success: false, error: "Contato não encontrado." };
    }

    await sendWelcomeMessage({
      name: contact.name,
      phone: contact.whatsapp,
      externalKey: contact.id,
    });

    try {
      await addInteraction(contact.id, {
        tipo: "whatsapp_enviado",
        descricao: "Mensagem inicial enviada via WhatsApp (ClickMassa) pelo back-office.",
        metadata: { canal: "clickmassa", origem: "acao_manual" },
        criadoPor: "back-office",
      });
    } catch (interErr) {
      console.error("[sendWhatsAppWelcome] mensagem enviada, mas falhou ao registrar interação:", interErr);
    }

    revalidatePath(`/admin/contatos/${id}`);
    return { success: true };
  } catch (err) {
    console.error("[sendWhatsAppWelcome] erro ao enviar WhatsApp:", err);
    const msg =
      err instanceof ClickMassaError
        ? `Falha no ClickMassa: ${err.message}`
        : "Não foi possível enviar a mensagem agora.";
    return { success: false, error: msg };
  }
}

/**
 * Entrada manual de financeiro (E4): grava na silver `negocios`.
 * Rótulos do form são livres; gravam exatamente nas colunas que o gold soma.
 */
export async function registrarNegocio(
  id: string,
  input: NovoNegocioInput,
): Promise<ActionResult> {
  try {
    await requireSession();
    const contact = await getContactById(id);
    if (!contact) {
      return { success: false, error: "Contato não encontrado." };
    }

    await createNegocio(id, input);

    revalidatePath(`/admin/contatos/${id}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[registrarNegocio] erro ao registrar negócio:", err);
    return { success: false, error: "Não foi possível registrar o negócio. Tente novamente." };
  }
}

/**
 * Entrada manual de financeiro (E4): grava na silver `lancamentos`.
 * `valor` é obrigatório (validado também no banco).
 */
export async function registrarLancamento(
  id: string,
  input: NovoLancamentoInput,
): Promise<ActionResult> {
  try {
    await requireSession();
    const contact = await getContactById(id);
    if (!contact) {
      return { success: false, error: "Contato não encontrado." };
    }

    await createLancamento(id, input);

    revalidatePath(`/admin/contatos/${id}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[registrarLancamento] erro ao registrar lançamento:", err);
    return { success: false, error: "Não foi possível registrar o lançamento. Tente novamente." };
  }
}
