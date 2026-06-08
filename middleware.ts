import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware Next 16 — proteção de rotas /admin/*.
 *
 * Roda no Edge antes de qualquer página. No mock (Fase 1), a validação
 * real acontece no AdminLayout client-side (que lê localStorage).
 *
 * Quando Lote C ativar Supabase Auth, este middleware vai validar
 * sessão real via cookies do Supabase.
 *
 * Por ora:
 * - Libera /admin/login* sem checagem
 * - Demais rotas /admin/* passam pra validação client-side
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
