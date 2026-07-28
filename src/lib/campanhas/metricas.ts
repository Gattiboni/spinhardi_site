import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CAMPANHA_METRICAS_ZERO, type CampanhaMetricas } from "./types";

/**
 * Métricas 100% DERIVADAS (V6): agregação de `campanha_eventos` sobre
 * `campanha_destinatarios`. Nenhum contador incremental em coluna, em lugar
 * nenhum — nem em `contacts`, nem em `campanhas`.
 *
 * Abertos e cliques contam PESSOAS ÚNICAS, não eventos: o Resend manda um
 * `email.opened` por abertura, e "37 aberturas" de 4 pessoas seria mentira
 * gerencial. Bounces e falhas contam eventos, que é o que interessa lá.
 *
 * Denominador junto do número é decisão de tela (entregues/enviados,
 * abertos/entregues), mas os dois lados saem daqui.
 */

/**
 * Uma leitura por campanha, agregada em memória. Volume: uma campanha da
 * Spinhardi tem ~205 destinatários e uns poucos milhares de eventos no teto —
 * cabe folgado, e evita RPC nova (restrição dura 1).
 */
export async function getMetricas(campanhaId: string): Promise<CampanhaMetricas> {
  const sb = supabaseAdmin();

  const [{ count: destinatarios, error: eD }, { data: eventos, error: eE }] = await Promise.all([
    sb
      .from("campanha_destinatarios")
      .select("*", { count: "exact", head: true })
      .eq("campanha_id", campanhaId),
    sb
      .from("campanha_eventos")
      .select("tipo, resend_email_id, contact_id, raw_payload")
      .eq("campanha_id", campanhaId)
      .limit(20000),
  ]);

  if (eD) throw new Error(`Erro ao contar destinatários: ${eD.message}`);
  if (eE) throw new Error(`Erro ao ler eventos: ${eE.message}`);

  const linhas = (
    (eventos ?? []) as {
      tipo: string;
      resend_email_id: string | null;
      contact_id: string | null;
      raw_payload: Record<string, unknown>;
    }[]
  ).filter((l) => l.tipo.startsWith("email.")); // auditoria.* fica de fora

  // Chave de "pessoa" pro conjunto único: o e-mail do payload é o mais estável
  // (existe em todo evento de e-mail e não depende da correlação com contato).
  const chave = (l: (typeof linhas)[number]): string => {
    const data = l.raw_payload?.data as { to?: unknown } | undefined;
    const to = data?.to;
    if (Array.isArray(to) && typeof to[0] === "string") return to[0].toLowerCase();
    return l.resend_email_id ?? l.contact_id ?? "?";
  };

  const unicos = (tipo: string) => new Set(linhas.filter((l) => l.tipo === tipo).map(chave)).size;
  const conta = (tipo: string) => linhas.filter((l) => l.tipo === tipo).length;

  const bounces = linhas.filter((l) => l.tipo === "email.bounced");
  const ehHard = (l: (typeof linhas)[number]) => {
    const data = l.raw_payload?.data as { bounce?: { type?: string } } | undefined;
    const t = (data?.bounce?.type ?? "").toLowerCase();
    return t.includes("permanent") || t.includes("hard");
  };

  return {
    ...CAMPANHA_METRICAS_ZERO,
    destinatarios: destinatarios ?? 0,
    enviados: unicos("email.sent"),
    entregues: unicos("email.delivered"),
    abertos: unicos("email.opened"),
    cliques: unicos("email.clicked"),
    // Descadastro chega como `contact.updated` (unsubscribed) e não fica
    // amarrado à campanha; aqui conta a reclamação, que fica.
    descadastros: unicos("email.suppressed"),
    reclamacoes: unicos("email.complained"),
    bouncesHard: bounces.filter(ehHard).length,
    bouncesSoft: bounces.filter((l) => !ehHard(l)).length,
    falhas: conta("email.failed"),
  };
}

/** Métricas de várias campanhas de uma vez — pro resumo da lista. */
export async function getMetricasEmLote(
  campanhaIds: string[],
): Promise<Record<string, CampanhaMetricas>> {
  const saida: Record<string, CampanhaMetricas> = {};
  if (campanhaIds.length === 0) return saida;

  // Sequencial de propósito: são poucas campanhas enviadas e cada uma é duas
  // queries. Paralelizar aqui só aumentaria a chance de estourar conexão.
  for (const id of campanhaIds) {
    try {
      saida[id] = await getMetricas(id);
    } catch (err) {
      console.error(`[campanhas.metricas] campanha ${id}:`, err);
      saida[id] = { ...CAMPANHA_METRICAS_ZERO };
    }
  }
  return saida;
}

// `taxa()` mudou pra `metricas-shared.ts`: a tela de resultados precisa dela e
// não pode importar este módulo (server-only). Re-exportada aqui pra quem já
// consumia daqui não quebrar.
export { taxa } from "./metricas-shared";
