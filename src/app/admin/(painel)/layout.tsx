import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { requireSession } from "@/lib/auth/session";

/**
 * Layout do painel (rotas autenticadas de `/admin`).
 *
 * Server Component: `requireSession()` valida a sessão real do Supabase (usuário
 * aprovado, com role) e redireciona pro login caso contrário. O grupo de rotas
 * `(painel)` isola este chrome das páginas públicas de auth (`/admin/login`,
 * `/admin/solicitar-acesso`, `/admin/aguardando`, `/admin/aprovar/[token]`), que
 * ficam fora do grupo e renderizam sem header/sidebar.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="min-h-screen bg-dark/5">
      <AdminHeader user={{ name: user.name, role: user.role }} />
      <div className="flex">
        <AdminSidebar role={user.role} />
        <main className="flex-1 p-8 lg:p-12">{children}</main>
      </div>
    </div>
  );
}
