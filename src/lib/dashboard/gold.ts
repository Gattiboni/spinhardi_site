import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  FinanceiroResumo,
  FunilEstagio,
  ContactsSnapshot,
  DistribItem,
  RecencyBucket,
} from "./types";

/**
 * Gold gerencial — leitura agregada pro dashboard.
 *
 * As somas/contagens financeiras e o funil vêm de funções SQL (RPC), que agregam
 * no Postgres (ver `sql/gold_dashboard.sql`). O front nunca puxa linha pra somar.
 * Enquanto as funções não forem aplicadas no banco, cada leitura degrada pra zero
 * (try/catch) — o dashboard não quebra, fica vazio. Mesmo padrão resiliente do
 * `clickmassa.getStats`.
 *
 * O snapshot CM já vem pré-agregado (1 linha): leitura direta, sem agregação.
 * Gold PODE ler bronze aqui (server-only); o componente de apresentação não.
 */

// ── Financeiro (RPC: gold_iddas_financeiro_resumo) ───────────────────────────

export async function getFinanceiroResumo(
  inicio: string | null,
  fim: string | null,
): Promise<FinanceiroResumo> {
  try {
    const { data, error } = await supabaseAdmin().rpc("gold_iddas_financeiro_resumo", {
      p_inicio: inicio,
      p_fim: fim,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const faturamento = Number(row?.faturamento ?? 0);
    const vendas = Number(row?.vendas ?? 0);
    return {
      faturamento,
      vendas,
      ticketMedio: vendas > 0 ? faturamento / vendas : 0,
    };
  } catch (err) {
    console.error("[gold] getFinanceiroResumo:", err);
    return { faturamento: 0, vendas: 0, ticketMedio: 0 };
  }
}

// ── Funil por estágio (RPC: gold_funil_por_estagio) ──────────────────────────

export async function getFunilPorEstagio(): Promise<FunilEstagio[]> {
  try {
    const { data, error } = await supabaseAdmin().rpc("gold_funil_por_estagio");
    if (error) throw error;

    return (data as { estagio: string; total: number }[]).map((r) => ({
      estagio: r.estagio,
      total: Number(r.total),
    }));
  } catch (err) {
    console.error("[gold] getFunilPorEstagio:", err);
    return [];
  }
}

// ── Snapshot CM (1 linha, já pré-agregada) ───────────────────────────────────

function parseDistrib(
  raw: unknown,
  labelKey: string,
): DistribItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const r = item as Record<string, unknown>;
      const label = r[labelKey];
      const count = Number(r.count ?? 0);
      if (typeof label !== "string" || !Number.isFinite(count)) return null;
      return { label, count };
    })
    .filter((x): x is DistribItem => x !== null);
}

export async function getContactsSnapshot(): Promise<ContactsSnapshot | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("bronze_clickmassa_contacts_dashboard")
      .select(
        "total, weekly_new, recency_d30, recency_d90, recency_d180, recency_d360, recency_d360plus, raw_payload, snapshot_at",
      )
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const payload = (data.raw_payload ?? {}) as Record<string, unknown>;

    const recency: RecencyBucket[] = [
      { bucket: "≤30d", total: Number(data.recency_d30 ?? 0) },
      { bucket: "31–90d", total: Number(data.recency_d90 ?? 0) },
      { bucket: "91–180d", total: Number(data.recency_d180 ?? 0) },
      { bucket: "181–360d", total: Number(data.recency_d360 ?? 0) },
      { bucket: "+360d", total: Number(data.recency_d360plus ?? 0) },
    ];

    return {
      total: Number(data.total ?? 0),
      weeklyNew: Number(data.weekly_new ?? 0),
      recency,
      tags: parseDistrib(payload.tags, "tag"),
      states: parseDistrib(payload.states, "name"),
      snapshotAt: (data.snapshot_at as string | null) ?? null,
    };
  } catch (err) {
    console.error("[gold] getContactsSnapshot:", err);
    return null;
  }
}
