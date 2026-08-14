import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Anexo, AnexoOwner } from "./types";
import { isAnexoPermitido } from "./types";

/**
 * Acesso a anexos — Storage privado + tabela `anexos` (service role, server-only).
 *
 * Bucket `anexos` é PRIVADO: a UI nunca recebe URL pública, só URL ASSINADA
 * temporária (`signedUrlDoAnexo`). Delete e registro passam pelo service role
 * (bypassa RLS) — as Server Actions que chamam já estão atrás de `requireSession`.
 *
 * UPLOAD É DIRETO DO NAVEGADOR (D-anexos): o servidor só assina uma URL de
 * upload (`criarUploadAssinado`) e depois registra o metadado (`registrarAnexo`).
 * O arquivo NUNCA trafega pela Server Action — é por isso que um PDF de 20MB
 * passa, mesmo com `bodySizeLimit: "3mb"` no next.config (limite que segue
 * valendo pra capa do blog, agora sem acoplamento nenhum com anexos).
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

/** Coluna de LEITURA do dono. A escrita usa `ownerColumns` (grava os dois FKs). */
function ownerColumn(owner: AnexoOwner): "jornada_id" | "contact_id" {
  return owner.kind === "jornada" ? "jornada_id" : "contact_id";
}

/**
 * FKs gravados no INSERT. Anexo de jornada grava TAMBÉM o `contact_id` da
 * jornada: o CHECK do banco só exige "ao menos um dono", e com os dois
 * preenchidos o arquivo aparece na ficha do contato sem tocar em nenhuma
 * leitura (`getAnexos` do contato segue filtrando por `contact_id`). Jornada
 * sem contato vinculado grava só o `jornada_id`, como antes.
 */
function ownerColumns(owner: AnexoOwner): Record<string, string> {
  if (owner.kind === "contact") return { contact_id: owner.id };
  return owner.contactId
    ? { jornada_id: owner.id, contact_id: owner.contactId }
    : { jornada_id: owner.id };
}

/** Prefixo do path no bucket — todo objeto de um dono mora debaixo dele. */
function ownerPrefix(owner: AnexoOwner): string {
  return `${owner.kind}/${owner.id}/`;
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

/** O que o cliente precisa pra subir o arquivo sozinho, sem credencial nenhuma. */
export type UploadAssinado = {
  /** URL de PUT já com o token embutido (válida por ~2h). */
  signedUrl: string;
  /** Path no bucket que o cliente devolve no registro. */
  path: string;
};

/**
 * PASSO 1 do upload: assina uma URL pro cliente subir DIRETO no bucket privado.
 * Nada é gravado na tabela aqui — o registro é o passo 2, depois do upload
 * confirmado, pra nunca existir linha apontando pra objeto inexistente.
 */
export async function criarUploadAssinado(
  owner: AnexoOwner,
  nomeArquivo: string,
): Promise<UploadAssinado> {
  if (!isAnexoPermitido(nomeArquivo)) {
    throw new Error("Tipo de arquivo não permitido (use PDF, Word, Excel ou imagem).");
  }

  const path = `${ownerPrefix(owner)}${crypto.randomUUID()}-${nomeSeguro(nomeArquivo)}`;
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Erro ao preparar upload: ${error?.message ?? "desconhecido"}`);
  }
  return { signedUrl: data.signedUrl, path: data.path };
}

/** Metadado que o cliente devolve depois do upload confirmado. */
export type RegistroAnexo = {
  path: string;
  nomeArquivo: string;
  tipo: string | null;
  tamanhoBytes: number;
};

/**
 * PASSO 2 do upload: registra o metadado do objeto já subido.
 *
 * O `path` vem do cliente, então é conferido contra o prefixo do dono — sem
 * isso, uma chamada forjada registraria um objeto de outro contato/jornada.
 *
 * Se ESTE passo falhar depois de o objeto ter subido, o arquivo fica órfão no
 * bucket (invisível na UI, custo desprezível) e nenhuma linha suja a tabela —
 * troca deliberada: linha órfã confunde a operadora, byte órfão não.
 */
export async function registrarAnexo(
  owner: AnexoOwner,
  registro: RegistroAnexo,
): Promise<Anexo> {
  if (!isAnexoPermitido(registro.nomeArquivo)) {
    throw new Error("Tipo de arquivo não permitido (use PDF, Word, Excel ou imagem).");
  }
  if (!registro.path.startsWith(ownerPrefix(owner))) {
    throw new Error("Caminho do arquivo não confere com o dono do anexo.");
  }

  const { data, error } = await supabaseAdmin()
    .from("anexos")
    .insert({
      ...ownerColumns(owner),
      nome_arquivo: registro.nomeArquivo,
      storage_path: registro.path,
      tipo: registro.tipo,
      tamanho_bytes: registro.tamanhoBytes,
    })
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao registrar anexo: ${error.message}`);
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
