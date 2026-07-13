import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

/**
 * Webhook de revalidação on-publish: Sanity Studio → Vercel.
 *
 * Quando a Amanda publica/edita um post no Studio, o Sanity dispara um webhook
 * pra cá e nós revalidamos as rotas do blog na hora — sem esperar o ISR de 60s.
 *
 * --- Como configurar no Sanity (painel, manual) ---------------------------
 * Studio → API → Webhooks → "Create webhook":
 *   • Name:    Revalidar blog (Vercel)
 *   • URL:     https://www.spinharditurismo.com.br/api/revalidate
 *   • Trigger: Create, Update, Delete
 *   • Filter (GROQ):  _type == "post"
 *   • Projection:     (vazio — não precisamos do payload, só do gatilho)
 *   • HTTP method:    POST
 *   • Secret:         o mesmo valor de SANITY_REVALIDATE_SECRET (env da Vercel)
 *
 * A Sanity assina o corpo com esse secret e manda a assinatura no header
 * `sanity-webhook-signature`. Validamos via HMAC-SHA256 com comparação
 * time-constant antes de revalidar. Sem assinatura válida → 401.
 * --------------------------------------------------------------------------
 *
 * Runtime Node (não Edge): precisamos do módulo `crypto` nativo.
 */
export const runtime = "nodejs";

const SIGNATURE_HEADER = "sanity-webhook-signature";

/** Comparação de strings em tempo constante (evita timing attacks). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual exige buffers do mesmo tamanho; tamanhos diferentes já
  // bastam pra reprovar (e não vazam mais do que o próprio length da entrada).
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Valida a assinatura do webhook contra o corpo bruto.
 *
 * Suporta os dois formatos que o header pode chegar:
 *  1. Esquema oficial da Sanity — `t=<timestamp>,v1=<sig>`, onde `sig` é
 *     HMAC-SHA256(`${t}.${body}`) em base64url.
 *  2. Fallback — o header é a própria HMAC-SHA256(body) em base64url.
 */
function isValidSignature(body: string, header: string, secret: string): boolean {
  const h = header.trim();

  if (h.includes("v1=")) {
    const fields = new Map<string, string>();
    for (const part of h.split(",")) {
      const eq = part.indexOf("=");
      if (eq > 0) fields.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    const t = fields.get("t");
    const v1 = fields.get("v1");
    if (t && v1) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`${t}.${body}`)
        .digest("base64url");
      return safeEqual(v1, expected);
    }
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return safeEqual(h, expected);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SANITY_REVALIDATE_SECRET;
    if (!secret) {
      return Response.json({ error: "missing SANITY_REVALIDATE_SECRET" }, { status: 500 });
    }

    // Corpo bruto: precisa ser a string exata que a Sanity assinou.
    const body = await request.text();
    if (!body) {
      return Response.json({ error: "malformed body" }, { status: 400 });
    }

    const signature = request.headers.get(SIGNATURE_HEADER);
    if (!signature || !isValidSignature(body, signature, secret)) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }

    // Listagem (literal) + todas as instâncias do dynamic route do post.
    // O `(public)` é route group e faz parte do path de arquivo que o
    // revalidatePath('page') casa — sem ele as páginas de post não invalidam.
    revalidatePath("/blog");
    revalidatePath("/(public)/blog/[slug]", "page");
    // O sitemap também fala do post: revalida junto pra não ficar 60s atrás da
    // listagem (o sitemap.xml é um Route Handler, invalidável por path).
    revalidatePath("/sitemap.xml");

    return Response.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
