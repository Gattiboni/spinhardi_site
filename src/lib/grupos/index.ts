import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Grupo, GrupoComContagens, MembroDoGrupo } from "./types";

/**
 * Grupos — CRUD e membresia. `supabaseAdmin()`, server-only, mesmo padrão do
 * resto do repo.
 *
 * NENHUMA chamada ao Resend acontece aqui, de propósito: criar, renomear,
 * adicionar e remover membro são operações locais. O Segment do Resend é
 * materializado só no envio (F5), preguiçosamente, e o id fica em
 * `grupos.resend_segment_id`.
 *
 * Elegibilidade nunca é reimplementada: quem responde "quantos deste grupo
 * receberiam hoje" é a view `contatos_elegiveis_email` (E1).
 */

type GrupoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  resend_segment_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToGrupo(row: GrupoRow): Grupo {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    resendSegmentId: row.resend_segment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLS = "id, nome, descricao, resend_segment_id, created_at, updated_at";
const TETO = 5000;

/** O índice unique de nome é case-insensitive — a mensagem precisa dizer isso. */
function ehNomeDuplicado(mensagem: string): boolean {
  return /duplicate key|unique/i.test(mensagem);
}

function validarNome(nome: string): string | null {
  const v = nome.trim();
  if (v.length < 2) return "Dê um nome com ao menos 2 letras.";
  if (v.length > 80) return "O nome ficou longo demais (máximo 80 letras).";
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────

export async function getGrupos(): Promise<Grupo[]> {
  const { data, error } = await supabaseAdmin()
    .from("grupos")
    .select(COLS)
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao listar grupos: ${error.message}`);
  return ((data as GrupoRow[]) ?? []).map(rowToGrupo);
}

export async function getGrupoById(id: string): Promise<Grupo | null> {
  const { data, error } = await supabaseAdmin()
    .from("grupos")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar grupo: ${error.message}`);
  return data ? rowToGrupo(data as GrupoRow) : null;
}

/** Ids dos contatos elegíveis AGORA — base das duas contagens. */
async function idsElegiveis(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin()
    .from("contatos_elegiveis_email")
    .select("id")
    .limit(TETO);
  if (error) throw new Error(`Erro ao ler elegíveis: ${error.message}`);
  return new Set(((data as { id: string }[]) ?? []).map((l) => l.id));
}

/**
 * Lista com as duas contagens. Uma leitura de membresia inteira + o conjunto de
 * elegíveis; o cruzamento é em memória. Volume boutique (205 elegíveis, grupos
 * curados à mão) — não vale RPC nova, que aliás está fora do lote.
 */
export async function getGruposComContagens(): Promise<GrupoComContagens[]> {
  const sb = supabaseAdmin();

  const [grupos, elegiveis, { data: membros, error }] = await Promise.all([
    getGrupos(),
    idsElegiveis(),
    sb.from("grupo_contatos").select("grupo_id, contact_id").limit(TETO),
  ]);

  if (error) throw new Error(`Erro ao ler membros: ${error.message}`);
  const linhas = (membros as { grupo_id: string; contact_id: string }[]) ?? [];

  return grupos.map((g) => {
    const doGrupo = linhas.filter((l) => l.grupo_id === g.id);
    return {
      ...g,
      membros: doGrupo.length,
      elegiveis: doGrupo.filter((l) => elegiveis.has(l.contact_id)).length,
    };
  });
}

export async function getMembros(grupoId: string): Promise<MembroDoGrupo[]> {
  const sb = supabaseAdmin();

  const { data: vinculos, error } = await sb
    .from("grupo_contatos")
    .select("contact_id, adicionado_em")
    .eq("grupo_id", grupoId)
    .limit(TETO);

  if (error) throw new Error(`Erro ao ler membros do grupo: ${error.message}`);
  const linhas = (vinculos as { contact_id: string; adicionado_em: string }[]) ?? [];
  if (linhas.length === 0) return [];

  const ids = linhas.map((l) => l.contact_id);
  const [elegiveis, { data: contatos, error: eC }] = await Promise.all([
    idsElegiveis(),
    sb.from("contacts").select("id, name, email, status, email_marketing_status").in("id", ids),
  ]);

  if (eC) throw new Error(`Erro ao ler contatos do grupo: ${eC.message}`);
  const porId = new Map(
    (
      (contatos as {
        id: string;
        name: string;
        email: string | null;
        status: string;
        email_marketing_status: string;
      }[]) ?? []
    ).map((c) => [c.id, c]),
  );

  return linhas
    .map((l) => {
      const c = porId.get(l.contact_id);
      const elegivel = elegiveis.has(l.contact_id);
      let motivo: string | null = null;
      if (!elegivel) {
        if (!c) motivo = "contato não encontrado";
        else if (c.status !== "ativo") motivo = "contato arquivado";
        else if (!c.email?.trim()) motivo = "sem e-mail";
        else if (c.email_marketing_status === "descadastrado") motivo = "pediu pra sair";
        else if (c.email_marketing_status === "invalido") motivo = "e-mail com problema";
        else motivo = "fora da lista de quem recebe";
      }
      return {
        contactId: l.contact_id,
        nome: c?.name ?? "(contato removido)",
        email: c?.email ?? null,
        adicionadoEm: l.adicionado_em,
        elegivel,
        motivoInelegivel: motivo,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

/** Grupos de que UM contato participa — bloco da ficha. */
export async function getGruposDoContato(contactId: string): Promise<Grupo[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("grupo_contatos")
    .select("grupo_id")
    .eq("contact_id", contactId);

  if (error) throw new Error(`Erro ao ler grupos do contato: ${error.message}`);
  const ids = ((data as { grupo_id: string }[]) ?? []).map((l) => l.grupo_id);
  if (ids.length === 0) return [];

  const { data: grupos, error: eG } = await sb
    .from("grupos")
    .select(COLS)
    .in("id", ids)
    .order("nome", { ascending: true });

  if (eG) throw new Error(`Erro ao ler grupos: ${eG.message}`);
  return ((grupos as GrupoRow[]) ?? []).map(rowToGrupo);
}

// ─────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────

export type ResultadoGrupo = { ok: true; grupo: Grupo } | { ok: false; erro: string };

/** Cria um grupo. Nome é único case-insensitive — o erro do índice vira frase. */
export async function criarGrupo(input: {
  nome: string;
  descricao: string | null;
}): Promise<ResultadoGrupo> {
  const invalido = validarNome(input.nome);
  if (invalido) return { ok: false, erro: invalido };

  const { data, error } = await supabaseAdmin()
    .from("grupos")
    .insert({
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
    })
    .select(COLS)
    .single();

  if (error) {
    if (ehNomeDuplicado(error.message)) {
      return { ok: false, erro: "Já existe um grupo com esse nome." };
    }
    return { ok: false, erro: "Não foi possível criar o grupo." };
  }
  return { ok: true, grupo: rowToGrupo(data as GrupoRow) };
}

/** Renomeia e/ou edita a descrição. `resend_segment_id` NUNCA é tocado aqui. */
export async function editarGrupo(
  id: string,
  campos: { nome?: string; descricao?: string | null },
): Promise<ResultadoGrupo> {
  if (campos.nome !== undefined) {
    const invalido = validarNome(campos.nome);
    if (invalido) return { ok: false, erro: invalido };
  }

  const patch: Record<string, string | null> = {};
  if (campos.nome !== undefined) patch.nome = campos.nome.trim();
  if (campos.descricao !== undefined) patch.descricao = campos.descricao?.trim() || null;

  const { data, error } = await supabaseAdmin()
    .from("grupos")
    .update(patch)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) {
    if (ehNomeDuplicado(error.message)) {
      return { ok: false, erro: "Já existe um grupo com esse nome." };
    }
    return { ok: false, erro: "Não foi possível salvar o grupo." };
  }
  return { ok: true, grupo: rowToGrupo(data as GrupoRow) };
}

/**
 * Apaga o grupo. A membresia cai junto por CASCADE — os CONTATOS ficam onde
 * estão, é só o vínculo que some. Campanha já enviada não é afetada: o
 * destinatário dela está congelado em `campanha_destinatarios` (G5).
 *
 * O Segment correspondente no Resend NÃO é removido: ele pode estar amarrado a
 * um broadcast já enviado, e apagar quebraria o histórico lá.
 */
export async function apagarGrupo(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await supabaseAdmin().from("grupos").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível apagar o grupo." };
  return { ok: true };
}

/**
 * Adiciona membros. Idempotente: a PK composta cobre a repetição e o
 * `ignoreDuplicates` faz reentrada não virar erro. Devolve quantos ENTRARAM
 * de fato (não quantos foram pedidos) — é o número que a frase da tela usa.
 */
export async function adicionarMembros(
  grupoId: string,
  contactIds: string[],
): Promise<{ ok: true; adicionados: number } | { ok: false; erro: string }> {
  if (contactIds.length === 0) return { ok: false, erro: "Nenhum contato escolhido." };

  const { data, error } = await supabaseAdmin()
    .from("grupo_contatos")
    .upsert(
      contactIds.map((contactId) => ({ grupo_id: grupoId, contact_id: contactId })),
      { onConflict: "grupo_id,contact_id", ignoreDuplicates: true },
    )
    .select("contact_id");

  if (error) {
    console.error("[grupos.adicionarMembros]", error);
    return { ok: false, erro: "Não foi possível adicionar ao grupo." };
  }
  return { ok: true, adicionados: ((data as { contact_id: string }[]) ?? []).length };
}

export async function removerMembro(
  grupoId: string,
  contactId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { error } = await supabaseAdmin()
    .from("grupo_contatos")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("contact_id", contactId);

  if (error) return { ok: false, erro: "Não foi possível remover do grupo." };
  return { ok: true };
}
