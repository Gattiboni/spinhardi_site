"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  criarUploadAssinado,
  registrarAnexo,
  removeAnexo,
  signedUrlDoAnexo,
  type RegistroAnexo,
} from "./index";
import { validarArquivoAnexo, type AnexoOwner } from "./types";

/**
 * Server Actions de anexos — chamadas pelo `AnexosBlock` (reutilizado no detalhe
 * da jornada e na ficha do contato). Cada uma revalida a página do dono certo a
 * partir do `owner.kind`. Registro/delete passam pelo service role (lib), atrás
 * de `requireSession`. O link de visualização é uma URL assinada efêmera, nunca
 * pública.
 *
 * UPLOAD EM DOIS PASSOS: `criarUploadUrlAction` (assina) → cliente sobe direto
 * pro Storage → `registrarAnexoAction` (grava a linha). Nenhum byte do arquivo
 * passa por Server Action, então PDF grande não esbarra no `bodySizeLimit`.
 * As duas revalidam/validam do mesmo jeito; a validação de tamanho/extensão do
 * cliente é REAPLICADA aqui (o cliente é conveniência, o servidor é autoridade).
 */

export type ActionResult = { success: boolean; error?: string };
export type SignedUrlResult = { success: boolean; url?: string; error?: string };
export type UploadUrlResult = {
  success: boolean;
  signedUrl?: string;
  path?: string;
  error?: string;
};

function revalidarDono(owner: AnexoOwner): void {
  if (owner.kind === "jornada") {
    revalidatePath(`/admin/jornadas/${owner.id}`);
  } else {
    revalidatePath(`/admin/contatos/${owner.id}`);
  }
}

/** PASSO 1 — devolve a URL assinada pro cliente subir o arquivo direto. */
export async function criarUploadUrlAction(
  owner: AnexoOwner,
  nomeArquivo: string,
  tamanhoBytes: number,
): Promise<UploadUrlResult> {
  try {
    await requireSession();
    const validacao = validarArquivoAnexo({ name: nomeArquivo, size: tamanhoBytes });
    if (!validacao.ok) return { success: false, error: validacao.erro };

    const { signedUrl, path } = await criarUploadAssinado(owner, nomeArquivo);
    return { success: true, signedUrl, path };
  } catch (err) {
    // Nome e tamanho no log; conteúdo do arquivo, nunca.
    console.error(
      `[criarUploadUrlAction] erro (${owner.kind} ${owner.id}, "${nomeArquivo}", ${tamanhoBytes}B):`,
      err,
    );
    return { success: false, error: "Não foi possível preparar o envio do arquivo." };
  }
}

/** PASSO 2 — registra na tabela o arquivo que JÁ subiu pro bucket. */
export async function registrarAnexoAction(
  owner: AnexoOwner,
  registro: RegistroAnexo,
): Promise<ActionResult> {
  try {
    await requireSession();
    const validacao = validarArquivoAnexo({
      name: registro.nomeArquivo,
      size: registro.tamanhoBytes,
    });
    if (!validacao.ok) return { success: false, error: validacao.erro };

    await registrarAnexo(owner, registro);
    revalidarDono(owner);
    return { success: true };
  } catch (err) {
    console.error(
      `[registrarAnexoAction] erro (${owner.kind} ${owner.id}, "${registro.nomeArquivo}", ${registro.tamanhoBytes}B):`,
      err,
    );
    return { success: false, error: "Arquivo enviado, mas não foi possível registrá-lo." };
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
