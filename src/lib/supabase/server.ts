import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client server-only com service role. Bypassa RLS.
// Usado por Server Components (leitura) e Server Actions (escrita).
//
// `import "server-only"` no topo: se um Client Component importar este módulo
// por engano, o build quebra de propósito (a service role key é admin do banco
// e NUNCA pode chegar ao bundle do browser).
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
