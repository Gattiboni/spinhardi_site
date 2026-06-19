"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import type { Role } from "@/lib/auth";

/**
 * Casca do painel: segura o estado de recolher da sidebar (default expandido) e
 * envolve o conteúdo. Como é o layout do grupo `(painel)`, o estado persiste
 * entre navegações do admin (layouts não remontam) e reseta só no reload.
 *
 * `min-w-0` no <main> é deliberado: sem ele, conteúdo largo (ex: o kanban do
 * funil, com min-width grande) impede o flex item de encolher, estoura na
 * horizontal e empurra a sidebar pra fora. Com `min-w-0`, o overflow rola
 * dentro do main e a sidebar fica firme em todas as páginas.
 */
export default function AdminShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex">
      <AdminSidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <main className="flex-1 min-w-0 p-8 lg:p-12">{children}</main>
    </div>
  );
}
