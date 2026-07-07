"use server";

import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export type RequestResetState = { error: string } | { success: true } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.spinharditurismo.com.br";

/**
 * Dispara o e-mail de redefinição de senha.
 *
 * Fluxo PKCE (@supabase/ssr): `resetPasswordForEmail` gera e grava o
 * `code_verifier` num cookie (permitido aqui, pois Server Action pode escrever
 * cookies) e envia um link que aponta pra `/admin/auth/callback`. Lá o `code` da
 * URL é trocado pela sessão de recovery (ver a rota de callback).
 *
 * ANTI-ENUMERAÇÃO: retornamos SEMPRE `{ success: true }`, exista ou não a conta.
 * O próprio Supabase já responde igual pros dois casos; garantimos que a UI não
 * revele nada. Só erros de rede (throw) viram mensagem — erros de API
 * (ex.: rate limit) são logados mas seguem mostrando sucesso.
 */
export async function requestReset(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." };

  const h = await headers();
  const origin = h.get("origin") ?? SITE_URL;

  const supabase = await supabaseServer();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/admin/auth/callback`,
    });
    if (error) {
      // Não vaza se o e-mail existe. Registra pra diagnóstico (rate limit/SMTP).
      console.error("[requestReset] erro ao enviar reset:", error);
    }
  } catch (err) {
    console.error("[requestReset] falha de rede:", err);
    return { error: "Não foi possível enviar o e-mail agora. Verifique sua conexão e tente de novo." };
  }

  return { success: true };
}
