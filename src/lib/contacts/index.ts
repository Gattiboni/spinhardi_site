import { supabaseAdmin } from "@/lib/supabase/server";
import { Contact, ContactInteraction, CaptureOrigin } from "./types";
import { normalizeBrPhoneLegacy } from "./phone";
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

// ─────────────────────────────────────────────────────────────────
// Dedup por telefone/e-mail (captura do site)
//
// A partir do Lote 1.1 os registros NOVOS gravam o WhatsApp canônico (só dígitos,
// com DDD, sem 55 — ver phone.ts), então o match principal é canônico vs canônico
// (igualdade direta). Mas o banco tem registros HISTÓRICOS sujos ("+55 11 9...",
// "119 8334 044", formatos mistos por origem): pra casar com eles mantemos o
// fallback por sufixo (últimos 11/10 dígitos, tolera prefixo 55 e ausência de
// DDD). E-mail casa exato, case-insensitive. Volume boutique: um select enxuto
// (id/whatsapp/email) dos ativos e varredura em memória — padrão de `getContacts`.
// ─────────────────────────────────────────────────────────────────

// `canonical` é a chave forte (só existe quando o número normaliza como BR
// válido); `d11`/`d10` são o fallback por sufixo pros registros legados sujos.
function phoneKeys(raw: string): { canonical: string | null; d11: string; d10: string } | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Dedup usa a variante COM promoção do nono dígito de propósito: um registro
  // legado de 10 díg (celular antigo) casa via canônico com um cadastro novo de
  // 11. É o único lugar onde a promoção é correta (comparar, não gravar).
  const norm = normalizeBrPhoneLegacy(raw);
  return {
    canonical: norm.ok ? norm.canonical : null,
    d11: digits.slice(-11),
    d10: digits.slice(-10),
  };
}

/**
 * Acha um contato ATIVO já existente pelo telefone (últimos 11/10 dígitos) ou
 * pelo e-mail exato (case-insensitive). E-mail tem prioridade. Retorna só o id
 * (é o que os chamadores precisam) ou null se não houver match.
 */
export async function findExistingContact(input: {
  whatsapp: string;
  email?: string | null;
}): Promise<{ id: string } | null> {
  const target = phoneKeys(input.whatsapp ?? "");
  const email = input.email?.trim().toLowerCase() || null;
  if (!target && !email) return null;

  const { data, error } = await supabaseAdmin()
    .from("contacts")
    .select("id, whatsapp, email")
    .eq("status", "ativo")
    .limit(5000);

  if (error) {
    throw new Error(`Erro ao buscar contato existente: ${error.message}`);
  }

  const rows = (data as { id: string; whatsapp: string; email: string | null }[]) ?? [];

  if (email) {
    const byEmail = rows.find(
      (r) => r.email && r.email.trim().toLowerCase() === email,
    );
    if (byEmail) return { id: byEmail.id };
  }

  if (target) {
    const byPhone = rows.find((r) => {
      const k = phoneKeys(r.whatsapp ?? "");
      if (k === null) return false;
      // Match forte: canônico vs canônico (registros novos).
      if (target.canonical && k.canonical && target.canonical === k.canonical) {
        return true;
      }
      // Fallback por sufixo: casa com o legado sujo do banco.
      return k.d11 === target.d11 || k.d10 === target.d10;
    });
    if (byPhone) return { id: byPhone.id };
  }

  return null;
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

/**
 * Edita o texto de uma NOTA INTERNA da timeline. O filtro `tipo='nota_interna'`
 * é a trava: eventos de sistema (sync, mudança de estágio, etc.) nunca são
 * editáveis, mesmo que o id chegue aqui. Retorna quantas linhas casaram.
 */
export async function updateNotaInterna(id: string, descricao: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("contact_interactions")
    .update({ descricao })
    .eq("id", id)
    .eq("tipo", "nota_interna")
    .select("id");

  if (error) {
    throw new Error(`Erro ao editar nota ${id}: ${error.message}`);
  }

  return (data as { id: string }[]).length;
}

/**
 * Exclui uma NOTA INTERNA da timeline. Mesma trava `tipo='nota_interna'`:
 * eventos de sistema são read-only e não podem ser apagados por aqui.
 */
export async function deleteNotaInterna(id: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("contact_interactions")
    .delete()
    .eq("id", id)
    .eq("tipo", "nota_interna")
    .select("id");

  if (error) {
    throw new Error(`Erro ao excluir nota ${id}: ${error.message}`);
  }

  return (data as { id: string }[]).length;
}

// ─────────────────────────────────────────────────────────────────
// Agregação pro dashboard
//
// Cada número é um COUNT no Postgres (`count: 'exact', head: true`): conta no
// banco, sem trazer nenhuma linha pro JS — imune ao teto de 1000 do PostgREST.
// "Novos"/"Capturas" contam só origem != 'importado' na janela (os 826
// importados não entram → devem dar 0 hoje). Degrada pra zeros em caso de erro.
// ─────────────────────────────────────────────────────────────────

export async function getContactStats(): Promise<{
  novosHoje: number;
  followUpHoje: number;
  capturasMes: number;
  emNegociacao: number;
  fechadosMes: number;
}> {
  const now = new Date();
  const hoje = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const inicioDia = `${hoje}T00:00:00`;
  const inicioMes = `${new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)}T00:00:00`;

  const sb = supabaseAdmin();
  // Builder base: conta contatos ativos sem trazer linha (head: true).
  const ativos = () =>
    sb.from("contacts").select("*", { count: "exact", head: true }).eq("status", "ativo");

  // D072: "em negociação" e "fechados" agora vêm de JORNADAS, não do contato.
  //  - emNegociacao  = jornadas abertas e aprovadas (atendimentos em andamento).
  //  - fechadosMes   = jornadas aprovadas (estagio='aprovado') fechadas no mês.
  const jornadas = () =>
    sb.from("jornadas").select("*", { count: "exact", head: true });

  try {
    const [novos, follow, capturas, negociacao, fechados] = await Promise.all([
      ativos().neq("origem", "importado").gte("created_at", inicioDia),
      ativos().not("proximo_follow_up", "is", null).lte("proximo_follow_up", hoje),
      ativos().neq("origem", "importado").gte("created_at", inicioMes),
      jornadas().eq("aberta", true).eq("aprovacao_status", "aprovada"),
      jornadas().eq("estagio", "aprovado").gte("closed_at", inicioMes),
    ]);

    return {
      novosHoje: novos.count ?? 0,
      followUpHoje: follow.count ?? 0,
      capturasMes: capturas.count ?? 0,
      emNegociacao: negociacao.count ?? 0,
      fechadosMes: fechados.count ?? 0,
    };
  } catch (err) {
    console.error("[getContactStats] erro ao contar stats:", err);
    return {
      novosHoje: 0,
      followUpHoje: 0,
      capturasMes: 0,
      emNegociacao: 0,
      fechadosMes: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Segmentos de gap — fontes server-side
//
// Duplicados e "sem cadastro no Iddas" vêm de funções (RPC) que o Claudinho
// definiu e validou no banco: o Postgres já devolve só o conjunto filtrado
// (48 e 170 hoje), não varremos linha no JS. UMA chamada por função: a contagem
// do card é o tamanho do conjunto e a lista filtrada são esses mesmos ids —
// mesma fonte (mata o desync). "Sem email" é um COUNT no banco (head: true).
// Cada leitura degrada pra vazio/zero em caso de erro.
// ─────────────────────────────────────────────────────────────────

async function rpcContactIds(fn: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin().rpc(fn);
  if (error) throw error;
  return new Set((data as { id: string }[]).map((r) => r.id));
}

/** Conjunto de contatos possíveis-duplicados (mesmo whatsapp). Fonte única. */
export async function getDuplicateContactIds(): Promise<Set<string>> {
  try {
    return await rpcContactIds("gold_contatos_duplicados");
  } catch (err) {
    console.error("[getDuplicateContactIds] erro:", err);
    return new Set();
  }
}

/** Conjunto de contatos com ClickMassa e SEM cadastro no Iddas. */
export async function getSemIddasContactIds(): Promise<Set<string>> {
  try {
    return await rpcContactIds("gold_contatos_sem_iddas");
  } catch (err) {
    console.error("[getSemIddasContactIds] erro:", err);
    return new Set();
  }
}

/** Contagem de contatos ativos sem e-mail — COUNT no banco, sem trazer linha. */
export async function getSemEmailCount(): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin()
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo")
      .or("email.is.null,email.eq.");
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("[getSemEmailCount] erro:", err);
    return 0;
  }
}
