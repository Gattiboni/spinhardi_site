import PrimitivosShowcase from "./PrimitivosShowcase";

/**
 * Página privada de validação visual dos QUATRO PRIMITIVOS (folha v1).
 * Rota: /dev/primitivos — referência interna, irmã de /dev/components.
 *
 * Existe pra dois usos: conferência a olho de cada estado da folha, e alvo do
 * roteiro de teste do agente de navegador (todos os controles têm
 * `data-testid`). Não é página de produto, não entra em nav nem em sitemap.
 *
 * PLANO DE REVERSÃO: apagar a pasta `src/app/(public)/dev/primitivos/`. Nenhum
 * outro arquivo importa daqui.
 */
export const metadata = {
  title: "Primitivos · Dev",
  robots: { index: false, follow: false },
};

export default function DevPrimitivos() {
  return <PrimitivosShowcase />;
}
