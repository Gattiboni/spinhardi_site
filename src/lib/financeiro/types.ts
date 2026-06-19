/**
 * Financeiro silver — entrada manual (E4 / D064).
 *
 * Dois grãos, duas tabelas:
 *  - `negocios`    → venda fechada (grão venda).
 *  - `lancamentos` → receita/despesa (grão lançamento).
 *
 * Estes são EXATAMENTE os campos que o gold gerencial soma. Os rótulos do
 * formulário são livres, mas gravam nestas colunas. `origem_dado` nasce
 * `'manual'` aqui — distingue do que vem do Iddas (bronze).
 */

export type OrigemDado = "manual" | "iddas" | "clickmassa" | (string & {});

export type LancamentoTipo = "receita" | "despesa";

export type Negocio = {
  id: string;
  contactId: string | null;
  venda: number | null;
  custo: number | null;
  lucro: number | null;
  percentualLucro: number | null;
  data: string | null; // YYYY-MM-DD
  situacao: string | null;
  observacao: string | null;
  origemDado: OrigemDado;
  bronzeRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Lancamento = {
  id: string;
  contactId: string | null;
  tipo: LancamentoTipo;
  categoria: string | null;
  valor: number; // obrigatório
  data: string | null; // YYYY-MM-DD
  descricao: string | null;
  origemDado: OrigemDado;
  bronzeRef: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Payload do form de negócio (campos coletados na UI). */
export type NovoNegocioInput = {
  venda: number | null;
  custo: number | null;
  lucro: number | null;
  percentualLucro: number | null;
  data: string | null;
  situacao: string | null;
  observacao: string | null;
};

/** Payload do form de lançamento (campos coletados na UI). */
export type NovoLancamentoInput = {
  tipo: LancamentoTipo;
  categoria: string | null;
  valor: number;
  data: string | null;
  descricao: string | null;
};
