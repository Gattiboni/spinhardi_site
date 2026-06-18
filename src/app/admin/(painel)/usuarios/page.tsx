import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Usuários · Admin",
};

export default async function AdminUsuarios() {
  await requireRole("admin");
  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-4">Usuários</h1>
      <p className="font-body text-dark/60 max-w-2xl leading-relaxed">
        Gestão de usuários do back office. Disponível após go-live (Fase 3), quando convidaremos
        Nina, Julia e Amanda.
      </p>
    </div>
  );
}
