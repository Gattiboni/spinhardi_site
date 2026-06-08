import type { AuthProvider } from "./provider";

/**
 * Implementação Supabase Auth com magic link.
 *
 * TODO (Lote C — Fase 1.11):
 * - Configurar @supabase/supabase-js client
 * - Implementar signIn via auth.signInWithOtp({ email })
 * - Implementar getUser via auth.getUser()
 * - Implementar verifySession via callback handler
 * - Implementar signOut via auth.signOut()
 * - Sincronizar user.role com tabela user_profiles
 */
export const supabaseAuth: AuthProvider = {
  async signIn() {
    throw new Error("Supabase Auth ainda não implementado. Ver Fase 1.11.");
  },
  async signOut() {
    throw new Error("Supabase Auth ainda não implementado. Ver Fase 1.11.");
  },
  async getUser() {
    throw new Error("Supabase Auth ainda não implementado. Ver Fase 1.11.");
  },
  async verifySession() {
    throw new Error("Supabase Auth ainda não implementado. Ver Fase 1.11.");
  },
};
