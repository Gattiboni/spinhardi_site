"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, hasPermission, type User } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoginRoute = pathname.startsWith("/admin/login");

  useEffect(() => {
    // Rotas de login renderizam sem chrome (early-return abaixo) e nunca leem
    // `loading` — por isso o efeito só precisa validar sessão fora do login.
    if (isLoginRoute) {
      return;
    }

    auth.getUser().then((u) => {
      if (!u) {
        router.replace("/admin/login");
        return;
      }
      if (!hasPermission(u.role, pathname)) {
        router.replace("/admin");
        return;
      }
      setUser(u);
      setLoading(false);
    });
  }, [pathname, isLoginRoute, router]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="font-body text-dark/60">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-dark/5">
      <AdminHeader user={user} />
      <div className="flex">
        <AdminSidebar role={user.role} />
        <main className="flex-1 p-8 lg:p-12">{children}</main>
      </div>
    </div>
  );
}
