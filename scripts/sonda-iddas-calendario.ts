/**
 * Sonda Iddas — material de CALENDÁRIO em `tarefa` e `solicitacao`
 *
 * Duas perguntas, ambas de LEITURA:
 *   Q1 — `GET /tarefa/{id}` traz campo que `GET /tarefa` (lista) não traz? (foi
 *        o que aconteceu com etiquetas no orçamento: o detalhe era mais rico)
 *   Q2 — `GET /solicitacao` tem material de calendário (ida/volta futuras) que
 *        valha entrar na visão? Diff lista×detalhe também.
 *
 * READ-ONLY ABSOLUTO contra o Iddas: só GET. O único POST é o `/auth/login` do
 * próprio transporte do sync (é como se obtém o bearer — não é escrita em
 * recurso). NENHUM POST/PUT/DELETE em /tarefa, /solicitacao ou qualquer outro
 * recurso: o schema de escrita de tarefa foi lido da SPEC
 * (docs/misc_etls/api_iddas_full.json), não da rede.
 *
 * Zero escrita no Supabase — as leituras da bronze servem só pra amostrar ids.
 *
 * Reusa client/auth do sync por IMPORT (`createIddasTransport`), sem alterar o
 * módulo — mesmo padrão de scripts/sonda-iddas-etiquetas.ts.
 *
 * Orçamento: teto de MAX_CALLS GETs, pausa >= 600ms daqui + 500ms do transporte.
 * Aborta após 3 falhas consecutivas.
 *
 * PII mascarada nos excertos; o shape é preservado.
 *
 * Uso: npx tsx scripts/sonda-iddas-calendario.ts [--verbose]
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createConsoleLogger, resolveIddasConfig, IngestionConfigError } from "@/lib/ingestion";
import { createIddasTransport } from "@/lib/ingestion/iddas/transport";
import { createSupabaseRest } from "@/lib/ingestion/supabase-rest";

// ─── Carregar .env.local ────────────────────────────────────────────────────

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

const VERBOSE = process.argv.slice(2).includes("--verbose");

const MAX_CALLS = 16;
const EXTRA_PAUSE_MS = 600;
const MAX_CONSECUTIVE_FAILURES = 3;

/** Campos cujo VALOR é PII — mascarados no excerto, shape preservado. */
const PII_RE = /nome|email|celular|telefone|cpf|cnpj|rg|passaporte|endereco|cliente|observacao/i;

// ─── Utilidades ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusFromError(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err);
  const m = msg.match(/HTTP (\d{3})/);
  return m ? m[1] : `ERR:${msg.slice(0, 120).replace(/\s+/g, " ")}`;
}

function mask(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((v) => mask(v, key));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mask(v, k);
    return out;
  }
  if (PII_RE.test(key) && typeof value === "string" && value !== "") return "<redacted>";
  return value;
}

/** `chave: tipo` — o shape sem os dados. */
function shapeOf(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
    const t = v === null ? "null" : Array.isArray(v) ? `array[${v.length}]` : typeof v;
    return `${k}: ${t}`;
  });
}

interface IddasList {
  success?: boolean;
  data?: unknown[];
  meta?: { page?: number; per_page?: number; total?: number };
}

// ─── Sonda ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cfg = resolveIddasConfig();
  const logger = createConsoleLogger("[sonda-calendario]", VERBOSE);
  const transport = createIddasTransport(cfg, logger);
  const rest = createSupabaseRest(cfg.supabase.url, cfg.supabase.key);

  const callLog: { n: number; url: string; status: string }[] = [];
  let calls = 0;
  let consecutiveFailures = 0;
  let aborted: string | null = null;

  async function get(path: string): Promise<{ ok: true; body: unknown } | { ok: false; status: string }> {
    if (aborted) return { ok: false, status: "abortado" };
    if (calls >= MAX_CALLS) {
      aborted = `teto de ${MAX_CALLS} chamadas atingido`;
      return { ok: false, status: "teto" };
    }
    const url = `${transport.apiUrl}/api/v1/${path}`;
    await sleep(EXTRA_PAUSE_MS);
    calls++;
    try {
      const body = await transport.iddasFetch(url); // GET-only por construção
      consecutiveFailures = 0;
      callLog.push({ n: calls, url: path, status: "200" });
      console.log(`  #${calls} GET /${path} → 200`);
      return { ok: true, body };
    } catch (err) {
      const status = statusFromError(err);
      consecutiveFailures++;
      callLog.push({ n: calls, url: path, status });
      console.log(`  #${calls} GET /${path} → ${status}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = `${MAX_CONSECUTIVE_FAILURES} falhas consecutivas (última: ${status})`;
      }
      return { ok: false, status };
    }
  }

  // ── Passo 0 — ids reais da bronze (leitura, sem gastar chamada) ────────────

  logger.sep("Passo 0 — amostrar ids (bronze, leitura)");
  async function amostrar(table: string, n: number): Promise<string[]> {
    const r = await rest.sbFetch(`/${table}`, {
      queryParams: { select: "id", order: "id.desc", limit: String(n) },
    });
    const rows = (Array.isArray(r.body) ? r.body : []) as { id: string }[];
    return rows.map((x) => String(x.id));
  }
  const tarefaIds = await amostrar("bronze_iddas_tarefa", 3);
  const solicitacaoIds = await amostrar("bronze_iddas_solicitacao", 1);
  console.log(`  tarefa: ${tarefaIds.join(", ")}`);
  console.log(`  solicitacao: ${solicitacaoIds.join(", ")}`);

  // ── Passo 1 — baseline da LISTA de tarefa ─────────────────────────────────

  logger.sep("Passo 1 — GET /tarefa (lista)");
  let tarefaListaKeys: string[] = [];
  let tarefaListaItem: Record<string, unknown> | null = null;
  let tarefaTotal = 0;

  const rl = await get("tarefa?page=1");
  if (rl.ok) {
    const body = rl.body as IddasList;
    tarefaTotal = Number(body.meta?.total ?? 0);
    tarefaListaItem = ((body.data ?? [])[0] ?? null) as Record<string, unknown> | null;
    tarefaListaKeys = tarefaListaItem ? Object.keys(tarefaListaItem) : [];
    console.log(`  total=${tarefaTotal} | ${tarefaListaKeys.length} chaves no item`);
    console.log(`  chaves: ${tarefaListaKeys.join(", ")}`);
  }

  // ── Passo 2 (Q1) — DETALHE de tarefa vs lista ─────────────────────────────

  logger.sep("Passo 2 (Q1) — GET /tarefa/{id}: detalhe vs lista");
  const diffs: { id: string; novas: string[]; ausentes: string[]; total: number }[] = [];
  let tarefaDetalheItem: Record<string, unknown> | null = null;

  for (const id of tarefaIds) {
    const r = await get(`tarefa/${id}`);
    if (!r.ok) continue;
    const data = (r.body as { data?: unknown }).data as Record<string, unknown> | undefined;
    if (!data) {
      console.log(`  tarefa/${id}: resposta sem .data`);
      continue;
    }
    const chaves = Object.keys(data);
    const novas = chaves.filter((k) => !tarefaListaKeys.includes(k));
    const ausentes = tarefaListaKeys.filter((k) => !chaves.includes(k));
    diffs.push({ id, novas, ausentes, total: chaves.length });
    if (!tarefaDetalheItem) tarefaDetalheItem = data;
    console.log(
      `  tarefa/${id}: ${chaves.length} chaves | +${novas.length} [${novas.join(",")}] | -${ausentes.length} [${ausentes.join(",")}]`,
    );
  }

  // ── Passo 3 (Q2) — solicitacao: lista + detalhe ───────────────────────────

  logger.sep("Passo 3 (Q2) — GET /solicitacao");
  let solListaKeys: string[] = [];
  let solListaItem: Record<string, unknown> | null = null;
  let solTotal = 0;
  let solFuturas = 0;
  let solAmostradas = 0;

  const rs = await get("solicitacao?page=1");
  if (rs.ok) {
    const body = rs.body as IddasList;
    solTotal = Number(body.meta?.total ?? 0);
    const itens = (body.data ?? []) as Record<string, unknown>[];
    solListaItem = itens[0] ?? null;
    solListaKeys = solListaItem ? Object.keys(solListaItem) : [];
    solAmostradas = itens.length;
    const hoje = new Date().toISOString().slice(0, 10);
    solFuturas = itens.filter((i) => {
      const ida = String(i.data_ida ?? "");
      return /^\d{4}-\d{2}-\d{2}$/.test(ida) && ida >= hoje;
    }).length;
    console.log(`  total=${solTotal} | ${itens.length} na página | ${solListaKeys.length} chaves`);
    console.log(`  chaves: ${solListaKeys.join(", ")}`);
    console.log(`  com data_ida >= hoje (${hoje}): ${solFuturas}/${itens.length}`);
  }

  let solDetalheItem: Record<string, unknown> | null = null;
  let solNovas: string[] = [];
  let solAusentes: string[] = [];
  for (const id of solicitacaoIds) {
    const r = await get(`solicitacao/${id}`);
    if (!r.ok) continue;
    const data = (r.body as { data?: unknown }).data as Record<string, unknown> | undefined;
    if (!data) continue;
    solDetalheItem = data;
    const chaves = Object.keys(data);
    solNovas = chaves.filter((k) => !solListaKeys.includes(k));
    solAusentes = solListaKeys.filter((k) => !chaves.includes(k));
    console.log(
      `  solicitacao/${id}: ${chaves.length} chaves | +${solNovas.length} [${solNovas.join(",")}] | -${solAusentes.length} [${solAusentes.join(",")}]`,
    );
  }

  // ── Relatório ─────────────────────────────────────────────────────────────

  logger.sep("RESUMO");
  console.log(`Chamadas GET ao Iddas: ${calls}/${MAX_CALLS}${aborted ? ` — ABORTADA: ${aborted}` : ""}`);

  console.log(`\nQ1 — /tarefa: total declarado = ${tarefaTotal}`);
  if (tarefaListaItem) {
    console.log(`  SHAPE da LISTA (${shapeOf(tarefaListaItem).length} campos):`);
    for (const l of shapeOf(tarefaListaItem)) console.log(`    ${l}`);
    console.log(`  item redigido: ${JSON.stringify(mask(tarefaListaItem)).slice(0, 800)}`);
  }
  if (tarefaDetalheItem) {
    console.log(`\n  SHAPE do DETALHE (${shapeOf(tarefaDetalheItem).length} campos):`);
    for (const l of shapeOf(tarefaDetalheItem)) console.log(`    ${l}`);
    console.log(`  item redigido: ${JSON.stringify(mask(tarefaDetalheItem)).slice(0, 800)}`);
  }
  const houveDiff = diffs.some((d) => d.novas.length > 0);
  console.log(
    `\n  VEREDITO Q1: detalhe ${houveDiff ? "TRAZ campo a mais" : "NÃO traz nada além da lista"} — ` +
      diffs.map((d) => `${d.id}:+${d.novas.length}/-${d.ausentes.length}`).join(" | "),
  );

  console.log(`\nQ2 — /solicitacao: total declarado = ${solTotal} (${solAmostradas} na página 1)`);
  if (solListaItem) {
    console.log(`  SHAPE da LISTA (${shapeOf(solListaItem).length} campos):`);
    for (const l of shapeOf(solListaItem)) console.log(`    ${l}`);
    console.log(`  item redigido: ${JSON.stringify(mask(solListaItem)).slice(0, 900)}`);
  }
  if (solDetalheItem) {
    console.log(
      `\n  DETALHE: +${solNovas.length} [${solNovas.join(",")}] | -${solAusentes.length} [${solAusentes.join(",")}]`,
    );
    console.log(`  item redigido: ${JSON.stringify(mask(solDetalheItem)).slice(0, 900)}`);
  }
  console.log(`\n  Material de calendário: ${solFuturas}/${solAmostradas} com data_ida futura na página 1.`);

  console.log(`\n── LOG DE CHAMADAS (${callLog.length}) ──`);
  for (const c of callLog) console.log(`  #${c.n} GET /${c.url} → ${c.status}`);

  if (aborted) process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof IngestionConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error("ERRO FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
