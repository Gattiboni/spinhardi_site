import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { ingerirWebhook } from "@/lib/campanhas/eventos";

/**
 * Webhook de eventos do Resend → back-office.
 *
 * Mesmo padrão da borda de `/api/revalidate` (V3): runtime nodejs, corpo BRUTO,
 * verificação de assinatura ANTES de qualquer parse, 401 em assinatura
 * inválida, 500 em env ausente, e toda a lógica fora da rota (vive em
 * `lib/campanhas/eventos.ts`).
 *
 * A verificação usa o helper do próprio SDK (`resend.webhooks.verify`), que lê
 * os headers `svix-id`, `svix-timestamp` e `svix-signature` e confere contra
 * `RESEND_WEBHOOK_SECRET`.
 *
 * --- Como configurar no painel do Resend (manual, do Alan) -----------------
 * Resend → Webhooks → "Add Webhook":
 *   • Endpoint: https://www.spinharditurismo.com.br/api/webhooks/resend
 *   • Eventos a marcar:
 *       email.sent            email.delivered      email.delivery_delayed
 *       email.bounced         email.complained     email.opened
 *       email.clicked         email.failed         email.scheduled
 *       email.suppressed      contact.updated
 *     (`contact.updated` é o que carrega o descadastro — sem ele a supressão
 *      automática de unsubscribe não acontece.)
 *   • Copiar o "Signing Secret" e pôr em RESEND_WEBHOOK_SECRET (env da Vercel).
 * --------------------------------------------------------------------------
 *
 * Sempre 200 quando a assinatura é válida, inclusive em evento desconhecido:
 * devolver erro faria o Resend reentregar pra sempre um payload que a gente já
 * gravou de propósito.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook/resend] RESEND_WEBHOOK_SECRET ausente");
      return Response.json({ error: "missing RESEND_WEBHOOK_SECRET" }, { status: 500 });
    }

    // Corpo bruto: precisa ser a string exata que o Resend assinou.
    const body = await request.text();
    if (!body) return Response.json({ error: "malformed body" }, { status: 400 });

    // O helper do SDK pede os três headers do Svix já extraídos (`{id,
    // timestamp, signature}`), não o objeto Headers do request. Faltando
    // qualquer um deles a requisição nem chega a ser verificada: é 401 direto.
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }

    let evento: unknown;
    try {
      evento = new Resend(process.env.RESEND_API_KEY ?? "sem-chave").webhooks.verify({
        payload: body,
        headers: { id, timestamp, signature },
        webhookSecret: secret,
      });
    } catch (err) {
      console.error("[webhook/resend] assinatura inválida:", err);
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }

    const resultado = await ingerirWebhook(evento);

    return Response.json({
      ok: true,
      tipo: resultado.tipo,
      gravado: resultado.gravado,
      duplicado: resultado.duplicado,
    });
  } catch (err) {
    console.error("[webhook/resend] erro:", err);
    const message = err instanceof Error ? err.message : "unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
