"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StageBadge from "@/components/admin/StageBadge";
import AnexosBlock from "@/components/admin/AnexosBlock";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import {
  criarAtendimento,
  addContactNote,
  editContactNote,
  deleteContactNote,
} from "./actions";
import type { Anexo } from "@/lib/anexos/types";
import {
  diasParado,
  DIAS_PARADO_ALERTA,
  type Jornada,
} from "@/lib/jornadas/types";
import {
  type ContactExternalLink,
  findLink,
} from "@/lib/contacts/external-links-shared";
import { buildPanelUrl, clickmassaContactUrl } from "@/lib/integrations/panel-urls";
import {
  type Contact,
  type ContactInteraction,
  type ContactInteractionType,
  ORIGEM_LABELS,
  DESTINO_LABELS,
  ORCAMENTO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
} from "@/lib/contacts/types";

const SYNC_STATUS_LABEL: Record<Contact["iddasSyncStatus"], string> = {
  synced: "✓ Sincronizado",
  pending: "⏳ Pendente",
  failed: "✗ Falhou",
};

const INTERACTION_ICON: Record<ContactInteractionType, string> = {
  form_submission: "📝",
  whatsapp_recebido: "💬",
  whatsapp_enviado: "💬",
  email_recebido: "📧",
  email_enviado: "📧",
  ligacao: "📞",
  reuniao: "🤝",
  nota_interna: "🗒️",
  mudanca_estagio: "🎯",
  sync_iddas: "🔄",
  sync_clickmassa: "🔄",
  tag_adicionada: "🏷️",
  tag_removida: "🏷️",
};

// BRL com centavos — detalhe operacional do contato (valores fechados individuais).
const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// BRL sem centavos — resumo gerencial do topo ("R$ X em vendas").
const moedaResumo = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function whatsappLink(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
}

function iniciais(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function passageirosResumo(c: Contact): string {
  const partes: string[] = [];
  partes.push(`${c.passageirosAdultos} adulto${c.passageirosAdultos !== 1 ? "s" : ""}`);
  if (c.passageirosCriancas > 0)
    partes.push(`${c.passageirosCriancas} criança${c.passageirosCriancas !== 1 ? "s" : ""}`);
  if (c.passageirosBebes > 0)
    partes.push(`${c.passageirosBebes} bebê${c.passageirosBebes !== 1 ? "s" : ""}`);
  return partes.join(" · ");
}

// ── Field helper ────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gold uppercase tracking-widest text-xs font-body mb-1">{label}</p>
      <div className="font-body text-sm text-dark">{children}</div>
    </div>
  );
}

function Vazio() {
  return <span className="text-dark/40">(não informado)</span>;
}

const cardClass = "bg-white border border-dark/10 rounded-md p-6 space-y-5";
const cardTitleClass = "font-display text-xl text-navy mb-2 pb-3 border-b border-dark/10";

// ── Header: identidade + resumo + ações ─────────────────────────
// Resumo gerencial enxuto (D072): cliente desde, nº de jornadas, total vendido
// (soma de `valor` das jornadas GANHAS). Sem épico financeiro aqui.
function ContatoHeader({
  contact,
  abertas,
  fechadas,
}: {
  contact: Contact;
  abertas: Jornada[];
  fechadas: Jornada[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const nJornadas = abertas.length + fechadas.length;
  const totalVendas = fechadas
    .filter((j) => j.estagio === "aprovado")
    .reduce((s, j) => s + (j.valor ?? 0), 0);

  const cmUrl = clickmassaContactUrl(contact.clickmassaContactId);
  const temCmId = contact.clickmassaContactId != null;

  const handleNovoAtendimento = async () => {
    setCriando(true);
    setFeedback(null);
    const result = await criarAtendimento(contact.id);
    setCriando(false);
    if (result.success) {
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível criar o atendimento." });
    }
  };

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center font-display text-lg">
            {iniciais(contact.name)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-navy truncate">{contact.name}</h1>
            <p className="font-body text-sm text-dark/60 mt-1">
              Cliente desde {formatDate(contact.createdAt)} · {nJornadas} jornada
              {nJornadas !== 1 ? "s" : ""}
              {totalVendas > 0 && ` · ${moedaResumo.format(totalVendas)} em vendas`}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center gap-3">
            {temCmId &&
              (cmUrl ? (
                <a
                  href={cmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-sm px-4 py-2 bg-gold text-dark hover:bg-gold/90 transition-colors duration-medium"
                >
                  💬 WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="configurar NEXT_PUBLIC_CLICKMASSA_PANEL_URL"
                  className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-sm px-4 py-2 border border-dark/15 text-dark/40 cursor-not-allowed"
                >
                  💬 WhatsApp
                </button>
              ))}
            <Button variant="secondary" size="sm" onClick={handleNovoAtendimento} disabled={criando}>
              {criando ? "Criando..." : "+ Novo atendimento"}
            </Button>
          </div>
          {feedback && (
            <span
              className={`font-body text-sm ${feedback.type === "ok" ? "text-green-700" : "text-red-600"}`}
            >
              {feedback.text}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Coluna: Dados pessoais ──────────────────────────────────────
function DadosCard({ contact: c }: { contact: Contact }) {
  return (
    <div className={cardClass}>
      <h2 className={cardTitleClass}>Dados</h2>

      <Field label="WhatsApp">
        <a
          href={whatsappLink(c.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-navy hover:text-gold transition-colors duration-short"
        >
          {c.whatsapp} <span className="text-gold">[Abrir]</span>
        </a>
      </Field>

      <Field label="E-mail">{c.email ?? <Vazio />}</Field>
      <Field label="CPF">{c.cpf ?? <Vazio />}</Field>
      <Field label="Nascimento">{c.dataNascimento ?? <Vazio />}</Field>
      <Field label="Nacionalidade">{c.nacionalidade}</Field>
      <Field label="Cidade">
        {c.cidade ? `${c.cidade}${c.estado ? ` · ${c.estado}` : ""}` : <Vazio />}
      </Field>
      <Field label="CEP">{c.cep ?? <Vazio />}</Field>
    </div>
  );
}

// ── Coluna: Qualificação ────────────────────────────────────────
function QualificacaoCard({ contact: c }: { contact: Contact }) {
  return (
    <div className={cardClass}>
      <h2 className={cardTitleClass}>Qualificação</h2>

      <Field label="Origem">
        {ORIGEM_LABELS[c.origem]}
        {c.origemDetalhe ? ` · ${c.origemDetalhe}` : ""}
      </Field>

      <Field label="Destino">
        <p>{DESTINO_LABELS[c.destinoTipo]}</p>
        {c.destinoTexto && <p className="text-dark/60 mt-1 leading-relaxed">{c.destinoTexto}</p>}
      </Field>

      <Field label="Prazo">{PRAZO_LABELS[c.prazoIdeal]}</Field>
      <Field label="Orçamento">{ORCAMENTO_LABELS[c.orcamentoEstimado]}</Field>
      <Field label="Perfil">{PERFIL_LABELS[c.perfilViajante]}</Field>
      <Field label="Passageiros">{passageirosResumo(c)}</Field>

      {(c.dataIda || c.dataVolta) && (
        <Field label="Datas">
          {c.dataIda ?? "?"} → {c.dataVolta ?? "?"}
        </Field>
      )}

      {c.experienciaAnterior && <Field label="Experiência anterior">{c.experienciaAnterior}</Field>}
      {c.restricoes && <Field label="Restrições">{c.restricoes}</Field>}
    </div>
  );
}

// ── Jornadas do contato (D072) ──────────────────────────────────
// Abertas em destaque (estágio + dias parado); fechadas como histórico (valor +
// desfecho), recolhidas além de um teto com "ver todas as fechadas". Cada uma
// linka pro detalhe da jornada.
const FECHADAS_VISIVEIS = 5;

function JornadasZone({
  abertas,
  fechadas,
}: {
  abertas: Jornada[];
  fechadas: Jornada[];
}) {
  const [verTodas, setVerTodas] = useState(false);
  const fechadasVisiveis = verTodas ? fechadas : fechadas.slice(0, FECHADAS_VISIVEIS);

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Jornadas</h2>

      {/* Abertas */}
      <div className="mt-4">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-3">Abertas</p>
        {abertas.length === 0 ? (
          <p className="font-body text-sm text-dark/50">Nenhuma jornada aberta.</p>
        ) : (
          <ul className="space-y-2">
            {abertas.map((j) => {
              const dias = diasParado(j.estagioAtualizadoEm);
              const parado = dias > DIAS_PARADO_ALERTA;
              return (
                <li key={j.id}>
                  <Link
                    href={`/admin/jornadas/${j.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 border border-dark/10 rounded-md hover:border-gold transition-colors duration-short"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-dark truncate">
                        {j.tituloJornada ?? "Atendimento sem título"}
                      </p>
                      <p
                        className={`font-body text-xs mt-0.5 ${
                          parado ? "text-red-600 font-medium" : "text-dark/40"
                        }`}
                      >
                        {dias} dia{dias !== 1 ? "s" : ""} parado
                      </p>
                    </div>
                    <StageBadge estagio={j.estagio} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Fechadas (histórico) */}
      {fechadas.length > 0 && (
        <div className="mt-6">
          <p className="text-gold uppercase tracking-widest text-xs font-body mb-3">Histórico</p>
          <ul className="divide-y divide-dark/5 border border-dark/10 rounded-md">
            {fechadasVisiveis.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/admin/jornadas/${j.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-dark/3 transition-colors duration-short"
                >
                  <span className="font-body text-sm text-dark/70 min-w-0 truncate">
                    {j.tituloJornada ?? "Atendimento sem título"}
                    {j.closedAt ? ` · ${formatDate(j.closedAt)}` : ""}
                    {j.valor != null ? ` · ${moedaBRL.format(j.valor)}` : ""}
                  </span>
                  <StageBadge estagio={j.estagio} />
                </Link>
              </li>
            ))}
          </ul>
          {fechadas.length > FECHADAS_VISIVEIS && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              className="mt-3 font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
            >
              {verTodas
                ? "Mostrar menos"
                : `Ver todas as fechadas (${fechadas.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preferências (tags) ─────────────────────────────────────────
function PreferenciasCard({ contact: c }: { contact: Contact }) {
  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Preferências</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {c.tags.length > 0 ? (
          c.tags.map((t) => (
            <span
              key={t}
              className="inline-block px-3 py-1 rounded-full text-xs font-body bg-gold/10 text-gold"
            >
              {t}
            </span>
          ))
        ) : (
          <span className="font-body text-sm text-dark/40">Sem preferências marcadas.</span>
        )}
      </div>
    </div>
  );
}

// ── Sistemas externos (recolhido) ───────────────────────────────
// <details> fechado por padrão: encanamento de integração não fica na cara. Iddas
// com botão "Abrir no Iddas" presente mas DESABILITADO (URL real do registro não
// confirmada — ver panel-urls.ts). ClickMassa abre o perfil no painel via env.
function SistemasExternosDetails({
  contact: c,
  iddasLink,
}: {
  contact: Contact;
  iddasLink: ContactExternalLink | null;
}) {
  const iddasUrl = buildPanelUrl("iddas", iddasLink?.externalId ?? c.iddasPessoaId);
  const cmUrl = clickmassaContactUrl(c.clickmassaContactId);

  return (
    <details className="bg-white border border-dark/10 rounded-md mt-6 group">
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-navy">Sistemas externos</h2>
        <span className="font-body text-sm text-dark/40 group-open:hidden">mostrar</span>
        <span className="font-body text-sm text-dark/40 hidden group-open:inline">ocultar</span>
      </summary>

      <div className="px-6 pb-6 space-y-5 border-t border-dark/10 pt-5">
        {/* Iddas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-body font-medium text-dark">Iddas</p>
            <span className="font-body text-sm text-dark/70">
              {SYNC_STATUS_LABEL[c.iddasSyncStatus]}
            </span>
          </div>
          <dl className="font-body text-sm text-dark/70 space-y-1">
            <div className="flex justify-between gap-3">
              <dt>Pessoa</dt>
              <dd>{c.iddasPessoaId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Cotação</dt>
              <dd>{c.iddasCotacaoCode ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Orçamento</dt>
              <dd>{c.iddasOrcamentoId ?? "—"}</dd>
            </div>
            {c.iddasVendaId && (
              <div className="flex justify-between gap-3">
                <dt>Venda</dt>
                <dd>{c.iddasVendaId}</dd>
              </div>
            )}
          </dl>
          {c.iddasSyncError && (
            <p className="text-red-600 text-xs font-body">Erro: {c.iddasSyncError}</p>
          )}
          {iddasUrl ? (
            <a
              href={iddasUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline font-body text-sm"
            >
              Abrir no Iddas →
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="URL do painel do Iddas ainda não confirmada"
              className="text-dark/40 font-body text-sm cursor-not-allowed"
            >
              Abrir no Iddas →
            </button>
          )}
        </div>

        <hr className="border-dark/10" />

        {/* ClickMassa */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-body font-medium text-dark">ClickMassa</p>
            <span className="font-body text-sm text-dark/70">
              {SYNC_STATUS_LABEL[c.clickmassaSyncStatus]}
            </span>
          </div>
          <dl className="font-body text-sm text-dark/70 space-y-1">
            <div className="flex justify-between gap-3">
              <dt>Contact</dt>
              <dd>{c.clickmassaContactId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Ticket atual</dt>
              <dd>{c.clickmassaTicketIds.at(-1) ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Etapa</dt>
              <dd>{c.clickmassaPipelineStep ?? "—"}</dd>
            </div>
          </dl>
          {c.clickmassaSyncError && (
            <p className="text-red-600 text-xs font-body">Erro: {c.clickmassaSyncError}</p>
          )}
          {cmUrl ? (
            <a
              href={cmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline font-body text-sm"
            >
              Abrir no ClickMassa →
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="configurar NEXT_PUBLIC_CLICKMASSA_PANEL_URL"
              className="text-dark/40 font-body text-sm cursor-not-allowed"
            >
              Abrir no ClickMassa →
            </button>
          )}
        </div>

        <hr className="border-dark/10" />

        <Field label="Última sync">
          {c.iddasUltimoSync ? formatDateTime(c.iddasUltimoSync) : <Vazio />}
        </Field>
      </div>
    </details>
  );
}

// ── Timeline de interações ──────────────────────────────────────
// Cronológica, mais recente no topo. Eventos de sistema são read-only; só notas
// internas (tipo `nota_interna`) têm menu de Editar/Excluir. Tarefas (o que fazer)
// vivem na jornada, não aqui — aqui é só o que ACONTECEU + adicionar nota.
function InteracoesTimeline({
  contactId,
  interactions,
}: {
  contactId: string;
  interactions: ContactInteraction[];
}) {
  const router = useRouter();
  const [novaNota, setNovaNota] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const ordered = [...interactions].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const handleAdd = async () => {
    const texto = novaNota.trim();
    if (!texto) return;
    setAdding(true);
    setFeedback(null);
    const result = await addContactNote(contactId, texto);
    setAdding(false);
    if (result.success) {
      setNovaNota("");
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível salvar a nota." });
    }
  };

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Interações ({interactions.length})</h2>

      <div className="mt-5">
        <label
          htmlFor="nova-nota"
          className="text-gold uppercase tracking-widest text-xs font-body mb-2 block"
        >
          Adicionar nota
        </label>
        <textarea
          id="nova-nota"
          rows={3}
          value={novaNota}
          onChange={(e) => setNovaNota(e.target.value)}
          placeholder="Anote o que foi tratado com este contato…"
          className={`${inputClass} w-full resize-none`}
        />
        <div className="mt-2 flex items-center gap-4">
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding || !novaNota.trim()}>
            {adding ? "Salvando..." : "Adicionar nota"}
          </Button>
          {feedback && (
            <span
              className={`font-body text-sm ${feedback.type === "ok" ? "text-green-700" : "text-red-600"}`}
            >
              {feedback.text}
            </span>
          )}
        </div>
      </div>

      <hr className="border-dark/10 my-6" />

      {ordered.length === 0 ? (
        <p className="font-body text-sm text-dark/50">Nenhuma interação registrada ainda.</p>
      ) : (
        <ul className="space-y-4">
          {ordered.map((it) => (
            <TimelineItem key={it.id} interaction={it} contactId={contactId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineItem({
  interaction: it,
  contactId,
}: {
  interaction: ContactInteraction;
  contactId: string;
}) {
  const router = useRouter();
  const isNota = it.tipo === "nota_interna";
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState(it.descricao);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleSaveEdit = async () => {
    const novo = texto.trim();
    if (!novo) {
      setErro("A nota não pode ficar vazia.");
      return;
    }
    setBusy(true);
    setErro(null);
    const result = await editContactNote(contactId, it.id, novo);
    setBusy(false);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setErro(result.error ?? "Não foi possível editar.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta nota? Não dá pra desfazer.")) return;
    setBusy(true);
    setErro(null);
    setMenuOpen(false);
    const result = await deleteContactNote(contactId, it.id);
    setBusy(false);
    if (result.success) {
      router.refresh();
    } else {
      setErro(result.error ?? "Não foi possível excluir.");
    }
  };

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  return (
    <li className="flex gap-4">
      <span className="text-xl shrink-0" aria-hidden="true">
        {INTERACTION_ICON[it.tipo]}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div>
            <textarea
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={`${inputClass} w-full resize-none`}
            />
            <div className="mt-2 flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTexto(it.descricao);
                  setErro(null);
                }}
                className="font-body text-sm text-dark/60 hover:text-dark"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-sm text-dark whitespace-pre-wrap break-words">
                {it.descricao}
              </p>
              <p className="font-body text-xs text-dark/50 mt-0.5">
                {formatDateTime(it.criadoEm)} · {it.criadoPor}
              </p>
            </div>

            {isNota && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  disabled={busy}
                  aria-label="Ações da nota"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="px-2 py-1 rounded-md text-dark/40 hover:text-dark hover:bg-dark/5 transition-colors duration-short"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-32 bg-white border border-dark/10 rounded-md shadow-md py-1 z-10"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 font-body text-sm text-dark hover:bg-dark/5"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDelete}
                      className="block w-full text-left px-3 py-2 font-body text-sm text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {erro && <p className="font-body text-xs text-red-600 mt-1">{erro}</p>}
      </div>
    </li>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function ContactDetailClient({
  contact,
  interactions,
  externalLinks,
  jornadas,
  anexos,
}: {
  contact: Contact;
  interactions: ContactInteraction[];
  externalLinks: ContactExternalLink[];
  jornadas: { abertas: Jornada[]; fechadas: Jornada[] };
  anexos: Anexo[];
}) {
  const iddasLink = findLink(externalLinks, "iddas");

  return (
    <div>
      <Link
        href="/admin/contatos"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        ← Voltar pra lista
      </Link>

      <ContatoHeader contact={contact} abertas={jornadas.abertas} fechadas={jornadas.fechadas} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <DadosCard contact={contact} />
        <QualificacaoCard contact={contact} />
      </div>

      <JornadasZone abertas={jornadas.abertas} fechadas={jornadas.fechadas} />

      <PreferenciasCard contact={contact} />

      <SistemasExternosDetails contact={contact} iddasLink={iddasLink} />

      <AnexosBlock owner={{ kind: "contact", id: contact.id }} anexos={anexos} />

      <InteracoesTimeline contactId={contact.id} interactions={interactions} />
    </div>
  );
}
