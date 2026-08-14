"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ESTAGIO_LABELS } from "@/lib/contacts/types";
import {
  ESTAGIOS_KANBAN,
  ESTAGIOS_FECHADOS,
  DIAS_PARADO_ALERTA,
  diasParado,
  type EstagioJornada,
  type JornadaCard,
} from "@/lib/jornadas/types";
import { resolverTagsInternas, type TagInterna } from "@/lib/tags/shared";
import { TagInternaBadge } from "@/components/admin/TagBadge";
import {
  moverJornadaAction,
  marcarAprovadoAction,
  marcarReprovadoAction,
} from "./actions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(/\./g, "");
}

// Paginação dentro da coluna: as colunas fechadas (aprovado/reprovado) acumulam
// centenas de cards. Renderiza um lote por vez e cresce sob demanda ("carregar
// mais") — sem custo de servidor, só client-side slice.
const PAGE_SIZE = 50;

// Teto de badges de tag no card. A lista de contatos usa 3, mas o card do funil
// tem 288px e já carrega título, valor, nome, "dias parado" e follow-up: 2 + "+N"
// é o que cabe sem quebrar a densidade da coluna.
const TETO_TAGS_CARD = 2;

// Cabeçalho de cada coluna (cor combina com o StageBadge). Cobre os 5 estágios.
const COLUMN_STYLE: Record<EstagioJornada, { bar: string }> = {
  "primeiro contato": { bar: "#caa45d" },
  "cotação enviada": { bar: "#1d4ed8" },
  "pediu pra esperar": { bar: "#6b7280" },
  aprovado: { bar: "#15803d" },
  reprovado: { bar: "#b91c1c" },
};

// ─── Card ────────────────────────────────────────────────────────
// Click simples abre o detalhe; segurar e mover arrasta (drag nativo do HTML5 —
// um clique sem movimento NÃO dispara dragstart, então onClick = abrir e o drag
// fica pra quando há movimento). O kebab ⋯ (ganhar/perder) intercepta o clique
// pra não abrir nem arrastar.
function JornadaCardView({
  jornada,
  catalogoInterno,
  busy,
  fechado,
  onOpen,
  onDragStart,
  onGanhar,
  onPerder,
}: {
  jornada: JornadaCard;
  catalogoInterno: TagInterna[];
  busy: boolean;
  fechado: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onGanhar: () => void;
  onPerder: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const valor = jornada.valor != null && jornada.valor > 0 ? brl(jornada.valor) : null;
  const tarefa = jornada.proximaTarefa;
  const dias = diasParado(jornada.estagioAtualizadoEm);
  const parado = dias > DIAS_PARADO_ALERTA;
  const selo = fechado
    ? `${jornada.estagio === "aprovado" ? "Ganho" : "Perdido"} ${dataCurta(jornada.closedAt)}`
    : null;
  // Tags INTERNAS do contato vinculado — projeção read-only, mesmo vocabulário
  // (slug→nome/cor) e mesmo badge da lista de contatos. Órfã aparece em cinza.
  const tags = resolverTagsInternas(jornada.tagsInternas, catalogoInterno);
  const tagsSobrando = tags.length - TETO_TAGS_CARD;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!busy}
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative bg-white border border-dark/10 rounded-md p-4 shadow-sm transition-all duration-short ${
        busy ? "opacity-50" : "hover:border-gold cursor-grab active:cursor-grabbing"
      } ${fechado ? "opacity-75" : ""}`}
    >
      {/* Kebab ⋯ — ações de fechamento escondidas (só nos cards abertos) */}
      {!fechado && (
        <div className="absolute top-2 right-2" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            disabled={busy}
            aria-label="Ações da jornada"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="px-2 py-0.5 rounded text-dark/40 hover:text-dark hover:bg-dark/5 transition-colors duration-short"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-36 bg-white border border-dark/10 rounded-md shadow-md py-1 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onGanhar();
                }}
                className="block w-full text-left px-3 py-2 font-body text-sm text-green-700 hover:bg-green-50"
              >
                Marcar ganho
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onPerder();
                }}
                className="block w-full text-left px-3 py-2 font-body text-sm text-red-600 hover:bg-red-50"
              >
                Marcar perdido
              </button>
            </div>
          )}
        </div>
      )}

      <p className="font-body font-medium text-sm text-dark leading-snug line-clamp-2 pr-6">
        {jornada.tituloJornada ?? "Atendimento sem título"}
      </p>

      {valor && <p className="font-body text-xs font-semibold text-green-700 mt-1">{valor}</p>}

      {jornada.contatoNome && (
        <p className="font-body text-xs text-dark/50 mt-1 truncate">{jornada.contatoNome}</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {tags.slice(0, TETO_TAGS_CARD).map((t) => (
            <TagInternaBadge key={t.slug} nome={t.name} cor={t.cor} orfao={t.orfao} />
          ))}
          {tagsSobrando > 0 && (
            <span
              className="font-body text-xs text-dark/50"
              title={tags
                .slice(TETO_TAGS_CARD)
                .map((t) => t.name)
                .join(", ")}
            >
              +{tagsSobrando}
            </span>
          )}
        </div>
      )}

      {selo ? (
        <p className="mt-2 font-body text-xs text-dark/50">{selo}</p>
      ) : (
        <p className={`mt-2 font-body text-xs ${parado ? "text-red-600 font-medium" : "text-dark/40"}`}>
          {dias} dia{dias !== 1 ? "s" : ""} parado
        </p>
      )}

      {tarefa && (
        <p
          className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-body"
          title={tarefa.assunto ?? "Tarefa"}
        >
          📌 {dataCurta(tarefa.data)}
          {tarefa.assunto ? ` · ${tarefa.assunto}` : ""}
        </p>
      )}
    </div>
  );
}

// ─── Board ───────────────────────────────────────────────────────
export default function KanbanClient({
  jornadas,
  catalogoInterno,
}: {
  jornadas: JornadaCard[];
  catalogoInterno: TagInterna[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; estagio: EstagioJornada } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<EstagioJornada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Quantos cards exibir por coluna (cresce no "carregar mais"). Default PAGE_SIZE.
  const [limites, setLimites] = useState<Partial<Record<EstagioJornada, number>>>({});
  // Colunas recolhidas (faixa fina). Todas expandidas por padrão; não persiste.
  const [recolhidas, setRecolhidas] = useState<Partial<Record<EstagioJornada, boolean>>>({});

  const porEstagio = (estagio: EstagioJornada) => jornadas.filter((j) => j.estagio === estagio);
  const limiteDe = (estagio: EstagioJornada) => limites[estagio] ?? PAGE_SIZE;
  const verMais = (estagio: EstagioJornada) =>
    setLimites((l) => ({ ...l, [estagio]: (l[estagio] ?? PAGE_SIZE) + PAGE_SIZE }));
  const toggleRecolhida = (estagio: EstagioJornada) =>
    setRecolhidas((r) => ({ ...r, [estagio]: !r[estagio] }));

  const run = (id: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setErro(null);
    startTransition(async () => {
      const result = await fn();
      setBusyId(null);
      if (result.success) {
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível concluir a ação.");
      }
    });
  };

  const handleDrop = (estagio: EstagioJornada) => {
    setDragOverCol(null);
    const drag = dragging;
    setDragging(null);
    if (!drag || drag.estagio === estagio) return;

    const alvoFechado = (ESTAGIOS_FECHADOS as string[]).includes(estagio);
    const origemFechada = (ESTAGIOS_FECHADOS as string[]).includes(drag.estagio);

    if (alvoFechado) {
      // Soltar em aprovado/reprovado fecha a jornada (ou troca o desfecho).
      // Passa por fecharJornada (seta aberta=false + closed_at), nunca moverJornada.
      const fechar =
        estagio === "aprovado" ? marcarAprovadoAction : marcarReprovadoAction;
      run(drag.id, () => fechar(drag.id));
      return;
    }

    if (origemFechada) {
      // Reabrir uma jornada fechada (fechada → aberta) não é suportado no MVP:
      // moverJornada deixaria aberta=false + closed_at preenchido (estado torto).
      setErro("Reabrir jornada fechada ainda não é suportado — use a ficha do contato.");
      return;
    }

    run(drag.id, () => moverJornadaAction(drag.id, estagio));
  };

  return (
    <div>
      {erro && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200">
          <p className="font-body text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${ESTAGIOS_KANBAN.length * 304}px` }}>
          {ESTAGIOS_KANBAN.map((estagio) => {
            const items = porEstagio(estagio);
            const fechado = (ESTAGIOS_FECHADOS as string[]).includes(estagio);
            // Header: soma o valor único da jornada (cotação/ganho/perda por estágio).
            const total = items.reduce((s, j) => s + (j.valor ?? 0), 0);
            const style = COLUMN_STYLE[estagio];
            const isOver = dragOverCol === estagio;
            const limite = limiteDe(estagio);
            const visiveis = items.slice(0, limite);
            const restantes = items.length - visiveis.length;

            // Recolhida: faixa fina vertical com nome + contador; clica e expande.
            if (recolhidas[estagio]) {
              return (
                <button
                  key={estagio}
                  type="button"
                  onClick={() => toggleRecolhida(estagio)}
                  aria-label={`Expandir coluna ${ESTAGIO_LABELS[estagio]}`}
                  title={`Expandir ${ESTAGIO_LABELS[estagio]}`}
                  className="flex flex-col items-center gap-3 w-12 shrink-0 py-3 rounded-lg bg-dark/3 hover:bg-dark/5 transition-colors duration-short"
                  style={{ borderTop: `2px solid ${style.bar}` }}
                >
                  <span className="text-sm leading-none" style={{ color: style.bar }} aria-hidden="true">
                    ›
                  </span>
                  <span
                    className="font-body text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: style.bar, color: "#fff" }}
                  >
                    {items.length}
                  </span>
                  <span
                    className="mt-1 font-body font-semibold text-sm whitespace-nowrap"
                    style={{ color: style.bar, writingMode: "vertical-rl" }}
                  >
                    {ESTAGIO_LABELS[estagio]}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={estagio}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCol !== estagio) setDragOverCol(estagio);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === estagio ? null : c))}
                onDrop={() => handleDrop(estagio)}
                className={`flex flex-col w-72 shrink-0 rounded-lg overflow-hidden transition-colors duration-short ${
                  isOver ? "bg-gold/10 ring-2 ring-gold/40" : "bg-dark/3"
                }`}
              >
                <div
                  className="px-4 py-3"
                  style={{ backgroundColor: `${style.bar}20`, borderBottom: `2px solid ${style.bar}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-body font-semibold text-sm" style={{ color: style.bar }}>
                      {ESTAGIO_LABELS[estagio]}
                    </h2>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="font-body text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: style.bar, color: "#fff" }}
                      >
                        {items.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRecolhida(estagio)}
                        aria-label={`Recolher coluna ${ESTAGIO_LABELS[estagio]}`}
                        title="Recolher"
                        className="text-sm leading-none hover:opacity-60 transition-opacity duration-short"
                        style={{ color: style.bar }}
                      >
                        ‹
                      </button>
                    </div>
                  </div>
                  {total > 0 && <p className="font-body text-xs mt-1 text-dark/60">{brl(total)}</p>}
                </div>

                <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-18rem)]">
                  {items.length === 0 ? (
                    <p className="font-body text-xs text-dark/40 text-center py-6">
                      {fechado ? "Nenhuma jornada" : "Arraste uma jornada pra cá"}
                    </p>
                  ) : (
                    <>
                      {visiveis.map((j) => (
                        <JornadaCardView
                          key={j.id}
                          jornada={j}
                          catalogoInterno={catalogoInterno}
                          busy={pending && busyId === j.id}
                          fechado={fechado}
                          onOpen={() => router.push(`/admin/jornadas/${j.id}`)}
                          onDragStart={() => setDragging({ id: j.id, estagio })}
                          onGanhar={() => run(j.id, () => marcarAprovadoAction(j.id))}
                          onPerder={() => run(j.id, () => marcarReprovadoAction(j.id))}
                        />
                      ))}
                      {restantes > 0 && (
                        <button
                          type="button"
                          onClick={() => verMais(estagio)}
                          className="w-full font-body text-xs text-dark/60 hover:text-gold border border-dark/10 rounded-md py-2 transition-colors duration-short"
                        >
                          Carregar mais ({restantes})
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
