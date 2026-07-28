"use server";

import { revalidatePath } from "next/cache";
import { getContactById, updateContact } from "@/lib/contacts";
import { whatsappValidationError } from "@/lib/contacts/phone";
import { requireSession } from "@/lib/auth/session";
import { tagEmMassa } from "@/lib/tags";
import { criarGrupo, adicionarMembros } from "@/lib/grupos";
import type { Contact, ContactStatus } from "@/lib/contacts/types";

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type QuickEditInput = {
  name: string;
  whatsapp: string;
  email: string | null;
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
 * O estágio saiu daqui (migrou pra `jornadas`): a edição rápida cuida só dos
 * dados da pessoa (nome, contato, status). `updated_at` fica com o trigger.
 */
export async function quickUpdateContact(id: string, input: QuickEditInput): Promise<ActionResult> {
  try {
    await requireSession();

    const name = input.name.trim();
    const whatsapp = input.whatsapp.trim();
    if (!name) return { success: false, error: "O nome não pode ficar vazio." };
    // WhatsApp é OPCIONAL na edição (U1): vazio grava null. Se preenchido, valida
    // o formato — mesma regra do cadastro manual.
    if (whatsapp) {
      const waErr = whatsappValidationError(whatsapp);
      if (waErr) return { success: false, error: waErr };
    }

    const current = await getContactById(id);
    if (!current) {
      return { success: false, error: "Contato não encontrado." };
    }

    const email = input.email?.trim() ? input.email.trim() : null;

    const patch: Partial<Contact> = {
      name,
      whatsapp: whatsapp || null,
      email,
      status: input.status,
    };

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

// ─────────────────────────────────────────────────────────────────
// Ações em massa da lista
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica (união) ou remove UMA tag interna nos contatos selecionados.
 *
 * A seleção máxima é a PÁGINA (10/25/50). "Selecionar todos os N do filtro"
 * ficou de fora de propósito: exigiria uma RPC de ids-por-filtro (restrição
 * dura do lote, e o incidente `UND_ERR_HEADERS_OVERFLOW` já conhecido).
 *
 * Uma validação só, no começo (o slug é o mesmo pra todo mundo), e escrita em
 * lote no lib. Slug inexistente ou desativado é recusado AQUI, no servidor —
 * um payload adulterado pela rede não passa.
 */
export async function aplicarTagEmMassa(
  contactIds: string[],
  slug: string,
  operacao: "adicionar" | "remover",
): Promise<ActionResult & { afetados?: number }> {
  try {
    await requireSession();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return { success: false, error: "Selecione ao menos um contato." };
    }
    if (typeof slug !== "string" || !slug.trim()) {
      return { success: false, error: "Escolha a tag." };
    }

    const resultado = await tagEmMassa(contactIds, slug.trim(), operacao);
    if (!resultado.ok) return { success: false, error: resultado.erro };

    revalidatePath("/admin/contatos");
    contactIds.forEach((id) => revalidatePath(`/admin/contatos/${id}`));
    return { success: true, afetados: resultado.afetados };
  } catch (err) {
    console.error("[aplicarTagEmMassa] erro:", err);
    return { success: false, error: "Não foi possível aplicar a tag. Tente de novo." };
  }
}

/**
 * Adiciona os selecionados a um grupo (existente ou criado na hora).
 *
 * Grupo NÃO filtra elegibilidade: pode conter contato sem e-mail. Quem filtra
 * é a view, no envio (E2). Aqui é só curadoria.
 */
export async function adicionarAoGrupoEmMassa(
  contactIds: string[],
  destino: { grupoId: string } | { nomeNovo: string },
): Promise<ActionResult & { grupoId?: string; adicionados?: number }> {
  try {
    await requireSession();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return { success: false, error: "Selecione ao menos um contato." };
    }

    let grupoId: string;
    if ("nomeNovo" in destino) {
      const criado = await criarGrupo({ nome: destino.nomeNovo, descricao: null });
      if (!criado.ok) return { success: false, error: criado.erro };
      grupoId = criado.grupo.id;
    } else {
      grupoId = destino.grupoId;
    }

    const resultado = await adicionarMembros(grupoId, contactIds);
    if (!resultado.ok) return { success: false, error: resultado.erro };

    revalidatePath("/admin/contatos");
    revalidatePath("/admin/campanhas/grupos");
    revalidatePath(`/admin/campanhas/grupos/${grupoId}`);
    return { success: true, grupoId, adicionados: resultado.adicionados };
  } catch (err) {
    console.error("[adicionarAoGrupoEmMassa] erro:", err);
    return { success: false, error: "Não foi possível adicionar ao grupo. Tente de novo." };
  }
}
