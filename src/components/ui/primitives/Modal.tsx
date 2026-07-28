"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Modal — primitivo 02 da folha de componentes v1. Três anatomias.
 *
 *  (a) `confirmacao`          440px · fecha com Esc e com clique no fundo
 *  (b) `destrutiva`           440px · NÃO fecha no fundo · régua navy 4px no topo
 *                             + filete ouro no primário (marcadores de risco, D1)
 *  (b·1) `confirmacao-digitada`  = (b) + campo que exige a palavra exata
 *  (c) `conteudo`             720px · cabeçalho e rodapé fixos, corpo rolável
 *                             (max-height 72vh, fundo surface-app)
 *
 * Regras implementadas como a folha escreve:
 *  • Foco inicial: (a)(b) no Cancelar (D7 — Enter reflexo não dispara ação);
 *    (b·1) no campo; (c) no cabeçalho (tabindex -1), pro leitor anunciar o
 *    título antes do conteúdo.
 *  • Foco preso no painel, ciclando; ao fechar volta EXATAMENTE pro elemento
 *    que abriu.
 *  • `overflow: hidden` no body com compensação da largura da barra de rolagem,
 *    pro layout não pular ao abrir.
 *  • Clique no fundo em (b)/(b·1): pulso de 120ms (escala 1 → 1.01 → 1) — o
 *    clique foi registrado e recusado.
 *  • Erro na ação primária NÃO fecha o modal: vira carregamento no botão e,
 *    ao falhar, uma faixa sólida acima do rodapé. O toast de erro não dispara
 *    (mensagem duplicada é ruído) — por isso `onConfirmar` devolve a mensagem
 *    em vez de o chamador tostar.
 *  • Um modal por vez. Nenhuma tela abre modal a partir de modal.
 *  • Mobile (D3): confirmação vira folha inferior (botões empilhados, 44px,
 *    primário em cima, sobe 240ms, arrastar pra baixo só fecha em variante não
 *    destrutiva); conteúdo grande vira tela cheia, sem overlay e sem raio.
 *
 * O atributo `data-modal-open` no <html> existe enquanto um modal vive: é como
 * o Toast sabe que o Esc não é dele.
 */

export type ModalVariant = "confirmacao" | "destrutiva" | "confirmacao-digitada" | "conteudo";

/** `null` = deu certo (fecha). String = mensagem de erro na faixa do rodapé. */
export type ConfirmResult = string | null;

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  variant?: ModalVariant;
  titulo: string;
  /** Corpo curto das variantes de confirmação; vira `aria-describedby`. */
  descricao?: string;
  /**
   * Corpo do modal. Na variante (c) é o conteúdo rolável; nas de confirmação é
   * o complemento da descrição (um select, um resumo). Fica abaixo da
   * `descricao` e acima do campo de (b·1).
   */
  children?: React.ReactNode;
  /** Rótulo do botão primário. Sem ele, o modal só tem Fechar (leitura). */
  primarioLabel?: string;
  /** Ação primária. Devolve `null` em sucesso ou a mensagem de erro. */
  onConfirmar?: () => Promise<ConfirmResult> | ConfirmResult;
  cancelarLabel?: string;
  /** (b·1) Palavra exigida. Sempre verbo em caixa alta: APAGAR, EXCLUIR… */
  palavraConfirmacao?: string;
  /** Rótulo do campo de (b·1). */
  palavraLabel?: string;
  "data-testid"?: string;
};

const LARGURA: Record<ModalVariant, string> = {
  confirmacao: "sm:max-w-110",
  destrutiva: "sm:max-w-110",
  "confirmacao-digitada": "sm:max-w-110",
  conteudo: "sm:max-w-180",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ehDestrutiva(v: ModalVariant): boolean {
  return v === "destrutiva" || v === "confirmacao-digitada";
}

/**
 * Casca: fechado NÃO monta o painel. É o que faz o estado interno (palavra
 * digitada, erro da tentativa anterior, carregando) zerar a cada abertura sem
 * um efeito de reset — remontar já é o reset.
 */
export default function Modal(props: ModalProps) {
  if (!props.open) return null;
  return <Painel {...props} />;
}

function Painel({
  onClose,
  variant = "confirmacao",
  titulo,
  descricao,
  children,
  primarioLabel,
  onConfirmar,
  cancelarLabel = "Cancelar",
  palavraConfirmacao,
  palavraLabel,
  "data-testid": testId,
}: ModalProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const cabecalhoRef = useRef<HTMLHeadingElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);

  const [palavra, setPalavra] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pulsando, setPulsando] = useState(false);
  const [arrasto, setArrasto] = useState(0);

  const tituloId = useId();
  const descricaoId = useId();
  const campoId = useId();

  const grande = variant === "conteudo";
  const destrutiva = ehDestrutiva(variant);
  const digitada = variant === "confirmacao-digitada";

  // Comparação exata, sensível a maiúsculas, aparadas as bordas.
  const palavraOk = !digitada || palavra.trim() === (palavraConfirmacao ?? "");
  const primarioBloqueado = carregando || !palavraOk;

  // ── Ciclo de vida: trava do body, foco inicial, foco de volta ────
  useEffect(() => {
    abridorRef.current = document.activeElement as HTMLElement | null;

    const html = document.documentElement;
    const body = document.body;
    const larguraBarra = window.innerWidth - html.clientWidth;
    const overflowAnterior = body.style.overflow;
    const paddingAnterior = body.style.paddingRight;

    body.style.overflow = "hidden";
    if (larguraBarra > 0) body.style.paddingRight = `${larguraBarra}px`;
    html.setAttribute("data-modal-open", "");

    // Foco inicial por variante (D7 e nota "onde o foco pousa").
    const alvo = digitada ? campoRef.current : grande ? cabecalhoRef.current : cancelarRef.current;
    // rAF: o painel acabou de montar; sem isso o focus pode cair antes do paint.
    const raf = requestAnimationFrame(() => alvo?.focus());

    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = overflowAnterior;
      body.style.paddingRight = paddingAnterior;
      html.removeAttribute("data-modal-open");
      abridorRef.current?.focus?.();
    };
  }, [digitada, grande]);

  const fechar = useCallback(() => {
    if (carregando) return; // não abandona ação em voo
    onClose();
  }, [carregando, onClose]);

  // ── Teclado: Esc fecha em TODAS as variantes; Tab fica preso ─────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
        return;
      }
      if (e.key !== "Tab") return;

      const painel = painelRef.current;
      if (!painel) return;
      const focaveis = Array.from(painel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;

      if (e.shiftKey && (ativo === primeiro || !painel.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [fechar]);

  const cliqueNoFundo = () => {
    if (destrutiva) {
      // Registrado e recusado: pulso de 120ms.
      setPulsando(true);
      setTimeout(() => setPulsando(false), 120);
      return;
    }
    fechar();
  };

  const confirmar = async () => {
    if (!onConfirmar || primarioBloqueado) return;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await onConfirmar();
      if (resultado) {
        setErro(resultado);
        setCarregando(false);
        return;
      }
      setCarregando(false);
      onClose();
    } catch (err) {
      console.error("[Modal] ação primária falhou:", err);
      setErro("Não foi possível concluir. Tente de novo.");
      setCarregando(false);
    }
  };

  // Arrastar pra baixo fecha — só em variante NÃO destrutiva, só no mobile
  // (o handler vive na alça, que só existe no sheet).
  const onArrastoInicio = (e: React.PointerEvent) => {
    if (destrutiva) return;
    const y0 = e.clientY;
    const alvo = e.currentTarget as HTMLElement;
    alvo.setPointerCapture(e.pointerId);

    const mover = (ev: PointerEvent) => setArrasto(Math.max(0, ev.clientY - y0));
    const soltar = (ev: PointerEvent) => {
      alvo.releasePointerCapture(ev.pointerId);
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      setArrasto((d) => {
        if (d > 80) fechar();
        return 0;
      });
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
  };

  const botaoBase =
    "inline-flex items-center justify-center rounded-md font-body text-sm font-semibold px-5 h-11 sm:h-9.5 focus-ring transition-colors duration-short";

  return (
    <div
      className="fixed inset-0 z-70 flex items-end sm:items-center sm:justify-center"
      data-testid={testId}
    >
      {/* Overlay navy 56%. No mobile a variante (c) é tela cheia SEM overlay. */}
      <div
        aria-hidden="true"
        onClick={cliqueNoFundo}
        className={["absolute inset-0 anim-overlay-in", grande ? "hidden sm:block" : "block"].join(
          " ",
        )}
        style={{ backgroundColor: "rgba(26, 43, 74, 0.56)" }}
      />

      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao ? descricaoId : undefined}
        style={arrasto ? { transform: `translateY(${arrasto}px)` } : undefined}
        className={[
          "relative w-full bg-surface flex flex-col shadow-modal",
          LARGURA[variant],
          // Mobile: (c) tela cheia sem raio; as outras, folha inferior.
          grande
            ? "h-full rounded-none sm:h-auto sm:rounded-modal sm:mx-6"
            : "rounded-t-modal anim-sheet-in sm:rounded-modal sm:mx-6 sm:anim-modal-in",
          grande ? "sm:anim-modal-in" : "",
          pulsando ? "anim-modal-reject" : "",
        ].join(" ")}
      >
        {/* (b) e (b·1): régua navy de 4px no topo — marcador de risco. */}
        {destrutiva && (
          <div
            aria-hidden="true"
            className="h-1 w-full bg-feedback-error-bg rounded-t-modal shrink-0"
          />
        )}

        {/* Alça da folha inferior (mobile, variantes de confirmação). */}
        {!grande && !destrutiva && (
          <div
            onPointerDown={onArrastoInicio}
            className="sm:hidden pt-3 pb-1 flex justify-center cursor-grab touch-none"
          >
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border-strong" />
          </div>
        )}

        {/* Cabeçalho */}
        <div
          className={[
            "flex items-start justify-between gap-4 px-6 pt-6 pb-4 shrink-0",
            grande ? "border-b border-border-soft" : "",
          ].join(" ")}
        >
          <h2
            ref={cabecalhoRef}
            id={tituloId}
            tabIndex={-1}
            className="font-display text-xl text-navy focus:outline-none"
          >
            {titulo}
          </h2>
          {grande && (
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="shrink-0 w-8 h-8 rounded-sm flex items-center justify-center text-text-muted hover:bg-surface-selected focus-ring transition-colors duration-short"
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        {/* Corpo */}
        <div
          className={[
            "px-6",
            grande
              ? "flex-1 overflow-y-auto bg-surface-app py-5 sm:max-h-[72vh]"
              : "pb-2 space-y-4",
          ].join(" ")}
        >
          {descricao && (
            <p id={descricaoId} className="font-body text-sm text-text-muted leading-5">
              {descricao}
            </p>
          )}

          {/* Corpo autoral. Na variante (c) é O conteúdo; nas de confirmação é
              o complemento da descrição (um select, um resumo) — sem ele a
              tela teria que abrir modal a partir de modal, que a folha proíbe. */}
          {children}

          {digitada && (
            <div>
              <label
                htmlFor={campoId}
                className="text-gold uppercase tracking-widest text-xs font-body mb-1 block"
              >
                {palavraLabel ?? `Digite ${palavraConfirmacao} pra confirmar`}
              </label>
              <input
                ref={campoRef}
                id={campoId}
                type="text"
                value={palavra}
                autoComplete="off"
                onChange={(e) => setPalavra(e.target.value)}
                data-testid="modal-palavra"
                className="w-full px-3 h-11 sm:h-9.5 border border-border-strong rounded-md font-body text-sm text-dark bg-surface focus-ring"
              />
            </div>
          )}
        </div>

        {/* Faixa de erro da ação primária — acima do rodapé, sólida (D1). */}
        {erro && (
          <div
            role="alert"
            data-testid="modal-erro"
            className="mx-6 mb-4 mt-2 px-4 py-3 rounded-md bg-feedback-error-bg text-feedback-error-fg font-body text-sm"
          >
            {erro}
          </div>
        )}

        {/* Rodapé */}
        <div
          className={[
            "px-6 pb-6 pt-2 shrink-0 gap-3",
            grande ? "border-t border-border-soft bg-surface pt-4 flex justify-end" : "",
            // Mobile: empilhado, primário EM CIMA. Desktop: em linha, primário à direita.
            !grande ? "flex flex-col-reverse sm:flex-row sm:justify-end" : "",
          ].join(" ")}
        >
          <button
            ref={cancelarRef}
            type="button"
            onClick={fechar}
            disabled={carregando}
            data-testid="modal-cancelar"
            className={`${botaoBase} border border-border-strong text-navy hover:bg-surface-selected disabled:text-text-disabled`}
          >
            {primarioLabel ? cancelarLabel : "Fechar"}
          </button>

          {primarioLabel && (
            <button
              type="button"
              onClick={confirmar}
              aria-disabled={primarioBloqueado}
              aria-describedby={digitada ? campoId : undefined}
              data-testid="modal-primario"
              className={[
                botaoBase,
                // Desabilitado fica aria-disabled (não `disabled`) pra continuar
                // focável e anunciável — folha, nota de (b·1).
                primarioBloqueado
                  ? "bg-surface-selected text-text-disabled cursor-not-allowed"
                  : destrutiva
                    ? "bg-feedback-error-bg text-feedback-error-fg hover:bg-primary-hover danger-inset"
                    : "bg-navy text-white hover:bg-primary-hover",
              ].join(" ")}
            >
              {carregando ? "Salvando…" : primarioLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
