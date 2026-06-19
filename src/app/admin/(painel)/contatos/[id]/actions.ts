"use server";

import { revalidatePath } from "next/cache";
import {
  getContactById,
  updateContact,
  addInteraction,
  updateNotaInterna,
  deleteNotaInterna,
} from "@/lib/contacts";
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
 * Salva a Gestão Interna da visão 360 (estágio, follow-up).
 *
 * As "notas internas" de texto livre saíram daqui (Lote C): viraram a timeline
 * de interações (`contact_interactions`, tipo `nota_interna`). Este action não
 * toca mais a coluna `notas_internas`.
 *
 * `estagioAtualizadoEm` só é tocado quando o estágio realmente muda — comparado
 * contra o valor atual no banco (autoridade do servidor, não do cliente).
 * `updated_at` é cuidado pelo trigger, não entra no patch.
 */
export async function saveGestaoInterna(
  id: string,
  data: { estagio: EstagioFunil; proximoFollowUp: string | null },
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
 * Timeline — adiciona uma nota interna (`contact_interactions`, tipo
 * `nota_interna`). Sem auth real ainda (D030 deferido): `criadoPor` fica com o
 * ator genérico de back-office já usado no resto do back-office — a coluna é
 * NOT NULL sem default, então não dá pra deixar null; não inventamos identidade
 * de usuário. Revalida só o detalhe (a nota não aparece na lista nem no dash).
 */
export async function addContactNote(id: string, texto: string): Promise<ActionResult> {
  try {
    await requireSession();
    const descricao = texto.trim();
    if (!descricao) {
      return { success: false, error: "A nota não pode ficar vazia." };
    }

    const contact = await getContactById(id);
    if (!contact) {
      return { success: false, error: "Contato não encontrado." };
    }

    await addInteraction(id, {
      tipo: "nota_interna",
      descricao,
      metadata: {},
      criadoPor: "back-office",
    });

    revalidatePath(`/admin/contatos/${id}`);
    return { success: true };
  } catch (err) {
    console.error("[addContactNote] erro ao adicionar nota:", err);
    return { success: false, error: "Não foi possível salvar a nota. Tente novamente." };
  }
}

/**
 * Timeline — edita o texto de uma nota interna. A lib filtra por
 * `tipo='nota_interna'`: evento de sistema nunca é editável.
 */
export async function editContactNote(
  contactId: string,
  noteId: string,
  texto: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const descricao = texto.trim();
    if (!descricao) {
      return { success: false, error: "A nota não pode ficar vazia." };
    }

    const matched = await updateNotaInterna(noteId, descricao);
    if (matched === 0) {
      return { success: false, error: "Nota não encontrada (ou não é editável)." };
    }

    revalidatePath(`/admin/contatos/${contactId}`);
    return { success: true };
  } catch (err) {
    console.error("[editContactNote] erro ao editar nota:", err);
    return { success: false, error: "Não foi possível editar a nota. Tente novamente." };
  }
}

/**
 * Timeline — exclui uma nota interna. Mesma trava `tipo='nota_interna'` na lib:
 * evento de sistema é read-only.
 */
export async function deleteContactNote(
  contactId: string,
  noteId: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const matched = await deleteNotaInterna(noteId);
    if (matched === 0) {
      return { success: false, error: "Nota não encontrada (ou não é excluível)." };
    }

    revalidatePath(`/admin/contatos/${contactId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteContactNote] erro ao excluir nota:", err);
    return { success: false, error: "Não foi possível excluir a nota. Tente novamente." };
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
    revalidatePath("/admin/contatos");
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
    revalidatePath("/admin/contatos");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("[registrarLancamento] erro ao registrar lançamento:", err);
    return { success: false, error: "Não foi possível registrar o lançamento. Tente novamente." };
  }
}
