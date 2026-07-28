"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column } from "@/components/ui/primitives/DataTable";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import { formatDateTimeShort } from "@/lib/utils/date";
import type { Grupo, MembroDoGrupo } from "@/lib/grupos/types";
import {
  adicionarMembrosAction,
  apagarGrupoAction,
  editarGrupoAction,
  removerMembroAction,
} from "../actions";

type Candidato = { id: string; nome: string; email: string | null };

/**
 * Tela de um grupo: cabeçalho editável, as duas contagens, tabela de membros e
 * o fluxo de adicionar/remover.
 *
 * A conta que importa — "quantos deste grupo receberiam hoje" — é derivada da
 * view de elegibilidade (E1), não recalculada aqui. Quem não passa aparece na
 * tabela com o motivo em português: é a informação que faz a operadora ir
 * consertar o e-mail em vez de achar que o grupo está errado.
 */
export default function GrupoDetalheClient({
  grupo,
  membros,
  candidatos,
}: {
  grupo: Grupo;
  membros: MembroDoGrupo[];
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(grupo.nome);
  const [descricao, setDescricao] = useState(grupo.descricao ?? "");

  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());

  const [apagando, setApagando] = useState(false);
  const [removendo, setRemovendo] = useState<MembroDoGrupo | null>(null);

  const elegiveis = membros.filter((m) => m.elegivel).length;
  const jaMembros = useMemo(() => new Set(membros.map((m) => m.contactId)), [membros]);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return candidatos
      .filter((c) => !jaMembros.has(c.id))
      .filter((c) => c.nome.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q))
      .slice(0, 25);
  }, [busca, candidatos, jaMembros]);

  const colunas: Column<MembroDoGrupo>[] = [
    {
      key: "nome",
      header: "Contato",
      sortValue: (m) => m.nome,
      render: (m) => (
        <Link
          href={`/admin/contatos/${m.contactId}`}
          className="font-medium text-navy hover:text-gold transition-colors duration-short"
        >
          {m.nome}
        </Link>
      ),
    },
    {
      key: "email",
      header: "E-mail",
      escondidaNoMobile: true,
      sortValue: (m) => m.email ?? "",
      render: (m) => m.email ?? <span className="text-icon-muted">—</span>,
    },
    {
      key: "elegivel",
      header: "Recebe?",
      render: (m) =>
        m.elegivel ? (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-success-bg border border-success-border text-green font-body text-xs">
            recebe
          </span>
        ) : (
          <span
            className="inline-flex items-center h-6 px-2.5 rounded-full bg-surface-selected text-text-muted font-body text-xs"
            title={m.motivoInelegivel ?? undefined}
          >
            não · {m.motivoInelegivel}
          </span>
        ),
    },
    {
      key: "adicionado",
      header: "Entrou em",
      escondidaNoMobile: true,
      sortValue: (m) => Date.parse(m.adicionadoEm),
      render: (m) => formatDateTimeShort(m.adicionadoEm),
    },
    {
      key: "acoes",
      header: "",
      render: (m) => (
        <button
          type="button"
          onClick={() => setRemovendo(m)}
          className="font-body text-sm text-text-muted hover:text-navy focus-ring rounded-sm"
        >
          Tirar do grupo
        </button>
      ),
    },
  ];

  const salvarCabecalho = async () => {
    const r = await editarGrupoAction(grupo.id, {
      nome,
      descricao: descricao.trim() || null,
    });
    if (!r.success) return r.error ?? "Não foi possível salvar.";
    toast.sucesso("Grupo salvo.");
    setEditando(false);
    router.refresh();
    return null;
  };

  const adicionar = async () => {
    if (escolhidos.size === 0) return "Escolha ao menos um contato.";
    const r = await adicionarMembrosAction(grupo.id, [...escolhidos]);
    if (!r.success) return r.error ?? "Não foi possível adicionar.";

    toast.sucesso(
      `${r.adicionados} ${r.adicionados === 1 ? "contato entrou" : "contatos entraram"} no grupo.`,
    );
    setEscolhidos(new Set());
    setBusca("");
    router.refresh();
    return null;
  };

  const remover = async () => {
    if (!removendo) return null;
    const r = await removerMembroAction(grupo.id, removendo.contactId);
    if (!r.success) return r.error ?? "Não foi possível remover.";
    toast.sucesso(`${removendo.nome} saiu do grupo.`);
    router.refresh();
    return null;
  };

  const apagar = async () => {
    const r = await apagarGrupoAction(grupo.id);
    if (!r.success) return r.error ?? "Não foi possível apagar.";
    toast.sucesso(`Grupo "${grupo.nome}" apagado.`);
    router.push("/admin/campanhas/grupos");
    return null;
  };

  const campo =
    "w-full px-3 h-10 border border-border-strong rounded-md font-body text-sm text-dark bg-white focus-ring";
  const rotulo = "text-gold uppercase tracking-widest text-xs font-body block mb-1";
  const botao =
    "h-9.5 px-4 rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short";

  return (
    <div>
      <Link
        href="/admin/campanhas/grupos"
        className="inline-block font-body text-sm text-text-muted hover:text-gold transition-colors duration-short mb-6"
      >
        ← Todos os grupos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-navy">{grupo.nome}</h1>
          {grupo.descricao && (
            <p className="font-body text-sm text-text-muted mt-1">{grupo.descricao}</p>
          )}
          <p className="font-body text-sm text-text-muted mt-3">
            <strong className="text-navy tabular-nums">{membros.length}</strong>{" "}
            {membros.length === 1 ? "pessoa" : "pessoas"} no grupo ·{" "}
            <strong className="text-navy tabular-nums">{elegiveis}</strong>{" "}
            {elegiveis === 1 ? "receberia" : "receberiam"} um e-mail hoje
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botao} onClick={() => setEditando(true)}>
            Editar
          </button>
          <button type="button" className={botao} onClick={() => setAdicionando(true)}>
            + Adicionar pessoas
          </button>
          <button
            type="button"
            onClick={() => setApagando(true)}
            data-testid="grupo-apagar"
            className="h-9.5 px-4 rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short"
          >
            Apagar grupo
          </button>
        </div>
      </div>

      <DataTable<MembroDoGrupo>
        data-testid="tabela-membros"
        rows={membros}
        rowId={(m) => m.contactId}
        columns={colunas}
        ordenacaoInicial={{ key: "nome", dir: "asc" }}
        vazio={{
          titulo: "Grupo vazio",
          descricao: "Adicione pessoas aqui, ou selecione contatos na lista e use a ação em massa.",
        }}
      />

      {/* ── Editar cabeçalho ─────────────────────────────────────── */}
      <Modal
        open={editando}
        onClose={() => setEditando(false)}
        variant="confirmacao"
        titulo="Editar grupo"
        primarioLabel="Salvar"
        onConfirmar={salvarCabecalho}
        data-testid="modal-grupo-editar"
      >
        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="editar-nome">
              Nome
            </label>
            <input
              id="editar-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="editar-descricao">
              Descrição
            </label>
            <input
              id="editar-descricao"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={campo}
            />
          </div>
        </div>
      </Modal>

      {/* ── Adicionar membros ────────────────────────────────────── */}
      <Modal
        open={adicionando}
        onClose={() => {
          setAdicionando(false);
          setBusca("");
          setEscolhidos(new Set());
        }}
        variant="conteudo"
        titulo="Adicionar pessoas ao grupo"
        primarioLabel="Adicionar"
        onConfirmar={adicionar}
        data-testid="modal-grupo-membros"
      >
        <div className="space-y-4">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className={campo}
            data-testid="grupo-busca-contato"
          />

          {escolhidos.size > 0 && (
            <p className="font-body text-sm text-text-muted">
              {escolhidos.size} {escolhidos.size === 1 ? "escolhido" : "escolhidos"}
            </p>
          )}

          {busca.trim() === "" ? (
            <p className="font-body text-sm text-text-muted">
              Digite pra procurar. Quem já está no grupo não aparece.
            </p>
          ) : resultados.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ninguém novo bate com essa busca.</p>
          ) : (
            <ul className="divide-y divide-border-soft bg-white rounded-md border border-border-soft">
              {resultados.map((c) => {
                const marcado = escolhidos.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-app">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          setEscolhidos((prev) => {
                            const proximo = new Set(prev);
                            if (proximo.has(c.id)) proximo.delete(c.id);
                            else proximo.add(c.id);
                            return proximo;
                          })
                        }
                        className="w-4 h-4 accent-gold focus-ring"
                      />
                      <span className="font-body text-sm text-dark">{c.nome}</span>
                      <span className="font-body text-xs text-text-muted ml-auto">
                        {c.email ?? "sem e-mail"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* ── Remover membro ───────────────────────────────────────── */}
      <Modal
        open={removendo !== null}
        onClose={() => setRemovendo(null)}
        variant="destrutiva"
        titulo={`Tirar ${removendo?.nome ?? ""} do grupo?`}
        descricao="O contato continua no sistema — só sai deste grupo. Campanha já enviada não muda."
        primarioLabel="Tirar do grupo"
        onConfirmar={remover}
        data-testid="modal-grupo-remover-membro"
      />

      {/* ── Apagar grupo (confirmação digitada, padrão b·1) ──────── */}
      <Modal
        open={apagando}
        onClose={() => setApagando(false)}
        variant="confirmacao-digitada"
        titulo="Apagar este grupo?"
        descricao="O grupo some e as pessoas continuam onde estão. Campanha já enviada não muda. Isso não tem como desfazer."
        primarioLabel="Apagar grupo"
        palavraConfirmacao="APAGAR"
        onConfirmar={apagar}
        data-testid="modal-grupo-apagar"
      />
    </div>
  );
}
