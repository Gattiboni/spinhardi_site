"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { sendApprovalRequest } from "@/lib/email/approval-request";

export type RequestAccessState = { error: string } | { success: true } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Autoatendimento: qualquer um solicita acesso, o Alan aprova depois.
 *
 * Cria o usuário já confirmado via `admin.createUser({ email_confirm: true })` —
 * ver "Surpresas técnicas" no relatório: isso elimina a dependência da config de
 * "Confirm email" do painel e evita que solicitantes fiquem travados sem
 * conseguir logar. A conta nasce com `user_profiles.status = 'pending'`, então o
 * portão de aprovação manual continua valendo. Se o insert do perfil falhar, o
 * usuário órfão de auth é removido pra não deixar lixo.
 */
export async function requestAccess(
  _prev: RequestAccessState,
  formData: FormData,
): Promise<RequestAccessState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (name.length < 2) return { error: "Informe seu nome completo." };
  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const admin = supabaseAdmin();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    if (createError && /already|registered|exists/i.test(createError.message)) {
      return { error: "Já existe uma conta com esse e-mail." };
    }
    console.error("[requestAccess] erro ao criar usuário:", createError);
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: userId,
    name,
    email,
    status: "pending",
    role: null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[requestAccess] erro ao criar perfil:", profileError);
    return { error: "Não foi possível concluir a solicitação. Tente novamente." };
  }

  try {
    await sendApprovalRequest({ userId, name, email });
  } catch (err) {
    // Perfil já criado — o Alan ainda pode aprovar pelo painel. Não falha pro
    // solicitante; apenas registra que a notificação não saiu.
    console.error("[requestAccess] perfil criado, mas falhou ao enviar e-mail:", err);
  }

  return { success: true };
}
