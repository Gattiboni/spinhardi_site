"use client";

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
import type { ContactsSnapshot, DistribItem } from "@/lib/dashboard/types";

/**
 * Gráficos de distribuição — leem o SNAPSHOT CM (bronze_clickmassa_contacts_dashboard),
 * já pré-agregado pelo ETL, NÃO a silver `contacts` (que está 'importado'/'novo'
 * em tudo e daria gráfico de uma barra só). São insight read-only: o snapshot é
 * agregado do CM, não linha-a-linha da nossa silver, então não tem drilldown.
 */

const cardClass = "bg-white border border-dark/10 rounded-md p-6";
const cardTitleClass = "font-display text-lg text-navy mb-4";

function topN(items: DistribItem[], n: number): DistribItem[] {
  return [...items].sort((a, b) => b.count - a.count).slice(0, n);
}

function HorizontalBar({
  data,
  color,
}: {
  data: DistribItem[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={SPIN.grid} />
        <XAxis type="number" tick={{ fontSize: 12, fill: SPIN.axis }} stroke={SPIN.grid} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 12, fill: SPIN.axis }}
          stroke={SPIN.grid}
        />
        <Tooltip
          cursor={{ fill: SPIN.grid }}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: SPIN.grid }}
        />
        <Bar dataKey="count" name="Contatos" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DistribuicaoCharts({
  snapshot,
}: {
  snapshot: ContactsSnapshot | null;
}) {
  if (!snapshot) {
    return (
      <section className="mb-10">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-4">Distribuição da base</p>
        <div className={cardClass}>
          <p className="font-body text-sm text-dark/50">
            Snapshot do ClickMassa indisponível no momento.
          </p>
        </div>
      </section>
    );
  }

  const recencyData: DistribItem[] = snapshot.recency.map((r) => ({
    label: r.bucket,
    count: r.total,
  }));

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-gold uppercase tracking-widest text-xs font-body">Distribuição da base</p>
        <p className="font-body text-xs text-dark/50">
          {snapshot.total.toLocaleString("pt-BR")} contatos no ClickMassa · {snapshot.weeklyNew} novos na semana
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardClass}>
          <h3 className={cardTitleClass}>Por tag (top 10)</h3>
          <HorizontalBar data={topN(snapshot.tags, 10)} color={SPIN.gold} />
        </div>

        <div className={cardClass}>
          <h3 className={cardTitleClass}>Por estado (top 10)</h3>
          <HorizontalBar data={topN(snapshot.states, 10)} color={SPIN.navy} />
        </div>

        <div className={`${cardClass} lg:col-span-2`}>
          <h3 className={cardTitleClass}>Por última interação</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={recencyData} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={SPIN.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: SPIN.axis }} stroke={SPIN.grid} />
              <YAxis tick={{ fontSize: 12, fill: SPIN.axis }} stroke={SPIN.grid} />
              <Tooltip
                cursor={{ fill: SPIN.grid }}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: SPIN.grid }}
              />
              <Bar dataKey="count" name="Contatos" fill={SPIN.verde} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
