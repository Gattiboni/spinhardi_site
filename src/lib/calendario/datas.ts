/**
 * Datas do calendário — aritmética sobre `YYYY-MM-DD`, sem fuso inventado.
 *
 * A RPC devolve `date` e `time` puros (sem timezone). Passar essas strings por
 * `new Date("2026-08-14")` as interpretaria como MEIA-NOITE UTC, e todo browser
 * a oeste de Greenwich renderizaria o dia anterior. Por isso:
 *
 *  • a unidade de trabalho é a STRING `YYYY-MM-DD`, nunca um `Date`;
 *  • quando um `Date` é inevitável (dia da semana, montagem da grade), ele nasce
 *    de `paraData()`, que ancora ao MEIO-DIA LOCAL — 12h de folga pra cada lado
 *    absorvem qualquer DST sem virar o dia;
 *  • `paraISO()` lê os componentes LOCAIS do `Date` (nunca `toISOString()`, que
 *    é UTC e traria o bug de volta pela porta dos fundos).
 *
 * `hojeEmSaoPaulo()` é o único ponto que decide "que dia é hoje": roda no
 * SERVIDOR e desce como prop pra toda a árvore. Sem isso, servidor (Vercel, UTC)
 * e browser (BRT) discordariam do "hoje" entre 21h e meia-noite — e "hoje" aqui
 * não é decoração: é o que define seção Hoje, corte de Atrasadas e contagem de
 * dias de atraso. Fixar em `America/Sao_Paulo` não é converter fuso de evento
 * (isso é ponto de extensão do C7): é declarar o fuso da operação, que é uma
 * agência brasileira.
 */

/** Data no formato `YYYY-MM-DD` — a unidade de trabalho do módulo. */
export type DataISO = string;

/** Hora no formato `HH:MM:SS` (como a RPC devolve) ou `HH:MM`. */
export type HoraISO = string;

export const DIAS_SEMANA_CURTO = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."] as const;

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/**
 * "Hoje" no fuso da operação. Chamar no servidor e passar adiante — ver docblock.
 * `en-CA` é o truque padrão pra obter `YYYY-MM-DD` já formatado pelo Intl.
 */
export function hojeEmSaoPaulo(): DataISO {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `Date` ancorado ao meio-dia local — só pra cálculo, nunca pra exibição direta. */
export function paraData(iso: DataISO): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

/** Componentes LOCAIS do `Date` → `YYYY-MM-DD`. Nunca `toISOString()`. */
export function paraISO(d: Date): DataISO {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function somaDias(iso: DataISO, dias: number): DataISO {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

export function somaMeses(iso: DataISO, meses: number): DataISO {
  const d = paraData(iso);
  const diaOriginal = d.getDate();
  d.setDate(1); // evita 31/jan + 1 mês virar 03/mar
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDia));
  return paraISO(d);
}

/** Diferença em dias inteiros (b − a). Ambos ancorados ao meio-dia, então é exato. */
export function diffDias(a: DataISO, b: DataISO): number {
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / 86400000);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: DataISO): number {
  return paraData(iso).getDay();
}

/** Domingo da semana que contém `iso`. */
export function inicioDaSemana(iso: DataISO): DataISO {
  return somaDias(iso, -diaDaSemana(iso));
}

/** Primeiro dia do mês de `iso`. */
export function inicioDoMes(iso: DataISO): DataISO {
  const d = paraData(iso);
  return paraISO(new Date(d.getFullYear(), d.getMonth(), 1, 12));
}

/**
 * Grade do mês: 6 semanas × 7 dias a partir do domingo anterior ao dia 1.
 *
 * É o range que a visão Mês PEDE À RPC — não o mês civil. As células de borda
 * (fim do mês anterior, começo do seguinte) são renderizadas esmaecidas mas
 * precisam dos eventos delas, e é essa a "margem pras células de borda" do
 * enunciado. 42 dias fixos mantêm a altura da grade estável entre meses.
 */
export function gradeDoMes(iso: DataISO): { inicio: DataISO; fim: DataISO; dias: DataISO[] } {
  const inicio = inicioDaSemana(inicioDoMes(iso));
  const dias = Array.from({ length: 42 }, (_, i) => somaDias(inicio, i));
  return { inicio, fim: dias[41], dias };
}

/** Os 7 dias da semana de `iso`, domingo → sábado. */
export function diasDaSemana(iso: DataISO): DataISO[] {
  const inicio = inicioDaSemana(iso);
  return Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
}

// ─────────────────────────────────────────────────────────────────
// Exibição (pt-BR)
// ─────────────────────────────────────────────────────────────────

/** `2026-08-14` → `14/8`. */
export function formatarDiaMes(iso: DataISO): string {
  const d = paraData(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** `2026-08-14` → `sex. 14/8`. */
export function formatarDiaSemanaCurto(iso: DataISO): string {
  return `${DIAS_SEMANA_CURTO[diaDaSemana(iso)]} ${formatarDiaMes(iso)}`;
}

/** `2026-08-14` → `sexta, 14 de agosto de 2026`. */
export function formatarPorExtenso(iso: DataISO): string {
  const d = paraData(iso);
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(d);
  return `${semana}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** `2026-08-14` → `agosto de 2026`. */
export function formatarMesAno(iso: DataISO): string {
  const d = paraData(iso);
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * `12:00:00` → `12:00`. A RPC devolve `time` com segundos (TRAP catalogada no
 * contrato C4 pra `tarefa_iddas`); nenhum lugar da UI mostra segundos.
 */
export function formatarHora(hora: HoraISO | null): string | null {
  if (!hora) return null;
  const m = hora.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : hora;
}

/** Aceita `14:30`, `1430`, `14h30`, `9:5` → `14:30:00`; inválido vira `null`. */
export function normalizarHoraDigitada(bruta: string): HoraISO | null {
  const limpa = bruta.trim();
  if (!limpa) return null;
  const m = limpa.match(/^(\d{1,2})\s*[:hH.]?\s*(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

/** `YYYY-MM-DD` sintaticamente válida E existente no calendário (rejeita 31/02). */
export function ehDataISOValida(valor: unknown): valor is DataISO {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(ano, mes, 0).getDate();
}
