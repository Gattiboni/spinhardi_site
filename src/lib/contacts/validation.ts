import "server-only";
import type { ContactFormInput } from "./from-form";
import { whatsappValidationError } from "./phone";

/**
 * Validação server-side da captura do site.
 *
 * O repo não tem lib de validação (nem zod) — segue o estilo explícito da casa
 * (mappers à mão, D029) com um validador de campo a campo em TS puro. Sem
 * dependência nova. Retorna a primeira mensagem amigável de erro (pt-BR) ou `ok`.
 *
 * Não valida os enums (destinoTipo, prazoIdeal, etc.): vêm de `<select>` fechado
 * e, se adulterados, as colunas/constraints do banco reprovam o insert. Aqui o
 * foco é o que o humano digita livre (nome, WhatsApp, e-mail, textos longos).
 */

const LIMITS = {
  nameMin: 2,
  nameMax: 120,
  emailMax: 160,
  destinoTextoMax: 500,
  observacaoMax: 2000,
  dataIdaMax: 10, // YYYY-MM-DD
} as const;

// E-mail "bom o suficiente": um @, um ponto no domínio, sem espaços.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campo do form ao qual o erro pertence — o consumidor (server action → form)
// usa isso pra renderizar a mensagem colada no campo certo (o erro do WhatsApp
// tem que aparecer no WhatsApp, o de e-mail no e-mail, etc.).
export type ValidationField =
  | "name"
  | "whatsapp"
  | "email"
  | "destinoTexto"
  | "observacao"
  | "dataIda";

export type ValidationResult =
  | { ok: true }
  | { ok: false; field: ValidationField; error: string };

export function validateSiteContact(data: ContactFormInput): ValidationResult {
  const name = data.name?.trim() ?? "";
  if (name.length < LIMITS.nameMin) {
    return { ok: false, field: "name", error: "Por favor, informe seu nome." };
  }
  if (name.length > LIMITS.nameMax) {
    return { ok: false, field: "name", error: "Nome muito longo." };
  }

  // WhatsApp: a normalização canônica BR estrita (fonte única) é o próprio
  // validador — celular de 10 dígitos é rejeitado como incompleto (nunca
  // "consertado"). A mensagem vem da mesma fonte que o feedback do client.
  const whatsappError = whatsappValidationError(data.whatsapp ?? "");
  if (whatsappError) {
    return { ok: false, field: "whatsapp", error: whatsappError };
  }

  const email = data.email?.trim() ?? "";
  if (email) {
    if (email.length > LIMITS.emailMax || !EMAIL_RE.test(email)) {
      return { ok: false, field: "email", error: "E-mail inválido." };
    }
  }

  if ((data.destinoTexto?.length ?? 0) > LIMITS.destinoTextoMax) {
    return { ok: false, field: "destinoTexto", error: "O texto do destino ficou muito longo." };
  }
  if ((data.observacao?.length ?? 0) > LIMITS.observacaoMax) {
    return { ok: false, field: "observacao", error: "A observação ficou muito longa." };
  }
  if ((data.dataIda?.length ?? 0) > LIMITS.dataIdaMax) {
    return { ok: false, field: "dataIda", error: "Data de ida inválida." };
  }

  return { ok: true };
}
