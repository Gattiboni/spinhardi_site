/**
 * Formata uma data-só (YYYY-MM-DD) no padrão pt-BR DD/MM/AAAA, ex: "15/03/2026".
 *
 * Parse LOCAL, não UTC: `new Date("2026-06-18")` é lido como UTC meia-noite e,
 * ao formatar em horário de Brasil (UTC-3), volta pro dia anterior ("17/06"). Por
 * isso quebramos a string e montamos a data no fuso local com `new Date(y, m-1, d)`,
 * preservando o dia digitado. Vale pra qualquer data-só que passe por aqui.
 */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata um datetime ISO no padrão pt-BR curto com hora, ex: "07/06/2026 09h23".
 *
 * Usado nas telas de contato (criação, interações) onde a hora importa.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const data = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = date
    .toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(":", "h");
  return `${data} ${hora}`;
}

/**
 * Formata um datetime ISO no formato curto "dd/mm hh:mm", ex: "07/06 09:23", ou
 * "dd/mm/aa hh:mm" com `{ comAno: true }`.
 *
 * Sem ano por padrão: nasceu pra coluna de tabela (última edição), onde o espaço
 * é curto e o que importa é "quando foi mexido" recente. Na ficha o espaço sobra
 * e o ano evita ler uma edição de um ano atrás como se fosse de ontem — daí o
 * flag, em vez de um segundo formatador quase igual.
 *
 * Fuso FIXO em America/Sao_Paulo, diferente de `formatDateTime` acima: isto roda
 * num componente cliente que também renderiza no servidor (SSR). Sem fuso fixo o
 * servidor formataria em UTC e o browser em -03, e o texto divergiria na
 * hidratação. Fixando o fuso, os dois lados produzem a mesma string — e é o fuso
 * da operação de qualquer jeito.
 */
export function formatDateTimeShort(iso: string, opts?: { comAno?: boolean }): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    ...(opts?.comAno ? { year: "2-digit" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}
