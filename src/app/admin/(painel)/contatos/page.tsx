import {
  getContacts,
  getDuplicateContactIds,
  getSemIddasContactIds,
  getSemEmailCount,
} from "@/lib/contacts";
import { computeGapSegments } from "@/lib/contacts/gold-operacional";
import { getCatalogos } from "@/lib/tags";
import { getGrupos } from "@/lib/grupos";
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
  const [contacts, duplicateIds, semIddasIds, semEmailCount, catalogos, grupos] = await Promise.all(
    [
      getContacts({ status: "ativo" }),
      getDuplicateContactIds(),
      getSemIddasContactIds(),
      getSemEmailCount(),
      // Vocabulário dos DOIS filtros de tag vem dos catálogos, não dos contatos
      // carregados (T8). `grupos` alimenta a ação em massa "adicionar ao grupo".
      getCatalogos(),
      getGrupos(),
    ],
  );

  const { flags, counts } = computeGapSegments(contacts, duplicateIds, semIddasIds, semEmailCount);

  return (
    <ContactsClient
      contacts={contacts}
      gapFlags={flags}
      gapCounts={counts}
      catalogoTagsInternas={catalogos.internas}
      catalogoTagsClickmassa={catalogos.clickmassa}
      grupos={grupos}
    />
  );
}
