import { getContactStats } from "@/lib/contacts";
import { clickmassa } from "@/lib/integrations/clickmassa";
import { getPosts } from "@/lib/blog";
import { requireSession } from "@/lib/auth/session";
import {
  getFinanceiroResumo,
  getFunilPorEstagio,
  getContactsSnapshot,
} from "@/lib/dashboard/gold";
import type { FinanceiroPorPeriodo } from "@/lib/dashboard/types";
import DashboardClient from "./DashboardClient";

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

// Intervalos de data (YYYY-MM-DD) pros 3 períodos do toggle financeiro. Calculados
// no servidor; o gold agrega cada um em SQL e o cliente só alterna entre eles.
function periodosFinanceiro(): {
  mes: [string, string];
  ano: [string, string];
} {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    mes: [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))],
    ano: [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))],
  };
}

export default async function AdminDashboard() {
  const { mes, ano } = periodosFinanceiro();

  const [
    session,
    contactStats,
    clickmassaStats,
    posts,
    finMes,
    finAno,
    finTudo,
    funil,
    snapshot,
  ] = await Promise.all([
    requireSession(),
    getContactStats(),
    clickmassa.getStats(),
    getPosts({ status: "publicado" }),
    getFinanceiroResumo(mes[0], mes[1]),
    getFinanceiroResumo(ano[0], ano[1]),
    getFinanceiroResumo(null, null),
    getFunilPorEstagio(),
    getContactsSnapshot(),
  ]);

  const financeiro: FinanceiroPorPeriodo = { mes: finMes, ano: finAno, tudo: finTudo };

  return (
    <DashboardClient
      contactStats={contactStats}
      clickmassaStats={clickmassaStats}
      postsCount={posts.length}
      userName={session.name}
      financeiro={financeiro}
      funil={funil}
      snapshot={snapshot}
    />
  );
}
