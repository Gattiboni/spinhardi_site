/**
 * Helpers PUROS de métrica — importáveis por Client Component.
 *
 * A agregação em si vive em `metricas.ts`, que é `server-only` (fala com o
 * Supabase). O que precisa rodar na tela é só a aritmética do percentual, e ela
 * mora aqui pra a tela não puxar o módulo de banco junto.
 */

import { RASTREIO_ABERTURA } from "./config";

/**
 * Percentual com denominador explícito. `null` quando não há base — e `null`
 * vira travessão na tela, nunca "0%": não ter base e ter zero são coisas
 * diferentes, e confundir as duas é como se inventa fracasso.
 */
export function taxa(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return (numerador / denominador) * 100;
}

export type MetricaTaxa = "entrega" | "abertura" | "clique";

/** A métrica é medida? Hoje só abertura pode não ser (D105, `config.ts`). */
export function metricaMedida(metrica: MetricaTaxa): boolean {
  return metrica === "abertura" ? RASTREIO_ABERTURA : true;
}

/**
 * `taxa()` com a pergunta anterior: a métrica é medida? Não medida devolve
 * `null` MESMO com base, e a tela diz "Não medido". São dois `null` com
 * sentidos diferentes, por isso a tela pergunta `metricaMedida` antes de
 * decidir entre "Não medido" e o travessão de "sem base".
 */
export function taxaDe(
  metrica: MetricaTaxa,
  numerador: number,
  denominador: number,
): number | null {
  if (!metricaMedida(metrica)) return null;
  return taxa(numerador, denominador);
}
