"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SyncBadge from "@/components/admin/SyncBadge";
import WhatsAppBadge from "@/components/admin/WhatsAppBadge";
import {
  type Contact,
  type CaptureOrigin,
  type ContactStatus,
  ORIGENS_OPTIONS,
  ORIGEM_LABELS,
} from "@/lib/contacts/types";
import { quickUpdateContact } from "./actions";
import { formatDateTimeShort } from "@/lib/utils/date";
import type { GapSegment, ContactGapFlags, GapCounts } from "@/lib/contacts/gold-operacional";
import AcoesEmMassa from "./AcoesEmMassa";
import { TagClickMassaBadge, TagInternaBadge, TagsOrfasCm } from "@/components/admin/TagBadge";
import {
  resolverTagsClickMassa,
  resolverTagsInternas,
  type TagClickMassa,
  type TagInterna,
} from "@/lib/tags/shared";
import type { Grupo } from "@/lib/grupos/types";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type SyncFilter = "todos" | "synced" | "pending" | "failed" | "partial";

const SYNC_FILTER_LABELS: Record<SyncFilter, string> = {
  todos: "Todos",
  synced: "Sincronizados",
  pending: "Pendentes",
  failed: "Falharam",
  partial: "Sync parcial",
};

// Filtro por indicador de qualidade `tem_whatsapp` (U1.2). Encaixa na infra de
// filtro já existente (origem/tag/sync) — mesma mecânica de select + memo.
type WhatsAppFilter = "todos" | "com" | "sem";

const WHATSAPP_FILTER_LABELS: Record<WhatsAppFilter, string> = {
  todos: "Todos",
  com: "Com WhatsApp",
  sem: "Sem WhatsApp",
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

// Ordenação da tabela. Colunas ordenáveis e direção; a lista sai ordenada por
// NOME A→Z por padrão (antes vinha na ordem do banco, `created_at` desc) porque
// a revisão manual é feita em varredura alfabética.
//
// Ordena em memória, sobre o array já filtrado, seguindo o padrão dos filtros
// desta tela: a página carrega todos os ativos de uma vez e filtra/pagina no
// cliente. Nada de ordenar na query — a query não é a fonte da paginação.
type SortKey = "name" | "updatedAt";
type SortDir = "asc" | "desc";

// Direção "natural" de cada coluna no primeiro clique: nome começa A→Z, última
// edição começa pela mais recente (é o que a Nina quer ver — onde ela parou).
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  updatedAt: "desc",
};

// Comparador base por coluna, sempre em ordem ascendente; a direção é aplicada
// depois. `localeCompare` pt-BR com sensitivity "base" pra acento não jogar
// "Álvaro" pro fim da lista — ele senta junto de "Alvaro"/"Amanda".
const SORT_COMPARATORS: Record<SortKey, (a: Contact, b: Contact) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  updatedAt: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
};

// "Enviar WhatsApp" nunca entrou de propósito: disparo em massa derruba o número
// por ban da Meta — o canal inteiro da agência morre. WhatsApp só individual, no
// detalhe do contato (um por vez, com confirm).
//
// As ações em massa REAIS (tag e grupo) vivem em `AcoesEmMassa`, com modal de
// confirmação e toast. O stub que abria `alert()` morreu junto com esta lista.

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
  const [whatsapp, setWhatsapp] = useState(contact.whatsapp ?? "");
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

// Cabeçalho de coluna ordenável. Botão de verdade (teclado/leitor de tela),
// `aria-sort` no `th` pro estado ser anunciado, e a seta como indicador visual —
// só na coluna ativa, pra não poluir o cabeçalho.
function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Ordenar por ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1.5 uppercase tracking-widest hover:text-gold transition-colors duration-short ${
          active ? "text-dark" : ""
        }`}
      >
        {label}
        <span aria-hidden="true" className={active ? "text-gold" : "text-dark/25"}>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ContactsClient({
  contacts,
  gapFlags,
  gapCounts,
  catalogoTagsInternas,
  catalogoTagsClickmassa,
  grupos,
}: {
  contacts: Contact[];
  gapFlags: Record<string, ContactGapFlags>;
  gapCounts: GapCounts;
  catalogoTagsInternas: TagInterna[];
  catalogoTagsClickmassa: TagClickMassa[];
  grupos: Grupo[];
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [origem, setOrigem] = useState<CaptureOrigin | "todas">("todas");
  // DOIS filtros separados, um por origem (T8). O vocabulário de cada um vem do
  // CATÁLOGO, não dos contatos carregados — senão a operadora só filtra por tag
  // que já está em uso e nunca descobre que a outra existe.
  const [tagInterna, setTagInterna] = useState<string>("todas");
  const [tagCm, setTagCm] = useState<string>("todas");
  const [sync, setSync] = useState<SyncFilter>("todos");
  const [wa, setWa] = useState<WhatsAppFilter>("todos");
  const [gap, setGap] = useState<GapSegment | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
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

  // Clique no cabeçalho: na coluna já ativa inverte a direção; em outra coluna
  // troca de coluna e assume a direção natural dela (nome A→Z, edição mais
  // recente primeiro). Volta pra primeira página — senão a Nina clica em ordenar
  // na página 5 e cai num pedaço aleatório da lista nova.
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(SORT_DEFAULT_DIR[key]);
    }
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

  // Índice slug→nome e id→nome, pra busca e pra linha. O vocabulário dos
  // SELECTS vem dos catálogos (props), não daqui.
  const nomePorSlug = useMemo(
    () => new Map(catalogoTagsInternas.map((t) => [t.slug, t.name])),
    [catalogoTagsInternas],
  );
  const nomePorIdCm = useMemo(
    () => new Map(catalogoTagsClickmassa.map((t) => [t.id, t.nome])),
    [catalogoTagsClickmassa],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      if (origem !== "todas" && c.origem !== origem) return false;
      if (tagInterna !== "todas" && !c.tags.includes(tagInterna)) return false;
      if (tagCm !== "todas" && !c.clickmassaTagsId.includes(Number(tagCm))) return false;
      if (!matchesSync(c, sync)) return false;
      if (wa === "com" && !c.temWhatsapp) return false;
      if (wa === "sem" && c.temWhatsapp) return false;
      if (gap && !gapFlags[c.id]?.[gap]) return false;
      if (q) {
        // A busca cobre as DUAS origens: slug e nome da interna, nome da do CM.
        const haystack = [
          c.name,
          c.whatsapp ?? "",
          c.email ?? "",
          ...c.tags,
          ...c.tags.map((t) => nomePorSlug.get(t) ?? ""),
          ...c.clickmassaTagsId.map((id) => nomePorIdCm.get(id) ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    contacts,
    search,
    origem,
    tagInterna,
    tagCm,
    sync,
    wa,
    gap,
    gapFlags,
    nomePorSlug,
    nomePorIdCm,
  ]);

  // Ordena DEPOIS de filtrar e ANTES de paginar — é o que faz a ordenação valer
  // sobre a lista inteira (todos os filtrados) e não só sobre a página visível.
  // Cópia antes do `sort` porque `filtered` pode ser o próprio array de props
  // quando nenhum filtro está ativo, e `sort` muta no lugar.
  const sorted = useMemo(() => {
    const compare = SORT_COMPARATORS[sortKey];
    const factor = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => compare(a, b) * factor);
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Clamp defensivo: se a página atual passou do total (ex: lista encolheu),
  // pagina pela última válida sem precisar de efeito.
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

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
          aria-label="Filtrar por tag interna"
          value={tagInterna}
          onChange={(e) => withPageReset(setTagInterna)(e.target.value)}
          className={selectClass}
          data-testid="filtro-tag-interna"
        >
          <option value="todas">Tag interna: todas</option>
          {catalogoTagsInternas.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
              {t.isActive ? "" : " (desativada)"}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por tag do ClickMassa"
          value={tagCm}
          onChange={(e) => withPageReset(setTagCm)(e.target.value)}
          className={selectClass}
          data-testid="filtro-tag-clickmassa"
        >
          <option value="todas">Tag do ClickMassa: todas</option>
          {catalogoTagsClickmassa.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.nome}
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
          aria-label="Filtrar por WhatsApp"
          value={wa}
          onChange={(e) => withPageReset(setWa)(e.target.value as WhatsAppFilter)}
          className={selectClass}
        >
          {(Object.keys(WHATSAPP_FILTER_LABELS) as WhatsAppFilter[]).map((w) => (
            <option key={w} value={w}>
              WhatsApp: {WHATSAPP_FILTER_LABELS[w]}
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
      </div>

      {/* Ações em massa reais (tag e grupo), com modal de confirmação e toast.
          Só aparece com seleção; o teto é a página. */}
      <AcoesEmMassa
        selecionados={[...selected]}
        catalogoInterno={catalogoTagsInternas}
        grupos={grupos}
        aoTerminar={() => setSelected(new Set())}
      />

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
              <SortHeader
                label="Nome"
                sortKey="name"
                active={sortKey === "name"}
                dir={sortDir}
                onSort={handleSort}
              />
              {["Origem", "Tags", "Sync"].map((h) => (
                <th
                  key={h}
                  className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60"
                >
                  {h}
                </th>
              ))}
              <SortHeader
                label="Última edição"
                sortKey="updatedAt"
                active={sortKey === "updatedAt"}
                dir={sortDir}
                onSort={handleSort}
                className="hidden lg:table-cell whitespace-nowrap"
              />
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
                    <span className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/contatos/${c.id}`}
                        className="hover:text-gold transition-colors duration-short"
                      >
                        {c.name}
                      </Link>
                      <WhatsAppBadge temWhatsapp={c.temWhatsapp} />
                    </span>
                  </td>
                  <td className="px-6 py-4 font-body text-sm text-dark/60">
                    {ORIGEM_LABELS[c.origem]}
                  </td>
                  {/* Tags das DUAS origens na mesma célula, distinguíveis pela
                      aparência do badge (preenchido = ClickMassa, vazado =
                      interna). Substituiu a coluna Destino, que já aparece na
                      ficha e disputava espaço com informação mais operacional. */}
                  <td className="px-6 py-4">
                    <TagsDaLinha
                      tags={c.tags}
                      clickmassaTagsId={c.clickmassaTagsId}
                      catalogoInterno={catalogoTagsInternas}
                      catalogoClickmassa={catalogoTagsClickmassa}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <SyncBadge iddas={c.iddasSyncStatus} clickmassa={c.clickmassaSyncStatus} />
                  </td>
                  {/* Última edição: só leitura. Quem mantém `updated_at` é o
                      trigger `trg_contacts_updated_at` no banco — nenhum código
                      daqui escreve nessa coluna. Escondida no mobile (a revisão
                      é no desktop) pra não espremer nome e ações. */}
                  <td className="hidden lg:table-cell px-6 py-4 font-body text-sm text-dark/60 whitespace-nowrap">
                    {formatDateTimeShort(c.updatedAt)}
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
                    <td colSpan={7} className="px-6 py-5">
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
                <td colSpan={7} className="px-6 py-12 text-center font-body text-dark/50">
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

/**
 * Célula de tags da lista: as duas origens juntas, distinguíveis sem legenda.
 *
 * Teto de 3 badges por origem — a linha tem largura finita e a densidade da
 * tabela importa mais que ver a lista inteira aqui (a ficha mostra tudo). O
 * excedente vira "+N", e os ids órfãos do CM viram contagem (nunca número cru).
 */
const TETO_BADGES = 3;

function TagsDaLinha({
  tags,
  clickmassaTagsId,
  catalogoInterno,
  catalogoClickmassa,
}: {
  tags: string[];
  clickmassaTagsId: number[];
  catalogoInterno: TagInterna[];
  catalogoClickmassa: TagClickMassa[];
}) {
  const cm = resolverTagsClickMassa(clickmassaTagsId, catalogoClickmassa);
  const internas = resolverTagsInternas(tags, catalogoInterno);

  if (internas.length === 0 && cm.tags.length === 0 && cm.orfaos === 0) {
    return <span className="font-body text-sm text-dark/30">—</span>;
  }

  const sobrandoInternas = internas.length - TETO_BADGES;
  const sobrandoCm = cm.tags.length - TETO_BADGES;

  return (
    <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
      {internas.slice(0, TETO_BADGES).map((t) => (
        <TagInternaBadge key={t.slug} nome={t.name} cor={t.cor} orfao={t.orfao} />
      ))}
      {sobrandoInternas > 0 && (
        <span className="font-body text-xs text-dark/50">+{sobrandoInternas}</span>
      )}

      {cm.tags.slice(0, TETO_BADGES).map((t) => (
        <TagClickMassaBadge key={t.id} nome={t.nome} cor={t.cor} />
      ))}
      {sobrandoCm > 0 && <span className="font-body text-xs text-dark/50">+{sobrandoCm}</span>}
      <TagsOrfasCm quantas={cm.orfaos} />
    </div>
  );
}
