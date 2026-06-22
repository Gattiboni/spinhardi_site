import type { IddasConfig } from "../config";
import type { Logger } from "../types";

// Pacing entre chamadas. A 300ms (~3.3 req/s) a API do Iddas devolvia 429 numa
// varredura completa; 500ms (~2 req/s) evita o 429 sem deixar a sync lenta.
export const PAUSE_MS = 500;
// Backoff exponencial (dobra, teto 2000ms) usado quando NÃO há Retry-After.
export const RETRY_DELAYS = [500, 1000, 2000];
// Teto de espera ao honrar Retry-After — evita um valor absurdo travar a sync.
export const RETRY_AFTER_CAP_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lê o header `Retry-After` (RFC 7231): ou delta em segundos ("120"), ou um
 * HTTP-date. Retorna a espera em ms, ou null se ausente/ininteligível.
 */
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

export interface IddasTransport {
  /** Garante token válido (login dinâmico + cache + renovação por exp do JWT). */
  getValidToken(): Promise<string>;
  iddasFetch(url: string): Promise<unknown>;
  fetchAllPages(resourcePath: string): Promise<{ items: unknown[]; total: number; pages: number }>;
  /** base da API (sem barra final), pra montar URLs de recurso. */
  readonly apiUrl: string;
}

interface IddasList {
  success: boolean;
  data: unknown[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    next: string | null;
    previous: string | null;
  };
}

/**
 * Transporte Iddas, lift verbatim de scripts/backfill-iddas.ts.
 *
 * Token NÃO é estático: `IDDAS_API_KEY` é a *chave de login*; o bearer é o
 * access_token obtido em /auth/login, cacheado e renovado quando falta < 5min
 * pro exp do JWT. `tokenCache` é por-instância (era módulo-global no script).
 */
export function createIddasTransport(cfg: IddasConfig, logger: Logger): IddasTransport {
  let tokenCache: TokenCache | null = null;

  async function getValidToken(): Promise<string> {
    const now = Date.now();
    const BUFFER_MS = 5 * 60 * 1000; // renova se faltar menos de 5 min

    if (tokenCache && tokenCache.expiresAt - now > BUFFER_MS) {
      return tokenCache.token;
    }

    logger.verbose("Obtendo novo token Iddas...");
    const res = await fetch(`${cfg.apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: cfg.apiKey }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Login Iddas falhou: HTTP ${res.status} — ${errBody}`);
    }

    const data = (await res.json()) as {
      success: boolean;
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    if (!data.success || !data.access_token) {
      throw new Error(`Login Iddas: resposta inesperada: ${JSON.stringify(data)}`);
    }

    let expiresAt: number;
    try {
      const parts = data.access_token.split(".");
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as {
        exp?: number;
      };
      expiresAt = payload.exp ? payload.exp * 1000 : now + data.expires_in * 1000;
    } catch {
      expiresAt = now + data.expires_in * 1000;
    }

    tokenCache = { token: data.access_token, expiresAt };
    const keyPreview = cfg.apiKey.slice(0, 4) + "...";
    logger.log(`Token obtido (key: ${keyPreview}), expira ${new Date(expiresAt).toISOString()}`);

    return tokenCache.token;
  }

  async function iddasFetch(url: string): Promise<unknown> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      await sleep(PAUSE_MS);
      const token = await getValidToken(); // verifica expiração antes de cada chamada
      logger.verbose(`GET ${url} (attempt ${attempt + 1})`);
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) {
          let errBody: unknown;
          try {
            errBody = await res.json();
          } catch {
            errBody = await res.text();
          }
          if (attempt < RETRY_DELAYS.length && (res.status === 429 || res.status >= 500)) {
            // 429: honra Retry-After (capado) quando presente; senão, backoff
            // exponencial. 5xx sempre via backoff. Loga cada retry de forma visível.
            const retryAfterMs =
              res.status === 429 ? parseRetryAfterMs(res.headers.get("retry-after")) : null;
            const waitMs =
              retryAfterMs !== null
                ? Math.min(retryAfterMs, RETRY_AFTER_CAP_MS)
                : RETRY_DELAYS[attempt];
            const reason =
              retryAfterMs !== null
                ? `Retry-After ${Math.round(waitMs / 1000)}s`
                : `backoff ${waitMs}ms`;
            logger.log(
              `HTTP ${res.status} em ${url} — retry ${attempt + 1}/${RETRY_DELAYS.length} (${reason})`,
            );
            await sleep(waitMs);
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
        }
        return await res.json();
      } catch (err) {
        if (attempt < RETRY_DELAYS.length) {
          logger.verbose(`  Erro de rede: ${String(err)}, retry em ${RETRY_DELAYS[attempt]}ms`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Todas as tentativas falharam: ${url}`);
  }

  async function fetchAllPages(
    resourcePath: string,
  ): Promise<{ items: unknown[]; total: number; pages: number }> {
    const items: unknown[] = [];
    let page = 1;
    let reportedTotal = 0;
    let pageCount = 0;

    while (true) {
      // Não usa meta.next (Quirk 1: URL interna index.php quebrada)
      const url = `${cfg.apiUrl}/api/v1/${resourcePath}?page=${page}`;
      const body = (await iddasFetch(url)) as IddasList;
      const pageItems: unknown[] = Array.isArray(body?.data) ? body.data : [];
      pageCount++;

      if (page === 1) {
        reportedTotal = Number(body?.meta?.total ?? 0);
        logger.verbose(`  Total declarado: ${reportedTotal}`);
        // Quirk 2: recursos vazios retornam total=0 mas next não-null
        if (reportedTotal === 0) {
          logger.verbose(`  Recurso vazio (total=0) — parando`);
          break;
        }
      }

      if (pageItems.length === 0) break;
      items.push(...pageItems);
      logger.verbose(
        `  Página ${page}: +${pageItems.length} (acumulado: ${items.length}/${reportedTotal})`,
      );

      if (items.length >= reportedTotal) break;
      page++;
    }

    return { items, total: reportedTotal, pages: pageCount };
  }

  return { getValidToken, iddasFetch, fetchAllPages, apiUrl: cfg.apiUrl };
}
