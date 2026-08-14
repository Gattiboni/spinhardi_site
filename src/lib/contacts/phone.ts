/**
 * Telefone BR — FONTE ÚNICA das DUAS formas que o sistema usa.
 *
 * São duas, e tratá-las como uma só foi o bug consertado no lote three-way (M8):
 *
 * 1. ARMAZENAMENTO — o que vai pra `contacts.whatsapp`. Só dígitos, COM o DDI:
 *    "5511983340441". É o formato da base INTEIRA: o que o sync das origens
 *    grava, o que a ficha grava, o que a migration de canonicalização de
 *    13/08/2026 aplicou nos registros manuais que estavam sem o prefixo, e o que
 *    a `promote_contacts_from_bronze` v2 (M5 do contrato three-way) casa por
 *    IGUALDADE ao promover bronze→contacts. Internacional (12–13 dígitos) fica
 *    como veio. Produzido por `toStoragePhone` — e SÓ por ele.
 *
 * 2. COMPARAÇÃO — nunca persistida. Só dígitos, com DDD, SEM o DDI:
 *    "11983340441" (o campo `canonical`). Serve pra validar o que o humano
 *    digitou e pra decidir se dois números são a mesma pessoa tolerando formato
 *    misto dos dois lados. Produzido por `normalizeBrPhone` /
 *    `normalizeBrPhoneLegacy`.
 *
 * Até 13/08/2026 este docblock declarava a forma 2 como "o canônico persistível".
 * Era o único elemento do sistema dizendo isso — banco, sync, ficha e RPC sempre
 * foram com-55 — e por causa disso a captura do site e o cadastro manual gravavam
 * fora do padrão da base. Não reinverta: comparação sem 55, armazenamento com 55.
 *
 * Consumido por:
 *   - validação server-side  → validation.ts + actions do back-office
 *                              (via `whatsappValidationError`) ......... forma 2
 *   - dedup                  → contacts/index.ts (`phoneKeys`) ......... forma 2
 *   - persistência           → from-form.ts (captura do site e cadastro
 *                              manual) + edit-validation.ts (ficha) .... forma 1
 *
 * Regras da forma de comparação (ANATEL):
 *   - tira tudo que não é dígito;
 *   - remove o DDI 55 quando presente (12–13 dígitos começando com 55 — só aí,
 *     pra não confundir com o DDD 55 de Santa Maria/RS);
 *   - DDD válido: 11–99 (rejeita 0x e 10);
 *   - celular (11 díg) precisa ter o 9 logo após o DDD;
 *   - fixo: 10 dígitos → DDD (2) + assinante (8), assinante iniciando 2–5.
 * Fora dessas formas → inválido.
 *
 * PROMOÇÃO DO NONO DÍGITO (celular antigo de 10 díg → 11): NÃO acontece na
 * normalização estrita. Fabricar um 9 a partir de um número de 10 dígitos
 * transforma um typo ("119 8334 044", faltou um dígito) num "sucesso" que grava
 * um número DIFERENTE do digitado. Por isso a promoção vive só em
 * `normalizeBrPhoneLegacy`, usada EXCLUSIVAMENTE pelo fallback de dedup contra
 * registros legados do banco. O form (validação/persistência) nunca a liga.
 *
 * `toStoragePhone` também NÃO valida nem promove nada: reveste com o DDI e ponto.
 * Quem barra formato ruim é a validação, antes — recusar número na hora de gravar
 * é decisão de design de outra leva.
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
 * Normalização ESTRITA (forma de COMPARAÇÃO) — usada pela validação do form e
 * como etapa de limpeza antes do revestimento de `toStoragePhone`.
 * Celular de 10 dígitos é INVÁLIDO (sem promoção). Fixo de 10 dígitos passa.
 * O `canonical` que ela devolve NÃO é o que se grava — ver o topo do arquivo.
 */
export function normalizeBrPhone(raw: string): NormalizedPhone {
  return normalizeCore(raw, false);
}

/**
 * Forma de ARMAZENAMENTO da base: dígitos com o DDI 55. Regra ÚNICA do sistema —
 * a ficha (`edit-validation.ts`) e a captura/cadastro (`from-form.ts`) chamam
 * esta função, ninguém reimplementa.
 *
 * A decisão é SÓ por comprimento, e isso é proposital. Número nacional tem 10
 * dígitos (fixo: DDD + 8) ou 11 (celular: DDD + 9); número com DDI tem 12 ou 13.
 * As faixas não se intersectam, então 10–11 dígitos é impossível já estar
 * prefixado — duplo prefixo não existe nessa faixa. Testar `startsWith("55")`
 * aqui não evita nada e engole o prefixo de todo cliente do DDD 55 (Santa
 * Maria/RS e região), que viraria um 11 dígitos fora do padrão da base.
 * NÃO reintroduza esse teste.
 *
 * 12+ dígitos (internacional) → passa como veio, sem reformatar: mexer no formato
 * de quem já está no padrão é o que quebraria o match do sync com as origens.
 * Aceita entrada crua ou já reduzida a dígitos — o strip é idempotente.
 */
export function toStoragePhone(raw: string): string {
  const digitos = stripToDigits(raw);
  const nacional = digitos.length === 10 || digitos.length === 11;
  return nacional ? `55${digitos}` : digitos;
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
