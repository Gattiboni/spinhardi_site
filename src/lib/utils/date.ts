/**
 * Formata uma data ISO (YYYY-MM-DD) no padrão pt-BR curto, ex: "15 mar 2026".
 *
 * O `replace` remove o ponto que o `toLocaleDateString` adiciona após a
 * abreviação do mês ("mar." → "mar").
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");
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
