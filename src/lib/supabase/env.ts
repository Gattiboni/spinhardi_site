/**
 * Variáveis públicas do Supabase, compartilhadas por todos os clients
 * (browser, server e proxy). Sem `server-only`: a chave abaixo é pública por
 * natureza e precisa chegar ao bundle do browser.
 *
 * A chave pública aceita dois nomes:
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — nome canônico do Lote E.
 * - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — fallback do projeto atual
 *   (projetos novos do Supabase chamam a chave de "publishable").
 *
 * As duas são funcionalmente idênticas no client (respeitam RLS). O fallback
 * evita exigir que o Alan duplique uma chave que já existe no ambiente.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
