/**
 * `trackEvent` — evento nomeado pro GA4, pelo `gtag` que a tag carregou.
 *
 * Fica ao lado do módulo `@/lib/analytics` (LEITURA de métrica pro painel, via
 * `AnalyticsProvider`) sem tocar nele: este arquivo é o lado da ESCRITA, no
 * navegador do visitante. Os dois não se importam.
 *
 * Regras:
 *  • No-op silencioso quando `window.gtag` não existe. Sem consentimento a tag
 *    nunca carrega (`GoogleAnalytics` só monta o script com `granted`), logo
 *    não há `gtag`, logo nada sai — a regra dura do consentimento vale aqui de
 *    graça, sem checar storage de novo.
 *  • Try/catch em volta de tudo: analytics NUNCA quebra o site.
 *  • Parâmetros só primitivos e nunca dado pessoal. Quem chama é responsável
 *    por não passar nome, telefone, e-mail ou conteúdo de formulário.
 */

type GtagParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    /** Definido pelo snippet inline do `GoogleAnalytics`, só após o Aceitar. */
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: GtagParams): void {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", name, params ?? {});
  } catch {
    // Tag quebrada ou bloqueada por extensão: o site segue como se nada fosse.
  }
}
