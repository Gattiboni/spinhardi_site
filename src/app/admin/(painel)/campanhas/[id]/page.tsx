import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import { getCampanhaById, urlImagemCampanha } from "@/lib/campanhas";
import { getGruposComContagens } from "@/lib/grupos";
import { destinosDeTesteAction } from "../actions";
import EditorClient from "./EditorClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getCampanhaById(id);
  return { title: c ? `${c.nomeInterno} · Campanhas · Admin` : "Campanha não encontrada" };
}

export default async function EditarCampanha({ params }: Props) {
  // Campanhas e ADMIN-ONLY em v1 (ver `lib/auth/roles.ts`). A guarda e aqui,
  // no servidor: esconder o item da sidebar nao e permissao.
  await requireRole("admin");

  const { id } = await params;
  const campanha = await getCampanhaById(id);
  if (!campanha) notFound();

  // Campanha enviada é imutável (C5): não existe tela de edição pra ela. A
  // trava de verdade é a server action; isto aqui é só não oferecer o caminho.
  if (campanha.estado === "enviada") redirect(`/admin/campanhas/${id}/resultados`);

  const [grupos, destinosTeste] = await Promise.all([
    getGruposComContagens(),
    destinosDeTesteAction(),
  ]);

  return (
    <EditorClient
      campanha={campanha}
      imagemUrl={urlImagemCampanha(campanha.imagemPath)}
      grupos={grupos}
      destinosTeste={destinosTeste}
      enderecoRodape={process.env.CAMPANHAS_ENDERECO_RODAPE ?? null}
    />
  );
}
