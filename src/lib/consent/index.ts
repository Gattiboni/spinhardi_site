/**
 * Consentimento de cookies de medição — fonte ÚNICA da escolha do visitante.
 *
 * Sem React, sem DOM além de `localStorage`, testável em Node (ver
 * `scripts/beta-consent.ts`). Quem precisa de estado reativo usa o
 * `ConsentProvider` (`@/components/consent`), que é só uma casca sobre isto.
 *
 * Contrato:
 *  • Chave `spinhardi:consent:v1`. A VERSÃO vive na chave: mudança relevante na
 *    política de privacidade = bump de `CONSENT_VERSION` = a chave antiga vira
 *    lixo ignorado e todo mundo é perguntado de novo. Nada de migrar registro.
 *  • Valor JSON `{ analytics: "granted" | "denied", at: <ISO> }`. Nada além
 *    disso: sem fingerprint, sem ID, sem contagem. Só a escolha e quando.
 *  • Validade 12 meses (`CONSENT_MAX_AGE_MS`): registro mais velho é tratado
 *    como ausente (o visitante decide de novo), sem apagar nada por conta.
 *  • Ambiente sem `window`/`localStorage` (SSR, teste, storage bloqueado pelo
 *    navegador): toda chamada retorna `null` / não faz nada. NUNCA lança —
 *    consentimento indisponível não pode derrubar página.
 */

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = `spinhardi:consent:v${CONSENT_VERSION}`;
/** 12 meses, em ms (365 dias — validade da escolha, não do cookie do GA). */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type AnalyticsConsent = "granted" | "denied";

export type ConsentState = {
  analytics: AnalyticsConsent;
  /** ISO 8601 de quando a escolha foi feita. */
  at: string;
};

/**
 * `localStorage` do ambiente, ou `null` se não existir ou se o acesso lançar
 * (Safari em modo privado antigo, storage desligado por política, iframe
 * sandbox). Lido a cada chamada de propósito: o `scripts/beta-consent.ts`
 * troca o `window` global entre as provas.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isAnalyticsConsent(value: unknown): value is AnalyticsConsent {
  return value === "granted" || value === "denied";
}

/**
 * Valida o que veio do storage. Qualquer coisa fora do contrato (JSON quebrado,
 * campo faltando, data inválida) é tratada como ausente — nunca como "granted".
 */
function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { analytics, at } = parsed as Record<string, unknown>;
    if (!isAnalyticsConsent(analytics) || typeof at !== "string") return null;
    const atMs = Date.parse(at);
    if (Number.isNaN(atMs)) return null;
    return { analytics, at };
  } catch {
    return null;
  }
}

function isExpired(state: ConsentState, now: number): boolean {
  return now - Date.parse(state.at) > CONSENT_MAX_AGE_MS;
}

/**
 * Escolha vigente, ou `null` se o visitante nunca respondeu (nesta versão da
 * chave), se o registro expirou ou se o storage está indisponível.
 */
export function readConsent(now: number = Date.now()): ConsentState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const state = parseConsent(storage.getItem(CONSENT_STORAGE_KEY));
    if (!state || isExpired(state, now)) return null;
    return state;
  } catch {
    return null;
  }
}

/**
 * Grava a escolha com o carimbo de agora. Retorna o estado gravado, ou `null`
 * se o storage estiver indisponível (a escolha vale só pra esta página, então).
 */
export function writeConsent(
  analytics: AnalyticsConsent,
  now: number = Date.now(),
): ConsentState | null {
  const storage = getStorage();
  if (!storage) return null;
  const state: ConsentState = { analytics, at: new Date(now).toISOString() };
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return null;
  }
}

/** Apaga a escolha (revogação da seção 8 da política). Nunca lança. */
export function clearConsent(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // storage bloqueado: nada a apagar, nada a fazer.
  }
}
