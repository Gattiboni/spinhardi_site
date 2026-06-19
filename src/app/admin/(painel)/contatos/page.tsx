import {
  getContacts,
  getDuplicateContactIds,
  getSemIddasContactIds,
  getSemEmailCount,
} from "@/lib/contacts";
import { computeGapSegments } from "@/lib/contacts/gold-operacional";
import { ESTAGIOS_OPTIONS, type EstagioFunil } from "@/lib/contacts/types";
import ContactsClient from "./ContactsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatos · Admin",
};

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

export default async function AdminContatos({
  searchParams,
}: {
  searchParams: Promise<{ estagio?: string }>;
}) {
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

  // Drilldown: `?estagio=` vindo do funil do dashboard pré-filtra a lista.
  // Validado contra o vocabulário; valor inválido cai pra "todos".
  const { estagio } = await searchParams;
  const initialEstagio =
    estagio && (ESTAGIOS_OPTIONS as string[]).includes(estagio)
      ? (estagio as EstagioFunil)
      : undefined;

  return (
    <ContactsClient
      contacts={contacts}
      gapFlags={flags}
      gapCounts={counts}
      initialEstagio={initialEstagio}
    />
  );
}
