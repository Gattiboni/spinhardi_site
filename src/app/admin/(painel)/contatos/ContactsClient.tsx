"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SyncBadge from "@/components/admin/SyncBadge";
import {
  type Contact,
  type CaptureOrigin,
  type ContactStatus,
  ORIGENS_OPTIONS,
  ORIGEM_LABELS,
  DESTINO_LABELS,
} from "@/lib/contacts/types";
import { quickUpdateContact } from "./actions";
import type {
  GapSegment,
  ContactGapFlags,
  GapCounts,
} from "@/lib/contacts/gold-operacional";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const LOTE_C_ALERT = "Implementação completa virá no Lote C";

type SyncFilter = "todos" | "synced" | "pending" | "failed" | "partial";

const SYNC_FILTER_LABELS: Record<SyncFilter, string> = {
  todos: "Todos",
  synced: "Sincronizados",
  pending: "Pendentes",
  failed: "Falharam",
  partial: "Sync parcial",
};

// Rótulos de status. A edição rápida só oferece os operacionais (ativo /
// arquivado); `duplicado`/`anonimizado_lgpd` são geridos por outros fluxos, mas
// o select inclui o valor atual do contato pra nunca mostrar opção errada.
const STATUS_LABELS: Record<ContactStatus, string> = {
  ativo: "Ativo",
  arquivado: "Arquivado",
  duplicado: "Duplicado",
  anonimizado_lgpd: "Anonimizado (LGPD)",
};

const STATUS_QUICK_OPTIONS: ContactStatus[] = ["ativo", "arquivado"];

// "Enviar WhatsApp" foi removido de propósito: disparo em massa derruba o número
// por ban da Meta — o canal inteiro da agência morre. WhatsApp só individual, no
// detalhe do contato (um por vez, com confirm). As ações abaixo são seguras.
const BULK_ACTIONS = ["Adicionar tag", "Exportar"];

// Cards de gap (gold operacional): contagem + clique que filtra a lista.
const GAP_CARDS: { key: GapSegment; title: string; hint: string }[] = [
  {
    key: "semEmail",
    title: "Sem email",
    hint: "Contatos sem e-mail cadastrado",
  },
  {
    key: "possivelDuplicado",
    title: "Possível duplicado",
    hint: "Dividem o mesmo telefone com outro contato",
  },
  {
    key: "clickmassaSemIddas",
    title: "Sem cadastro no Iddas",
    hint: "Falados no WhatsApp (ClickMassa), fora do ERP",
  },
];

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

// Editor inline da edição rápida (expansão da linha). Campos básicos; salva via
// server action e fecha. A membresia de "possível duplicado" NÃO é recalculada
// aqui — vem da RPC ao revalidar, fonte única (ver actions.ts / gold-operacional).
function QuickEditRow({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [whatsapp, setWhatsapp] = useState(contact.whatsapp);
  const [email, setEmail] = useState(contact.email ?? "");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inclui o status atual no select mesmo quando não é operacional (ex:
  // duplicado), pra nunca exibir um valor selecionado fora da lista.
  const statusOptions = STATUS_QUICK_OPTIONS.includes(status)
    ? STATUS_QUICK_OPTIONS
    : [status, ...STATUS_QUICK_OPTIONS];

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";
  const labelClass = "text-gold uppercase tracking-widest text-xs font-body mb-1 block";

  const handleSave = async () => {
    setSaving(true);
    setErro(null);
    const result = await quickUpdateContact(contact.id, {
      name,
      whatsapp,
      email: email.trim() ? email.trim() : null,
      status,
    });
    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setErro(result.error ?? "Não foi possível salvar.");
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
        <div>
          <label className={labelClass}>WhatsApp</label>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
        <div>
          <label className={labelClass}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
            className={`${inputClass} w-full`}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="font-body text-sm text-dark/60 hover:text-dark transition-colors duration-short"
        >
          Cancelar
        </button>
        {erro && <span className="font-body text-sm text-red-600">{erro}</span>}
      </div>
    </div>
  );
}

export default function ContactsClient({
  contacts,
  gapFlags,
  gapCounts,
}: {
  contacts: Contact[];
  gapFlags: Record<string, ContactGapFlags>;
  gapCounts: GapCounts;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [origem, setOrigem] = useState<CaptureOrigin | "todas">("todas");
  const [tag, setTag] = useState<string>("todas");
  const [sync, setSync] = useState<SyncFilter>("todos");
  const [gap, setGap] = useState<GapSegment | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

  // Card de gap: clica pra filtrar, clica de novo no ativo pra limpar. Volta
  // pra primeira página (event handler, não efeito).
  const toggleGap = (key: GapSegment) => {
    setGap((prev) => (prev === key ? null : key));
    setPage(1);
  };

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
      if (origem !== "todas" && c.origem !== origem) return false;
      if (tag !== "todas" && !c.tags.includes(tag)) return false;
      if (!matchesSync(c, sync)) return false;
      if (gap && !gapFlags[c.id]?.[gap]) return false;
      if (q) {
        const haystack = [c.name, c.whatsapp, c.email ?? "", ...c.tags].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, origem, tag, sync, gap, gapFlags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Clamp defensivo: se a página atual passou do total (ex: lista encolheu),
  // pagina pela última válida sem precisar de efeito.
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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

      {/* Cards de gap (gold operacional) — contagem + clique que filtra a lista */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {GAP_CARDS.map((card) => {
          const active = gap === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => toggleGap(card.key)}
              aria-pressed={active}
              className={`text-left bg-white border rounded-md p-6 min-h-[120px] transition-all duration-short ${
                active
                  ? "border-gold ring-2 ring-gold/30"
                  : "border-dark/10 hover:border-gold hover:shadow-sm"
              }`}
            >
              <p className="font-body text-sm text-dark/60 mb-3">{card.title}</p>
              <p className="font-display text-4xl text-navy">{gapCounts[card.key]}</p>
              <p className="font-body text-xs text-dark/50 mt-2">
                {active ? "Filtrando · clique pra limpar" : card.hint}
              </p>
            </button>
          );
        })}
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
          aria-label="Itens por página"
          value={pageSize}
          onChange={(e) => withPageReset(setPageSize)(Number(e.target.value))}
          className={`${selectClass} ml-auto`}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} por página
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
          className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
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
              {["Nome", "Origem", "Destino", "Sync"].map((h) => (
                <th
                  key={h}
                  className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60"
                >
                  {h}
                </th>
              ))}
              <th className="text-right px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <Fragment key={c.id}>
                <tr className="border-b border-dark/5 last:border-0 hover:bg-dark/5 transition-colors duration-short">
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
                  <td className="px-6 py-4 font-body text-sm text-dark/60">
                    {DESTINO_LABELS[c.destinoTipo]}
                  </td>
                  <td className="px-6 py-4">
                    <SyncBadge iddas={c.iddasSyncStatus} clickmassa={c.clickmassaSyncStatus} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingId((prev) => (prev === c.id ? null : c.id))}
                      aria-expanded={editingId === c.id}
                      className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
                    >
                      {editingId === c.id ? "Fechar" : "Editar"}
                    </button>
                  </td>
                </tr>
                {editingId === c.id && (
                  <tr className="border-b border-dark/5 bg-dark/5">
                    <td colSpan={6} className="px-6 py-5">
                      <QuickEditRow
                        contact={c}
                        onClose={() => setEditingId(null)}
                        onSaved={() => {
                          setEditingId(null);
                          router.refresh();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
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
