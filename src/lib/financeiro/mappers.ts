import type { Negocio, Lancamento, OrigemDado, LancamentoTipo } from "./types";

/**
 * Mapeamento EXPLÍCITO por campo entre o banco (snake_case) e o TS (camelCase),
 * mesma disciplina de `contacts/mappers.ts`: nada de conversor genérico de
 * chaves — o compilador cobra cada campo, e o grão financeiro é o que o gold soma.
 */

export type NegocioRow = {
  id: string;
  contact_id: string | null;
  venda: number | null;
  custo: number | null;
  lucro: number | null;
  percentual_lucro: number | null;
  data: string | null;
  situacao: string | null;
  observacao: string | null;
  origem_dado: OrigemDado;
  bronze_ref: string | null;
  created_at: string;
  updated_at: string;
};

// Insert: id/created_at/updated_at gerados pelo banco.
export type NegocioInsertRow = Omit<NegocioRow, "id" | "created_at" | "updated_at">;

export type LancamentoRow = {
  id: string;
  contact_id: string | null;
  tipo: LancamentoTipo;
  categoria: string | null;
  valor: number;
  data: string | null;
  descricao: string | null;
  origem_dado: OrigemDado;
  bronze_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type LancamentoInsertRow = Omit<LancamentoRow, "id" | "created_at" | "updated_at">;

export function rowToNegocio(row: NegocioRow): Negocio {
  return {
    id: row.id,
    contactId: row.contact_id,
    venda: row.venda,
    custo: row.custo,
    lucro: row.lucro,
    percentualLucro: row.percentual_lucro,
    data: row.data,
    situacao: row.situacao,
    observacao: row.observacao,
    origemDado: row.origem_dado,
    bronzeRef: row.bronze_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToLancamento(row: LancamentoRow): Lancamento {
  return {
    id: row.id,
    contactId: row.contact_id,
    tipo: row.tipo,
    categoria: row.categoria,
    valor: row.valor,
    data: row.data,
    descricao: row.descricao,
    origemDado: row.origem_dado,
    bronzeRef: row.bronze_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
