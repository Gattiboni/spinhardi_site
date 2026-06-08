import Link from "next/link";
import AdminContactForm from "@/components/admin/AdminContactForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novo contato · Admin",
};

export default function NovoContato() {
  return (
    <div>
      <Link
        href="/admin/contatos"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        ← Voltar pra lista
      </Link>
      <h1 className="font-display text-3xl text-navy mb-2">Novo contato</h1>
      <p className="font-body text-dark/60 mb-8">
        Cadastro manual — pra clientes que chegaram fora do site (ligação, indicação, evento).
      </p>
      <AdminContactForm />
    </div>
  );
}
