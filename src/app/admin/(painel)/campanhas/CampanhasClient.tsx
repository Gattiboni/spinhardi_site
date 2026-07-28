"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column } from "@/components/ui/primitives/DataTable";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import { formatDateTimeShort } from "@/lib/utils/date";
import {
  ESTADO_BADGE,
  TIPO_LABELS,
  TIPOS_OPTIONS,
  type Campanha,
  type CampanhaMetricas,
  type CampanhaTipo,
} from "@/lib/campanhas/types";
import { cancelarAgendamentoAction, criarCampanhaAction } from "./actions";

/**
 * Lista de campanhas.
 *
 * A "data relevante" muda com o estado de propósito — rascunho quer saber
 * quando foi mexido pela última vez, agendada quer saber pra quando, enviada
 * quer saber quando saiu. Uma coluna só, três significados, o rótulo em cima
 * de cada linha dizendo qual é.
 *
 * O resumo das enviadas é DERIVADO de eventos (V6). Rascunho não tem resumo
 * porque não tem o que resumir.
 */
export default function CampanhasClient({
  campanhas,
  metricas,
}: {
  campanhas: Campanha[];
  metricas: Record<string, CampanhaMetricas>;
}) {
  const router = useRouter();
  const toast = useToast();

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CampanhaTipo>("newsletter");
  const [cancelando, setCancelando] = useState<Campanha | null>(null);

  const dataRelevante = (c: Campanha): { rotulo: string; valor: string | null } => {
    switch (c.estado) {
      case "agendada":
        return { rotulo: "sai em", valor: c.agendadoPara };
      case "enviada":
        return { rotulo: "saiu em", valor: c.enviadoEm };
      case "testada":
        return { rotulo: "testada em", valor: c.testadoEm };
      default:
        return { rotulo: "mexida em", valor: c.updatedAt };
    }
  };

  const colunas: Column<Campanha>[] = [
    {
      key: "nome",
      header: "Campanha",
      sortValue: (c) => c.nomeInterno,
      render: (c) => <span className="font-medium text-navy">{c.nomeInterno}</span>,
    },
    {
      key: "tipo",
      header: "Tipo",
      escondidaNoMobile: true,
      sortValue: (c) => TIPO_LABELS[c.tipo],
      render: (c) => <span className="text-text-muted">{TIPO_LABELS[c.tipo]}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      sortValue: (c) => c.estado,
      render: (c) => {
        const b = ESTADO_BADGE[c.estado];
        return (
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-body text-xs ${b.classe}`}
            data-testid={`estado-${c.estado}`}
          >
            <span aria-hidden="true">{b.icone}</span>
            {b.label}
          </span>
        );
      },
    },
    {
      key: "data",
      header: "Quando",
      escondidaNoMobile: true,
      sortValue: (c) => Date.parse(dataRelevante(c).valor ?? "") || 0,
      render: (c) => {
        const d = dataRelevante(c);
        return d.valor ? (
          <span className="text-text-muted">
            {d.rotulo} {formatDateTimeShort(d.valor, { comAno: true })}
          </span>
        ) : (
          <span className="text-icon-muted">—</span>
        );
      },
    },
    {
      key: "resumo",
      header: "Resumo",
      escondidaNoMobile: true,
      render: (c) => {
        if (c.estado !== "enviada") return <span className="text-icon-muted">—</span>;
        const m = metricas[c.id];
        if (!m) return <span className="text-icon-muted">—</span>;
        return (
          <span className="text-text-muted tabular-nums text-xs">
            {m.destinatarios} enviados · {m.entregues} entregues · {m.abertos} abriram · {m.cliques}{" "}
            clicaram · {m.reclamacoes + m.bouncesHard} problemas
          </span>
        );
      },
    },
    {
      key: "acoes",
      header: "",
      render: (c) => {
        if (c.estado === "enviada") {
          return (
            <Link
              href={`/admin/campanhas/${c.id}/resultados`}
              className="font-body text-sm text-navy hover:text-gold transition-colors duration-short"
            >
              Ver resultados
            </Link>
          );
        }
        if (c.estado === "agendada") {
          return (
            <div className="flex items-center gap-3 justify-end">
              <Link
                href={`/admin/campanhas/${c.id}`}
                className="font-body text-sm text-navy hover:text-gold transition-colors duration-short"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => setCancelando(c)}
                data-testid="cancelar-agendamento"
                className="font-body text-sm text-text-muted hover:text-navy focus-ring rounded-sm"
              >
                Cancelar envio
              </button>
            </div>
          );
        }
        return (
          <Link
            href={`/admin/campanhas/${c.id}`}
            className="font-body text-sm text-navy hover:text-gold transition-colors duration-short"
          >
            Continuar
          </Link>
        );
      },
    },
  ];

  const criar = async () => {
    const r = await criarCampanhaAction(nome, tipo);
    if (!r.success) return r.error ?? "Não foi possível criar.";
    toast.sucesso("Campanha criada.");
    setNome("");
    if (r.id) router.push(`/admin/campanhas/${r.id}`);
    return null;
  };

  const cancelar = async () => {
    if (!cancelando) return null;
    const r = await cancelarAgendamentoAction(cancelando.id);
    if (!r.success) return r.error ?? "Não foi possível cancelar.";
    toast.sucesso("Agendamento cancelado. A campanha voltou pra testada.");
    router.refresh();
    return null;
  };

  const campo =
    "w-full px-3 h-10 border border-border-strong rounded-md font-body text-sm text-dark bg-white focus-ring";
  const rotulo = "text-gold uppercase tracking-widest text-xs font-body block mb-1";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-3xl text-navy">Campanhas</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/campanhas/grupos"
            className="h-9.5 px-4 inline-flex items-center rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected transition-colors duration-short"
          >
            Grupos
          </Link>
          <button
            type="button"
            onClick={() => setCriando(true)}
            data-testid="campanha-nova"
            className="h-9.5 px-5 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short"
          >
            + Nova campanha
          </button>
        </div>
      </div>

      <DataTable<Campanha>
        data-testid="tabela-campanhas"
        rows={campanhas}
        rowId={(c) => c.id}
        columns={colunas}
        ordenacaoInicial={{ key: "data", dir: "desc" }}
        vazio={{
          titulo: "Nenhuma campanha ainda",
          descricao:
            "Uma campanha é um e-mail que sai pra uma lista. Você escreve, testa em você mesma e só então envia.",
          acao: (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="h-9.5 px-5 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short"
            >
              Criar a primeira
            </button>
          ),
        }}
      />

      <Modal
        open={criando}
        onClose={() => setCriando(false)}
        variant="confirmacao"
        titulo="Nova campanha"
        descricao="O nome é só pra você achar depois — quem recebe nunca vê."
        primarioLabel="Criar e escrever"
        onConfirmar={criar}
        data-testid="modal-campanha-nova"
      >
        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="campanha-nome">
              Nome interno
            </label>
            <input
              id="campanha-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campo}
              data-testid="campanha-nome"
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="campanha-tipo">
              Tipo
            </label>
            <select
              id="campanha-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as CampanhaTipo)}
              className={campo}
              data-testid="campanha-tipo"
            >
              {TIPOS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={cancelando !== null}
        onClose={() => setCancelando(null)}
        variant="confirmacao"
        titulo="Cancelar o envio agendado?"
        descricao="A campanha volta pro estado testada e o disparo é cancelado no provedor. Você pode reagendar depois."
        primarioLabel="Cancelar envio"
        cancelarLabel="Deixar agendado"
        onConfirmar={cancelar}
        data-testid="modal-cancelar-agendamento"
      />
    </div>
  );
}
