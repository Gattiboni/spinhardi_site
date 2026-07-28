import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { EmailMarketingOrigem, EmailMarketingStatus } from "./types";

/**
 * Ingestão de eventos do Resend e supressão automática (V1–V5).
 *
 * Regras que moram aqui e em nenhum outro lugar:
 *  • Append-only. Insert com `ignoreDuplicates` sobre a unique
 *    (resend_email_id, tipo, ocorrido_em). Reentrega produz o mesmo resultado
 *    (V4). Nunca UPDATE, nunca DELETE.
 *  • Evento de tipo desconhecido é GRAVADO com o payload cru e fica fora da
 *    agregação — nunca descartado (V2).
 *  • Supressão automática, no servidor, independente de UI (V5):
 *      bounce HARD   → invalido      · origem bounce
 *      complained    → descadastrado · origem reclamacao
 *      contact.updated com unsubscribed=true → descadastrado · origem descadastro
 *    Soft bounce NÃO suprime: é contado e exibido.
 *
 * Correlação evento→campanha (Z1): o SDK 6.12.4 declara
 * `BaseEmailEventData.broadcast_id?: string`, então quando ele vem no payload a
 * correlação é DIRETA (broadcast_id → campanhas.resend_broadcast_id). Quando
 * não vem, cai no best-effort por e-mail do destinatário + janela de tempo,
 * como o contrato previu. As duas rotas estão implementadas.
 */

/** Tipos que a agregação de métricas conhece. */
const TIPOS_DE_EMAIL = new Set([
  "email.sent",
  "email.scheduled",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
  "email.suppressed",
]);

type PayloadResend = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

function comoTexto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Primeiro destinatário do evento — é por ele que a correlação best-effort vai. */
function emailDoEvento(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const to = data.to;
  if (Array.isArray(to) && typeof to[0] === "string") return to[0].trim().toLowerCase();
  if (typeof to === "string") return to.trim().toLowerCase();
  const email = data.email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

/** Bounce hard vs soft — o SDK entrega `data.bounce.type`. */
function ehBounceHard(data: Record<string, unknown> | undefined): boolean {
  const bounce = data?.bounce as { type?: string; subType?: string } | undefined;
  const tipo = (bounce?.type ?? "").toLowerCase();
  // "Permanent" é o vocabulário do SES por trás do Resend; "hard" cobre o resto.
  return tipo.includes("permanent") || tipo.includes("hard");
}

// ─────────────────────────────────────────────────────────────────
// Correlação
// ─────────────────────────────────────────────────────────────────

/** Janela do best-effort: evento fora de 30 dias do envio não é correlacionado. */
const JANELA_MS = 30 * 24 * 60 * 60 * 1000;

async function correlacionar(
  broadcastId: string | null,
  email: string | null,
  ocorridoEm: string,
): Promise<{ campanhaId: string | null; contactId: string | null }> {
  const sb = supabaseAdmin();

  // Rota direta (Z1 resolvido): broadcast_id no payload.
  if (broadcastId) {
    const { data } = await sb
      .from("campanhas")
      .select("id")
      .eq("resend_broadcast_id", broadcastId)
      .maybeSingle();
    const campanhaId = (data as { id: string } | null)?.id ?? null;
    if (campanhaId) {
      const contactId = email ? await contatoDoDestinatario(campanhaId, email) : null;
      return { campanhaId, contactId };
    }
  }

  // Best-effort: destinatário congelado + janela de tempo.
  if (!email) return { campanhaId: null, contactId: null };

  const limite = new Date(Date.parse(ocorridoEm) - JANELA_MS).toISOString();
  const { data } = await sb
    .from("campanha_destinatarios")
    .select("campanha_id, contact_id, enviado_em")
    .eq("email", email)
    .gte("enviado_em", limite)
    .order("enviado_em", { ascending: false })
    .limit(1);

  const linha = ((data as { campanha_id: string; contact_id: string | null }[]) ?? [])[0];
  return {
    campanhaId: linha?.campanha_id ?? null,
    contactId: linha?.contact_id ?? null,
  };
}

async function contatoDoDestinatario(campanhaId: string, email: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("campanha_destinatarios")
    .select("contact_id")
    .eq("campanha_id", campanhaId)
    .eq("email", email)
    .maybeSingle();
  return (data as { contact_id: string | null } | null)?.contact_id ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Supressão (V5)
// ─────────────────────────────────────────────────────────────────

/**
 * Escreve o novo status de e-mail marketing. Casa por contactId quando existe;
 * senão pelo e-mail (o unsubscribe do Resend chega por contato dele, não pelo
 * nosso). Sempre grava `status_em` e `status_origem` — sem os dois não existe
 * prova (P4).
 *
 * Só toca contato ATIVO. E nunca "melhora" um status: quem já está
 * descadastrado não vira inválido, e vice-versa — as duas transições são
 * terminais por UI (P2).
 */
async function suprimir(
  alvo: { contactId: string | null; email: string | null },
  status: Extract<EmailMarketingStatus, "descadastrado" | "invalido">,
  origem: EmailMarketingOrigem,
): Promise<void> {
  const sb = supabaseAdmin();
  const patch = {
    email_marketing_status: status,
    email_marketing_status_em: new Date().toISOString(),
    email_marketing_status_origem: origem,
  };

  let q = sb
    .from("contacts")
    .update(patch)
    .eq("status", "ativo")
    .not("email_marketing_status", "in", '("descadastrado","invalido")');

  if (alvo.contactId) q = q.eq("id", alvo.contactId);
  else if (alvo.email) q = q.ilike("email", alvo.email);
  else return;

  const { error } = await q;
  if (error) console.error("[campanhas.eventos] supressão falhou:", error);
}

// ─────────────────────────────────────────────────────────────────
// Ingestão
// ─────────────────────────────────────────────────────────────────

export type ResultadoIngestao = {
  gravado: boolean;
  duplicado: boolean;
  tipo: string;
  campanhaId: string | null;
};

/**
 * Grava UM evento do webhook. Idempotente pela unique do banco: reentrega
 * retorna `duplicado: true` e não escreve linha nova nem re-suprime.
 */
export async function ingerirEvento(payload: PayloadResend): Promise<ResultadoIngestao> {
  const tipo = payload.type;
  const data = payload.data ?? {};

  const resendEmailId = comoTexto(data.email_id) ?? comoTexto(data.id);
  const broadcastId = comoTexto(data.broadcast_id);
  const email = emailDoEvento(data);
  const ocorridoEm =
    comoTexto(data.created_at) ?? comoTexto(payload.created_at) ?? new Date().toISOString();

  const { campanhaId, contactId } = await correlacionar(broadcastId, email, ocorridoEm);

  // Append-only + dedup (V4). A unique tem NULLS NOT DISTINCT, então evento sem
  // resend_email_id também deduplica.
  const { data: inserido, error } = await supabaseAdmin()
    .from("campanha_eventos")
    .upsert(
      {
        campanha_id: campanhaId,
        contact_id: contactId,
        resend_email_id: resendEmailId,
        tipo,
        ocorrido_em: ocorridoEm,
        raw_payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "resend_email_id,tipo,ocorrido_em", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`Erro ao gravar evento: ${error.message}`);

  const linhas = (inserido as { id: string }[]) ?? [];
  const duplicado = linhas.length === 0;

  // Supressão só na PRIMEIRA vez que o evento chega.
  if (!duplicado) {
    if (tipo === "email.bounced" && ehBounceHard(data)) {
      await suprimir({ contactId, email }, "invalido", "bounce");
    } else if (tipo === "email.complained") {
      await suprimir({ contactId, email }, "descadastrado", "reclamacao");
    } else if (tipo === "contact.updated" && data.unsubscribed === true) {
      await suprimir({ contactId, email }, "descadastrado", "descadastro");
    }
  }

  return { gravado: !duplicado, duplicado, tipo, campanhaId };
}

/** Um payload do Resend traz um evento; a assinatura é por request. */
export async function ingerirWebhook(payload: unknown): Promise<ResultadoIngestao> {
  const p = payload as PayloadResend;
  if (!p || typeof p.type !== "string") {
    throw new Error("Payload sem `type`.");
  }
  const r = await ingerirEvento(p);
  if (!TIPOS_DE_EMAIL.has(p.type) && !p.type.startsWith("contact.")) {
    console.warn(`[campanhas.eventos] tipo desconhecido gravado e fora da agregação: ${p.type}`);
  }
  return r;
}
