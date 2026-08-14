import {
  type CaptureOrigin,
  type DestinoTipo,
  type OrcamentoEstimado,
  type PerfilViajante,
  type PrazoIdeal,
  ORIGENS_OPTIONS,
  DESTINOS_OPTIONS,
  ORCAMENTOS_OPTIONS,
  PERFIS_OPTIONS,
  PRAZOS_OPTIONS,
} from "./types";
import { toStoragePhone } from "./phone";

/**
 * Validação + normalização dos campos editáveis na FICHA do contato (M1 do
 * contrato de ficha/docs/comunicação). FONTE ÚNICA das regras: o mesmo módulo é
 * chamado no client (feedback imediato, antes do roundtrip) e dentro da server
 * action (autoridade — server action é alcançável por POST direto, então a
 * validação do client não é garantia de nada).
 *
 * É lógica pura (sem I/O), por isso importável dos dois lados — mesmo princípio
 * de `phone.ts`.
 *
 * Os conjuntos de valores dos campos de Qualificação NÃO são declarados aqui:
 * vêm das listas de `types.ts` (`ORIGENS_OPTIONS` e cia), que são as mesmas que
 * o form de criação usa e batem 1:1 com os CHECK constraints da tabela
 * `contacts`. Nada de enum novo neste arquivo.
 */

export type EditResult<T> = { ok: true; value: T } | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function inSet<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

/**
 * Data no formato do `<input type="date">` (YYYY-MM-DD) E existente no calendário
 * — a regex sozinha aceitaria "2026-02-31". O round-trip em UTC derruba isso.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// ─────────────────────────────────────────────────────────────────
// Card "Dados"
// ─────────────────────────────────────────────────────────────────

// Tudo string: é o shape cru do formulário (inputs devolvem string).
export type DadosPessoaisForm = {
  name: string;
  whatsapp: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  cidade: string;
  estado: string;
  cep: string;
};

// Shape já normalizado, pronto pro patch de `contacts`.
export type DadosPessoaisPatch = {
  name: string;
  whatsapp: string;
  email: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

// Faixa de sanidade do WhatsApp em DÍGITOS. A base real vive COM o DDI: 13
// dígitos (55 + DDD + 9) em 799 registros, 12 em 78, 11 em um só.
const WHATSAPP_MIN_DIGITOS = 10;
const WHATSAPP_MAX_DIGITOS = 13;

const ANO_MINIMO_NASCIMENTO = 1900;

// Idade mínima do CONTATO. O contato é o comprador da viagem: assina contrato,
// paga e vai pro cadastro do Iddas — menor de 16 nessa posição é erro de
// digitação, quase sempre ano trocado. Acompanhantes menores entram como
// passageiros na Qualificação, não como contato, então a regra não os atinge.
//
// A mensagem devolvida NÃO cita idade de propósito: quem só errou o ano não
// precisa aprender a regra, e explicá-la na tela vira ruído.
const IDADE_MINIMA_ANOS = 16;

/**
 * Última data de nascimento que ainda dá a idade mínima HOJE. Sai da mesma
 * string de `hoje` que o resto da validação usa: dia e mês são preservados
 * intactos e só o ano recua, então quem faz aniversário hoje passa (idade
 * completa) e quem faz amanhã não. Comparação lexicográfica de ISO basta.
 */
function limiteNascimento(hoje: string): string {
  const [ano, mesDia] = [hoje.slice(0, 4), hoje.slice(4)];
  return `${Number(ano) - IDADE_MINIMA_ANOS}${mesDia}`;
}

/**
 * `current` entra só pra decidir se o WhatsApp MUDOU. Se não mudou, o valor
 * legado passa como está: contato importado com número fora do padrão não pode
 * ficar impossível de editar o e-mail. A checagem de formato vale pro que a
 * pessoa digita de novo.
 *
 * WhatsApp vazio é sempre recusado — a coluna é NOT NULL no banco (verificado em
 * produção; o tipo TS ainda diz `string | null`, ver relatório).
 */
export function normalizeDadosPessoais(
  input: DadosPessoaisForm,
  current: { whatsapp: string | null },
): EditResult<DadosPessoaisPatch> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "O nome não pode ficar vazio." };

  const digitados = onlyDigits(input.whatsapp);
  if (!digitados) return { ok: false, error: "O WhatsApp não pode ficar vazio." };

  const mudouWhatsapp = digitados !== onlyDigits(current.whatsapp);
  if (
    mudouWhatsapp &&
    (digitados.length < WHATSAPP_MIN_DIGITOS || digitados.length > WHATSAPP_MAX_DIGITOS)
  ) {
    return {
      ok: false,
      error: "Confira o WhatsApp: use DDD + número, ex.: 5511987654321 ou (11) 98765-4321.",
    };
  }

  // Faixa conferida sobre o que a pessoa digitou; o DDI entra depois (10–11
  // dígitos viram 12–13, dentro do que a base já usa). A regra do 55 mora em
  // `phone.ts` — mesma função que a captura e o cadastro manual usam.
  const whatsapp = toStoragePhone(digitados);

  const dataNascimento = blankToNull(input.dataNascimento);
  if (dataNascimento) {
    if (!isValidIsoDate(dataNascimento)) {
      return { ok: false, error: "Data de nascimento inválida." };
    }
    const hoje = new Date().toISOString().slice(0, 10);
    if (dataNascimento > hoje) {
      return { ok: false, error: "A data de nascimento não pode ser no futuro." };
    }
    if (Number(dataNascimento.slice(0, 4)) < ANO_MINIMO_NASCIMENTO) {
      return { ok: false, error: "Confira o ano da data de nascimento." };
    }
    if (dataNascimento > limiteNascimento(hoje)) {
      return { ok: false, error: "Data de nascimento inválida." };
    }
  }

  return {
    ok: true,
    value: {
      name,
      whatsapp,
      // E-mail sem validação forte, de propósito — mesmo padrão da edição rápida
      // da lista. Só trim, vazio vira null.
      email: blankToNull(input.email),
      cpf: blankToNull(input.cpf),
      dataNascimento,
      cidade: blankToNull(input.cidade),
      estado: blankToNull(input.estado),
      cep: blankToNull(input.cep),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Card "Qualificação"
// ─────────────────────────────────────────────────────────────────

export type QualificacaoForm = {
  origem: CaptureOrigin;
  origemDetalhe: string;
  destinoTipo: DestinoTipo;
  destinoTexto: string;
  prazoIdeal: PrazoIdeal;
  orcamentoEstimado: OrcamentoEstimado;
  perfilViajante: PerfilViajante;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;
};

export type QualificacaoPatch = {
  origem: CaptureOrigin;
  origemDetalhe: string | null;
  destinoTipo: DestinoTipo;
  destinoTexto: string | null;
  prazoIdeal: PrazoIdeal;
  orcamentoEstimado: OrcamentoEstimado;
  perfilViajante: PerfilViajante;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;
};

// Teto de sanidade dos contadores (o banco não tem CHECK; o form de criação usa
// min=1/min=0). Barra número negativo, fracionário e digitação acidental.
const PASSAGEIROS_MAX = 50;

function contagemValida(value: unknown, min: number): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= PASSAGEIROS_MAX
  );
}

/**
 * Campos internos do back-office (M1): editáveis livremente, o sync nunca os
 * toca. Cada select é conferido contra a lista de `types.ts` — valor fora dela
 * seria recusado pelo CHECK do banco com erro feio; aqui volta como mensagem.
 */
export function normalizeQualificacao(input: QualificacaoForm): EditResult<QualificacaoPatch> {
  if (!inSet(ORIGENS_OPTIONS, input.origem)) {
    return { ok: false, error: "Origem inválida." };
  }
  if (!inSet(DESTINOS_OPTIONS, input.destinoTipo)) {
    return { ok: false, error: "Destino inválido." };
  }
  if (!inSet(PRAZOS_OPTIONS, input.prazoIdeal)) {
    return { ok: false, error: "Prazo inválido." };
  }
  if (!inSet(ORCAMENTOS_OPTIONS, input.orcamentoEstimado)) {
    return { ok: false, error: "Orçamento inválido." };
  }
  if (!inSet(PERFIS_OPTIONS, input.perfilViajante)) {
    return { ok: false, error: "Perfil inválido." };
  }

  if (!contagemValida(input.passageirosAdultos, 1)) {
    return { ok: false, error: `Adultos: informe um número de 1 a ${PASSAGEIROS_MAX}.` };
  }
  if (!contagemValida(input.passageirosCriancas, 0)) {
    return { ok: false, error: `Crianças: informe um número de 0 a ${PASSAGEIROS_MAX}.` };
  }
  if (!contagemValida(input.passageirosBebes, 0)) {
    return { ok: false, error: `Bebês: informe um número de 0 a ${PASSAGEIROS_MAX}.` };
  }

  return {
    ok: true,
    value: {
      origem: input.origem,
      origemDetalhe: blankToNull(input.origemDetalhe),
      destinoTipo: input.destinoTipo,
      destinoTexto: blankToNull(input.destinoTexto),
      prazoIdeal: input.prazoIdeal,
      orcamentoEstimado: input.orcamentoEstimado,
      perfilViajante: input.perfilViajante,
      passageirosAdultos: input.passageirosAdultos,
      passageirosCriancas: input.passageirosCriancas,
      passageirosBebes: input.passageirosBebes,
    },
  };
}
