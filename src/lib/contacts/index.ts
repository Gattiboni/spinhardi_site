import { supabaseAdmin } from "@/lib/supabase/server";
import { Contact, ContactInteraction, EstagioFunil, CaptureOrigin } from "./types";
import {
  rowToContact,
  rowToInteraction,
  contactToInsertRow,
  contactPatchToRow,
  interactionToInsertRow,
  type ContactRow,
  type ContactInteractionRow,
} from "./mappers";

/**
 * Acesso a contatos — Supabase (Lote C).
 *
 * Leitura via Server Components, escrita via Server Actions; ambos passam por
 * este módulo, que usa o client server-only com service role (`supabaseAdmin`,
 * bypassa RLS). As assinaturas são idênticas às da fase mock — as páginas que
 * consomem não mudam.
 *
 * Os filtros de `getContacts` são aplicados em memória sobre o array já mapeado.
 * O volume é boutique; não vale a complexidade de traduzir cada filtro pra query.
 */

// ─────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────

export async function getContacts(opts?: {
  estagio?: EstagioFunil | "todos";
  origem?: CaptureOrigin | "todas";
  tags?: string[];
  syncStatus?: "todos" | "synced" | "pending" | "failed" | "partial";
  search?: string;
  status?: "ativo" | "arquivado";
}): Promise<Contact[]> {
  const { data, error } = await supabaseAdmin()
    .from("contacts")
    .select("*")
    .eq("status", opts?.status ?? "ativo")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar contatos: ${error.message}`);
  }

  let contacts = (data as ContactRow[]).map(rowToContact);

  if (opts?.estagio && opts.estagio !== "todos") {
    contacts = contacts.filter((c) => c.estagio === opts.estagio);
  }

  if (opts?.origem && opts.origem !== "todas") {
    contacts = contacts.filter((c) => c.origem === opts.origem);
  }

  if (opts?.tags && opts.tags.length > 0) {
    contacts = contacts.filter((c) => opts.tags!.some((tag) => c.tags.includes(tag)));
  }

  if (opts?.syncStatus && opts.syncStatus !== "todos") {
    contacts = contacts.filter((c) => {
      const i = c.iddasSyncStatus;
      const cm = c.clickmassaSyncStatus;
      switch (opts.syncStatus) {
        case "synced":
          return i === "synced" && cm === "synced";
        case "pending":
          return i === "pending" || cm === "pending";
        case "failed":
          return i === "failed" && cm === "failed";
        case "partial":
          return (i === "synced") !== (cm === "synced");
      }
    });
  }

  if (opts?.search) {
    const q = opts.search.toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.whatsapp.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return contacts;
}

export async function getContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabaseAdmin()
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar contato ${id}: ${error.message}`);
  }

  return data ? rowToContact(data as ContactRow) : null;
}

export async function getContactInteractions(contactId: string): Promise<ContactInteraction[]> {
  const { data, error } = await supabaseAdmin()
    .from("contact_interactions")
    .select("*")
    .eq("contact_id", contactId)
    .order("criado_em", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar interações do contato ${contactId}: ${error.message}`);
  }

  return (data as ContactInteractionRow[]).map(rowToInteraction);
}

// ─────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────

export async function createContact(
  data: Omit<Contact, "id" | "createdAt" | "updatedAt">,
): Promise<Contact> {
  const { data: inserted, error } = await supabaseAdmin()
    .from("contacts")
    .insert(contactToInsertRow(data))
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar contato: ${error.message}`);
  }

  return rowToContact(inserted as ContactRow);
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
  // `updated_at` fica de fora do patch — o trigger do banco cuida dele.
  const { data: updated, error } = await supabaseAdmin()
    .from("contacts")
    .update(contactPatchToRow(patch))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar contato ${id}: ${error.message}`);
  }

  return rowToContact(updated as ContactRow);
}

export async function addInteraction(
  contactId: string,
  data: Omit<ContactInteraction, "id" | "contactId" | "criadoEm">,
): Promise<ContactInteraction> {
  const { data: inserted, error } = await supabaseAdmin()
    .from("contact_interactions")
    .insert(interactionToInsertRow({ contactId, ...data }))
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao registrar interação do contato ${contactId}: ${error.message}`);
  }

  return rowToInteraction(inserted as ContactInteractionRow);
}

// ─────────────────────────────────────────────────────────────────
// Agregação pro dashboard
//
// Volume boutique: puxa os ativos uma vez e conta em memória — uma fonte de
// verdade só (mesmo mapeamento de `getContacts`), sem 6 queries de count.
// ─────────────────────────────────────────────────────────────────

export async function getContactStats(): Promise<{
  novosHoje: number;
  followUpHoje: number;
  pendentesSync: number;
  capturasMes: number;
  emNegociacao: number;
  fechadosMes: number;
}> {
  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const ativos = await getContacts({ status: "ativo" });

  return {
    novosHoje: ativos.filter((c) => c.createdAt.startsWith(hoje)).length,
    followUpHoje: ativos.filter((c) => c.proximoFollowUp && c.proximoFollowUp <= hoje).length,
    pendentesSync: ativos.filter(
      (c) =>
        c.iddasSyncStatus === "pending" ||
        c.clickmassaSyncStatus === "pending" ||
        c.iddasSyncStatus === "failed" ||
        c.clickmassaSyncStatus === "failed",
    ).length,
    capturasMes: ativos.filter((c) => c.createdAt >= primeiroDiaMes).length,
    emNegociacao: ativos.filter((c) => c.estagio === "em_negociacao").length,
    fechadosMes: ativos.filter(
      (c) => c.estagio === "fechado_confirmado" && c.estagioAtualizadoEm >= primeiroDiaMes,
    ).length,
  };
}
