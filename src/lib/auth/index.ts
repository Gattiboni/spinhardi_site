/**
 * Barrel de auth.
 *
 * `roles` é puro (sem dependências de server/client) e pode ser importado de
 * qualquer lugar — inclusive Client Components (AdminSidebar). As funções de
 * sessão vivem em `./session` (server-only) e devem ser importadas diretamente
 * de `@/lib/auth/session` para não arrastar `server-only` pro bundle do browser.
 */
export type { Role } from "./roles";
export { hasPermission } from "./roles";
