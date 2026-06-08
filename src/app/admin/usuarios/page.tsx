import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usuários · Admin",
};

export default function AdminUsuarios() {
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
