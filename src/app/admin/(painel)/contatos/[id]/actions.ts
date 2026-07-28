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
import { createJornadaManual } from "@/lib/jornadas";
import {
  normalizeDadosPessoais,
  normalizeQualificacao,
  type DadosPessoaisForm,
  type QualificacaoForm,
} from "@/lib/contacts/edit-validation";
import type { NovoNegocioInput, NovoLancamentoInput } from "@/lib/financeiro/types";
import { definirTagsDoContato } from "@/lib/tags";
import type { Contact } from "@/lib/contacts/types";

export type SaveGestaoInternaResult = {
  success: boolean;
  error?: string;
};

export type ActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Salva a Gestão Interna da visão 360 (follow-up).
 *
 * O estágio do funil saiu daqui (migrou pra `jornadas`): o contato é a pessoa, o
 * estágio vive na jornada. Este action cuida só do próximo follow-up do contato.
 * `updated_at` é cuidado pelo trigger, não entra no patch.
 */
export async function saveGestaoInterna(
  id: string,
  data: { proximoFollowUp: string | null },
): Promise<SaveGestaoInternaResult> {
  try {
    await requireSession();
    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const patch: Partial<Contact> = {
      proximoFollowUp: data.proximoFollowUp,
    };

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

// Revalida o que a edição de contato pode ter mudado na tela: a ficha, a lista
// (nome/origem/destino são colunas dela, além dos cards de gap) e o dashboard.
// Mesmo conjunto que a edição rápida da lista já revalidava.
function revalidateContato(id: string) {
  revalidatePath(`/admin/contatos/${id}`);
  revalidatePath("/admin/contatos");
  revalidatePath("/admin");
}

// Carimbo de edição HUMANA por card (`dados_editado_em` / `qualificacao_editado_em`,
// timestamptz nullable). Separado do `updated_at`, que o trigger sobe a cada
// escrita — inclusive a do sync. Só estas duas actions escrevem nessas colunas.
function agoraIso(): string {
  return new Date().toISOString();
}

/**
 * Card "Dados" da ficha — edição dos campos cadastrais (M1): nome, whatsapp,
 * e-mail, cpf, data de nascimento, cidade, estado, cep.
 *
 * Escreve pelo MESMO `updateContact` da lista e da visão 360 (update direto no
 * Supabase com service role); `updated_at` fica com o trigger do banco, nunca
 * entra no patch. As regras de validação vivem em `edit-validation.ts` e rodam
 * de novo AQUI — server action é alcançável por POST direto, o que o client
 * validou não vale como garantia.
 *
 * Nada de sync: os campos cadastrais que as origens também escrevem (email, cpf,
 * cidade, estado, cep, data_nascimento) são reconciliados pelo three-way (M2),
 * que é entrega de outro canal. Aqui só grava o que o humano digitou.
 */
export async function updateContactDados(
  id: string,
  input: DadosPessoaisForm,
): Promise<ActionResult> {
  try {
    await requireSession();

    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const parsed = normalizeDadosPessoais(input, current);
    if (!parsed.ok) {
      return { success: false, error: parsed.error };
    }

    const patch: Partial<Contact> = { ...parsed.value, dadosEditadoEm: agoraIso() };
    await updateContact(id, patch);

    revalidateContato(id);
    return { success: true };
  } catch (err) {
    console.error("[updateContactDados] erro ao salvar dados do contato:", err);
    return { success: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

/**
 * Card "Qualificação" da ficha — origem, destino, prazo, orçamento, perfil e
 * passageiros. São campos INTERNOS do back-office (M1): editáveis livremente, o
 * sync nunca os toca.
 *
 * Os valores dos selects vêm das listas de `types.ts` (as mesmas do form de
 * criação), que batem 1:1 com os CHECK constraints da tabela — a validação
 * confere a lista antes de o banco reclamar.
 */
export async function updateContactQualificacao(
  id: string,
  input: QualificacaoForm,
): Promise<ActionResult> {
  try {
    await requireSession();

    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const parsed = normalizeQualificacao(input);
    if (!parsed.ok) {
      return { success: false, error: parsed.error };
    }

    const patch: Partial<Contact> = { ...parsed.value, qualificacaoEditadoEm: agoraIso() };
    await updateContact(id, patch);

    revalidateContato(id);
    return { success: true };
  } catch (err) {
    console.error("[updateContactQualificacao] erro ao salvar qualificação:", err);
    return { success: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

// Cap do título do atendimento — alinhado ao do título automático do site.
const TITULO_ATENDIMENTO_MAX = 80;

/**
 * "Novo atendimento" na ficha do contato — cria uma jornada manual (D072).
 * Nasce aberta, já aprovada, em "primeiro contato": entra direto no kanban.
 *
 * O título passa a ser OBRIGATÓRIO na borda (o banco segue nullable de propósito,
 * por causa das jornadas históricas). Sem título → erro amigável, nada é criado.
 */
export async function criarAtendimento(contactId: string, titulo: string): Promise<ActionResult> {
  try {
    await requireSession();

    const tituloLimpo = titulo?.trim() ?? "";
    if (!tituloLimpo) {
      return { success: false, error: "Dê um título pro atendimento." };
    }

    const contact = await getContactById(contactId);
    if (!contact) {
      return { success: false, error: "Contato não encontrado." };
    }

    await createJornadaManual(contactId, {
      tituloJornada: tituloLimpo.slice(0, TITULO_ATENDIMENTO_MAX),
    });

    revalidatePath(`/admin/contatos/${contactId}`);
    revalidatePath("/admin/jornadas");
    return { success: true };
  } catch (err) {
    console.error("[criarAtendimento] erro ao criar jornada manual:", err);
    return { success: false, error: "Não foi possível criar o atendimento. Tente novamente." };
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
export async function deleteContactNote(contactId: string, noteId: string): Promise<ActionResult> {
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

    // Sem telefone não há como enviar WhatsApp (U1: contato pode existir sem
    // whatsapp). Barra antes de chamar a API — a ação depende do canal.
    if (!contact.whatsapp) {
      return { success: false, error: "Contato sem WhatsApp." };
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
      console.error(
        "[sendWhatsAppWelcome] mensagem enviada, mas falhou ao registrar interação:",
        interErr,
      );
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
export async function registrarNegocio(id: string, input: NovoNegocioInput): Promise<ActionResult> {
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

// ─────────────────────────────────────────────────────────────────
// Tags internas da ficha (bloco "Tags internas")
// ─────────────────────────────────────────────────────────────────

/**
 * Substitui integralmente `contacts.tags` do contato (T1/T5).
 *
 * Escreve SÓ essa coluna: `clickmassa_tags_id` é do sync e não é tocada por
 * nenhum caminho de back-office. A validação (slug existe + está ativo, sem
 * duplicata, gravação ordenada) vive no módulo puro `lib/tags/shared` e roda
 * de novo aqui — a tela é conveniência, o servidor é a autoridade.
 *
 * Sem carimbo de edição novo: a folha de contrato não pede coluna de carimbo
 * pra tag, e `updated_at` (trigger) já cobre "mexeram nesse contato".
 */
export async function salvarTagsInternas(
  contactId: string,
  slugs: string[],
): Promise<ActionResult> {
  try {
    await requireSession();

    const resultado = await definirTagsDoContato(contactId, slugs);
    if (!resultado.ok) return { success: false, error: resultado.erro };

    revalidatePath(`/admin/contatos/${contactId}`);
    revalidatePath("/admin/contatos");
    return { success: true };
  } catch (err) {
    console.error("[salvarTagsInternas] erro ao salvar tags:", err);
    return { success: false, error: "Não foi possível salvar as tags. Tente de novo." };
  }
}
