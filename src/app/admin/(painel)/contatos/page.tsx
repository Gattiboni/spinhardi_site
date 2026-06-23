import {
  getContacts,
  getDuplicateContactIds,
  getSemIddasContactIds,
  getSemEmailCount,
} from "@/lib/contacts";
import { computeGapSegments } from "@/lib/contacts/gold-operacional";
import ContactsClient from "./ContactsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatos · Admin",
};

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

export default async function AdminContatos() {
  // Gold operacional: lista de contatos + segmentos de gap. Dup e sem-Iddas vêm
  // de funções (RPC) que filtram no Postgres (mesma fonte pra contagem e lista);
  // sem-email é um COUNT no banco. O componente cliente nunca toca bronze.
  const [contacts, duplicateIds, semIddasIds, semEmailCount] = await Promise.all([
    getContacts({ status: "ativo" }),
    getDuplicateContactIds(),
    getSemIddasContactIds(),
    getSemEmailCount(),
  ]);

  const { flags, counts } = computeGapSegments(
    contacts,
    duplicateIds,
    semIddasIds,
    semEmailCount,
  );

  return (
    <ContactsClient contacts={contacts} gapFlags={flags} gapCounts={counts} />
  );
}
