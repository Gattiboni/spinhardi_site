/**
 * Critério de aceite (β) do lote GA4 + CONSENTIMENTO — provas determinísticas.
 *
 * ZERO REDE, ZERO BANCO, ZERO DOM. Todo check exercita função REAL do repo,
 * importada de `@/lib/consent` e `@/lib/analytics/track` — nada é
 * reimplementado aqui. O `localStorage` é simulado por um objeto em memória
 * pendurado num `window` falso no `globalThis`, trocado entre as provas
 * (inclusive REMOVIDO, pra provar o caminho sem `window`).
 *
 * O que cada bloco cobre:
 *   1. Storage — ausente, granted, denied, validade de 12 meses, versão da
 *      chave, clearConsent, JSON inválido, `at` inválido.
 *   2. Ambiente — sem `window`, e com `localStorage` que lança no acesso.
 *   3. trackEvent — sem `window.gtag` e sem `window`: não lança; com `gtag`
 *      presente: repassa nome e parâmetros sem inventar nada.
 *
 * Uso:
 *   npx tsx scripts/beta-consent.ts
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

import {
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  clearConsent,
  readConsent,
  writeConsent,
} from "@/lib/consent";
import { trackEvent } from "@/lib/analytics/track";

const resultados: { n: string; ok: boolean; nota: string }[] = [];

function check(n: string, ok: boolean, nota: string) {
  resultados.push({ n, ok, nota });
  console.log(`[${ok ? "PASSOU" : "NÃO PASSOU"}] ${n} — ${nota}`);
}

// ─────────────────────────────────────────────────────────────────
// `window` falso: só o que o módulo toca (`localStorage`, e `gtag` no bloco 3)
// ─────────────────────────────────────────────────────────────────

type FakeWindow = { localStorage?: unknown; gtag?: unknown };
const g = globalThis as unknown as { window?: FakeWindow };

/** `localStorage` em memória com a superfície que o módulo usa. */
function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    /** Leitura direta pra provar o que ficou gravado. */
    dump: () => Object.fromEntries(data),
  };
}

function comStorage(seed: Record<string, string> = {}) {
  const storage = memoryStorage(seed);
  g.window = { localStorage: storage };
  return storage;
}

function semWindow() {
  delete g.window;
}

const AGORA = Date.parse("2026-09-11T12:00:00.000Z");
const DIA_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
// 1. Storage
// ─────────────────────────────────────────────────────────────────

check(
  "1.0 chave versionada",
  CONSENT_STORAGE_KEY === `spinhardi:consent:v${CONSENT_VERSION}` && CONSENT_VERSION === 1,
  CONSENT_STORAGE_KEY,
);

comStorage();
check("1.1 ausente → null", readConsent(AGORA) === null, "nunca respondeu");

{
  const storage = comStorage();
  const gravado = writeConsent("granted", AGORA);
  const lido = readConsent(AGORA);
  const bruto = storage.dump()[CONSENT_STORAGE_KEY];
  const parsed = JSON.parse(bruto) as Record<string, unknown>;
  check(
    "1.2 grava granted → lê granted",
    gravado?.analytics === "granted" &&
      lido?.analytics === "granted" &&
      lido.at === new Date(AGORA).toISOString(),
    `at=${lido?.at}`,
  );
  check(
    "1.3 valor gravado é SÓ { analytics, at }",
    Object.keys(parsed).sort().join(",") === "analytics,at" &&
      Object.keys(storage.dump()).length === 1,
    bruto,
  );
}

{
  comStorage();
  writeConsent("denied", AGORA);
  check(
    "1.4 grava denied → lê denied",
    readConsent(AGORA)?.analytics === "denied",
    "recusa persiste",
  );
}

{
  // 13 meses atrás (395 dias): mais velho que a validade de 12 meses (365 dias).
  const treze = new Date(AGORA - 395 * DIA_MS).toISOString();
  comStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ analytics: "granted", at: treze }) });
  check(
    "1.5 registro de 13 meses atrás → null",
    readConsent(AGORA) === null && CONSENT_MAX_AGE_MS === 365 * DIA_MS,
    `at=${treze}, validade=${CONSENT_MAX_AGE_MS / DIA_MS} dias`,
  );
}

{
  // No limite (364 dias) ainda vale — a expiração é "mais velho que", não "igual".
  const quase = new Date(AGORA - 364 * DIA_MS).toISOString();
  comStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ analytics: "granted", at: quase }) });
  check("1.6 registro de 364 dias ainda vale", readConsent(AGORA)?.analytics === "granted", quase);
}

{
  const chaveAntiga = `spinhardi:consent:v${CONSENT_VERSION - 1}`;
  comStorage({
    [chaveAntiga]: JSON.stringify({ analytics: "granted", at: new Date(AGORA).toISOString() }),
  });
  check("1.7 chave de versão diferente → null", readConsent(AGORA) === null, chaveAntiga);
}

{
  const storage = comStorage();
  writeConsent("granted", AGORA);
  clearConsent();
  check(
    "1.8 clearConsent → null e chave removida",
    readConsent(AGORA) === null && !(CONSENT_STORAGE_KEY in storage.dump()),
    "revogação limpa de verdade",
  );
}

{
  comStorage({ [CONSENT_STORAGE_KEY]: "{isso não é json" });
  const a = readConsent(AGORA);
  comStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ analytics: "maybe", at: "2026-01-01" }) });
  const b = readConsent(AGORA);
  comStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ analytics: "granted", at: "ontem" }) });
  const c = readConsent(AGORA);
  check(
    "1.9 registro fora do contrato → null, nunca granted",
    a === null && b === null && c === null,
    "json quebrado, analytics inválido, at inválido",
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. Ambiente
// ─────────────────────────────────────────────────────────────────

{
  semWindow();
  let lancou = false;
  let lido: unknown = "não rodou";
  let gravado: unknown = "não rodou";
  try {
    lido = readConsent(AGORA);
    gravado = writeConsent("granted", AGORA);
    clearConsent();
  } catch {
    lancou = true;
  }
  check(
    "2.1 sem window → null sem lançar",
    !lancou && lido === null && gravado === null,
    "read/write/clear inertes (SSR)",
  );
}

{
  g.window = {
    get localStorage(): unknown {
      throw new Error("SecurityError: storage bloqueado");
    },
  };
  let lancou = false;
  let lido: unknown = "não rodou";
  try {
    lido = readConsent(AGORA);
    writeConsent("granted", AGORA);
    clearConsent();
  } catch {
    lancou = true;
  }
  check(
    "2.2 localStorage que lança → null sem lançar",
    !lancou && lido === null,
    "storage bloqueado",
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. trackEvent
// ─────────────────────────────────────────────────────────────────

{
  comStorage();
  let lancou = false;
  try {
    trackEvent("generate_lead", { method: "form_contato" });
  } catch {
    lancou = true;
  }
  check(
    "3.1 trackEvent sem window.gtag → não lança",
    !lancou,
    "sem consentimento = sem gtag = nada",
  );
}

{
  semWindow();
  let lancou = false;
  try {
    trackEvent("generate_lead");
  } catch {
    lancou = true;
  }
  check("3.2 trackEvent sem window → não lança", !lancou, "SSR");
}

{
  const chamadas: unknown[][] = [];
  g.window = {
    localStorage: memoryStorage(),
    gtag: (...args: unknown[]) => void chamadas.push(args),
  };
  trackEvent("generate_lead", { method: "form_contato" });
  check(
    "3.3 com gtag: repassa nome e parâmetros, nada além",
    chamadas.length === 1 &&
      JSON.stringify(chamadas[0]) === '["event","generate_lead",{"method":"form_contato"}]',
    JSON.stringify(chamadas[0]),
  );
}

{
  g.window = {
    localStorage: memoryStorage(),
    gtag: () => {
      throw new Error("tag quebrada");
    },
  };
  let lancou = false;
  try {
    trackEvent("generate_lead");
  } catch {
    lancou = true;
  }
  check("3.4 gtag que lança → engolido", !lancou, "analytics nunca quebra o site");
}

semWindow();

// ─────────────────────────────────────────────────────────────────

const falhas = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - falhas.length}/${resultados.length} checks passaram.` +
    (falhas.length ? ` FALHAS: ${falhas.map((f) => f.n).join(", ")}` : " Nenhuma falha."),
);
process.exit(falhas.length === 0 ? 0 : 1);
