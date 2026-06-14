import { getContacts } from "@/lib/contacts";
import ContactsClient from "./ContactsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatos · Admin",
};

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

export default async function AdminContatos() {
  const contacts = await getContacts({ status: "ativo" });
  return <ContactsClient contacts={contacts} />;
}
