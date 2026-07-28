import { getContactById, getContactInteractions } from "@/lib/contacts";
import { getContactExternalLinks } from "@/lib/contacts/external-links";
import { getJornadasDoContato } from "@/lib/jornadas";
import { getAnexos } from "@/lib/anexos";
import { getCatalogos } from "@/lib/tags";
import { getGruposDoContato } from "@/lib/grupos";
import { getHistoricoEmailDoContato } from "@/lib/campanhas";
import { notFound } from "next/navigation";
import ContactDetailClient from "./ContactDetailClient";
import type { Metadata } from "next";

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contact = await getContactById(id);
  return {
    title: contact ? `${contact.name} · Contatos · Admin` : "Contato não encontrado",
  };
}

export default async function ContatoDetalhe({ params }: Props) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const [interactions, externalLinks, jornadas, anexos, catalogos, grupos, historicoEmail] =
    await Promise.all([
      getContactInteractions(id),
      getContactExternalLinks(id),
      getJornadasDoContato(id),
      getAnexos({ kind: "contact", id }),
      // Vocabulário das tags vem dos CATÁLOGOS, não do que este contato tem —
      // senão o editor só oferece o que já está marcado.
      getCatalogos(),
      getGruposDoContato(id),
      getHistoricoEmailDoContato(id),
    ]);

  return (
    <ContactDetailClient
      contact={contact}
      interactions={interactions}
      externalLinks={externalLinks}
      jornadas={jornadas}
      anexos={anexos}
      catalogoTagsInternas={catalogos.internas}
      catalogoTagsClickmassa={catalogos.clickmassa}
      grupos={grupos}
      historicoEmail={historicoEmail}
    />
  );
}
