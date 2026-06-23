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
      { href: "/admin/jornadas", label: "Jornadas", icon: "🧭" },
      { href: "/admin/blog", label: "Blog", icon: "📝" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: "👥" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "⚙" },
    ],
  },
];

export default function AdminSidebar({
  role,
  collapsed,
  onToggle,
}: {
  role: Role;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } shrink-0 bg-white border-r border-dark/10 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto transition-[width] duration-short`}
    >
      <nav className="p-3">
        {/* Toggle de recolher — default expandido */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className="flex items-center justify-center w-full h-10 mb-4 rounded-md text-dark/60 hover:bg-dark/5 hover:text-dark transition-colors duration-short"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
        </button>

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => hasPermission(role, item.href));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-6">
              {!collapsed && (
                <p className="text-gold uppercase tracking-widest text-xs font-body mb-3 px-3">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`
                          flex items-center ${collapsed ? "justify-center" : "gap-3"} px-3 py-2 rounded-md
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
                        {!collapsed && <span>{item.label}</span>}
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
