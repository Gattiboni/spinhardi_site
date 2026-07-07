import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Callback do fluxo de recovery do Supabase (@supabase/ssr).
 *
 * O link de redefinição chega aqui com `?token_hash=...&type=recovery`.
 * Verificamos o token server-side com `verifyOtp` — sem depender do
 * `code_verifier` (PKCE), então o link funciona mesmo aberto em outro
 * navegador/dispositivo. Precisa ser um Route Handler (não uma page):
 * `supabaseServer().setAll` só consegue gravar os cookies de sessão fora do
 * render de um Server Component.
 *
 * Sucesso → manda pra tela de nova senha (já com sessão ativa).
 * Falha (link expirado/inválido/já consumido) → volta pra mesma tela
 * sinalizando `?error=link`.
 *
 * Esta rota é isenta no proxy (ver PUBLIC_ADMIN_ROUTES): no momento do clique
 * ainda não há sessão, então o proxy não pode barrar o acesso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (token_hash && type === "recovery") {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}/admin/redefinir-senha`);
    }
    console.error("[auth/callback] falha ao verificar token de recovery:", error);
  }

  return NextResponse.redirect(`${origin}/admin/redefinir-senha?error=link`);
}
