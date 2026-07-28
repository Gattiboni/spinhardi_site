"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  adicionarMembros,
  apagarGrupo,
  criarGrupo,
  editarGrupo,
  removerMembro,
} from "@/lib/grupos";

/**
 * Server actions de grupos. Padrão do repo: `"use server"`, `requireSession()`
 * primeiro, validação no servidor, delegação pro lib, `revalidatePath` em
 * cascata, `console.error("[nome] ...")`.
 *
 * NENHUMA destas fala com o Resend. O Segment é materializado só no envio (F5).
 */

export type ActionResult = { success: boolean; error?: string };

function revalidar(grupoId?: string) {
  revalidatePath("/admin/campanhas/grupos");
  if (grupoId) revalidatePath(`/admin/campanhas/grupos/${grupoId}`);
  // A lista de contatos mostra o seletor de grupos na ação em massa.
  revalidatePath("/admin/contatos");
}

export async function criarGrupoAction(
  nome: string,
  descricao: string | null,
): Promise<ActionResult & { grupoId?: string }> {
  try {
    await requireRole("admin");
    const r = await criarGrupo({ nome, descricao });
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(r.grupo.id);
    return { success: true, grupoId: r.grupo.id };
  } catch (err) {
    console.error("[criarGrupoAction] erro:", err);
    return { success: false, error: "Não foi possível criar o grupo." };
  }
}

export async function editarGrupoAction(
  grupoId: string,
  campos: { nome?: string; descricao?: string | null },
): Promise<ActionResult> {
  try {
    await requireRole("admin");
    const r = await editarGrupo(grupoId, campos);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(grupoId);
    return { success: true };
  } catch (err) {
    console.error("[editarGrupoAction] erro:", err);
    return { success: false, error: "Não foi possível salvar o grupo." };
  }
}

/**
 * Apaga o grupo. Os CONTATOS ficam — só o vínculo cai (CASCADE). Campanha já
 * enviada não muda: o destinatário dela está congelado (G5).
 */
export async function apagarGrupoAction(grupoId: string): Promise<ActionResult> {
  try {
    await requireRole("admin");
    const r = await apagarGrupo(grupoId);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[apagarGrupoAction] erro:", err);
    return { success: false, error: "Não foi possível apagar o grupo." };
  }
}

export async function adicionarMembrosAction(
  grupoId: string,
  contactIds: string[],
): Promise<ActionResult & { adicionados?: number }> {
  try {
    await requireRole("admin");
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return { success: false, error: "Escolha ao menos um contato." };
    }

    const r = await adicionarMembros(grupoId, contactIds);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(grupoId);
    contactIds.forEach((id) => revalidatePath(`/admin/contatos/${id}`));
    return { success: true, adicionados: r.adicionados };
  } catch (err) {
    console.error("[adicionarMembrosAction] erro:", err);
    return { success: false, error: "Não foi possível adicionar ao grupo." };
  }
}

export async function removerMembroAction(
  grupoId: string,
  contactId: string,
): Promise<ActionResult> {
  try {
    await requireRole("admin");
    const r = await removerMembro(grupoId, contactId);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(grupoId);
    revalidatePath(`/admin/contatos/${contactId}`);
    return { success: true };
  } catch (err) {
    console.error("[removerMembroAction] erro:", err);
    return { success: false, error: "Não foi possível remover do grupo." };
  }
}
