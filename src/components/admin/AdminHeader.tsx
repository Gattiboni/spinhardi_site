"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/auth";

type HeaderUser = {
  name: string;
  role: Role;
};

export default function AdminHeader({ user }: { user: HeaderUser }) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 h-16 bg-navy text-white border-b border-dark/20">
      <div className="h-full flex items-center justify-between px-6">
        <Link
          href="/admin"
          className="font-display text-xl text-white hover:text-gold transition-colors duration-short"
        >
          Spinhardi · Admin
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-body text-sm text-white">{user.name}</p>
            <p className="font-body text-xs text-white/60 capitalize">{user.role}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="font-body text-sm text-white/70 hover:text-gold transition-colors duration-short underline"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
