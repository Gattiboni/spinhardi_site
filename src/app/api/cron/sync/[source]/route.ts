import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { runSync, type SyncSource } from "@/lib/sync/run-sync";

/**
 * Rota de sync recorrente: repopula o bronze de uma fonte e promove pra silver.
 *
 *   /api/cron/sync/clickmassa
 *   /api/cron/sync/iddas
 *   ...?ingestOnly=1   → só ingestão, sem promoção
 *
 * Rota [source] dinâmica (uma só, sem duplicação) — valida `source` contra a
 * lista fechada. A lógica vive em `@/lib/sync/run-sync`; aqui é só borda:
 * autenticação, parse de query, e tradução do resultado/erro em HTTP.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (comparação time-constant). Sem
 * bater → 401. Sem `CRON_SECRET` no ambiente → 500 (misconfig do servidor).
 *
 * Método: o Vercel Cron invoca via GET. Exportamos GET e POST apontando pro mesmo
 * handler pra não depender disso e pra facilitar o teste manual com curl.
 *
 * Runtime Node (não Edge): `crypto` nativo + client service-role do Supabase.
 * `force-dynamic`: nunca cachear — cada chamada executa de fato.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O Iddas leva ~8min; 800s é o teto GA do plano Pro com fluid compute.
export const maxDuration = 800;

const SOURCES: readonly SyncSource[] = ["clickmassa", "iddas"];

/** Comparação de strings em tempo constante (evita timing attacks). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual exige buffers do mesmo tamanho; tamanhos diferentes já
  // reprovam (e não vazam mais que o length da própria entrada).
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ source: string }> },
): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "missing CRON_SECRET" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (!auth || !safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { source } = await ctx.params;
  if (!SOURCES.includes(source as SyncSource)) {
    return Response.json({ error: `unknown source: ${source}` }, { status: 404 });
  }

  const ingestOnly = request.nextUrl.searchParams.get("ingestOnly") === "1";

  try {
    const result = await runSync(source as SyncSource, { ingestOnly });
    // "Tudo certo" = a run inteira foi bem-sucedida. Erro de promoção já lança
    // dentro de runSync (cai no catch abaixo → 500); aqui só resta checar a
    // ingestão. Campo de decisão: result.ingestao.status — apenas "completed"
    // vira 200; "partial"/"failed" viram 500. O corpo continua sendo o
    // resultado do runSync nos dois casos.
    const ok = result.ingestao.status === "completed";
    return Response.json(result, { status: ok ? 200 : 500 });
  } catch (err) {
    // Esta rota roda sozinha no cron — ninguém olha o terminal. Logar COM
    // contexto (fonte, ingestOnly) e stack, não só `err.message`.
    console.error(
      `[cron/sync/${source}] sync falhou (ingestOnly=${ingestOnly}):`,
      err instanceof Error ? (err.stack ?? err.message) : err,
    );
    const message = err instanceof Error ? err.message : "unexpected error";
    return Response.json({ error: message, source }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ source: string }> },
): Promise<Response> {
  return handle(request, ctx);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ source: string }> },
): Promise<Response> {
  return handle(request, ctx);
}
