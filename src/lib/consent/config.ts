/**
 * Configuração da medição de audiência (GA4) — lida em UM lugar só.
 *
 * `GA4_MEASUREMENT_ID` vem de `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (inlinada no
 * bundle do cliente em build). Sem ela: `null`, e TUDO que depende de medição
 * desliga junto — banner de cookies, loader da tag e botão de revogação na
 * política. Não há nada a consentir se não há nada a carregar. O valor real
 * (produção) nunca entra no repo: mora na Vercel, em todos os ambientes.
 *
 * `PRODUCTION_HOSTNAME` é literal de propósito, e NÃO derivado de `SITE_URL`:
 * `NEXT_PUBLIC_SITE_URL` é setada com o domínio canônico em todos os ambientes
 * da Vercel (é o que o `metadataBase` precisa), então derivar daria "produção"
 * também no Preview. Aqui a pergunta é outra: "este navegador está no domínio
 * público?" Se não está (localhost, `*.vercel.app`), a tag sobe com
 * `debug_mode: true`, que manda os hits pro DebugView e permite o filtro
 * "Developer traffic" no GA4 tirá-los dos relatórios.
 */

export const GA4_MEASUREMENT_ID: string | null =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || null;

export const PRODUCTION_HOSTNAME = "www.spinharditurismo.com.br";
