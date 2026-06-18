import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Clients Supabase server-only.
 *
 * `import "server-only"` no topo: se um Client Component importar este módulo por
 * engano, o build quebra de propósito (a service role key é admin do banco e
 * NUNCA pode chegar ao bundle do browser).
 *
 * Dois modos:
 * - `supabaseAdmin()`  — service role, bypassa RLS. Apenas em operações
 *   privilegiadas (Server Actions/Components já protegidos por sessão).
 * - `supabaseServer()` — chave pública + cookies da sessão. Respeita RLS e
 *   carrega o usuário logado. Usado para `auth.getUser()` e login/signin.
 */
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` foi chamado durante o render de um Server Component, onde
          // não é possível escrever cookies. O refresh do token de sessão é
          // feito pelo proxy (src/proxy.ts), então ignorar aqui é seguro.
        }
      },
    },
  });
}
