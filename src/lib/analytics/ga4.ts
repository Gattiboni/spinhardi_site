import type { AnalyticsProvider } from "./provider";

/**
 * Implementação real via GA4 Data API.
 *
 * TODO (Fase 4):
 * - Instalar @google-analytics/data
 * - Configurar credenciais (GA4_PROPERTY_ID, service account)
 * - Implementar cada método consultando Data API
 */
export const ga4Analytics: AnalyticsProvider = {
  async getVisits() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
  async getWhatsAppClicks() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
  async getFormSubmissions() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
  async getActiveConversations() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
  async getReservations() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
  async getPostsPublished() {
    throw new Error("GA4 ainda não implementado. Ver Fase 4.");
  },
};
