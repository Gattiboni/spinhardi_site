import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getJornadaById,
  getTarefasDaJornada,
  getTarefasInternas,
  getJornadasDoContato,
} from "@/lib/jornadas";
import { getAnexos } from "@/lib/anexos";
import JornadaDetailClient from "./JornadaDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const jornada = await getJornadaById(id);
  return {
    title: jornada
      ? `${jornada.tituloJornada ?? "Jornada"} · Jornadas · Admin`
      : "Jornada não encontrada",
  };
}

export default async function JornadaDetalhe({ params }: Props) {
  const { id } = await params;
  const jornada = await getJornadaById(id);
  if (!jornada) notFound();

  const [tarefasIddas, tarefasInternas, doContato, anexos] = await Promise.all([
    getTarefasDaJornada(jornada.bronzeRef),
    getTarefasInternas(jornada.id),
    jornada.contactId
      ? getJornadasDoContato(jornada.contactId)
      : Promise.resolve({ abertas: [], fechadas: [] }),
    getAnexos({ kind: "jornada", id: jornada.id, contactId: jornada.contactId }),
  ]);

  // "Histórico do cliente" = as OUTRAS jornadas do mesmo contato (exclui esta).
  const outrasJornadas = [...doContato.abertas, ...doContato.fechadas].filter(
    (j) => j.id !== jornada.id,
  );

  return (
    <JornadaDetailClient
      jornada={jornada}
      tarefasIddas={tarefasIddas}
      tarefasInternas={tarefasInternas}
      outrasJornadas={outrasJornadas}
      anexos={anexos}
    />
  );
}
