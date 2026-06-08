import { Contact, ContactInteraction, EstagioFunil, CaptureOrigin } from "./types";
import { MOCK_CONTACTS } from "./mock-contacts";
import { MOCK_INTERACTIONS } from "./mock-interactions";

/**
 * Acesso a contatos.
 *
 * MOCK na Fase 1: dados estáticos.
 * Vira integração Supabase no Lote C — implementação destas funções muda,
 * páginas que consomem continuam idênticas.
 */

export async function getContacts(opts?: {
  estagio?: EstagioFunil | "todos";
  origem?: CaptureOrigin | "todas";
  tags?: string[];
  syncStatus?: "todos" | "synced" | "pending" | "failed" | "partial";
  search?: string;
  status?: "ativo" | "arquivado";
}): Promise<Contact[]> {
  let contacts = MOCK_CONTACTS;

  if (opts?.status) {
    contacts = contacts.filter((c) => c.status === opts.status);
  } else {
    // default: ativos
    contacts = contacts.filter((c) => c.status === "ativo");
  }

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

  return [...contacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getContactById(id: string): Promise<Contact | null> {
  return MOCK_CONTACTS.find((c) => c.id === id) ?? null;
}

export async function getContactInteractions(contactId: string): Promise<ContactInteraction[]> {
  return MOCK_INTERACTIONS.filter((i) => i.contactId === contactId).sort((a, b) =>
    a.criadoEm.localeCompare(b.criadoEm),
  );
}

// Stubs — não funcionais na Fase 1
export async function createContact(
  _data: Omit<Contact, "id" | "createdAt" | "updatedAt">,
): Promise<Contact> {
  throw new Error("Implementação completa virá no Lote C (Supabase)");
}

export async function updateContact(_id: string, _patch: Partial<Contact>): Promise<Contact> {
  throw new Error("Implementação completa virá no Lote C (Supabase)");
}

export async function addInteraction(
  _contactId: string,
  _data: Omit<ContactInteraction, "id" | "contactId" | "criadoEm">,
): Promise<ContactInteraction> {
  throw new Error("Implementação completa virá no Lote C (Supabase)");
}

// Helpers de agregação pro dashboard
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

  const ativos = MOCK_CONTACTS.filter((c) => c.status === "ativo");

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
