import { getContactById, getContactInteractions } from "@/lib/contacts";
import { notFound } from "next/navigation";
import ContactDetailClient from "./ContactDetailClient";
import type { Metadata } from "next";

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

  const interactions = await getContactInteractions(id);

  return <ContactDetailClient contact={contact} interactions={interactions} />;
}
