"use client";

import { useId, useState } from "react";

/**
 * Toggle — primitivo 04 da folha de componentes v1. 44×24, botão 20px.
 *
 * Regra de bolso pra escolher entre toggle e checkbox (da própria folha):
 * **se existe um botão Salvar na tela, é checkbox.** Toggle é pra efeito
 * imediato, sem Salvar; preferência ou estado ligado/desligado do sistema.
 *
 *  • Rótulo à esquerda, controle encostado à direita da linha. A LINHA INTEIRA
 *    alterna o estado; altura mínima 44px mesmo no desktop.
 *  • Texto auxiliar sempre ABAIXO do rótulo, nunca ao lado do controle, e entra
 *    em `aria-describedby`.
 *  • `<button role="switch" aria-checked>`, Espaço e Enter. O rótulo NÃO muda de
 *    texto ao ligar — só `aria-checked`.
 *  • Sem "Ligado/Desligado" escrito dentro do trilho: em 44px a fonte cairia
 *    abaixo de 11px e a paleta não tem contraste pra isso.
 *  • Desabilitado: trilho surface-selected, rótulo icon-muted, fora da ordem de
 *    tabulação, e o texto auxiliar SEMPRE explica por quê.
 *  • Otimista: muda na hora. Se `onChange` devolver erro, volta ao estado
 *    anterior com a mesma animação de 140ms — sem spinner dentro do controle.
 *    Quem mostra o toast de erro é o chamador (o toggle não conhece o Toast).
 */

export type ToggleProps = {
  checked: boolean;
  /** Devolve `false` pra reverter (gravação falhou). `void` = seguiu em frente. */
  onChange: (proximo: boolean) => void | boolean | Promise<void | boolean>;
  label: string;
  /** Obrigatório quando `disabled`: explica por que está desabilitado. */
  auxiliar?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

export default function Toggle({
  checked,
  onChange,
  label,
  auxiliar,
  disabled = false,
  "data-testid": testId,
}: ToggleProps) {
  // Estado otimista local: espelha `checked` até a gravação responder.
  const [otimista, setOtimista] = useState<boolean | null>(null);
  const ligado = otimista ?? checked;
  const auxiliarId = useId();

  const alternar = async () => {
    if (disabled) return;
    const proximo = !ligado;
    setOtimista(proximo);
    const resultado = await onChange(proximo);
    // `false` explícito = falhou, volta ao anterior. Qualquer outra coisa
    // (undefined/true) confia no `checked` que vem de fora.
    if (resultado === false) setOtimista(!proximo);
    else setOtimista(null);
  };

  return (
    <div
      onClick={alternar}
      className={[
        "flex items-center justify-between gap-6 min-h-11 py-2",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className={`font-body text-sm leading-5 ${disabled ? "text-icon-muted" : "text-dark"}`}>
          {label}
        </p>
        {auxiliar && (
          <p id={auxiliarId} className="font-body text-[13px] leading-5 text-text-muted mt-0.5">
            {auxiliar}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={label}
        aria-describedby={auxiliar ? auxiliarId : undefined}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        data-testid={testId}
        onClick={(e) => {
          e.stopPropagation(); // a linha já chama `alternar`
          alternar();
        }}
        className={[
          "relative shrink-0 w-11 h-6 rounded-full focus-ring-pill",
          "transition-colors duration-[140ms] ease-emphasis",
          disabled
            ? "bg-surface-selected cursor-not-allowed"
            : ligado
              ? "bg-gold"
              : "bg-icon-muted",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow-knob",
            "transition-transform duration-[140ms] ease-emphasis",
            ligado ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
