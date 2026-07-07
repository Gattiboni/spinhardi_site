"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type UpdatePasswordState = { error: string } | null;

/**
 * Grava a nova senha do usuário logado pela sessão de recovery.
 *
 * A sessão foi estabelecida na rota de callback (troca do code PKCE). Se ela
 * não existir mais (link expirado, sessão perdida), `getUser` volta vazio e
 * pedimos um novo link. Em sucesso, redireciona pro painel — a sessão já está
 * ativa, então não é preciso logar de novo.
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sua sessão de redefinição expirou. Solicite um novo link e tente de novo." };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (/different from the old|should be different/i.test(error.message)) {
        return { error: "A nova senha precisa ser diferente da anterior." };
      }
      console.error("[updatePassword] erro ao atualizar senha:", error);
      return { error: "Não foi possível redefinir a senha. Tente novamente." };
    }
  } catch (err) {
    console.error("[updatePassword] falha de rede:", err);
    return { error: "Não foi possível redefinir a senha agora. Verifique sua conexão e tente de novo." };
  }

  redirect("/admin");
}
