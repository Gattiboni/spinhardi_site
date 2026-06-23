import Link from "next/link";
import type { Metadata } from "next";
import { getJornadasPendentes } from "@/lib/jornadas";
import AprovacaoClient from "./AprovacaoClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aprovar jornadas · Admin",
};

export default async function AprovacaoPage() {
  const pendentes = await getJornadasPendentes();

  return (
    <div>
      <Link
        href="/admin/jornadas"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        ← Voltar pro kanban
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl text-navy">Aprovar jornadas</h1>
        <p className="font-body text-sm text-dark/60 mt-1">
          {pendentes.length} jornada{pendentes.length !== 1 ? "s" : ""} aguardando aprovação.
          Confirme ou corrija o estágio sugerido antes de aprovar — a jornada entra no kanban.
        </p>
      </header>

      <AprovacaoClient pendentes={pendentes} />
    </div>
  );
}
