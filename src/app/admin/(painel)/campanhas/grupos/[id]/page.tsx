import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { getGrupoById, getMembros } from "@/lib/grupos";
import { getContacts } from "@/lib/contacts";
import GrupoDetalheClient from "./GrupoDetalheClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const grupo = await getGrupoById(id);
  return { title: grupo ? `${grupo.nome} · Grupos · Admin` : "Grupo não encontrado" };
}

export default async function GrupoDetalhe({ params }: Props) {
  // Campanhas e ADMIN-ONLY em v1 (ver `lib/auth/roles.ts`). A guarda e aqui,
  // no servidor: esconder o item da sidebar nao e permissao.
  await requireRole("admin");

  const { id } = await params;
  const grupo = await getGrupoById(id);
  if (!grupo) notFound();

  // A busca de "adicionar membro" roda sobre os contatos ATIVOS, em memória —
  // mesmo padrão da lista de contatos (volume boutique, 864 ativos).
  const [membros, ativos] = await Promise.all([getMembros(id), getContacts({ status: "ativo" })]);

  return (
    <GrupoDetalheClient
      grupo={grupo}
      membros={membros}
      candidatos={ativos.map((c) => ({
        id: c.id,
        nome: c.name,
        email: c.email,
      }))}
    />
  );
}
