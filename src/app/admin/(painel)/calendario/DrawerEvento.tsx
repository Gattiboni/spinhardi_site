"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  CATEGORIAS,
  META_POR_TIPO,
  categoriaDe,
  estaAtrasada,
  iconeDoEvento,
  origemDoEvento,
  TIPOS_TAREFA,
  type CalendarEvent,
  type Pessoa,
} from "@/lib/calendario/types";
import {
  diffDias,
  formatarDiaMes,
  formatarHora,
  formatarPorExtenso,
  type DataISO,
} from "@/lib/calendario/datas";
import FormTarefa, { horaParaTexto, paraInput, type ValoresTarefa } from "./FormTarefa";
import type { TarefaInput } from "./actions";

/**
 * Drawer lateral — o detalhe do evento NUNCA é navegação (contrato C6).
 *
 * O calendário é uma tela de varredura: sair dela pra ver um localizador e ter
 * que voltar, reencontrar o mês e reachar o dia é caro. O painel entra por cima,
 * mostra o que a `meta` daquele tipo carrega e sai — o contexto não se perde.
 *
 * A única navegação oferecida é deliberada: "Abrir contato", quando a cadeia
 * `orçamento → link externo → contato` resolveu no banco e existe pra onde ir.
 */

export default function DrawerEvento({
  ev,
  hoje,
  pessoas,
  pessoasPorId,
  usuario,
  salvando,
  onFechar,
  onAlternarConclusao,
  onSalvar,
  onPedirExclusao,
}: {
  ev: CalendarEvent;
  hoje: DataISO;
  pessoas: Pessoa[];
  pessoasPorId: Map<string, Pessoa>;
  usuario: { id: string; nome: string; ehAdmin: boolean };
  salvando: boolean;
  onFechar: () => void;
  onAlternarConclusao: (ev: CalendarEvent) => void;
  onSalvar: (id: string, input: TarefaInput) => Promise<string | null>;
  onPedirExclusao: (ev: CalendarEvent) => void;
}) {
  const cat = CATEGORIAS[categoriaDe(ev.eventType)];
  const atrasada = estaAtrasada(ev, hoje);
  const concluida = ev.concluida === true;
  const responsavel = ev.responsavelUserId ? pessoasPorId.get(ev.responsavelUserId) : null;
  const origem = origemDoEvento(ev);
  const tipoTarefa = typeof ev.meta.tipo === "number" ? TIPOS_TAREFA[ev.meta.tipo] : null;
  // Só a tarefa LOCAL abre formulário: `tarefa_iddas` é espelho read-only, e o
  // write-back no Iddas é ponto de extensão nomeado do C7, não deste lote.
  const editavelDeVerdade = ev.eventType === "tarefa";

  const [modo, setModo] = useState<"ver" | "editar">("ver");
  const [valores, setValores] = useState<ValoresTarefa | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const painelRef = useRef<HTMLElement>(null);
  const tituloId = useId();

  // Trocar de evento com o drawer aberto tem que voltar pro modo leitura, senão
  // o formulário do evento anterior continuaria montado sobre o novo. Quem
  // resolve isso é o `key={chaveEvento(ev)}` no chamador: outro evento é outro
  // componente, e remontar já É o reset — mesma postura do primitivo Modal, que
  // não monta o painel fechado justamente pra não precisar de efeito de limpeza.

  // Esc fecha e o foco entra no painel — o drawer nasce no padrão dos
  // primitivos porque o admin ainda não tem um painel lateral próprio.
  useEffect(() => {
    painelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  function abrirEdicao() {
    setValores({
      titulo: ev.titulo,
      descricao: typeof ev.meta.descricao === "string" ? ev.meta.descricao : "",
      data: ev.dataInicio,
      horaTexto: horaParaTexto(ev.horaInicio),
      tipo: typeof ev.meta.tipo === "number" ? ev.meta.tipo : null,
      responsavelId: ev.responsavelUserId ?? usuario.id,
      contato: ev.contactId
        ? { id: ev.contactId, nome: ev.clienteNome ?? "Contato vinculado" }
        : null,
      jornadaId: typeof ev.meta.jornada_id === "string" ? ev.meta.jornada_id : null,
    });
    setErroForm(null);
    setModo("editar");
  }

  async function salvar() {
    if (!valores) return;
    const erro = await onSalvar(ev.sourceId, paraInput(valores));
    if (erro) setErroForm(erro);
    else setModo("ver");
  }

  const linhasMeta = META_POR_TIPO[ev.eventType]
    .map(({ chave, rotulo }) => ({ rotulo, valor: formatarValorMeta(chave, ev.meta[chave]) }))
    .filter((l): l is { rotulo: string; valor: string } => l.valor !== null);

  return (
    <>
      <div
        onClick={onFechar}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-navy/20 anim-overlay-in"
      />

      <aside
        ref={painelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="fixed top-0 right-0 z-50 w-full sm:w-95 h-full overflow-y-auto bg-surface border-l border-border-soft shadow-modal p-5 anim-sheet-in sm:anim-modal-in focus:outline-none"
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="float-right w-8 h-8 rounded-md text-text-muted hover:bg-surface-app focus-ring"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-body text-[11.5px] font-semibold"
          style={{ backgroundColor: cat.cor }}
        >
          <span aria-hidden="true">{iconeDoEvento(ev)}</span>
          {cat.nome}
          {tipoTarefa && ` · ${tipoTarefa.nome}`}
          {!ev.editavel && " · 🔒 somente leitura"}
        </span>

        <h2
          id={tituloId}
          className={`mt-3 mb-3 font-display text-xl text-navy leading-snug ${concluida ? "line-through" : ""}`}
        >
          {ev.titulo}
        </h2>

        {modo === "editar" && valores ? (
          <FormTarefa
            valores={valores}
            onChange={setValores}
            pessoas={pessoas}
            usuario={usuario}
            erro={erroForm}
            salvando={salvando}
            onSubmit={salvar}
            onCancelar={() => setModo("ver")}
            rotuloSubmit="Salvar"
          />
        ) : (
          <>
            <dl className="grid gap-2 font-body text-[13px] text-text-muted">
              <Linha rotulo="📅 Quando">
                <b className="text-dark">{formatarPorExtenso(ev.dataInicio)}</b>
                {ev.horaInicio && (
                  <>
                    {" às "}
                    <b className="text-dark">{formatarHora(ev.horaInicio)}</b>
                  </>
                )}
                {ev.dataFim && ev.dataFim !== ev.dataInicio && (
                  <>
                    {" até "}
                    <b className="text-dark">{formatarDiaMes(ev.dataFim)}</b>
                  </>
                )}
              </Linha>

              {responsavel && (
                <Linha rotulo="👤 Responsável">
                  <b className="text-dark">{responsavel.nome}</b>
                </Linha>
              )}

              {ev.clienteNome && (
                <Linha rotulo="🧳 Cliente">
                  <b className="text-dark">{ev.clienteNome}</b>
                </Linha>
              )}

              {linhasMeta.map((l) => (
                <Linha key={l.rotulo} rotulo={l.rotulo}>
                  <b className="text-dark">{l.valor}</b>
                </Linha>
              ))}

              {atrasada && (
                <Linha rotulo="⚠ Atraso">
                  <b className="text-dark">{diffDias(ev.dataInicio, hoje)} dias</b>
                </Linha>
              )}
            </dl>

            {origem && (
              <p className="flex items-center gap-2 my-4 px-2.5 py-2 rounded-md bg-surface-app border border-border-soft font-body text-[11.5px] text-text-muted">
                <span aria-hidden="true">🔄</span>
                Sincronizado · <b className="text-dark">{origem}</b> · edição só na origem
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {ev.editavel && (
                <button
                  type="button"
                  onClick={() => onAlternarConclusao(ev)}
                  className="px-4 py-2 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short"
                >
                  {concluida ? "Reabrir" : "✓ Concluir"}
                </button>
              )}

              {editavelDeVerdade && (
                <>
                  <button
                    type="button"
                    onClick={abrirEdicao}
                    className="px-4 py-2 rounded-md border border-border-strong font-body text-sm text-dark hover:bg-surface-app focus-ring transition-colors duration-short"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onPedirExclusao(ev)}
                    className="px-4 py-2 rounded-md border border-border-strong font-body text-sm text-dark hover:bg-surface-app focus-ring transition-colors duration-short"
                  >
                    Excluir
                  </button>
                </>
              )}

              {ev.contactId && (
                <Link
                  href={`/admin/contatos/${ev.contactId}`}
                  className="px-4 py-2 rounded-md border-2 border-gold font-body text-sm font-medium text-gold hover:bg-gold hover:text-dark focus-ring transition-colors duration-medium"
                >
                  Abrir contato →
                </Link>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 w-30">{rotulo}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/**
 * Valor de `meta` em texto. A RPC devolve `date`/`time` crus dentro do jsonb —
 * `2026-08-17` e `11:35:00` — e mostrar isso ao usuário seria vazar o formato do
 * banco na tela. Aqui é só formatação de exibição, sem conversão de fuso.
 */
function formatarValorMeta(chave: string, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (chave === "idade" && typeof valor === "number") return `${valor} anos`;

  if (typeof valor === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarPorExtenso(valor);
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) return formatarHora(valor) ?? valor;
    return valor;
  }

  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  return null;
}
