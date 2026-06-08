/**
 * Integração com a API do Iddas.
 *
 * STUB na Fase 1 (Lote B): retorna mocks plausíveis.
 * Implementação real no Lote C: POST real pra apiagencia.iddas.com.br
 *
 * Endpoints relevantes do Iddas:
 * - POST público pra link de solicitação de cotação
 * - GET /pessoa, GET /orcamento, GET /venda
 * - POST /pessoa pra criar cliente manualmente
 *
 * Ver docs/Iddas_Agência_-_Documentação_API.pdf
 */

import type { Contact } from "@/lib/contacts/types";

export const iddas = {
  async createSolicitacao(
    _contact: Pick<
      Contact,
      | "name"
      | "whatsapp"
      | "email"
      | "destinoTexto"
      | "destinoTipo"
      | "dataIda"
      | "dataVolta"
      | "passageirosAdultos"
      | "passageirosCriancas"
      | "passageirosBebes"
    >,
  ): Promise<{ sucesso: "S" | "N"; cotacao: string; msg: string }> {
    // STUB — mock plausível
    return {
      sucesso: "S",
      cotacao: `mock-${Date.now().toString(36)}`,
      msg: "Solicitação realizada com sucesso (mock)",
    };
  },

  async getStats(): Promise<{
    orcamentosMes: number;
    vendasMes: number;
    ticketMedio: number;
  }> {
    // STUB — números plausíveis seedados por dia
    const seed = new Date().getDate();
    return {
      orcamentosMes: 12 + (seed % 5),
      vendasMes: 4 + (seed % 3),
      ticketMedio: 18500 + ((seed * 137) % 5000),
    };
  },
};
