"use client";

import Script from "next/script";
import { GA4_MEASUREMENT_ID, PRODUCTION_HOSTNAME } from "@/lib/consent/config";
import { useConsent } from "./ConsentProvider";

/**
 * GoogleAnalytics — carrega a tag do GA4 SÓ depois do Aceitar.
 *
 * Regra dura: com `consent` diferente de `"granted"`, nenhum byte sai pro
 * Google. Não há Consent Mode "denied", não há ping cookieless, o `<script>`
 * não entra no DOM. É o `next/script` que só é renderizado no ramo `granted`,
 * e esse ramo só existe no cliente: `consent` nasce `undefined` no servidor
 * (ver `ConsentProvider`), então o HTML servido nunca contém a tag nem o ID.
 *
 * `strategy="afterInteractive"`: injetado pelo cliente após a hidratação, nunca
 * no HTML. Montado no `(public)/layout.tsx`, dentro do `ConsentProvider`; o
 * admin fica fora.
 *
 * `debug_mode` liga quando o hostname não é o domínio público (localhost,
 * Preview `*.vercel.app`): os hits vão pro DebugView e o filtro "Developer
 * traffic" do GA4 (tarefa do usuário, na UI do GA4) os tira dos relatórios.
 * A comparação é feita no snippet, no navegador — nada de `window` no render.
 *
 * Sem `send_page_view: false` (o Enhanced measurement cuida de page_view,
 * scroll, outbound click e form_*), sem `anonymize_ip` (GA4 não guarda IP),
 * sem parâmetros de usuário.
 *
 * Revogação na mesma sessão: se o visitante aceita e depois clica em "Alterar
 * minha escolha" na política, este componente desmonta o `<Script>`, mas o
 * `gtag.js` já executado não é "descarregado" — não existe isso. A tag para de
 * receber eventos nossos (`trackEvent` continua achando `window.gtag`, mas o
 * Enhanced measurement segue vivo até a próxima navegação de página cheia,
 * que parte do zero e respeita a escolha nova). Aceitar de novo na mesma
 * página remonta o `<Script>`; o `next/script` deduplica por `id` e não
 * reexecuta, o que está certo: o `gtag` já está lá.
 */
export default function GoogleAnalytics() {
  const { consent } = useConsent();

  if (!GA4_MEASUREMENT_ID || consent?.analytics !== "granted") return null;

  return (
    <>
      <Script
        id="ga4-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', ${JSON.stringify(GA4_MEASUREMENT_ID)}, { debug_mode: window.location.hostname !== ${JSON.stringify(PRODUCTION_HOSTNAME)} });`}
      </Script>
    </>
  );
}
