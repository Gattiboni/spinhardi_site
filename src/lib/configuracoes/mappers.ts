import type { CaptureOrigin, Tag } from "./types";

/**
 * Mapeamento EXPLÍCITO por campo entre o banco e o TS (padrão D029 do Lote C).
 *
 * Aqui o domínio mantém os mesmos nomes das colunas (naming misto), então a
 * conversão é uma cópia campo a campo. Mesmo assim o mapper explícito vale a
 * pena: o compilador cobra que nenhum campo ficou de fora e fixa o `select`
 * esperado num único lugar.
 */

// ─────────────────────────────────────────────────────────────────
// capture_origins
// ─────────────────────────────────────────────────────────────────

export type CaptureOriginRow = {
  id: string;
  name: string;
  slug: string;
  descricao: string | null;
  is_active: boolean;
  campanha_ativa: boolean;
  created_at: string;
  updated_at: string;
};

// Insert: o banco gera id (default) e created_at/updated_at (default + trigger).
export type CaptureOriginInsertRow = Omit<CaptureOriginRow, "id" | "created_at" | "updated_at">;
export type CaptureOriginUpdateRow = Partial<CaptureOriginInsertRow>;

export function rowToCaptureOrigin(row: CaptureOriginRow): CaptureOrigin {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    descricao: row.descricao,
    is_active: row.is_active,
    campanha_ativa: row.campanha_ativa,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────
// tags (sem timestamps — D028, decisão (a))
// ─────────────────────────────────────────────────────────────────

export type TagRow = {
  id: string;
  name: string;
  slug: string;
  cor: string;
  grupo: string | null;
  is_active: boolean;
};

// Insert: o banco gera id (default).
export type TagInsertRow = Omit<TagRow, "id">;
export type TagUpdateRow = Partial<TagInsertRow>;

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    cor: row.cor,
    grupo: row.grupo,
    is_active: row.is_active,
  };
}
