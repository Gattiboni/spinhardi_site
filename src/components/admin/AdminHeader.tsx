"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, setRoleOverride, type User, type Role } from "@/lib/auth";

export default function AdminHeader({ user }: { user: User }) {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/admin/login");
  };

  const handleRoleSwap = (newRole: Role) => {
    setRoleOverride(newRole);
    window.location.reload();
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

        <div className="flex items-center gap-4">
          {isDev && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-md">
              <span className="text-xs text-white/60 uppercase tracking-widest">Role:</span>
              <button
                type="button"
                onClick={() => handleRoleSwap("admin")}
                className={`text-xs px-2 py-1 rounded transition-colors duration-short ${
                  user.role === "admin" ? "bg-gold text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwap("editor")}
                className={`text-xs px-2 py-1 rounded transition-colors duration-short ${
                  user.role === "editor" ? "bg-gold text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Editor
              </button>
            </div>
          )}

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
      </div>
    </header>
  );
}
