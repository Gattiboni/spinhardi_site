/**
 * Integração com a API do ClickMassa.
 *
 * STUB na Fase 1 (Lote B): retorna mocks plausíveis.
 * Implementação real no Lote C.
 *
 * Endpoints relevantes do ClickMassa:
 * - POST /v1/api/external/{apiId} (enviar mensagem / criar nota)
 * - GET tags, opportunities, pipeline-steps
 * - POST /opportunities (criar oportunidade no funil do CM)
 *
 * Ver docs/ClickMassa_API.pdf
 */

import type { Contact } from "@/lib/contacts/types";

export const clickmassa = {
  async createTicket(
    _contact: Pick<Contact, "name" | "whatsapp" | "destinoTipo">,
  ): Promise<{ ticketId: string; message: string }> {
    return {
      ticketId: `mock-tk-${Date.now().toString(36)}`,
      message: "Ticket criado com sucesso (mock)",
    };
  },

  async getStats(): Promise<{
    ticketsAbertos: number;
    oportunidadesAtivas: number;
  }> {
    const seed = new Date().getDate();
    return {
      ticketsAbertos: 8 + (seed % 4),
      oportunidadesAtivas: 5 + (seed % 3),
    };
  },
};
