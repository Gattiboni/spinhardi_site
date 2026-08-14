/**
 * Anexos — arquivos ligados a um contato OU a uma jornada (tabela `anexos`,
 * bucket privado `anexos`). O CHECK do banco garante ao menos um dono; aqui o
 * `AnexoOwner` modela exatamente essa escolha (jornada xor contato).
 *
 * Tipos e helpers PUROS (ícone, validação, formato) ficam aqui pra serem
 * importáveis por Client Components. O acesso ao Storage/Postgres fica no
 * `index.ts` server-only.
 */

export type AnexoOwnerKind = "jornada" | "contact";

/**
 * Dono do anexo. União DISCRIMINADA de propósito: a variante "jornada" exige o
 * `contactId` da jornada porque a ESCRITA grava os DOIS FKs (`jornada_id` +
 * `contact_id`) — assim o arquivo subido na jornada aparece também na ficha do
 * contato, sem mudar nenhuma leitura (o CHECK do banco já aceita ambos). Sendo
 * união, o TypeScript cobra o campo em todo ponto que monta um owner de jornada.
 */
export type AnexoOwner =
  | { kind: "contact"; id: string }
  | { kind: "jornada"; id: string; contactId: string | null };

export type Anexo = {
  id: string;
  contactId: string | null;
  jornadaId: string | null;
  nomeArquivo: string;
  storagePath: string;
  tipo: string | null;
  tamanhoBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
};

/** Categoria visual do anexo (decide o ícone). Deriva da extensão/mime. */
export type AnexoKind = "pdf" | "doc" | "xls" | "image" | "file";

const EXT_KIND: Record<string, AnexoKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  xls: "xls",
  xlsx: "xls",
  jpg: "image",
  jpeg: "image",
  png: "image",
};

function extOf(nome: string): string {
  const dot = nome.lastIndexOf(".");
  return dot === -1 ? "" : nome.slice(dot + 1).toLowerCase();
}

/** Categoria do anexo (pdf/doc/xls/image/file) pela extensão do nome. */
export function anexoKind(nomeArquivo: string): AnexoKind {
  return EXT_KIND[extOf(nomeArquivo)] ?? "file";
}

/** Emoji por categoria — usado na lista de anexos. */
export const ANEXO_ICON: Record<AnexoKind, string> = {
  pdf: "📄",
  doc: "📝",
  xls: "📊",
  image: "🖼️",
  file: "📎",
};

/** Extensões aceitas no upload (PDF, Word, Excel, imagem). */
export const ANEXO_EXTENSOES = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
] as const;

/** `accept` do <input type="file"> a partir das extensões aceitas. */
export const ANEXO_ACCEPT = ANEXO_EXTENSOES.map((e) => `.${e}`).join(",");

/** Valida se o nome do arquivo tem uma extensão aceita. */
export function isAnexoPermitido(nomeArquivo: string): boolean {
  return (ANEXO_EXTENSOES as readonly string[]).includes(extOf(nomeArquivo));
}

/**
 * Teto de NEGÓCIO do anexo: 25MB. Não é limite de infra — o arquivo vai direto
 * do navegador pro Storage por URL assinada, sem passar pela Server Action, e
 * portanto sem esbarrar no `bodySizeLimit` do next.config (que segue valendo só
 * pra capa do blog). Este número existe pra não encher o bucket com vídeo.
 */
export const ANEXO_MAX_MB = 25;
export const ANEXO_MAX_BYTES = ANEXO_MAX_MB * 1024 * 1024;

export type ValidacaoAnexo = { ok: true } | { ok: false; erro: string };

/**
 * Validação do arquivo ANTES de gastar rede — roda no cliente (o `File` do
 * input) e é reaplicada no servidor pelas actions (defesa em profundidade).
 * Recebe só `{ name, size }` pra ser testável sem `File`.
 */
export function validarArquivoAnexo(file: { name: string; size: number }): ValidacaoAnexo {
  if (file.size === 0) return { ok: false, erro: "Arquivo vazio." };
  if (!isAnexoPermitido(file.name)) {
    return { ok: false, erro: "Tipo não aceito (use PDF, Word, Excel ou imagem)." };
  }
  if (file.size > ANEXO_MAX_BYTES) {
    return {
      ok: false,
      erro: `Arquivo maior que ${ANEXO_MAX_MB}MB (${formatTamanho(file.size)}).`,
    };
  }
  return { ok: true };
}

/** Tamanho legível ("2,3 MB", "812 KB") a partir de bytes. */
export function formatTamanho(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
