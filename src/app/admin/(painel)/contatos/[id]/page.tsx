import { getContactById, getContactInteractions } from "@/lib/contacts";
import { getContactExternalLinks } from "@/lib/contacts/external-links";
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

  const [interactions, externalLinks] = await Promise.all([
    getContactInteractions(id),
    getContactExternalLinks(id),
  ]);

  return (
    <ContactDetailClient
      contact={contact}
      interactions={interactions}
      externalLinks={externalLinks}
    />
  );
}
