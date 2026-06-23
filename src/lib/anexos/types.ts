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

export type AnexoOwner = {
  kind: AnexoOwnerKind;
  id: string;
};

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

/** Tamanho legível ("2,3 MB", "812 KB") a partir de bytes. */
export function formatTamanho(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
