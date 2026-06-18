import "server-only";
import { getClickMassaAuthHeader } from "./auth";

export class ClickMassaError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ClickMassaError";
  }
}

const RETRY_STATUSES = new Set([500, 502, 503, 504]);
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 10_000;

function getBaseUrl(): string {
  const url = process.env.CLICKMASSA_API_URL;
  if (!url) {
    throw new ClickMassaError(0, "CONFIG_ERROR", "CLICKMASSA_API_URL nao definida");
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function fetchOnce<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const msg =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : `HTTP ${response.status}`;
    throw new ClickMassaError(response.status, `HTTP_${response.status}`, msg, payload);
  }
  return response.json() as Promise<T>;
}

// path pode ser relativo ao CLICKMASSA_API_URL (ex: "/pipeline-steps")
// ou uma URL absoluta (ex: para o endpoint de users que tem estrutura diferente)
export async function clickMassaFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getClickMassaAuthHeader(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const reqInit: RequestInit = { ...init, headers };
  try {
    return await fetchOnce<T>(url, reqInit);
  } catch (err) {
    const isRetriable =
      (err instanceof ClickMassaError && RETRY_STATUSES.has(err.status)) ||
      (err instanceof Error && err.name === "AbortError");
    if (!isRetriable) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchOnce<T>(url, reqInit);
  }
}

export { getBaseUrl };
