/**
 * Constantes e helper do WhatsApp da Spinhardi.
 *
 * Fonte única de verdade para o número e a mensagem padrão usados pelo
 * componente CTAWhatsApp (e por qualquer outro ponto que precise abrir conversa).
 */

/** Número no formato wa.me: sem "+", sem espaços, sem traços. */
export const WHATSAPP_NUMBER = "5519997761226";

/** Mensagem padrão pré-preenchida na conversa (placeholder validado posteriormente). */
export const WHATSAPP_DEFAULT_MESSAGE =
  "Oi! Cheguei pelo site da Spinhardi e quero conversar sobre uma viagem.";

/**
 * Monta a URL wa.me com a mensagem já codificada para querystring.
 * @param message Texto pré-preenchido. Default: WHATSAPP_DEFAULT_MESSAGE.
 */
export function buildWhatsAppURL(message: string = WHATSAPP_DEFAULT_MESSAGE): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
}
