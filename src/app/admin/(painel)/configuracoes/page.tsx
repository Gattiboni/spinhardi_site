import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getCaptureOrigins, getTags } from "@/lib/configuracoes";
import ConfiguracoesClient from "./ConfiguracoesClient";

export const metadata: Metadata = {
  title: "Configurações · Admin",
};

// Leitura ao vivo a cada request — admin only.
export const dynamic = "force-dynamic";

export default async function AdminConfiguracoes() {
  await requireRole("admin");

  const [origins, tags] = await Promise.all([getCaptureOrigins(), getTags()]);

  return <ConfiguracoesClient origins={origins} tags={tags} />;
}
