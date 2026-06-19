import { getContacts } from "@/lib/contacts";
import { getAllExternalLinks } from "@/lib/contacts/external-links";
import { computeGapSegments } from "@/lib/contacts/gold-operacional";
import ContactsClient from "./ContactsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatos · Admin",
};

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

export default async function AdminContatos() {
  // Gold operacional: contatos (silver) + vínculos externos → segmentos de gap.
  // A query gold lê silver/vínculo; o componente cliente nunca toca bronze.
  const [contacts, links] = await Promise.all([
    getContacts({ status: "ativo" }),
    getAllExternalLinks(),
  ]);

  const { flags, counts } = computeGapSegments(contacts, links);

  return <ContactsClient contacts={contacts} gapFlags={flags} gapCounts={counts} />;
}
