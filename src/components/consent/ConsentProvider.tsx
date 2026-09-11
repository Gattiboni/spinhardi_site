"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CONSENT_STORAGE_KEY,
  clearConsent,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/consent";

/**
 * ConsentProvider — estado React da escolha de cookies, compartilhado por
 * `CookieBanner`, `GoogleAnalytics` e `CookiePreferenceButton`.
 *
 * Montado SÓ em `src/app/(public)/layout.tsx`. Nem no root layout nem no
 * admin: o painel interno não recebe banner nem tag, e o tráfego da equipe
 * nunca entra na propriedade do GA4.
 *
 * Estado exposto (`consent`):
 *  • `undefined` — ainda não leu o storage (SSR e o primeiro paint da
 *    hidratação). Quem consome não renderiza nada neste estado, pra não piscar.
 *  • `null` — nunca respondeu nesta versão da chave, ou expirou. Banner aparece.
 *  • `ConsentState` — a escolha vigente.
 *
 * Por que `useSyncExternalStore` e não `useEffect` + `useState`: o storage é
 * uma fonte externa de verdade. Com a store, o snapshot do servidor é
 * `undefined` (hidratação sem divergência), o do cliente é o valor real no
 * primeiro render pós-hidratação, e o evento `storage` sincroniza abas
 * (aceitou numa aba, o banner some na outra) sem effect nem setState. O
 * snapshot é a STRING crua do storage — primitivo, então estável entre
 * chamadas — e o `ConsentState` é derivado dela por `useMemo`.
 */

type ConsentContextValue = {
  consent: ConsentState | null | undefined;
  accept: () => void;
  decline: () => void;
  reset: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

// Ouvintes desta aba. O evento `storage` do navegador só dispara nas OUTRAS
// abas, então escrita local precisa avisar por aqui.
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** String crua do storage (`null` = sem registro ou storage indisponível). */
function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** No servidor (e na hidratação) ainda não sabemos: `undefined`. */
function getServerSnapshot(): undefined {
  return undefined;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // `raw` muda → relê pelo módulo (que valida e aplica a validade de 12 meses).
  const consent = useMemo<ConsentState | null | undefined>(
    () => (raw === undefined ? undefined : readConsent()),
    [raw],
  );

  const accept = useCallback(() => {
    writeConsent("granted");
    emit();
  }, []);

  const decline = useCallback(() => {
    writeConsent("denied");
    emit();
  }, []);

  // Revogação (seção 8 da política): apaga e volta pra `null`, o que faz o
  // banner reaparecer. Se a tag já carregou nesta página, ela não é
  // "descarregada" (impossível); ver docblock do `GoogleAnalytics`.
  const reset = useCallback(() => {
    clearConsent();
    emit();
  }, []);

  const value = useMemo(
    () => ({ consent, accept, decline, reset }),
    [consent, accept, decline, reset],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/**
 * Acesso ao consentimento. Fora do `ConsentProvider` lança: consumir isto no
 * root layout ou no admin é erro de montagem, não caso de uso a degradar.
 */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent() precisa estar dentro de <ConsentProvider> (layout público).");
  }
  return ctx;
}
