/**
 * Sonda ClickMassa — histórico de conversas (tickets + mensagens) é ingerível?
 *
 * A exploração de junho (scripts/explore-clickmassa-internal.ts →
 * docs/misc_etls/clickmassa-internal-endpoints.md) parou em
 * `GET /tickets?pageNumber=1` → 500 `WHERE parameter "userId" has invalid
 * "undefined" value`. A rota existe e QUER `userId`. Como o ticketId nunca foi
 * descoberto, o bloco de mensagens (`/messages/{ticketId}`) foi pulado — nunca
 * testado. Esta sonda fecha as duas pontas.
 *
 * READ-ONLY ABSOLUTO: só GET. Zero mutação no CRM, zero escrita no Supabase.
 *
 * Responde:
 *   P1 — /tickets aceita userId? qual shape, qual paginação, qual volume?
 *   P2 — existe endpoint de mensagens por ticket? qual dos 3 candidatos?
 *   P3 — dá pra correlacionar com contato (contactId ↔ bronze_clickmassa_contacts.id)?
 *   P4 — tem timestamp utilizável como chave incremental?
 *
 * Auth/host: mesmo par da exploração de junho — host = origin de
 * CLICKMASSA_API_URL, Bearer = CLICKMASSA_API_KEY (o JWT tenantId=28 serve tanto
 * a API externa quanto as rotas internas do fork Whaticket).
 *
 * Orçamento: teto de MAX_CALLS GETs, pausa >= 600ms (≈1.6 req/s). Aborta em 429
 * (reporta e para a linha) ou após 3 falhas consecutivas.
 *
 * PII: corpo de mensagem e nome/número de contato saem `<redacted>` no relatório.
 * O shape (chaves + tipos) é preservado, que é o que interessa pro contrato.
 *
 * Não grava arquivo nenhum: o relatório sai em stdout.
 *
 * Uso:
 *   npx tsx scripts/sonda-clickmassa-conversas.ts
 *   npx tsx scripts/sonda-clickmassa-conversas.ts --full   # varre os 5 users e 3 status
 */

import { readFileSync } from "fs";
import { join } from "path";

// ─── Carregar .env.local (mesmo bloco dos outros scripts) ───────────────────

try {
  const envPath = join(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    const value = rawVal.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.error("AVISO: nao foi possivel carregar .env.local");
}

// ─── Config ────────────────────────────────────────────────────────────────

const EXTERNAL_URL = (process.env.CLICKMASSA_API_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.CLICKMASSA_API_KEY ?? "";

if (!EXTERNAL_URL || !API_KEY) {
  console.error("ERRO: CLICKMASSA_API_URL ou CLICKMASSA_API_KEY nao definidos em .env.local");
  process.exit(1);
}

const HOST = new URL(EXTERNAL_URL).origin;

const FULL = process.argv.slice(2).includes("--full");

/** Teto duro de GETs na execução inteira. */
const MAX_CALLS = FULL ? 40 : 24;
/** ≈1.6 req/s — folgado sob o teto de 2 req/s da instrução. */
const PAUSE_MS = 620;
const TIMEOUT_MS = 15_000;
const MAX_CONSECUTIVE_FAILURES = 3;

/** Users reais de `bronze_clickmassa_users` (Angelina primeiro — é a dona da fila). */
const USERS: { id: number; nome: string; profile: string }[] = [
  { id: 60, nome: "Angelina", profile: "admin" },
  { id: 67, nome: "Julia", profile: "admin" },
  { id: 164, nome: "Amanda Gattiboni", profile: "admin" },
  { id: 144, nome: "Isaura Teixeira", profile: "user" },
  { id: 170, nome: "Bruna Massita", profile: "user" },
];

/** Chaves cujo VALOR é PII — mascaradas no excerto, shape preservado. */
const PII_KEY_RE = /^(body|name|number|pushname|email|profilePicUrl|mediaUrl|mediaName|lid)$/i;

// ─── Utilidades ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mascara valores de chaves PII em qualquer nível, preservando o shape. */
function mask(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((v) => mask(v, key));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mask(v, k);
    return out;
  }
  if (PII_KEY_RE.test(key) && typeof value === "string" && value !== "") return "<redacted>";
  return value;
}

/** `chave: tipo` de um objeto — o shape sem os dados. */
function shapeOf(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
    const t = v === null ? "null" : Array.isArray(v) ? `array[${v.length}]` : typeof v;
    return `${k}: ${t}`;
  });
}

/** Primeiro array não-vazio dentro do envelope (tickets/messages/data/...). */
function firstArray(body: unknown): { key: string; arr: unknown[] } | null {
  if (Array.isArray(body)) return { key: "(raiz)", arr: body };
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  for (const k of ["tickets", "messages", "data", "results", "items"]) {
    if (Array.isArray(obj[k])) return { key: k, arr: obj[k] as unknown[] };
  }
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length > 0) return { key: k, arr: v };
  }
  return null;
}

interface Resposta {
  ok: boolean;
  status: number | null;
  body: unknown;
  raw: string;
  ms: number;
}

// ─── Sonda ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Host interno: ${HOST}`);
  console.log(`Bearer (preview): ${API_KEY.slice(0, 8)}...`);
  console.log(`Pausa: ${PAUSE_MS}ms (~${(1000 / PAUSE_MS).toFixed(1)} req/s) | teto: ${MAX_CALLS} GETs`);
  console.log("─".repeat(72));

  const log: { n: number; path: string; status: string; ms: number; bytes: number }[] = [];
  let calls = 0;
  let consecutiveFailures = 0;
  let aborted: string | null = null;

  /** Único ponto de saída pra rede. Só GET. Conta, pausa, loga, respeita 429. */
  async function get(path: string): Promise<Resposta> {
    if (aborted) return { ok: false, status: null, body: null, raw: "", ms: 0 };
    if (calls >= MAX_CALLS) {
      aborted = `teto de ${MAX_CALLS} chamadas atingido`;
      return { ok: false, status: null, body: null, raw: "", ms: 0 };
    }
    await sleep(PAUSE_MS);
    calls++;
    const url = `${HOST}${path}`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json, text/plain, */*",
          Origin: "https://enterprise-352n.clickmassa.com.br",
          Referer: "https://enterprise-352n.clickmassa.com.br/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timer);
      const ms = Date.now() - start;
      const raw = await res.text();
      let body: unknown = null;
      try {
        body = JSON.parse(raw);
      } catch {
        /* HTML/texto — 404 do Express */
      }
      log.push({ n: calls, path, status: String(res.status), ms, bytes: raw.length });
      console.log(`  #${calls} GET ${path} → ${res.status} (${ms}ms, ${raw.length}B)`);

      // 429: para a linha inteira e reporta, conforme restrição 5.
      if (res.status === 429) {
        aborted = `HTTP 429 em ${path} (retry-after: ${res.headers.get("retry-after") ?? "ausente"})`;
        return { ok: false, status: 429, body, raw, ms };
      }
      // 4xx/5xx COM resposta são resultado, não falha de sonda: um 500 de
      // negócio ("userId undefined") é justamente o que viemos medir, e abortar
      // nele mataria os passos seguintes, que são independentes. Só erro de
      // REDE (e 429, acima) interrompe.
      consecutiveFailures = 0;
      return { ok: res.ok, status: res.status, body, raw, ms };
    } catch (e) {
      const ms = Date.now() - start;
      const motivo = e instanceof Error ? (e.name === "AbortError" ? "TIMEOUT" : e.message) : String(e);
      log.push({ n: calls, path, status: `ERR:${motivo}`, ms, bytes: 0 });
      console.log(`  #${calls} GET ${path} → ERRO ${motivo}`);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = `${MAX_CONSECUTIVE_FAILURES} falhas consecutivas (última: ${motivo})`;
      }
      return { ok: false, status: null, body: null, raw: "", ms };
    }
  }

  /** Excerto do erro, achatado — é o que diferencia 500-de-negócio de 500-real. */
  function erroCurto(r: Resposta): string {
    const s = r.body ? JSON.stringify(r.body) : r.raw;
    return s.replace(/\s+/g, " ").slice(0, 160);
  }

  // ── Passo 1 — /tickets com userId ─────────────────────────────────────────

  console.log("\n=== PASSO 1 — GET /tickets?userId=<id>&pageNumber=1 ===");

  let ticketAmostra: Record<string, unknown> | null = null;
  let envelopeTickets: string[] = [];
  const porUser: { user: string; id: number; status: string; count: unknown; hasMore: unknown; n: number }[] = [];

  const usersAlvo = FULL ? USERS : USERS.slice(0, 3);
  for (const u of usersAlvo) {
    const r = await get(`/tickets?userId=${u.id}&pageNumber=1`);
    if (!r.ok) {
      porUser.push({ user: u.nome, id: u.id, status: `HTTP ${r.status}`, count: "—", hasMore: "—", n: 0 });
      console.log(`      ${u.nome}(${u.id}) → ${erroCurto(r)}`);
      continue;
    }
    const env = r.body as Record<string, unknown> | null;
    const fa = firstArray(r.body);
    envelopeTickets = env && !Array.isArray(env) ? Object.keys(env) : ["(raiz é array)"];
    porUser.push({
      user: u.nome,
      id: u.id,
      status: "200",
      count: env?.count ?? "—",
      hasMore: env?.hasMore ?? "—",
      n: fa?.arr.length ?? 0,
    });
    console.log(
      `      ${u.nome}(${u.id}) → envelope=[${envelopeTickets.join(",")}] itens=${fa?.arr.length ?? 0} count=${String(env?.count ?? "—")} hasMore=${String(env?.hasMore ?? "—")}`,
    );
    if (!ticketAmostra && fa && fa.arr.length > 0) {
      ticketAmostra = fa.arr[0] as Record<string, unknown>;
    }
  }

  // ── Passo 1b — bypass do filtro por usuário ───────────────────────────────
  // No Whaticket, `showAll=true` troca o whereCondition por `{ tenantId }` e
  // dispensa o userId da sessão — é a única variação que poderia destravar a
  // listagem com um token que não carrega identidade de usuário. `queueIds`
  // vazio entra junto porque alguns forks exigem o array explícito.

  if (!ticketAmostra && !aborted) {
    console.log("\n=== PASSO 1b — bypass do filtro por usuário ===");
    for (const p of [
      "/tickets?showAll=true&pageNumber=1",
      "/tickets?showAll=true&status=open&queueIds=%5B%5D&pageNumber=1",
    ]) {
      const r = await get(p);
      const fa = r.ok ? firstArray(r.body) : null;
      const env = r.ok && r.body && !Array.isArray(r.body) ? Object.keys(r.body as object) : [];
      console.log(
        `      ${p} → ${r.ok ? "200" : `HTTP ${r.status}`} envelope=[${env.join(",")}] itens=${fa?.arr.length ?? 0}`,
      );
      if (!r.ok) console.log(`         ${erroCurto(r)}`);
      if (r.ok && fa && fa.arr.length > 0) {
        ticketAmostra = fa.arr[0] as Record<string, unknown>;
        envelopeTickets = env;
        porUser.push({
          user: "(showAll)",
          id: 0,
          status: "200",
          count: (r.body as Record<string, unknown>)?.count ?? "—",
          hasMore: (r.body as Record<string, unknown>)?.hasMore ?? "—",
          n: fa.arr.length,
        });
        break;
      }
    }
  }

  // ── Passo 2 — variações de status (só se o passo 1 deu 200) ────────────────

  const porStatus: { status: string; http: string; count: unknown; n: number }[] = [];
  const userOk = porUser.find((p) => p.status === "200");
  if (userOk && !aborted) {
    console.log("\n=== PASSO 2 — variação de status ===");
    const statusAlvo = FULL ? ["open", "pending", "closed"] : ["open", "closed"];
    for (const st of statusAlvo) {
      const r = await get(`/tickets?userId=${userOk.id}&status=${st}&pageNumber=1`);
      const env = r.ok ? (r.body as Record<string, unknown> | null) : null;
      const fa = r.ok ? firstArray(r.body) : null;
      porStatus.push({
        status: st,
        http: r.ok ? "200" : `HTTP ${r.status}`,
        count: env?.count ?? "—",
        n: fa?.arr.length ?? 0,
      });
      console.log(
        `      status=${st} → ${r.ok ? "200" : `HTTP ${r.status}`} itens=${fa?.arr.length ?? 0} count=${String(env?.count ?? "—")}`,
      );
      if (!r.ok) console.log(`         ${erroCurto(r)}`);
      if (!ticketAmostra && fa && fa.arr.length > 0) ticketAmostra = fa.arr[0] as Record<string, unknown>;
    }
  } else if (!userOk) {
    console.log("\n=== PASSO 2 — PULADO (nenhum userId devolveu 200) ===");
  }

  // ── Passo 3 — paginação real ──────────────────────────────────────────────

  let paginacao = "não testada";
  if (userOk && !aborted) {
    console.log("\n=== PASSO 3 — paginação ===");
    const r2 = await get(`/tickets?userId=${userOk.id}&pageNumber=2`);
    if (r2.ok) {
      const env = r2.body as Record<string, unknown> | null;
      const fa = firstArray(r2.body);
      const ids1 = "—";
      paginacao = `pageNumber: page2 devolveu ${fa?.arr.length ?? 0} itens, hasMore=${String(env?.hasMore ?? "—")}, count=${String(env?.count ?? "—")}`;
      console.log(`      page2 → ${fa?.arr.length ?? 0} itens (${ids1})`);
    } else {
      paginacao = `page2 → HTTP ${r2.status}`;
    }
  }

  // ── Passo 4 — endpoint de mensagens por ticket ────────────────────────────

  console.log("\n=== PASSO 4 — mensagens por ticket ===");
  const ticketId = ticketAmostra && typeof ticketAmostra.id === "number" ? ticketAmostra.id : null;
  const candidatos: { path: string; http: string; envelope: string; n: number }[] = [];
  let msgAmostra: Record<string, unknown> | null = null;
  let msgEnvelope: Record<string, unknown> | null = null;

  if (ticketId == null) {
    // Sem ticketId real (a listagem 500), ainda dá pra separar "a ROTA não
    // existe" de "só falta um id": um id-sonda distingue 404-HTML (Express não
    // tem a rota) de 404/500-JSON (rota existe, id inválido) e de 200. Nada
    // aqui é varredura — é UM id por candidato, e o mesmo pro /tickets/{id}.
    console.log("  [FALLBACK] sem ticketId real — teste de EXISTÊNCIA da rota com id-sonda.");
    const SONDA_ID = 1;
    for (const p of [
      `/tickets/${SONDA_ID}`,
      `/messages/${SONDA_ID}?pageNumber=1`,
      `/tickets/${SONDA_ID}/messages?pageNumber=1`,
      `/messages?ticketId=${SONDA_ID}&pageNumber=1`,
    ]) {
      const r = await get(p);
      const tipo = r.body ? "JSON (rota existe)" : r.raw.startsWith("<") ? "HTML (rota inexistente)" : "vazio";
      candidatos.push({
        path: p,
        http: r.ok ? "200" : `HTTP ${r.status}`,
        envelope: tipo,
        n: firstArray(r.body)?.arr.length ?? 0,
      });
      console.log(`      ${p} → ${r.ok ? "200" : `HTTP ${r.status}`} | ${tipo} | ${erroCurto(r)}`);
      if (r.ok && r.body) {
        msgAmostra = (firstArray(r.body)?.arr[0] ?? null) as Record<string, unknown> | null;
        if (msgAmostra) msgEnvelope = r.body as Record<string, unknown>;
      }
    }
  } else {
    console.log(`  ticketId amostrado: ${ticketId}`);
    const paths = [
      `/messages/${ticketId}?pageNumber=1`,
      `/tickets/${ticketId}/messages?pageNumber=1`,
      `/messages?ticketId=${ticketId}&pageNumber=1`,
    ];
    for (const p of paths) {
      const r = await get(p);
      const fa = r.ok ? firstArray(r.body) : null;
      const env =
        r.ok && r.body && typeof r.body === "object" && !Array.isArray(r.body)
          ? Object.keys(r.body as object).join(",")
          : r.ok
            ? "(raiz é array)"
            : "—";
      candidatos.push({ path: p, http: r.ok ? "200" : `HTTP ${r.status}`, envelope: env, n: fa?.arr.length ?? 0 });
      console.log(`      ${p} → ${r.ok ? "200" : `HTTP ${r.status}`} envelope=[${env}] itens=${fa?.arr.length ?? 0}`);
      if (!r.ok) console.log(`         ${erroCurto(r)}`);
      if (r.ok && fa && fa.arr.length > 0 && !msgAmostra) {
        msgAmostra = fa.arr[0] as Record<string, unknown>;
        msgEnvelope = r.body as Record<string, unknown>;
        break; // achou — não precisa queimar os outros candidatos
      }
    }
  }

  // ── Passo 5 — detalhe de 1 ticket (campos que a lista não traz) ────────────

  let ticketDetalhe: Record<string, unknown> | null = null;
  if (ticketId != null && !aborted) {
    console.log("\n=== PASSO 5 — detalhe do ticket ===");
    const r = await get(`/tickets/${ticketId}`);
    if (r.ok && r.body && typeof r.body === "object") {
      ticketDetalhe = r.body as Record<string, unknown>;
      const novas = Object.keys(ticketDetalhe).filter((k) => !(k in (ticketAmostra ?? {})));
      console.log(`      +${novas.length} chaves vs lista: ${novas.join(",") || "(nenhuma)"}`);
    } else {
      console.log(`      HTTP ${r.status} — ${erroCurto(r)}`);
    }
  }

  // ── Relatório ─────────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(72));
  console.log("RESUMO");
  console.log("=".repeat(72));
  console.log(`Chamadas: ${calls}/${MAX_CALLS}${aborted ? ` — ABORTADA: ${aborted}` : ""}`);

  console.log(`\nP1 — /tickets?userId por usuário:`);
  for (const p of porUser) {
    console.log(`  user ${p.id} (${p.user}): ${p.status} | itens=${p.n} count=${String(p.count)} hasMore=${String(p.hasMore)}`);
  }
  if (porStatus.length) {
    console.log(`P1 — por status: ${porStatus.map((s) => `${s.status}=${s.http}/${s.n} itens (count=${String(s.count)})`).join(" | ")}`);
  }
  console.log(`P1 — paginação: ${paginacao}`);

  if (ticketAmostra) {
    console.log(`\nP1 — SHAPE de 1 ticket (${shapeOf(ticketAmostra).length} campos):`);
    for (const l of shapeOf(ticketAmostra)) console.log(`    ${l}`);
    console.log(`  amostra redigida:`);
    console.log(`    ${JSON.stringify(mask(ticketAmostra)).slice(0, 1200)}`);
  } else {
    console.log(`\nP1 — nenhum ticket amostrado.`);
  }

  if (ticketDetalhe) {
    const novas = Object.keys(ticketDetalhe).filter((k) => !(k in (ticketAmostra ?? {})));
    console.log(`\nP1 — detalhe vs lista: +${novas.length} chaves (${novas.join(",") || "nenhuma"})`);
  }

  console.log(`\nP2 — candidatos de mensagens:`);
  for (const c of candidatos) console.log(`  ${c.path} → ${c.http} envelope=[${c.envelope}] itens=${c.n}`);
  if (msgAmostra) {
    console.log(`\nP2 — SHAPE de 1 mensagem (${shapeOf(msgAmostra).length} campos):`);
    for (const l of shapeOf(msgAmostra)) console.log(`    ${l}`);
    console.log(`  amostra redigida:`);
    console.log(`    ${JSON.stringify(mask(msgAmostra)).slice(0, 1600)}`);
    if (msgEnvelope) {
      const semArray: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(msgEnvelope)) if (!Array.isArray(v)) semArray[k] = v;
      console.log(`  envelope (fora do array): ${JSON.stringify(mask(semArray)).slice(0, 400)}`);
    }
  } else {
    console.log(`\nP2 — nenhuma mensagem amostrada.`);
  }

  // Correlação e incremental — derivados do shape, sem gastar chamada.
  console.log(`\nP3 — correlação com contato:`);
  for (const [rotulo, amostra] of [
    ["ticket", ticketAmostra],
    ["mensagem", msgAmostra],
  ] as const) {
    if (!amostra) continue;
    const chaves = Object.keys(amostra).filter((k) => /contact|ticket|user|whatsapp|queue/i.test(k));
    const vals = chaves.map((k) => `${k}=${JSON.stringify(mask(amostra[k], k))}`.slice(0, 80));
    console.log(`  ${rotulo}: ${vals.join(" | ") || "(nenhuma chave de correlação)"}`);
  }

  console.log(`\nP4 — timestamps (chave incremental candidata):`);
  for (const [rotulo, amostra] of [
    ["ticket", ticketAmostra],
    ["mensagem", msgAmostra],
  ] as const) {
    if (!amostra) continue;
    const ts = Object.keys(amostra).filter((k) => /At$|date|time|timestamp/i.test(k));
    console.log(`  ${rotulo}: ${ts.map((k) => `${k}=${String(amostra[k])}`).join(" | ") || "(nenhum)"}`);
  }

  console.log(`\n── LOG DE CHAMADAS (${log.length}) ──`);
  for (const c of log) console.log(`  #${c.n} GET ${c.path} → ${c.status} (${c.ms}ms, ${c.bytes}B)`);

  if (aborted) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("ERRO FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
