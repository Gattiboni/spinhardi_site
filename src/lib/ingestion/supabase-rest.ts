/**
 * Acesso ao Supabase via REST cru (PostgREST), lift verbatim dos scripts de
 * backfill. Mantido como REST (e NÃO `@supabase/supabase-js`) de propósito:
 * garante headers `Prefer` e semântica de upsert idênticos ao comportamento de
 * hoje, e mantém a lib livre de `server-only`. Parametrizado por url+key.
 */

export interface SupabaseRest {
  sbFetch(
    path: string,
    opts?: {
      method?: string;
      body?: unknown;
      queryParams?: Record<string, string>;
      prefer?: string;
    },
  ): Promise<{ status: number; body: unknown }>;
  sbUpsert(
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
  ): Promise<{ inserted: number; error?: string }>;
  sbInsert(
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<{ inserted: number; error?: string }>;
}

export function createSupabaseRest(sbUrl: string, sbKey: string): SupabaseRest {
  const SB_HEADERS = {
    apikey: sbKey,
    Authorization: `Bearer ${sbKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  async function sbFetch(
    path: string,
    opts: {
      method?: string;
      body?: unknown;
      queryParams?: Record<string, string>;
      prefer?: string;
    } = {},
  ): Promise<{ status: number; body: unknown }> {
    let url = `${sbUrl}/rest/v1${path}`;
    if (opts.queryParams) {
      const qs = new URLSearchParams(opts.queryParams).toString();
      if (qs) url += `?${qs}`;
    }
    const headers: Record<string, string> = { ...SB_HEADERS };
    if (opts.prefer) headers.Prefer = opts.prefer;
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let resBody: unknown;
    try {
      resBody = await res.json();
    } catch {
      resBody = null;
    }
    return { status: res.status, body: resBody };
  }

  async function sbUpsert(
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
  ): Promise<{ inserted: number; error?: string }> {
    if (rows.length === 0) return { inserted: 0 };
    const { status, body } = await sbFetch(`/${table}`, {
      method: "POST",
      body: rows,
      queryParams: { on_conflict: onConflict },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    if (status >= 200 && status < 300) return { inserted: rows.length };
    return { inserted: 0, error: `HTTP ${status}: ${JSON.stringify(body)}` };
  }

  async function sbInsert(
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<{ inserted: number; error?: string }> {
    if (rows.length === 0) return { inserted: 0 };
    const { status, body } = await sbFetch(`/${table}`, {
      method: "POST",
      body: rows,
      prefer: "return=minimal",
    });
    if (status >= 200 && status < 300) return { inserted: rows.length };
    return { inserted: 0, error: `HTTP ${status}: ${JSON.stringify(body)}` };
  }

  return { sbFetch, sbUpsert, sbInsert };
}
