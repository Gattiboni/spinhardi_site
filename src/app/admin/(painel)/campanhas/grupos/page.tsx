import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getGruposComContagens } from "@/lib/grupos";
import GruposClient from "./GruposClient";

export const metadata: Metadata = { title: "Grupos · Campanhas · Admin" };

/** Leitura ao vivo (sem prerender de snapshot vazio), como o resto do painel. */
export const dynamic = "force-dynamic";

export default async function GruposPage() {
  // Campanhas e ADMIN-ONLY em v1 (ver `lib/auth/roles.ts`). A guarda e aqui,
  // no servidor: esconder o item da sidebar nao e permissao.
  await requireRole("admin");

  const grupos = await getGruposComContagens();
  return <GruposClient grupos={grupos} />;
}
