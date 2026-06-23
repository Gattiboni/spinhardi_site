"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { uploadAnexo, removeAnexo, signedUrlDoAnexo } from "./index";
import { isAnexoPermitido, type AnexoOwner } from "./types";

/**
 * Server Actions de anexos — chamadas pelo `AnexosBlock` (reutilizado no detalhe
 * da jornada e na ficha do contato). Cada uma revalida a página do dono certo a
 * partir do `owner.kind`. Upload/delete passam pelo service role (lib), atrás de
 * `requireSession`. O link de visualização é uma URL assinada efêmera, nunca pública.
 */

export type ActionResult = { success: boolean; error?: string };
export type SignedUrlResult = { success: boolean; url?: string; error?: string };

function revalidarDono(owner: AnexoOwner): void {
  if (owner.kind === "jornada") {
    revalidatePath(`/admin/jornadas/${owner.id}`);
  } else {
    revalidatePath(`/admin/contatos/${owner.id}`);
  }
}

export async function uploadAnexoAction(
  owner: AnexoOwner,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireSession();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Selecione um arquivo." };
    }
    if (!isAnexoPermitido(file.name)) {
      return { success: false, error: "Tipo não permitido (PDF, Word, Excel ou imagem)." };
    }

    await uploadAnexo(owner, file);
    revalidarDono(owner);
    return { success: true };
  } catch (err) {
    console.error("[uploadAnexoAction] erro:", err);
    return { success: false, error: "Não foi possível subir o arquivo." };
  }
}

export async function removeAnexoAction(
  owner: AnexoOwner,
  anexoId: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    await removeAnexo(anexoId);
    revalidarDono(owner);
    return { success: true };
  } catch (err) {
    console.error("[removeAnexoAction] erro:", err);
    return { success: false, error: "Não foi possível remover o anexo." };
  }
}

export async function getAnexoUrlAction(anexoId: string): Promise<SignedUrlResult> {
  try {
    await requireSession();
    const url = await signedUrlDoAnexo(anexoId);
    return { success: true, url };
  } catch (err) {
    console.error("[getAnexoUrlAction] erro:", err);
    return { success: false, error: "Não foi possível abrir o anexo." };
  }
}
