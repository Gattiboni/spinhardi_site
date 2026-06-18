"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Client Supabase para Client Components (browser).
 *
 * Usa a chave pública (anon/publishable) — respeita RLS. Hoje só é necessário
 * para o `signOut` do header; login e signup acontecem em Server Actions.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
