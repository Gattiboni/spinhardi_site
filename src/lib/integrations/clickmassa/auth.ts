import "server-only";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

function getApiKey(): string {
  const key = process.env.CLICKMASSA_API_KEY;
  if (!key) throw new Error("CLICKMASSA_API_KEY nao definida");
  return key;
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const raw = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getClickMassaAuthHeader(): { Authorization: string } {
  const key = getApiKey();
  const payload = jwtPayload(key);
  if (payload && typeof payload.exp === "number") {
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = payload.exp - nowSec;
    if (remainingSec < THIRTY_DAYS_SEC) {
      const days = Math.floor(remainingSec / 86400);
      console.warn(
        `[ClickMassa] JWT expira em ${days} dia(s) -- renovar antes do vencimento.`,
      );
    }
  }
  return { Authorization: `Bearer ${key}` };
}
