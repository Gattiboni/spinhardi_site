/**
 * Resolução de configuração a partir do ambiente.
 *
 * Mesma precedência de Supabase dos scripts de backfill
 * (`SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL`). O *file-read* de `.env.local`
 * continua sendo concern do CLI; aqui só se lê de `process.env` (ou de um `env`
 * injetado), pra que uma rota Next leia direto do ambiente da Vercel.
 */

export interface SupabaseRestConfig {
  url: string;
  key: string;
}

export interface ClickMassaConfig {
  externalUrl: string;
  apiKey: string;
  /** origin interno derivado da URL externa */
  internalBase: string;
  /** origin do painel (host interno com -352n. no lugar de -352napi.) */
  internalOrigin: string;
  /** Quirk: endpoint de users usa path invertido /users/{apiId} */
  usersExternalUrl: string;
  supabase: SupabaseRestConfig;
}

export interface IddasConfig {
  apiUrl: string;
  apiKey: string;
  supabase: SupabaseRestConfig;
}

/** Erro de configuração com a MESMA mensagem que os scripts imprimiam. */
export class IngestionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionConfigError";
  }
}

type Env = Record<string, string | undefined>;

function resolveSupabase(env: Env): SupabaseRestConfig {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key };
}

export function resolveClickMassaConfig(env: Env = process.env): ClickMassaConfig {
  const externalUrl = (env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
  const apiKey = env.CLICKMASSA_API_KEY ?? "";
  const supabase = resolveSupabase(env);

  if (!externalUrl || !apiKey) {
    throw new IngestionConfigError(
      "ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidas.",
    );
  }
  if (!supabase.url || !supabase.key) {
    throw new IngestionConfigError(
      "ERRO: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidas.",
    );
  }

  // Derivar host interno a partir da URL externa.
  // externalUrl = "https://enterprise-352napi.clickmassa.com.br/v1/api/external/<apiId>"
  const internalBase = (() => {
    try {
      return new URL(externalUrl).origin;
    } catch {
      const m = externalUrl.match(/^(https?:\/\/[^/]+)/);
      return m ? m[1] : "";
    }
  })();

  // Quirk 1: users endpoint usa path invertido na API externa.
  const lastSlash = externalUrl.lastIndexOf("/");
  const apiId = externalUrl.slice(lastSlash + 1);
  const urlWithoutApiId = externalUrl.slice(0, lastSlash);
  const usersExternalUrl = `${urlWithoutApiId}/users/${apiId}`;

  // painel origin: -352napi. -> -352n.
  const internalOrigin = internalBase.replace(/-352napi\./, "-352n.");

  return { externalUrl, apiKey, internalBase, internalOrigin, usersExternalUrl, supabase };
}

export function resolveIddasConfig(env: Env = process.env): IddasConfig {
  const apiUrl = (env.IDDAS_API_URL ?? "").replace(/\/$/, "");
  const apiKey = env.IDDAS_API_KEY ?? "";
  const supabase = resolveSupabase(env);

  if (!apiUrl || !apiKey) {
    throw new IngestionConfigError("ERRO: IDDAS_API_URL ou IDDAS_API_KEY nao definidas.");
  }
  if (!supabase.url || !supabase.key) {
    throw new IngestionConfigError(
      "ERRO: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidas.",
    );
  }

  return { apiUrl, apiKey, supabase };
}
