"use client";

import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { SPIN } from "./palette";
import { ESTAGIOS_OPTIONS, ESTAGIO_LABELS } from "@/lib/contacts/types";
import type { FunilEstagio } from "@/lib/dashboard/types";

/**
 * Funil interno por estágio. Nasce degenerado (todos 'novo', e o módulo de
 * Oportunidades do CM está bloqueado) — uma barra só. Mas a ESTRUTURA é montada
 * com todos os estágios em ordem; popula sozinha conforme a Nina trabalha os
 * leads. Drilldown: clicar numa barra leva pra lista de Contatos filtrada por
 * aquele estágio (o fio atravessa).
 */
export default function FunilChart({ funil }: { funil: FunilEstagio[] }) {
  const router = useRouter();

  const byEstagio = new Map(funil.map((f) => [f.estagio, f.total]));
  const data = ESTAGIOS_OPTIONS.map((estagio) => ({
    estagio,
    label: ESTAGIO_LABELS[estagio],
    total: byEstagio.get(estagio) ?? 0,
  }));

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-gold uppercase tracking-widest text-xs font-body">Funil por estágio</p>
        <p className="font-body text-xs text-dark/50">Clique numa barra pra ver os contatos</p>
      </div>

      <div className="bg-white border border-dark/10 rounded-md p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ left: 8, right: 24, top: 4, bottom: 40 }}
            onClick={(state) => {
              // activeIndex aponta a barra clicada; indexo meu próprio array
              // (ordem controlada) pra achar o estágio do drilldown.
              const idx = Number(state?.activeIndex);
              const point = Number.isInteger(idx) ? data[idx] : undefined;
              if (point?.estagio) {
                router.push(`/admin/contatos?estagio=${point.estagio}`);
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={SPIN.grid} />
            <XAxis
              dataKey="label"
              angle={-30}
              textAnchor="end"
              height={60}
              interval={0}
              tick={{ fontSize: 11, fill: SPIN.axis }}
              stroke={SPIN.grid}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: SPIN.axis }} stroke={SPIN.grid} />
            <Tooltip
              cursor={{ fill: SPIN.grid }}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: SPIN.grid }}
            />
            <Bar
              dataKey="total"
              name="Contatos"
              fill={SPIN.navy}
              radius={[4, 4, 0, 0]}
              className="cursor-pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
