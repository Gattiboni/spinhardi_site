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
