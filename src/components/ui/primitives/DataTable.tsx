"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tabela de dados — primitivo 03 da folha de componentes v1.
 *
 * Cobre a matriz inteira da folha: ordenação de três estados, seleção com
 * indeterminado, barra de ações em massa grudada acima do cabeçalho fixo,
 * vazio-de-base, vazio-por-filtro, carregando (esqueleto), erro de carregamento,
 * paginação e mobile com a primeira coluna fixa (D4).
 *
 * FRONTEIRA DESTE LOTE: este primitivo é usado SÓ nas telas novas (campanhas,
 * grupos). As tabelas existentes — contatos, blog — continuam como estão; a
 * migração é lote futuro. Nada aqui altera comportamento de tela existente.
 *
 * DESVIO DELIBERADO da folha. A folha descreve "Selecionar todos os 312
 * contatos do filtro" como ação explícita na barra. Ela NÃO é implementada:
 * exigiria uma RPC de ids-por-filtro (restrição dura 6 do lote, e o incidente
 * `UND_ERR_HEADERS_OVERFLOW` já conhecido). A seleção máxima é a página atual.
 * Quando a RPC existir, é só acrescentar um botão nesta barra.
 */

export type SortDir = "asc" | "desc";

export type Column<T> = {
  /** Identificador estável da coluna (também é a chave de ordenação). */
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Só ordena quem tem `sortValue`. */
  sortValue?: (row: T) => string | number;
  /** Coluna de valor vai à direita, com tabular-nums (folha, "Números"). */
  numerica?: boolean;
  /** Esconde no mobile — a coluna fixa e as essenciais ficam. */
  escondidaNoMobile?: boolean;
  className?: string;
};

export type BulkAction = {
  label: string;
  onClick: (ids: string[]) => void;
  /** Ação destrutiva ganha filete ouro (D1). Confirmação é do chamador. */
  destrutiva?: boolean;
};

export type FiltroChip = {
  label: string;
  onRemover: () => void;
};

export type DataTableProps<T> = {
  rows: T[];
  rowId: (row: T) => string;
  columns: Column<T>[];

  /** Estado de carregamento — vira esqueleto só depois de 300ms. */
  carregando?: boolean;
  /** Erro de carregamento: a tabela troca o CORPO por uma faixa sólida. */
  erro?: { mensagem: string; onTentarDeNovo?: () => void } | null;

  /** Vazio de BASE (nenhum registro existe). */
  vazio?: { titulo: string; descricao?: string; acao?: React.ReactNode };
  /**
   * Vazio POR FILTRO. Diferente do de base de propósito: diz o total da base e
   * mantém os chips visíveis, senão a usuária acha que perdeu os dados.
   */
  filtros?: { totalBase: number; chips: FiltroChip[]; onLimpar: () => void };

  selecao?: {
    selecionados: Set<string>;
    onChange: (proximos: Set<string>) => void;
    acoes: BulkAction[];
    /** Singular/plural do rótulo da barra: ["contato","contatos"]. */
    rotulo: [string, string];
  };

  /** Clique na linha inteira leva ao detalhe. */
  aoAbrir?: (row: T) => void;
  /** Rótulo do botão de ação por linha; sem ele a coluna não aparece. */
  abrirLabel?: string;

  ordenacaoInicial?: { key: string; dir: SortDir };
  pageSizeInicial?: number;
  /** Sem paginação quando `false` (listas curtas, ex: membros de grupo). */
  paginar?: boolean;

  "data-testid"?: string;
};

const PAGE_SIZES = [10, 25, 50];
const ATRASO_ESQUELETO = 300; // abaixo disso o esqueleto pisca e incomoda
const LINHAS_ESQUELETO = 5;

/** Espaço fino (U+2009) como separador de milhar e travessão no intervalo. */
function intervalo(de: number, ate: number, total: number): string {
  const n = (v: number) => v.toLocaleString("pt-BR").replace(/\./g, " ");
  return `Mostrando ${n(de)}–${n(ate)} de ${n(total)}`;
}

export default function DataTable<T>({
  rows,
  rowId,
  columns,
  carregando = false,
  erro = null,
  vazio,
  filtros,
  selecao,
  aoAbrir,
  abrirLabel,
  ordenacaoInicial,
  pageSizeInicial = 10,
  paginar = true,
  "data-testid": testId,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(ordenacaoInicial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(ordenacaoInicial?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeInicial);
  const [esperaLonga, setEsperaLonga] = useState(false);
  const ultimoClicado = useRef<string | null>(null);

  // Esqueleto só a partir de 300ms de espera — abaixo disso ele pisca e
  // incomoda. O flag é derivado (`carregando && esperaLonga`) e a limpeza zera
  // ao sair do carregamento, pro segundo carregamento não pular o atraso.
  useEffect(() => {
    if (!carregando) return;
    const t = setTimeout(() => setEsperaLonga(true), ATRASO_ESQUELETO);
    return () => {
      clearTimeout(t);
      setEsperaLonga(false);
    };
  }, [carregando]);

  const mostrarEsqueleto = carregando && esperaLonga;

  // Ciclo de três estados: neutro → ascendente → descendente → neutro.
  // Só uma coluna ordenada por vez.
  const ordenar = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
    setPage(1);
  };

  const ordenadas = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const fator = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
      return String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" }) * fator;
    });
  }, [rows, columns, sortKey, sortDir]);

  const totalPaginas = paginar ? Math.max(1, Math.ceil(ordenadas.length / pageSize)) : 1;
  const paginaSegura = Math.min(page, totalPaginas);
  const visiveis = paginar
    ? ordenadas.slice((paginaSegura - 1) * pageSize, paginaSegura * pageSize)
    : ordenadas;

  const idsVisiveis = visiveis.map(rowId);
  const selecionadosNaPagina = selecao
    ? idsVisiveis.filter((id) => selecao.selecionados.has(id))
    : [];
  const todosDaPagina =
    idsVisiveis.length > 0 && selecionadosNaPagina.length === idsVisiveis.length;
  const parcial = selecionadosNaPagina.length > 0 && !todosDaPagina;

  // Esc limpa a seleção.
  useEffect(() => {
    if (!selecao || selecao.selecionados.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.documentElement.hasAttribute("data-modal-open")) {
        selecao.onChange(new Set());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecao]);

  const alternarUm = (id: string, comShift: boolean) => {
    if (!selecao) return;
    const proximos = new Set(selecao.selecionados);

    // Shift+clique seleciona intervalo (dentro da página visível).
    if (comShift && ultimoClicado.current) {
      const i = idsVisiveis.indexOf(ultimoClicado.current);
      const j = idsVisiveis.indexOf(id);
      if (i >= 0 && j >= 0) {
        const [de, ate] = i < j ? [i, j] : [j, i];
        for (let k = de; k <= ate; k++) proximos.add(idsVisiveis[k]);
        selecao.onChange(proximos);
        ultimoClicado.current = id;
        return;
      }
    }

    if (proximos.has(id)) proximos.delete(id);
    else proximos.add(id);
    ultimoClicado.current = id;
    selecao.onChange(proximos);
  };

  const alternarPagina = () => {
    if (!selecao) return;
    const proximos = new Set(selecao.selecionados);
    if (todosDaPagina) idsVisiveis.forEach((id) => proximos.delete(id));
    else idsVisiveis.forEach((id) => proximos.add(id));
    selecao.onChange(proximos);
  };

  const colSpan = columns.length + (selecao ? 1 : 0) + (abrirLabel ? 1 : 0);
  const totalSelecionado = selecao?.selecionados.size ?? 0;

  return (
    <div data-testid={testId} className="space-y-4">
      {/* Chips de filtro ativos — ficam visíveis inclusive no vazio-por-filtro. */}
      {filtros && filtros.chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-xs uppercase tracking-widest text-text-muted">
            Filtros:
          </span>
          {filtros.chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemover}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-selected font-body text-xs text-navy hover:bg-border-soft focus-ring transition-colors duration-short"
            >
              {chip.label}
              <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-modal border border-border-soft bg-surface overflow-hidden">
        {/* Barra de ações em massa — gruda ACIMA do cabeçalho fixo. */}
        {selecao && totalSelecionado > 0 && (
          <div
            data-testid="tabela-barra-massa"
            className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-5 py-3 bg-feedback-error-bg text-feedback-error-fg"
          >
            <span className="font-body text-sm font-semibold">
              {totalSelecionado} {selecao.rotulo[totalSelecionado === 1 ? 0 : 1]} selecionado
              {totalSelecionado === 1 ? "" : "s"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {selecao.acoes.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => a.onClick([...selecao.selecionados])}
                  className={[
                    "h-8 px-3 rounded-sm font-body text-xs font-semibold focus-ring transition-colors duration-short",
                    a.destrutiva
                      ? "danger-inset text-feedback-error-fg hover:bg-primary-hover"
                      : "text-feedback-error-fg hover:bg-accent-soft/20",
                  ].join(" ")}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => selecao.onChange(new Set())}
              className="ml-auto h-8 px-3 rounded-sm font-body text-xs text-accent-soft hover:bg-accent-soft/20 focus-ring transition-colors duration-short"
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-muted">
                {selecao && (
                  <th className="w-12 px-5 py-3 sticky left-0 z-10 bg-surface-muted">
                    <Checkbox
                      checked={todosDaPagina}
                      indeterminate={parcial}
                      onChange={alternarPagina}
                      aria-label="Selecionar todos da página"
                    />
                  </th>
                )}
                {columns.map((col, i) => {
                  const ativa = sortKey === col.key;
                  const primeira = i === 0 && !selecao;
                  return (
                    <th
                      key={col.key}
                      aria-sort={ativa ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      className={[
                        "px-5 py-3 font-body text-[11px] leading-4 font-semibold uppercase tracking-wider text-navy",
                        col.numerica ? "text-right" : "text-left",
                        col.escondidaNoMobile ? "hidden md:table-cell" : "",
                        // Coluna de identificação fixa no mobile (D4).
                        primeira ? "sticky left-0 z-10 bg-surface-muted" : "",
                      ].join(" ")}
                    >
                      {col.sortValue ? (
                        // O alvo de clique é a CÉLULA inteira, não a seta.
                        <button
                          type="button"
                          onClick={() => ordenar(col.key)}
                          className={`w-full inline-flex items-center gap-1.5 uppercase tracking-wider focus-ring ${
                            col.numerica ? "justify-end" : "justify-start"
                          }`}
                        >
                          {col.header}
                          <span
                            aria-hidden="true"
                            className={ativa ? "text-gold" : "text-icon-muted"}
                          >
                            {ativa ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
                {abrirLabel && <th className="px-5 py-3 w-24" />}
              </tr>
            </thead>

            <tbody aria-busy={carregando || undefined}>
              {/* Erro de carregamento: o erro pertence ao lugar onde o dado
                  deveria estar — não é toast. */}
              {erro ? (
                <tr>
                  <td colSpan={colSpan} className="p-0">
                    <div className="m-5 px-5 py-6 rounded-md bg-feedback-error-bg text-feedback-error-fg text-center">
                      <p className="font-body text-sm">{erro.mensagem}</p>
                      {erro.onTentarDeNovo && (
                        <button
                          type="button"
                          onClick={erro.onTentarDeNovo}
                          className="mt-3 h-9 px-4 rounded-md danger-inset font-body text-sm font-semibold focus-ring"
                        >
                          Tentar de novo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : carregando ? (
                mostrarEsqueleto ? (
                  Array.from({ length: LINHAS_ESQUELETO }).map((_, i) => (
                    <tr key={i} className="border-t border-border-soft">
                      {selecao && <td className="px-5 py-4" />}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-5 py-4 ${col.escondidaNoMobile ? "hidden md:table-cell" : ""}`}
                        >
                          <span className="block h-3 rounded-sm bg-skeleton anim-skeleton" />
                        </td>
                      ))}
                      {abrirLabel && <td className="px-5 py-4" />}
                    </tr>
                  ))
                ) : null
              ) : visiveis.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-16 text-center">
                    {filtros && filtros.chips.length > 0 ? (
                      <div className="space-y-3">
                        <p className="font-display text-xl text-navy">
                          Nada bate com esses filtros
                        </p>
                        <p className="font-body text-sm text-text-muted">
                          Existem {filtros.totalBase} registros na base. Os {filtros.chips.length}{" "}
                          filtros ativos acima estão escondendo todos eles.
                        </p>
                        <button
                          type="button"
                          onClick={filtros.onLimpar}
                          className="h-9.5 px-5 rounded-md border border-border-strong font-body text-sm font-semibold text-navy hover:bg-surface-selected focus-ring transition-colors duration-short"
                        >
                          Limpar filtros
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="font-display text-xl text-navy">
                          {vazio?.titulo ?? "Nada por aqui ainda"}
                        </p>
                        {vazio?.descricao && (
                          <p className="font-body text-sm text-text-muted max-w-md mx-auto">
                            {vazio.descricao}
                          </p>
                        )}
                        {vazio?.acao}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                visiveis.map((row) => {
                  const id = rowId(row);
                  const marcada = selecao?.selecionados.has(id) ?? false;
                  return (
                    <tr
                      key={id}
                      tabIndex={aoAbrir ? 0 : undefined}
                      data-testid="tabela-linha"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && aoAbrir) aoAbrir(row);
                        if (e.key === " " && selecao) {
                          e.preventDefault();
                          alternarUm(id, false);
                        }
                      }}
                      onClick={(e) => {
                        if (!aoAbrir) return;
                        // Ignora clique no checkbox, no botão de ação e em
                        // texto selecionado.
                        const alvo = e.target as HTMLElement;
                        if (alvo.closest("input,button,a")) return;
                        if (window.getSelection()?.toString()) return;
                        aoAbrir(row);
                      }}
                      className={[
                        "border-t border-border-soft transition-colors duration-[90ms] focus-ring",
                        marcada ? "bg-surface-selected" : "bg-surface hover:bg-surface-app",
                        aoAbrir ? "cursor-pointer hover:row-accent" : "",
                      ].join(" ")}
                    >
                      {selecao && (
                        <td className="px-5 py-4 sticky left-0 z-10 bg-inherit">
                          <Checkbox
                            checked={marcada}
                            onChange={(e) => alternarUm(id, (e.nativeEvent as MouseEvent).shiftKey)}
                            aria-label={`Selecionar linha ${id}`}
                          />
                        </td>
                      )}
                      {columns.map((col, i) => {
                        const primeira = i === 0 && !selecao;
                        return (
                          <td
                            key={col.key}
                            className={[
                              "px-5 py-3 font-body text-sm text-dark align-middle",
                              col.numerica ? "text-right tabular-nums" : "text-left",
                              col.escondidaNoMobile ? "hidden md:table-cell" : "",
                              primeira ? "sticky left-0 z-10 bg-inherit" : "",
                              col.className ?? "",
                            ].join(" ")}
                          >
                            {col.render(row)}
                          </td>
                        );
                      })}
                      {abrirLabel && (
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => aoAbrir?.(row)}
                            className="font-body text-sm text-navy hover:text-gold focus-ring transition-colors duration-short"
                          >
                            {abrirLabel}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginar && !erro && !carregando && ordenadas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 font-body text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest">Itens por página</span>
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  // Trocar itens por página volta pra página 1 e PRESERVA a
                  // seleção (ela é por id, não por posição).
                  setPageSize(n);
                  setPage(1);
                }}
                className={`h-8 w-9 rounded-sm focus-ring transition-colors duration-short ${
                  pageSize === n
                    ? "bg-surface-selected text-navy font-semibold"
                    : "hover:bg-surface-app"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="tabular-nums">
            {intervalo(
              (paginaSegura - 1) * pageSize + 1,
              Math.min(paginaSegura * pageSize, ordenadas.length),
              ordenadas.length,
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, paginaSegura - 1))}
              disabled={paginaSegura === 1}
              aria-label="Página anterior"
              className="h-8 w-8 rounded-sm hover:bg-surface-app disabled:text-text-disabled disabled:cursor-not-allowed focus-ring"
            >
              ‹
            </button>
            <span className="tabular-nums">
              {paginaSegura} / {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPaginas, paginaSegura + 1))}
              disabled={paginaSegura === totalPaginas}
              aria-label="Próxima página"
              className="h-8 w-8 rounded-sm hover:bg-surface-app disabled:text-text-disabled disabled:cursor-not-allowed focus-ring"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Checkbox com estado indeterminado (só a propriedade DOM o expressa). */
function Checkbox({
  indeterminate = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="w-4 h-4 rounded-sm border-icon-muted accent-gold focus-ring cursor-pointer"
      {...props}
    />
  );
}
