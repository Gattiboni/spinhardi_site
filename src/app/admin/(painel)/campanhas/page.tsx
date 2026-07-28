import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getCampanhas } from "@/lib/campanhas";
import { getMetricasEmLote } from "@/lib/campanhas/metricas";
import CampanhasClient from "./CampanhasClient";

export const metadata: Metadata = { title: "Campanhas · Admin" };
export const dynamic = "force-dynamic";

export default async function CampanhasPage() {
  // Campanhas e ADMIN-ONLY em v1 (ver `lib/auth/roles.ts`). A guarda e aqui,
  // no servidor: esconder o item da sidebar nao e permissao.
  await requireRole("admin");

  const campanhas = await getCampanhas();

  // Resumo só das enviadas: métricas são derivadas (V6) e custam duas queries
  // por campanha — não faz sentido pagar isso por rascunho.
  const metricas = await getMetricasEmLote(
    campanhas.filter((c) => c.estado === "enviada").map((c) => c.id),
  );

  return <CampanhasClient campanhas={campanhas} metricas={metricas} />;
}
