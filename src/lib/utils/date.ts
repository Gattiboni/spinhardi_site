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
