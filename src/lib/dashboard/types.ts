/**
 * Tipos PUROS do gold gerencial — sem IO, seguros pro client (os componentes de
 * gráfico recharts recebem estes shapes). A leitura (server-only) fica em
 * `gold.ts`.
 */

export type PeriodoKey = "mes" | "ano" | "tudo";

export type FinanceiroResumo = {
  faturamento: number;
  vendas: number;
  ticketMedio: number;
};

/** Resumo financeiro pré-calculado pros 3 períodos do toggle. */
export type FinanceiroPorPeriodo = Record<PeriodoKey, FinanceiroResumo>;

export type FunilEstagio = {
  estagio: string;
  total: number;
};

export type DistribItem = {
  label: string;
  count: number;
};

export type RecencyBucket = {
  bucket: string;
  total: number;
};

/** Distribuições pré-agregadas do snapshot CM (1 linha, raw_payload + colunas). */
export type ContactsSnapshot = {
  total: number;
  weeklyNew: number;
  recency: RecencyBucket[];
  tags: DistribItem[];
  states: DistribItem[];
  snapshotAt: string | null;
};
