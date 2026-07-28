"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Toast — primitivo 01 da folha de componentes v1. Substitui `alert()`.
 *
 * Decisões da folha implementadas como escritas:
 *  • Três variantes (D8 cortou "atenção"): sucesso, erro, informação.
 *  • Durações: sucesso 4000ms · informação 5000ms · erro NÃO expira · qualquer
 *    toast com ação 8000ms. Erro com ação continua infinito — erro persiste é a
 *    regra mais forte (D5), e um erro que some sozinho com botão dentro é pior
 *    que um erro parado na tela.
 *  • Hover/foco pausa o timer; ao sair, reinicia do ZERO em vez de retomar (D6).
 *  • Teto de 3 simultâneos; o quarto empurra o mais antigo pra fora na hora.
 *    Toasts anteriores perdem opacidade e sombra, nunca escala.
 *  • Posição: inferior direito 24px no desktop (empilhando pra cima); topo,
 *    largura total menos 16px de cada lado, abaixo do header, no mobile (D2).
 *  • Largura min 320px · max 420px. Duas linhas de mensagem é o teto.
 *  • Esc dispensa o mais recente quando o foco está no documento — desde que não
 *    haja modal aberto (lá o Esc é do modal; ver `data-modal-open`).
 *  • Erro (D1): único toast com fundo sólido, por inversão de peso, sem vermelho.
 *    A cor vem de `feedback-error-*` — trocar o token troca aqui junto.
 *
 * DESVIO DOCUMENTADO (acessibilidade). A folha pede "uma região role=status
 * polite pros não-erros e uma role=alert assertive só pro erro". Implementado
 * como DUAS regiões persistentes e visualmente escondidas que recebem o TEXTO do
 * toast, com a pilha visual num `<ol>` comum. Motivo: região ao vivo criada no
 * mesmo instante em que ganha conteúdo é anunciada de forma não confiável —
 * exatamente o problema que a folha cita pra justificar duas regiões. Assim as
 * duas existem desde o mount, os dois níveis ficam separados como pedido, e os
 * botões (dispensar/ação) seguem no fluxo normal de foco.
 */

export type ToastVariant = "sucesso" | "erro" | "informacao";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastInput = {
  /** Default: "informacao". */
  variant?: ToastVariant;
  /** Mensagem. Não cabe em duas linhas? Não é toast, é estado na tela. */
  mensagem: string;
  /** Máximo 2. Toast com ação nunca dura menos de 8s. */
  acoes?: ToastAction[];
};

type ToastItem = ToastInput & {
  id: number;
  variant: ToastVariant;
  /** Incrementa a cada "reiniciar do zero" (saída de hover/foco). */
  run: number;
  saindo: boolean;
};

const TETO_SIMULTANEOS = 3;
const MAX_ACOES = 2;

/** ms de vida por variante; `null` = não expira. */
const DURACAO: Record<ToastVariant, number | null> = {
  sucesso: 4000,
  informacao: 5000,
  erro: null,
};

const DURACAO_COM_ACAO = 8000;
const DURACAO_SAIDA = 140; // casa com anim-toast-out

function duracaoDe(t: ToastItem): number | null {
  if (t.variant === "erro") return null; // D5: erro sempre persiste
  const base = DURACAO[t.variant];
  if (base === null) return null;
  return t.acoes && t.acoes.length > 0 ? DURACAO_COM_ACAO : base;
}

type ToastContextValue = {
  /** Empurra um toast. Retorna o id (pra dispensar na mão, se precisar). */
  toast: (input: ToastInput) => number;
  /** Atalhos — o caso comum é uma linha só. */
  sucesso: (mensagem: string, acoes?: ToastAction[]) => number;
  erro: (mensagem: string, acoes?: ToastAction[]) => number;
  info: (mensagem: string, acoes?: ToastAction[]) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook de uso. Fora do provider ele NÃO quebra a tela: devolve um dublê que só
 * loga. Um componente compartilhado (ex: bloco de anexos) pode ser montado em
 * página que ainda não tem provider, e derrubar a página por causa de um aviso
 * é pior que perder o aviso.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  const noop = (mensagem: string) => {
    console.warn("[Toast] fora do ToastProvider:", mensagem);
    return -1;
  };
  return {
    toast: (input) => noop(input.mensagem),
    sucesso: noop,
    erro: noop,
    info: noop,
    dismiss: () => {},
  };
}

// ─────────────────────────────────────────────────────────────────
// Aparência por variante
// ─────────────────────────────────────────────────────────────────

const ICONE: Record<ToastVariant, string> = {
  sucesso: "✓",
  erro: "!",
  informacao: "i",
};

type Aparencia = {
  painel: string;
  icone: string;
  texto: string;
  barra: string;
  botao: string;
};

const APARENCIA: Record<ToastVariant, Aparencia> = {
  sucesso: {
    painel: "bg-success-bg border border-success-border",
    icone: "text-green",
    texto: "text-dark",
    barra: "bg-green",
    botao: "text-green hover:bg-green/10",
  },
  informacao: {
    painel: "bg-surface border border-border-soft",
    icone: "text-navy",
    texto: "text-dark",
    barra: "bg-navy",
    botao: "text-navy hover:bg-navy/10",
  },
  // Único toast com fundo sólido (D1). Branco sobre navy = 14,1:1.
  erro: {
    painel: "bg-feedback-error-bg",
    icone: "text-feedback-error-accent",
    texto: "text-feedback-error-fg",
    barra: "bg-feedback-error-accent",
    botao: "text-feedback-error-fg hover:bg-accent-soft/20",
  },
};

// ─────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const [anunciopolite, setAnuncioPolite] = useState("");
  const [anuncioAssertivo, setAnuncioAssertivo] = useState("");
  const proximoId = useRef(1);

  const dismiss = useCallback((id: number) => {
    // Marca saindo (anima 140ms) e só então remove do array.
    setItens((prev) => prev.map((t) => (t.id === id ? { ...t, saindo: true } : t)));
    setTimeout(() => {
      setItens((prev) => prev.filter((t) => t.id !== id));
    }, DURACAO_SAIDA);
  }, []);

  const toast = useCallback((input: ToastInput): number => {
    const id = proximoId.current++;
    const variant = input.variant ?? "informacao";
    const acoes = input.acoes?.slice(0, MAX_ACOES);

    setItens((prev) => {
      // Teto de 3: o quarto entra empurrando o mais antigo pra fora na hora
      // (sem animação de saída — a folha diz "imediatamente").
      const base = prev.length >= TETO_SIMULTANEOS ? prev.slice(1) : prev;
      return [...base, { ...input, acoes, variant, id, run: 0, saindo: false }];
    });

    // Anúncio pro leitor de tela na região do nível certo.
    if (variant === "erro") setAnuncioAssertivo(input.mensagem);
    else setAnuncioPolite(input.mensagem);

    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      sucesso: (mensagem, acoes) => toast({ variant: "sucesso", mensagem, acoes }),
      erro: (mensagem, acoes) => toast({ variant: "erro", mensagem, acoes }),
      info: (mensagem, acoes) => toast({ variant: "informacao", mensagem, acoes }),
      dismiss,
    }),
    [toast, dismiss],
  );

  // Esc dispensa o mais recente. Só quando não há modal aberto: lá o Esc
  // pertence ao modal (e ele marca `data-modal-open` no <html> enquanto vive).
  useEffect(() => {
    if (itens.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.documentElement.hasAttribute("data-modal-open")) return;
      setItens((prev) => {
        const vivos = prev.filter((t) => !t.saindo);
        if (vivos.length === 0) return prev;
        const alvo = vivos[vivos.length - 1];
        setTimeout(() => dismiss(alvo.id), 0);
        return prev;
      });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [itens.length, dismiss]);

  const reiniciar = useCallback((id: number) => {
    setItens((prev) => prev.map((t) => (t.id === id ? { ...t, run: t.run + 1 } : t)));
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Regiões ao vivo persistentes — ver docblock. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {anunciopolite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {anuncioAssertivo}
      </div>

      <ol
        data-testid="toast-stack"
        className={[
          "fixed z-60 flex gap-3 pointer-events-none",
          // Mobile: topo, abaixo do header (4rem), 16px de folga lateral.
          // O mais recente entra por cima → ordem visual invertida.
          "top-18 left-4 right-4 flex-col-reverse",
          // Desktop: canto inferior direito, 24px das bordas, empilhando pra cima.
          "sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 sm:flex-col sm:items-end",
        ].join(" ")}
      >
        {itens.map((t, i) => (
          <ToastCard
            key={t.id}
            item={t}
            /* Só o mais recente fica em peso cheio; os anteriores perdem
               opacidade e sombra (nunca escala). */
            atenuado={i < itens.length - 1}
            onDismiss={() => dismiss(t.id)}
            onReiniciar={() => reiniciar(t.id)}
          />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────

function ToastCard({
  item,
  atenuado,
  onDismiss,
  onReiniciar,
}: {
  item: ToastItem;
  atenuado: boolean;
  onDismiss: () => void;
  onReiniciar: () => void;
}) {
  const [pausado, setPausado] = useState(false);
  const ap = APARENCIA[item.variant];
  const duracao = duracaoDe(item);

  // Timer de vida. Recria a cada `run` (reinício do zero) e a cada pausa —
  // é assim que "sair do hover reinicia a contagem completa" (D6) sai de graça.
  useEffect(() => {
    if (duracao === null || pausado || item.saindo) return;
    const t = setTimeout(onDismiss, duracao);
    return () => clearTimeout(t);
  }, [duracao, pausado, item.saindo, item.run, onDismiss]);

  const pausar = () => setPausado(true);
  const retomar = () => {
    setPausado(false);
    onReiniciar(); // reinicia do zero, não retoma
  };

  return (
    <li
      data-testid="toast"
      data-variant={item.variant}
      onMouseEnter={pausar}
      onMouseLeave={retomar}
      onFocus={pausar}
      onBlur={retomar}
      className={[
        "pointer-events-auto w-full sm:w-auto sm:min-w-80 sm:max-w-105",
        "rounded-md overflow-hidden",
        item.saindo ? "anim-toast-out" : "anim-toast-in-top sm:anim-toast-in",
        atenuado ? "opacity-70" : "shadow-toast",
        ap.painel,
      ].join(" ")}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          aria-hidden="true"
          className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-body font-semibold ${ap.icone} border-current`}
        >
          {ICONE[item.variant]}
        </span>

        <div className="min-w-0 flex-1">
          <p className={`font-body text-sm leading-5 line-clamp-2 ${ap.texto}`}>{item.mensagem}</p>

          {item.acoes && item.acoes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.acoes.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    a.onClick();
                    onDismiss();
                  }}
                  className={`min-h-7.5 px-3 rounded-sm font-body text-xs font-semibold focus-ring transition-colors duration-short ${ap.botao}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          data-testid="toast-dismiss"
          className={`shrink-0 w-6 h-6 rounded-sm flex items-center justify-center font-body text-sm focus-ring transition-colors duration-short ${ap.botao}`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {/* Barra de tempo restante (3px, cor do ícone). É ela que torna a pausa
          no hover perceptível. Só existe quando o toast expira. */}
      {duracao !== null && !item.saindo && (
        <div
          key={item.run}
          aria-hidden="true"
          className={`h-0.75 origin-left ${ap.barra}`}
          style={{
            animation: `toast-barra ${duracao}ms linear forwards`,
            animationPlayState: pausado ? "paused" : "running",
          }}
        />
      )}
    </li>
  );
}
