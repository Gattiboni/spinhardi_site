"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column } from "@/components/ui/primitives/DataTable";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import { formatDateTimeShort } from "@/lib/utils/date";
import type { GrupoComContagens } from "@/lib/grupos/types";
import { criarGrupoAction } from "./actions";

/**
 * Lista de grupos. Usa o primitivo de tabela novo (tela nova) — as tabelas
 * antigas de contatos e blog seguem como estão, migração é lote futuro.
 *
 * As duas contagens existem porque significam coisas diferentes: "membros" é o
 * que a operadora curou; "receberiam hoje" é a interseção com a view de
 * elegibilidade (E1). Grupo NÃO filtra elegibilidade — a diferença entre os
 * dois números é justamente a informação útil.
 */
export default function GruposClient({ grupos }: { grupos: GrupoComContagens[] }) {
  const router = useRouter();
  const toast = useToast();

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const colunas: Column<GrupoComContagens>[] = [
    {
      key: "nome",
      header: "Grupo",
      sortValue: (g) => g.nome,
      render: (g) => <span className="font-medium text-navy">{g.nome}</span>,
    },
    {
      key: "descricao",
      header: "Descrição",
      escondidaNoMobile: true,
      render: (g) =>
        g.descricao ? (
          <span className="text-text-muted">{g.descricao}</span>
        ) : (
          <span className="text-icon-muted">—</span>
        ),
    },
    {
      key: "membros",
      header: "Membros",
      numerica: true,
      sortValue: (g) => g.membros,
      render: (g) => g.membros,
    },
    {
      key: "elegiveis",
      header: "Receberiam hoje",
      numerica: true,
      sortValue: (g) => g.elegiveis,
      render: (g) => (
        <span className={g.elegiveis < g.membros ? "text-text-muted" : ""}>{g.elegiveis}</span>
      ),
    },
    {
      key: "updated",
      header: "Última mudança",
      escondidaNoMobile: true,
      sortValue: (g) => Date.parse(g.updatedAt),
      render: (g) => formatDateTimeShort(g.updatedAt),
    },
  ];

  const criar = async () => {
    const r = await criarGrupoAction(nome, descricao.trim() || null);
    if (!r.success) return r.error ?? "Não foi possível criar o grupo.";

    toast.sucesso(`Grupo "${nome.trim()}" criado.`);
    setNome("");
    setDescricao("");
    router.refresh();
    if (r.grupoId) router.push(`/admin/campanhas/grupos/${r.grupoId}`);
    return null;
  };

  const campo =
    "w-full px-3 h-10 border border-border-strong rounded-md font-body text-sm text-dark bg-white focus-ring";
  const rotulo = "text-gold uppercase tracking-widest text-xs font-body block mb-1";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <Link
            href="/admin/campanhas"
            className="inline-block font-body text-sm text-text-muted hover:text-gold transition-colors duration-short mb-2"
          >
            ← Campanhas
          </Link>
          <h1 className="font-display text-3xl text-navy">Grupos</h1>
        </div>
        <button
          type="button"
          onClick={() => setCriando(true)}
          data-testid="grupo-novo"
          className="h-9.5 px-5 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short"
        >
          + Novo grupo
        </button>
      </div>

      <DataTable<GrupoComContagens>
        data-testid="tabela-grupos"
        rows={grupos}
        rowId={(g) => g.id}
        columns={colunas}
        ordenacaoInicial={{ key: "nome", dir: "asc" }}
        aoAbrir={(g) => router.push(`/admin/campanhas/grupos/${g.id}`)}
        abrirLabel="Abrir"
        vazio={{
          titulo: "Nenhum grupo ainda",
          descricao:
            "Grupo é um conjunto de contatos que você escolhe a dedo. Dá pra criar aqui ou direto da lista de contatos, selecionando as pessoas.",
          acao: (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="h-9.5 px-5 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short"
            >
              Criar o primeiro grupo
            </button>
          ),
        }}
      />

      <Modal
        open={criando}
        onClose={() => setCriando(false)}
        variant="confirmacao"
        titulo="Novo grupo"
        descricao="Grupo nasce vazio. Você adiciona as pessoas depois, aqui ou pela lista de contatos."
        primarioLabel="Criar grupo"
        onConfirmar={criar}
        data-testid="modal-grupo-novo"
      >
        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="grupo-nome">
              Nome
            </label>
            <input
              id="grupo-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campo}
              data-testid="grupo-nome"
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="grupo-descricao">
              Descrição (opcional)
            </label>
            <input
              id="grupo-descricao"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={campo}
              data-testid="grupo-descricao"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
