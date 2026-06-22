import type { ClickMassaConfig } from "../config";
import type { Logger } from "../types";

/** Pausa entre chamadas e backoff de retry — idênticos ao backfill. */
export const PAUSE_MS = 300;
export const RETRY_DELAYS = [500, 1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ClickMassaTransport {
  externalGet(urlOrPath: string, params?: Record<string, string>): Promise<unknown>;
  internalGet(path: string, params?: Record<string, string>): Promise<unknown>;
}

/**
 * Transporte HTTP do ClickMassa: API externa (Bearer estático) + API interna
 * (mesma key, mas com headers de browser + Origin/Referer do painel).
 *
 * Token CM é estático de propósito (sem refresh) — preserva o comportamento de
 * hoje. Lift verbatim de scripts/backfill-clickmassa.ts.
 */
export function createClickMassaTransport(
  cfg: ClickMassaConfig,
  logger: Logger,
): ClickMassaTransport {
  const EXTERNAL_HEADERS = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };

  const INTERNAL_HEADERS = {
    Authorization: `Bearer ${cfg.apiKey}`,
    Accept: "application/json, text/plain, */*",
    Origin: cfg.internalOrigin,
    Referer: `${cfg.internalOrigin}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };

  async function externalGet(
    urlOrPath: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    let url = urlOrPath.startsWith("http") ? urlOrPath : `${cfg.externalUrl}${urlOrPath}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      await sleep(PAUSE_MS);
      const t0 = Date.now();
      logger.verbose(`[external] GET ${url} (attempt ${attempt + 1})`);
      try {
        const res = await fetch(url, { headers: EXTERNAL_HEADERS });
        const latency = Date.now() - t0;
        logger.verbose(`  HTTP ${res.status} (${latency}ms)`);
        if (!res.ok) {
          let errBody: unknown;
          try {
            errBody = await res.json();
          } catch {
            errBody = await res.text();
          }
          if (attempt < RETRY_DELAYS.length && res.status >= 500) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
        }
        return await res.json();
      } catch (err) {
        if (attempt < RETRY_DELAYS.length) {
          logger.verbose(`  Erro, aguardando ${RETRY_DELAYS[attempt]}ms...`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Todas as tentativas falharam: ${url}`);
  }

  async function internalGet(path: string, params?: Record<string, string>): Promise<unknown> {
    let url = `${cfg.internalBase}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      await sleep(PAUSE_MS);
      const t0 = Date.now();
      logger.verbose(
        `[internal] GET ${path}${params ? "?" + new URLSearchParams(params) : ""} (attempt ${attempt + 1})`,
      );
      try {
        const res = await fetch(url, { headers: INTERNAL_HEADERS });
        const latency = Date.now() - t0;
        logger.verbose(`  HTTP ${res.status} (${latency}ms)`);
        if (!res.ok) {
          let errBody: unknown;
          try {
            errBody = await res.json();
          } catch {
            errBody = await res.text();
          }
          if (attempt < RETRY_DELAYS.length && res.status >= 500) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
        }
        return await res.json();
      } catch (err) {
        if (attempt < RETRY_DELAYS.length) {
          logger.verbose(`  Erro, aguardando ${RETRY_DELAYS[attempt]}ms...`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Todas as tentativas falharam: ${path}`);
  }

  return { externalGet, internalGet };
}
