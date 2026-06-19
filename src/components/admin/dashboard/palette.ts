/**
 * Tokens Spinhardi em hex pros gráficos (recharts precisa de cor literal, não
 * classe Tailwind). Navy/gold/verde-pinheiro da identidade visual. A escala
 * verde numérica é OK aqui porque é admin (estado de UI).
 */
export const SPIN = {
  navy: "#1A2B4A",
  gold: "#AD8330",
  verde: "#3F5B30",
  // tons auxiliares pros eixos/grid (derivados do navy com baixa opacidade).
  grid: "#1A2B4A1a",
  axis: "#1A2B4A99",
} as const;

export const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
