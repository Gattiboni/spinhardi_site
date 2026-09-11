"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { GA4_MEASUREMENT_ID } from "@/lib/consent/config";
import { useConsent } from "./ConsentProvider";

/**
 * CookieBanner — pede a autorização prometida na seção 6 da política.
 *
 * Renderiza SÓ quando há o que consentir (`GA4_MEASUREMENT_ID` setada) e a
 * escolha é `null` (nunca respondeu / expirou / revogou). Com `undefined`
 * (storage ainda não lido) não renderiza nada, pra não piscar na hidratação.
 *
 * Não é cookie wall: sem overlay, sem `aria-modal`, sem travar scroll. A página
 * segue inteira usável por trás. Os dois botões têm o mesmo peso (mesmo
 * tamanho, mesma altura, nenhum pré-selecionado ou com foco automático):
 * "Aceitar" é o `primary` e "Recusar" o `secondary` que já existem no `Button`.
 * O `secondary` tem `border-2`; pra igualar a altura, o `primary` recebe uma
 * borda da própria cor (`border-2 border-gold`), invisível sobre o fundo gold.
 *
 * Posição e empilhamento (decisão local, documentada):
 *  • Mobile: barra fixa no rodapé, largura total, `z-30`. O `BackToTop` é
 *    `z-40` no canto inferior direito, então ele flutua POR CIMA do banner —
 *    e os botões ficam alinhados à esquerda justamente pra não caírem embaixo
 *    dele. Nenhum dos dois esconde o outro.
 *  • Desktop (`sm+`): card no canto inferior ESQUERDO, largura máxima `max-w-md`
 *    (28rem). O `BackToTop` mora à direita; sem sobreposição em nenhuma largura
 *    a partir de 640px.
 *  • Header (`z-50`) e menu mobile (`z-60`) ficam acima: o menu aberto cobre o
 *    banner, como cobre o resto da página.
 */
export default function CookieBanner() {
  const { consent, accept, decline } = useConsent();

  if (!GA4_MEASUREMENT_ID || consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-dark/10 bg-white p-5 shadow-lg shadow-dark/10 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-md sm:rounded-md sm:border sm:p-6"
    >
      <p className="font-body text-sm leading-relaxed text-dark/80">
        A gente usa cookies pra medir a audiência do site e entender o que funciona. Você escolhe.
      </p>
      <p className="mt-2 font-body text-sm">
        <Link
          href="/politica-de-privacidade"
          className="text-gold underline underline-offset-4 transition-colors duration-short hover:text-navy"
        >
          Política de privacidade
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap justify-start gap-3">
        <Button variant="primary" size="sm" className="border-2 border-gold" onClick={accept}>
          Aceitar
        </Button>
        <Button variant="secondary" size="sm" onClick={decline}>
          Recusar
        </Button>
      </div>
    </div>
  );
}
