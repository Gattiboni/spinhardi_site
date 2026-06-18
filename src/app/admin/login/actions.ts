"use server";

import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

export type LoginState = { error: string } | null;

/**
 * Login com e-mail + senha (formato `useActionState`).
 *
 * `signInWithPassword` grava os cookies de sessão (permitido em Server Action).
 * Em seguida lê o `status` do perfil (via service role, pois RLS bloquearia um
 * usuário pending de ler o próprio registro) e roteia conforme o estado:
 * - approved → painel
 * - pending  → tela de aguardando (sessão mantida pro botão "Sair")
 * - rejected → desloga e mostra "acesso não autorizado"
 *
 * Sucesso encerra com `redirect()` (lança e propaga). Só retornamos `{ error }`
 * nos caminhos de falha.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "E-mail ou senha incorretos." };
  }

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("status")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Perfil não encontrado. Solicite acesso novamente." };
  }

  if (profile.status === "rejected") {
    await supabase.auth.signOut();
    return { error: "Acesso não autorizado. Contate o administrador." };
  }

  if (profile.status === "pending") {
    redirect("/admin/aguardando");
  }

  redirect("/admin");
}
