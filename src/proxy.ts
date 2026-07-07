import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/env";

/**
 * Proxy (Next 16 — antigo `middleware`) cirurgicamente limitado a `/admin/*`.
 *
 * Faz duas coisas:
 * 1. Mantém a sessão Supabase fresca (refresh dos cookies de auth).
 * 2. Barra acesso anônimo às rotas protegidas, redirecionando pro login.
 *
 * A checagem de `status`/`role` (approved/admin/editor) NÃO acontece aqui — fica
 * em `requireSession`/`requireRole` nas páginas e Server Actions. O proxy só
 * garante "está autenticado?". Isso é defesa em profundidade: o Next executa
 * Server Actions como POST na própria rota, e o doc oficial recomenda validar
 * auth dentro de cada Server Function, não confiar só no proxy.
 *
 * O matcher é exatamente `/admin/:path*` — nada público (`/`, `/sobre`,
 * `/viagens/*`, `/blog/*`, `/contato`) é interceptado.
 */
const PUBLIC_ADMIN_ROUTES = [
  "/admin/login",
  "/admin/solicitar-acesso",
  "/admin/aguardando",
  // Fluxo "esqueci minha senha": o usuário chega aqui sem sessão (o callback é
  // quem estabelece a sessão de recovery), então o proxy não pode barrar.
  "/admin/esqueci-senha",
  "/admin/redefinir-senha",
  "/admin/auth/callback",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicAdmin =
    PUBLIC_ADMIN_ROUTES.includes(pathname) || pathname.startsWith("/admin/aprovar/");
  if (isPublicAdmin) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
