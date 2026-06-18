import {
  getOpportunity,
  listPipelineSteps,
  listUsers,
  listTags,
  ClickMassaError,
} from "@/lib/integrations/clickmassa";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditOpportunityForm from "./EditOpportunityForm";
import StatusActionsBar from "./StatusActionsBar";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const opp = await getOpportunity(Number(id));
    return { title: `${opp.name} · Funil · Admin` };
  } catch {
    return { title: "Oportunidade · Funil · Admin" };
  }
}

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

function dataFormatada(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/\./g, "");
}

// ─── Sub-componentes de exibicao ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gold uppercase tracking-widest text-xs font-body mb-1">{label}</p>
      <div className="font-body text-sm text-dark">{children}</div>
    </div>
  );
}

function Vazio() {
  return <span className="text-dark/40">(nao informado)</span>;
}

const STATUS_LABEL: Record<"open" | "won" | "lost", string> = {
  open: "Aberta",
  won: "Ganha",
  lost: "Perdida",
};

const STATUS_COLOR: Record<"open" | "won" | "lost", string> = {
  open: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-700",
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function OportunidadeDetalhe({ params }: Props) {
  const { id } = await params;
  const oppId = Number(id);

  if (isNaN(oppId)) notFound();

  let opp;
  try {
    opp = await getOpportunity(oppId);
  } catch (err) {
    if (err instanceof ClickMassaError && err.status === 404) notFound();
    const msg =
      err instanceof ClickMassaError
        ? `${err.code}: ${err.message}`
        : (err as Error).message;
    return (
      <div>
        <Link
          href="/admin/funil"
          className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
        >
          Voltar ao funil
        </Link>
        <div className="px-4 py-3 rounded-md bg-red-50 border border-red-200">
          <p className="font-body text-sm text-red-700">Erro ao carregar oportunidade: {msg}</p>
        </div>
      </div>
    );
  }

  const [steps, users, tags] = await Promise.all([
    listPipelineSteps().catch(() => []),
    listUsers().catch(() => []),
    listTags().catch(() => []),
  ]);

  const cardClass = "bg-white border border-dark/10 rounded-md p-6 space-y-5";
  const cardTitleClass = "font-display text-xl text-navy mb-2 pb-3 border-b border-dark/10";

  return (
    <div>
      <Link
        href="/admin/funil"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        Voltar ao funil
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-navy">{opp.name}</h1>
          <p className="font-body text-sm text-dark/60 mt-1">
            Criada em {dataFormatada(opp.createdAt)}
            {opp.pipelineStep && ` · ${opp.pipelineStep.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full font-body text-xs font-semibold ${STATUS_COLOR[opp.status]}`}
          >
            {STATUS_LABEL[opp.status]}
          </span>
        </div>
      </header>

      {/* Cards de dados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados principais */}
        <div className={cardClass}>
          <h2 className={cardTitleClass}>Dados</h2>
          <Field label="Valor">{opp.value != null ? brl(opp.value) : <Vazio />}</Field>
          <Field label="Data prevista">{dataFormatada(opp.expectedCloseDate)}</Field>
          <Field label="Etapa">
            {opp.pipelineStep?.name ?? <Vazio />}
          </Field>
          {opp.description && (
            <Field label="Descricao">
              <p className="leading-relaxed text-dark/80">{opp.description}</p>
            </Field>
          )}
        </div>

        {/* Contato e responsavel */}
        <div className={cardClass}>
          <h2 className={cardTitleClass}>Contato e Responsavel</h2>
          <Field label="Contato">
            {opp.contact ? (
              <div>
                <p>{opp.contact.name}</p>
                {opp.contact.phone && (
                  <p className="text-dark/60">{opp.contact.phone}</p>
                )}
              </div>
            ) : opp.contactId ? (
              <span className="text-dark/60">ID: {opp.contactId}</span>
            ) : (
              <Vazio />
            )}
          </Field>
          <Field label="Responsavel">
            {opp.responsible?.name ?? <Vazio />}
          </Field>
          {opp.gainOrLossReasonId && (
            <Field label="Motivo">
              {opp.gainOrLossReasonId}
            </Field>
          )}
        </div>

        {/* Produtos */}
        <div className={cardClass}>
          <h2 className={cardTitleClass}>Produtos</h2>
          {opp.productsOpportunity && opp.productsOpportunity.length > 0 ? (
            <ul className="space-y-2">
              {opp.productsOpportunity.map((p, i) => (
                <li key={i} className="flex items-center justify-between font-body text-sm">
                  <span className="text-dark/60">ID {p.productId} x{p.amount}</span>
                  <span className="font-semibold">{brl(p.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-dark/40">Nenhum produto associado</p>
          )}
          {tags.length > 0 && (
            <div className="pt-3 border-t border-dark/10">
              <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">Tags disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 10).map((t) => (
                  <span
                    key={t.id || t.tag}
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-body text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acoes de status */}
      <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
        <h2 className={cardTitleClass}>Acoes</h2>
        <StatusActionsBar opportunityId={opp.id} currentStatus={opp.status} />
      </div>

      {/* Formulario de edicao */}
      <EditOpportunityForm opp={opp} steps={steps} users={users} />
    </div>
  );
}
