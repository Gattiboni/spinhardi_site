import {
  listPipelineStepsResilient,
  listOpportunities,
} from "@/lib/integrations/clickmassa";
import type { Opportunity, PipelineStep } from "@/lib/integrations/clickmassa";
import { supabaseAdmin } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";
import { forceRefreshPipelineStepsAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Funil de Vendas · Admin",
};

// ─── Formatadores ──────────────────────────────────────────────────────────

function brl(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(color);
}

function dataFormatada(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "");
}

// ─── Card de oportunidade ──────────────────────────────────────────────────

function OppCard({
  opp,
  contactName,
}: {
  opp: Opportunity;
  // Nome resolvido do Supabase; fallback para opp.contact.name (geralmente telefone)
  contactName: string;
}) {
  return (
    <Link
      href={`/admin/funil/${opp.id}`}
      className="block bg-white border border-dark/10 rounded-md p-4 hover:border-gold hover:shadow-sm transition-all duration-short group"
    >
      <p className="font-body font-medium text-sm text-dark group-hover:text-navy leading-snug line-clamp-2">
        {opp.name}
      </p>
      {opp.value != null && (
        <p className="font-body text-xs font-semibold text-green mt-1">{brl(opp.value)}</p>
      )}
      {contactName && (
        <p className="font-body text-xs text-dark/50 mt-1 truncate">{contactName}</p>
      )}
      {opp.responsible?.name && (
        <p className="font-body text-xs text-dark/40 mt-0.5 truncate">{opp.responsible.name}</p>
      )}
      {opp.expectedCloseDate && (
        <p className="font-body text-xs text-dark/40 mt-1">{dataFormatada(opp.expectedCloseDate)}</p>
      )}
    </Link>
  );
}

// ─── Coluna do Kanban ──────────────────────────────────────────────────────

function KanbanColumn({
  step,
  opps,
  contactMap,
  error,
}: {
  step: PipelineStep;
  opps: Opportunity[];
  contactMap: Map<string, string>;
  error?: string;
}) {
  const total = opps.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const headerColor = isValidHex(step.color) ? step.color : "#1a2b4a";

  return (
    <div className="flex flex-col w-72 shrink-0 bg-dark/3 rounded-lg overflow-hidden">
      <div
        className="px-4 py-3"
        style={{ backgroundColor: `${headerColor}20`, borderBottom: `2px solid ${headerColor}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-body font-semibold text-sm truncate"
            style={{ color: headerColor }}
          >
            {step.name}
          </h2>
          <span
            className="font-body text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: headerColor, color: "#fff" }}
          >
            {opps.length}
          </span>
        </div>
        {total > 0 && (
          <p className="font-body text-xs mt-1 text-dark/60">{brl(total)}</p>
        )}
      </div>

      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {error ? (
          <p className="font-body text-xs text-red-500 text-center py-4">
            Erro ao carregar coluna
          </p>
        ) : opps.length === 0 ? (
          <p className="font-body text-xs text-dark/40 text-center py-4">
            Nenhuma oportunidade
          </p>
        ) : (
          opps.map((opp) => {
            const contactName =
              contactMap.get(String(opp.contactId)) ?? opp.contact?.name ?? "";
            return <OppCard key={opp.id} opp={opp} contactName={contactName} />;
          })
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function FunilPage() {
  // 1. Pipeline steps via cache resiliente (absorve Quirk 2 -- 500 intermitente)
  const { steps, source: stepsSource, error: stepsError } = await listPipelineStepsResilient();
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  // 2. Oportunidades por stage em paralelo (falha por coluna, nao derruba tudo)
  const oppsResults =
    sortedSteps.length > 0
      ? await Promise.allSettled(
          sortedSteps.map((s) => listOpportunities({ pipelineStepId: s.id })),
        )
      : [];

  // 3. JOIN com Supabase para nome real do contato
  // clickmassa_contact_id e TEXT no DB; opp.contactId e number da API
  const allOpps = oppsResults
    .filter(
      (r): r is PromiseFulfilledResult<Opportunity[]> => r.status === "fulfilled",
    )
    .flatMap((r) => r.value);

  const contactIdStrings = [...new Set(allOpps.map((o) => String(o.contactId)))];

  let contactMap = new Map<string, string>();
  if (contactIdStrings.length > 0) {
    const { data: supabaseContacts } = await supabaseAdmin()
      .from("contacts")
      .select("name, clickmassa_contact_id")
      .in("clickmassa_contact_id", contactIdStrings);

    if (supabaseContacts) {
      contactMap = new Map(
        (
          supabaseContacts as {
            name: string;
            clickmassa_contact_id: string | null;
          }[]
        )
          .filter((c) => c.clickmassa_contact_id != null)
          .map((c) => [c.clickmassa_contact_id as string, c.name]),
      );
    }
  }

  const totalOpps = allOpps.length;
  const totalValor = allOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);

  // 4. Estado vazio: sem steps e API fora
  if (sortedSteps.length === 0 && stepsError) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-3xl text-navy">Funil de Vendas</h1>
        </header>
        <div className="max-w-sm mx-auto text-center py-16">
          <p className="font-body text-dark/60 mb-4">
            Aguardando sincronizacao inicial com ClickMassa
          </p>
          <form action={forceRefreshPipelineStepsAction}>
            <button
              type="submit"
              className="font-body text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy/90 transition-colors"
            >
              Forcar sincronizacao agora
            </button>
          </form>
          <p className="font-body text-xs text-dark/40 mt-3">{stepsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-navy">Funil de Vendas</h1>
        <p className="font-body text-sm text-dark/60 mt-1">
          {totalOpps} oportunidade{totalOpps !== 1 ? "s" : ""} · {brl(totalValor)} no funil
          {stepsSource === "stale-cache" && (
            <span className="ml-2 text-amber-600">(etapas do cache local)</span>
          )}
        </p>
      </header>

      {stepsError && (
        <div className="mb-4 px-4 py-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="font-body text-sm text-amber-800">
            Etapas carregadas do cache local (API indisponivel): {stepsError}
          </p>
        </div>
      )}

      {sortedSteps.length === 0 && !stepsError && (
        <p className="font-body text-sm text-dark/50">
          Nenhuma etapa de funil configurada no ClickMassa.
        </p>
      )}

      {sortedSteps.length > 0 && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${sortedSteps.length * 304}px` }}>
            {sortedSteps.map((step, idx) => {
              const result = oppsResults[idx];
              const opps =
                result?.status === "fulfilled" ? result.value : [];
              const colError =
                result?.status === "rejected"
                  ? result.reason instanceof Error
                    ? result.reason.message
                    : "Erro desconhecido"
                  : undefined;
              return (
                <KanbanColumn
                  key={step.id}
                  step={step}
                  opps={opps}
                  contactMap={contactMap}
                  error={colError}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
