import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Negocio, Lancamento, NovoNegocioInput, NovoLancamentoInput } from "./types";
import {
  rowToNegocio,
  rowToLancamento,
  type NegocioRow,
  type LancamentoRow,
  type NegocioInsertRow,
  type LancamentoInsertRow,
} from "./mappers";

/**
 * Entrada manual de financeiro (E4) — escreve nas silver `negocios`/`lancamentos`.
 *
 * Toda escrita nasce `origem_dado: 'manual'` e `bronze_ref: null` (não veio de
 * bronze). Server-only, via `supabaseAdmin`, igual ao módulo de contatos.
 */

export async function createNegocio(
  contactId: string,
  input: NovoNegocioInput,
): Promise<Negocio> {
  const row: NegocioInsertRow = {
    contact_id: contactId,
    venda: input.venda,
    custo: input.custo,
    lucro: input.lucro,
    percentual_lucro: input.percentualLucro,
    data: input.data,
    situacao: input.situacao,
    observacao: input.observacao,
    origem_dado: "manual",
    bronze_ref: null,
  };

  const { data, error } = await supabaseAdmin()
    .from("negocios")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao registrar negócio: ${error.message}`);
  }

  return rowToNegocio(data as NegocioRow);
}

export async function createLancamento(
  contactId: string,
  input: NovoLancamentoInput,
): Promise<Lancamento> {
  const row: LancamentoInsertRow = {
    contact_id: contactId,
    tipo: input.tipo,
    categoria: input.categoria,
    valor: input.valor,
    data: input.data,
    descricao: input.descricao,
    origem_dado: "manual",
    bronze_ref: null,
  };

  const { data, error } = await supabaseAdmin()
    .from("lancamentos")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao registrar lançamento: ${error.message}`);
  }

  return rowToLancamento(data as LancamentoRow);
}
