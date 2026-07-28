/**
 * Helpers PUROS de métrica — importáveis por Client Component.
 *
 * A agregação em si vive em `metricas.ts`, que é `server-only` (fala com o
 * Supabase). O que precisa rodar na tela é só a aritmética do percentual, e ela
 * mora aqui pra a tela não puxar o módulo de banco junto.
 */

/**
 * Percentual com denominador explícito. `null` quando não há base — e `null`
 * vira travessão na tela, nunca "0%": não ter base e ter zero são coisas
 * diferentes, e confundir as duas é como se inventa fracasso.
 */
export function taxa(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return (numerador / denominador) * 100;
}
