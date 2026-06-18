export type Role = "admin" | "editor";

/**
 * Permissões por role.
 *
 * Convenção:
 * - "*" sozinho = acesso total (admin)
 * - "/admin"     = match exato (apenas /admin, não /admin/qualquercoisa)
 * - "/admin/*"   = match com filhos (/admin/blog, /admin/blog/123, etc)
 *
 * Editor tem acesso ao dashboard (raiz exata) e às seções de blog e
 * contatos (com filhos). NÃO tem acesso a /admin/usuarios, /admin/integracoes,
 * /admin/configuracoes.
 */
const PERMISSIONS: Record<Role, string[]> = {
  admin: ["*"],
  editor: ["/admin", "/admin/blog/*", "/admin/contatos/*", "/admin/funil/*"],
};

export function hasPermission(role: Role, path: string): boolean {
  const perms = PERMISSIONS[role];
  if (perms.includes("*")) return true;

  return perms.some((perm) => {
    if (perm.endsWith("/*")) {
      const prefix = perm.slice(0, -2); // remove "/*"
      return path === prefix || path.startsWith(`${prefix}/`);
    }
    return path === perm; // match exato
  });
}
