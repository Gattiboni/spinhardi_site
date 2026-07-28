import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { getCampanhaById, getDestinatarios, urlImagemCampanha } from "@/lib/campanhas";
import { getMetricas } from "@/lib/campanhas/metricas";
import { conteudoDe, montarEmailHtml } from "@/lib/campanhas/conteudo";
import ResultadosClient from "./ResultadosClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getCampanhaById(id);
  return { title: c ? `${c.nomeInterno} · Resultados · Admin` : "Campanha não encontrada" };
}

export default async function ResultadosPage({ params }: Props) {
  // Campanhas e ADMIN-ONLY em v1 (ver `lib/auth/roles.ts`). A guarda e aqui,
  // no servidor: esconder o item da sidebar nao e permissao.
  await requireRole("admin");

  const { id } = await params;
  const campanha = await getCampanhaById(id);
  if (!campanha) notFound();

  const [metricas, destinatarios] = await Promise.all([getMetricas(id), getDestinatarios(id)]);

  // "Ver o e-mail como foi enviado": remontado do conteúdo, que é IMUTÁVEL
  // depois do envio (C5). Não é uma aproximação — é o mesmo montador.
  const html = montarEmailHtml(conteudoDe(campanha), {
    imagemUrl: urlImagemCampanha(campanha.imagemPath),
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });

  return (
    <ResultadosClient
      campanha={campanha}
      metricas={metricas}
      totalDestinatarios={destinatarios.length}
      html={html}
    />
  );
}
