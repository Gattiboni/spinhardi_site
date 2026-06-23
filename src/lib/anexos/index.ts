import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Anexo, AnexoOwner } from "./types";
import { isAnexoPermitido } from "./types";

/**
 * Acesso a anexos — Storage privado + tabela `anexos` (service role, server-only).
 *
 * Bucket `anexos` é PRIVADO: a UI nunca recebe URL pública, só URL ASSINADA
 * temporária (`signedUrlDoAnexo`). Upload e delete passam pelo service role
 * (bypassa RLS) — as Server Actions que chamam já estão atrás de `requireSession`.
 *
 * Path no bucket: `{jornada|contact}/{ownerId}/{uuid}-{nome}` — o uuid evita
 * colisão de nomes; o prefixo por dono mantém os arquivos organizados e fáceis
 * de varrer. As LEITURAS degradam pra vazio em erro (o detalhe não quebra);
 * as ESCRITAS lançam (a action captura e devolve mensagem).
 */

const BUCKET = "anexos";
const SIGNED_URL_TTL = 60; // segundos — link de visualização efêmero

type AnexoRow = {
  id: string;
  contact_id: string | null;
  jornada_id: string | null;
  nome_arquivo: string;
  storage_path: string;
  tipo: string | null;
  tamanho_bytes: number | string | null;
  uploaded_by: string | null;
  created_at: string;
};

function rowToAnexo(row: AnexoRow): Anexo {
  return {
    id: row.id,
    contactId: row.contact_id,
    jornadaId: row.jornada_id,
    nomeArquivo: row.nome_arquivo,
    storagePath: row.storage_path,
    tipo: row.tipo,
    tamanhoBytes: row.tamanho_bytes == null ? null : Number(row.tamanho_bytes),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

const COLS =
  "id, contact_id, jornada_id, nome_arquivo, storage_path, tipo, tamanho_bytes, uploaded_by, created_at";

function ownerColumn(owner: AnexoOwner): "jornada_id" | "contact_id" {
  return owner.kind === "jornada" ? "jornada_id" : "contact_id";
}

// Remove separadores de path e espaços problemáticos do nome, preservando a
// extensão. O uuid no path garante unicidade; aqui só evitamos quebrar a rota.
function nomeSeguro(nome: string): string {
  return nome.replace(/[/\\]+/g, "_").replace(/\s+/g, "_").slice(-120);
}

/** Anexos de um dono (jornada ou contato), mais recentes primeiro. */
export async function getAnexos(owner: AnexoOwner): Promise<Anexo[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("anexos")
      .select(COLS)
      .eq(ownerColumn(owner), owner.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data as AnexoRow[]) ?? []).map(rowToAnexo);
  } catch (err) {
    console.error("[anexos] getAnexos:", err);
    return [];
  }
}

/**
 * Sobe um arquivo pro bucket privado e registra a linha em `anexos`. Valida a
 * extensão antes de gastar upload. Se a inserção da linha falhar, remove o objeto
 * recém-subido (não deixa lixo órfão no Storage).
 */
export async function uploadAnexo(owner: AnexoOwner, file: File): Promise<Anexo> {
  if (!isAnexoPermitido(file.name)) {
    throw new Error("Tipo de arquivo não permitido (use PDF, Word, Excel ou imagem).");
  }

  const sb = supabaseAdmin();
  const path = `${owner.kind}/${owner.id}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throw new Error(`Erro ao subir arquivo: ${upErr.message}`);

  const { data, error } = await sb
    .from("anexos")
    .insert({
      [ownerColumn(owner)]: owner.id,
      nome_arquivo: file.name,
      storage_path: path,
      tipo: file.type || null,
      tamanho_bytes: file.size,
    })
    .select(COLS)
    .single();

  if (error) {
    // Rollback do objeto pra não deixar órfão no bucket.
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(`Erro ao registrar anexo: ${error.message}`);
  }

  return rowToAnexo(data as AnexoRow);
}

/** Remove um anexo do Storage E da tabela. Idempotente no Storage. */
export async function removeAnexo(id: string): Promise<void> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("anexos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar anexo: ${error.message}`);
  if (!data) return; // já não existe

  const path = (data as { storage_path: string }).storage_path;
  const { error: rmErr } = await sb.storage.from(BUCKET).remove([path]);
  if (rmErr) throw new Error(`Erro ao remover arquivo: ${rmErr.message}`);

  const { error: delErr } = await sb.from("anexos").delete().eq("id", id);
  if (delErr) throw new Error(`Erro ao excluir anexo: ${delErr.message}`);
}

/** URL ASSINADA temporária pra visualizar/baixar um anexo (bucket é privado). */
export async function signedUrlDoAnexo(id: string): Promise<string> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("anexos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Erro ao buscar anexo: ${error.message}`);
  if (!data) throw new Error("Anexo não encontrado.");

  const path = (data as { storage_path: string }).storage_path;
  const { data: signed, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !signed) {
    throw new Error(`Erro ao gerar link: ${signErr?.message ?? "desconhecido"}`);
  }
  return signed.signedUrl;
}
