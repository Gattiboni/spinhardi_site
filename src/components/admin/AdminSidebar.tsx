"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type Role } from "@/lib/auth";

const NAV_GROUPS = [
  {
    title: "Navegação",
    items: [
      { href: "/admin", label: "Dashboard", icon: "📊" },
      { href: "/admin/contatos", label: "Contatos", icon: "📧" },
      { href: "/admin/blog", label: "Blog", icon: "📝" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: "👥" },
      { href: "/admin/integracoes", label: "Integrações", icon: "🔌" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "⚙" },
    ],
  },
];

export default function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-dark/10 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      <nav className="p-6">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => hasPermission(role, item.href));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-8">
              <p className="text-gold uppercase tracking-widest text-xs font-body mb-3">
                {group.title}
              </p>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-md
                          font-body text-sm transition-colors duration-short
                          ${
                            isActive
                              ? "bg-gold/10 text-gold"
                              : "text-dark/70 hover:bg-dark/5 hover:text-dark"
                          }
                        `}
                      >
                        <span className="text-lg" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
