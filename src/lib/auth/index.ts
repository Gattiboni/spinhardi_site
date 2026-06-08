import { mockAuth } from "./mock";
// import { supabaseAuth } from "./supabase"; // ATIVAR NO LOTE C

/**
 * Provider de auth ativo.
 *
 * Fase 1: mock via localStorage (sem dependência externa).
 * Fase 1.11 (Lote C): trocar pra supabaseAuth quando Supabase
 *                     for configurado.
 */
export const auth = mockAuth;

export type { User, AuthProvider } from "./provider";
export type { Role } from "./roles";
export { hasPermission } from "./roles";
export { setRoleOverride } from "./mock";
