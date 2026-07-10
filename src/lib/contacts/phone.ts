/**
 * Normalização canônica de telefone BR — FONTE ÚNICA.
 *
 * Um só lugar para transformar qualquer entrada humana ("(11) 98334-0441",
 * "+55 11 98334 0441", "11983340441") num formato canônico comparável e
 * persistível. Consumido por (e SÓ por):
 *   - validação server-side  → validation.ts   (via whatsappValidationError)
 *   - persistência           → from-form.ts    (o que grava no banco)
 *   - dedup                  → contacts/index.ts (compara canônico vs canônico)
 *
 * CANÔNICO = só dígitos, com DDD, SEM o DDI 55. Ex.: "11983340441".
 *   - fixo:    10 dígitos → DDD (2) + assinante (8), assinante iniciando 2–5;
 *   - celular: 11 dígitos → DDD (2) + 9 + assinante (8).
 *
 * Regras (ANATEL):
 *   - tira tudo que não é dígito;
 *   - remove o DDI 55 quando presente (12–13 dígitos começando com 55 — só aí,
 *     pra não confundir com o DDD 55 de Santa Maria/RS);
 *   - DDD válido: 11–99 (rejeita 0x e 10);
 *   - celular (11 díg) precisa ter o 9 logo após o DDD.
 * Fora dessas formas → inválido.
 *
 * PROMOÇÃO DO NONO DÍGITO (celular antigo de 10 díg → 11): NÃO acontece na
 * normalização estrita. Fabricar um 9 a partir de um número de 10 dígitos
 * transforma um typo ("119 8334 044", faltou um dígito) num "sucesso" que grava
 * um número DIFERENTE do digitado. Por isso a promoção vive só em
 * `normalizeBrPhoneLegacy`, usada EXCLUSIVAMENTE pelo fallback de dedup contra
 * registros legados do banco. O form (validação/persistência) nunca a liga.
 *
 * NÃO tem "server-only": é lógica pura (sem I/O), importável no client. A máscara
 * do form é convenção separada (ContactForm) — a fonte da verdade é sempre esta
 * normalização, que roda no servidor em validação/persistência/dedup.
 */

// `incomplete_mobile`: celular antigo de 10 dígitos (assinante iniciando 9/8/7) —
// falta o nono dígito, quase sempre um typo. `invalid`: qualquer outra forma.
export type PhoneRejectReason = "incomplete_mobile" | "invalid";

export type NormalizedPhone =
  | { ok: true; canonical: string; tipo: "fixo" | "celular" }
  | { ok: false; reason: PhoneRejectReason };

// Assinante de celular no padrão antigo (8 díg): inicia 9, 8 ou 7 (regra ANATEL
// do nono dígito). Assinante de fixo (8 díg) inicia 2–5.
const MOBILE_LEADING = new Set(["7", "8", "9"]);
const FIXO_LEADING = new Set(["2", "3", "4", "5"]);

function stripToDigits(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

function isValidDdd(ddd: string): boolean {
  const n = Number(ddd);
  return n >= 11 && n <= 99;
}

/**
 * Núcleo compartilhado. `promoteMobile9` só é ligado pelo caminho legado de dedup
 * (ver `normalizeBrPhoneLegacy`). No caminho estrito, celular de 10 dígitos é
 * rejeitado como incompleto — nunca "consertado".
 */
function normalizeCore(raw: string, promoteMobile9: boolean): NormalizedPhone {
  let d = stripToDigits(raw);

  // DDI 55: só remove quando o resto vira 10–11 dígitos (12/13 no total).
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }

  if (d.length !== 10 && d.length !== 11) return { ok: false, reason: "invalid" };

  const ddd = d.slice(0, 2);
  if (!isValidDdd(ddd)) return { ok: false, reason: "invalid" };

  let local = d.slice(2);

  // Celular antigo (DDD + 8, assinante iniciando 9/8/7): forma incompleta.
  const looksLikeOldMobile = local.length === 8 && MOBILE_LEADING.has(local[0]);

  // Promoção do nono dígito: SÓ no caminho legado (dedup). No form fabricaria um
  // número diferente do digitado e aceitaria typo como válido.
  if (promoteMobile9 && looksLikeOldMobile) {
    local = `9${local}`;
  }

  if (local.length === 9) {
    // Celular: após a normalização, tem que começar com 9.
    if (local[0] !== "9") return { ok: false, reason: "invalid" };
    return { ok: true, canonical: `${ddd}${local}`, tipo: "celular" };
  }

  if (local.length === 8) {
    // Celular antigo de 10 díg NÃO promovido → incompleto (motivo específico).
    if (looksLikeOldMobile) return { ok: false, reason: "incomplete_mobile" };
    // Fixo: assinante inicia 2–5 (barra números claramente inválidos).
    if (!FIXO_LEADING.has(local[0])) return { ok: false, reason: "invalid" };
    return { ok: true, canonical: `${ddd}${local}`, tipo: "fixo" };
  }

  return { ok: false, reason: "invalid" };
}

/**
 * Normalização ESTRITA — usada por validação e persistência do form.
 * Celular de 10 dígitos é INVÁLIDO (sem promoção). Fixo de 10 dígitos passa.
 */
export function normalizeBrPhone(raw: string): NormalizedPhone {
  return normalizeCore(raw, false);
}

/**
 * Variante com promoção do nono dígito — SÓ para o fallback de dedup contra
 * registros LEGADOS do banco (celular antigo gravado com 10 dígitos casa com um
 * novo cadastro de 11). NUNCA usar em validação/persistência de form: fabrica um
 * número diferente do digitado.
 */
export function normalizeBrPhoneLegacy(raw: string): NormalizedPhone {
  return normalizeCore(raw, true);
}

/**
 * Mensagem de erro pt-BR para um WhatsApp que não normaliza — FONTE ÚNICA da
 * mensagem, reusada pela validação server-side (validation.ts) e pelo feedback
 * imediato do ContactForm (client). Retorna `null` quando o número é válido.
 */
export function whatsappValidationError(raw: string): string | null {
  const norm = normalizeBrPhone(raw);
  if (norm.ok) return null;
  if (norm.reason === "incomplete_mobile") {
    return "Confira o número: celular tem 9 dígitos depois do DDD, ex.: (11) 98765-4321.";
  }
  return "Informe um WhatsApp válido com DDD, ex.: (11) 98765-4321.";
}
