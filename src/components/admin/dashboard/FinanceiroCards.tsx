"use client";

import { useState } from "react";
import DashboardCard from "@/components/admin/DashboardCard";
import { moedaBRL } from "./palette";
import type { FinanceiroPorPeriodo, PeriodoKey } from "@/lib/dashboard/types";

/**
 * 3 cards financeiros reais (mata o mock Iddas): faturamento, vendas, ticket
 * médio. Os números vêm pré-agregados em SQL (RPC) pros 3 períodos; o toggle só
 * troca qual já está em mãos — zero ida ao banco no clique, zero soma no JS.
 */

const PERIODO_LABELS: Record<PeriodoKey, string> = {
  mes: "Mês corrente",
  ano: "Ano",
  tudo: "Tudo",
};

const PERIODOS: PeriodoKey[] = ["mes", "ano", "tudo"];

export default function FinanceiroCards({
  financeiro,
}: {
  financeiro: FinanceiroPorPeriodo;
}) {
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");
  const r = financeiro[periodo];

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gold uppercase tracking-widest text-xs font-body">Financeiro (Iddas + manual)</p>
        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={`px-3 py-1.5 rounded-md font-body text-sm transition-colors duration-short ${
                periodo === p ? "bg-gold text-dark" : "bg-dark/5 text-dark/60 hover:text-dark"
              }`}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard title="Faturamento" value={moedaBRL.format(r.faturamento)} />
        <DashboardCard title="Vendas" value={r.vendas} />
        <DashboardCard title="Ticket médio" value={moedaBRL.format(r.ticketMedio)} />
      </div>
    </section>
  );
}
