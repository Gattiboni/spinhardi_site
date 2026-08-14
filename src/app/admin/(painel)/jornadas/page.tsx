import Link from "next/link";
import type { Metadata } from "next";
import { getKanbanJornadas, getJornadasPendentes } from "@/lib/jornadas";
import { getCatalogoInterno } from "@/lib/tags";
import KanbanClient from "./KanbanClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jornadas · Admin",
};

export default async function JornadasPage() {
  const [jornadas, pendentes, catalogoInterno] = await Promise.all([
    getKanbanJornadas(),
    getJornadasPendentes(),
    // Vocabulário slug→nome/cor das tags internas, o MESMO da lista de contatos.
    // `getCatalogoInterno` lança em erro; aqui degrada pra vazio — sem catálogo
    // o card só deixa de mostrar as tags, o quadro segue de pé.
    getCatalogoInterno().catch((err) => {
      console.error("[jornadas] catálogo de tags:", err);
      return [];
    }),
  ]);

  // O kanban traz todas as aprovadas; os agregados do topo contam só as abertas.
  const abertas = jornadas.filter((j) => j.aberta);
  const totalValor = abertas.reduce((s, j) => s + (j.valor ?? 0), 0);
  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(totalValor);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-navy">Jornadas</h1>
          <p className="font-body text-sm text-dark/60 mt-1">
            {abertas.length} jornada{abertas.length !== 1 ? "s" : ""} aberta
            {abertas.length !== 1 ? "s" : ""} · {brl} no funil
          </p>
        </div>

        <Link
          href="/admin/jornadas/aprovacao"
          className="inline-flex items-center gap-2 font-body text-sm font-medium px-4 py-2 rounded-md border-2 border-gold text-gold hover:bg-gold hover:text-dark transition-colors duration-medium"
        >
          Aprovações
          {pendentes.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-gold text-dark text-xs font-bold">
              {pendentes.length}
            </span>
          )}
        </Link>
      </header>

      <KanbanClient jornadas={jornadas} catalogoInterno={catalogoInterno} />
    </div>
  );
}
