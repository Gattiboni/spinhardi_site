"use client";

import Button from "@/components/ui/Button";
import { GA4_MEASUREMENT_ID } from "@/lib/consent/config";
import { useConsent } from "./ConsentProvider";

/**
 * CookiePreferenceButton — o "revogar um consentimento" da seção 8 da política.
 *
 * Único pedaço client da página `/politica-de-privacidade` (Server Component).
 * Chama `reset()` do `ConsentProvider`: apaga a escolha gravada e o
 * `CookieBanner` reaparece no rodapé da viewport, onde o visitante escolhe de
 * novo. Sem `GA4_MEASUREMENT_ID` não renderiza: sem medição, não há escolha a
 * alterar (mesma constante que desliga banner e tag).
 *
 * `secondary` e `sm` de propósito: é uma ação de referência no meio de texto
 * corrido, não um CTA.
 */
export default function CookiePreferenceButton() {
  const { reset } = useConsent();

  if (!GA4_MEASUREMENT_ID) return null;

  return (
    <Button variant="secondary" size="sm" className="mt-6" onClick={reset}>
      Alterar minha escolha de cookies
    </Button>
  );
}
