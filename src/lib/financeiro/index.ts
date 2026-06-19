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

/**
 * Negócios manuais de um contato — leitura pro resumo comercial (Lote C).
 * Só o grão `negocios` (venda manual); o que vem do Iddas é lido separado do
 * bronze. Ordena por data desc (mais recente primeiro), nulls ao fim.
 */
export async function getNegociosByContact(contactId: string): Promise<Negocio[]> {
  const { data, error } = await supabaseAdmin()
    .from("negocios")
    .select("*")
    .eq("contact_id", contactId)
    .order("data", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Erro ao buscar negócios do contato ${contactId}: ${error.message}`);
  }

  return (data as NegocioRow[]).map(rowToNegocio);
}

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
