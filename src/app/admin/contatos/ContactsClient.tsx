"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import StageBadge from "@/components/admin/StageBadge";
import SyncBadge from "@/components/admin/SyncBadge";
import {
  type Contact,
  type EstagioFunil,
  type CaptureOrigin,
  ESTAGIOS_OPTIONS,
  ORIGENS_OPTIONS,
  ESTAGIO_LABELS,
  ORIGEM_LABELS,
  DESTINO_LABELS,
} from "@/lib/contacts/types";

const PAGE_SIZE = 10;

const LOTE_C_ALERT = "Implementação completa virá no Lote C";

type SyncFilter = "todos" | "synced" | "pending" | "failed" | "partial";

const SYNC_FILTER_LABELS: Record<SyncFilter, string> = {
  todos: "Todos",
  synced: "Sincronizados",
  pending: "Pendentes",
  failed: "Falharam",
  partial: "Sync parcial",
};

const BULK_ACTIONS = ["Adicionar tag", "Mudar estágio", "Enviar WhatsApp", "Exportar"];

function matchesSync(c: Contact, filter: SyncFilter): boolean {
  const i = c.iddasSyncStatus;
  const cm = c.clickmassaSyncStatus;
  switch (filter) {
    case "todos":
      return true;
    case "synced":
      return i === "synced" && cm === "synced";
    case "pending":
      return i === "pending" || cm === "pending";
    case "failed":
      return i === "failed" && cm === "failed";
    case "partial":
      return (i === "synced") !== (cm === "synced");
  }
}

export default function ContactsClient({ contacts }: { contacts: Contact[] }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [estagio, setEstagio] = useState<EstagioFunil | "todos">("todos");
  const [origem, setOrigem] = useState<CaptureOrigin | "todas">("todas");
  const [tag, setTag] = useState<string>("todas");
  const [sync, setSync] = useState<SyncFilter>("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce da busca (300ms). Reseta a página dentro do callback (async),
  // nunca de forma síncrona no corpo do efeito.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Troca de filtro: aplica o setter e volta pra primeira página (event handler,
  // não efeito — evita a regra set-state-in-effect).
  function withPageReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  // Vocabulário de tags presente nos contatos
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      if (estagio !== "todos" && c.estagio !== estagio) return false;
      if (origem !== "todas" && c.origem !== origem) return false;
      if (tag !== "todas" && !c.tags.includes(tag)) return false;
      if (!matchesSync(c, sync)) return false;
      if (q) {
        const haystack = [c.name, c.whatsapp, c.email ?? "", ...c.tags].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, estagio, origem, tag, sync]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp defensivo: se a página atual passou do total (ex: lista encolheu),
  // pagina pela última válida sem precisar de efeito.
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allPageSelected = pageItems.length > 0 && pageItems.every((c) => selected.has(c.id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageItems.forEach((c) => next.delete(c.id));
      } else {
        pageItems.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const handleBulkAction = (action: string) => {
    if (!action) return;
    alert(`"${action}" para ${selected.size} contato(s) selecionado(s).\n\n${LOTE_C_ALERT}.`);
  };

  const selectClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-navy">Contatos</h1>
        <Link href="/admin/contatos/novo">
          <Button variant="primary" size="md">
            + Novo contato
          </Button>
        </Link>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome, WhatsApp, e-mail, tag..."
          className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short"
        />
      </div>

      {/* Filtros + ações em massa */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          aria-label="Filtrar por estágio"
          value={estagio}
          onChange={(e) => withPageReset(setEstagio)(e.target.value as EstagioFunil | "todos")}
          className={selectClass}
        >
          <option value="todos">Estágio: todos</option>
          {ESTAGIOS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ESTAGIO_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por origem"
          value={origem}
          onChange={(e) => withPageReset(setOrigem)(e.target.value as CaptureOrigin | "todas")}
          className={selectClass}
        >
          <option value="todas">Origem: todas</option>
          {ORIGENS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {ORIGEM_LABELS[o]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por tag"
          value={tag}
          onChange={(e) => withPageReset(setTag)(e.target.value)}
          className={selectClass}
        >
          <option value="todas">Tags: todas</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por sync"
          value={sync}
          onChange={(e) => withPageReset(setSync)(e.target.value as SyncFilter)}
          className={selectClass}
        >
          {(Object.keys(SYNC_FILTER_LABELS) as SyncFilter[]).map((s) => (
            <option key={s} value={s}>
              Sync: {SYNC_FILTER_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          aria-label="Ações em massa"
          value=""
          disabled={selected.size === 0}
          onChange={(e) => {
            handleBulkAction(e.target.value);
            e.target.value = "";
          }}
          className={`${selectClass} ml-auto disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">Ações em massa{selected.size > 0 ? ` (${selected.size})` : ""}</option>
          {BULK_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-md border border-dark/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark/10 bg-dark/5">
              <th className="w-12 px-6 py-4">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos da página"
                  checked={allPageSelected}
                  onChange={toggleAllOnPage}
                  className="accent-gold"
                />
              </th>
              {["Nome", "Origem", "Estágio", "Destino", "Sync"].map((h) => (
                <th
                  key={h}
                  className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <tr
                key={c.id}
                className="border-b border-dark/5 last:border-0 hover:bg-dark/5 transition-colors duration-short"
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${c.name}`}
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    className="accent-gold"
                  />
                </td>
                <td className="px-6 py-4 font-body text-dark">
                  <Link
                    href={`/admin/contatos/${c.id}`}
                    className="hover:text-gold transition-colors duration-short"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">
                  {ORIGEM_LABELS[c.origem]}
                </td>
                <td className="px-6 py-4">
                  <StageBadge estagio={c.estagio} />
                </td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">
                  {DESTINO_LABELS[c.destinoTipo]}
                </td>
                <td className="px-6 py-4">
                  <SyncBadge iddas={c.iddasSyncStatus} clickmassa={c.clickmassaSyncStatus} />
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center font-body text-dark/50">
                  Nenhum contato encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between mt-6 font-body text-sm text-dark/60">
        <span>
          Mostrando {pageItems.length} de {filtered.length}
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-short"
          >
            ← Anterior
          </button>
          <span>
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-short"
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
