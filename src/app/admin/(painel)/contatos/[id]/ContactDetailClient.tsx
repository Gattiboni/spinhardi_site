"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StageBadge from "@/components/admin/StageBadge";
import FinanceiroForm from "@/components/admin/FinanceiroForm";
import { formatDateTime } from "@/lib/utils/date";
import { saveGestaoInterna, sendWhatsAppWelcome } from "./actions";
import {
  type ContactExternalLink,
  findLink,
} from "@/lib/contacts/external-links-shared";
import { buildPanelUrl } from "@/lib/integrations/panel-urls";
import {
  type Contact,
  type ContactInteraction,
  type ContactInteractionType,
  type EstagioFunil,
  ESTAGIOS_OPTIONS,
  ESTAGIO_LABELS,
  ORIGEM_LABELS,
  DESTINO_LABELS,
  ORCAMENTO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
} from "@/lib/contacts/types";

const LOTE_C_ALERT = "Implementação completa virá no Lote C";

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

function whatsappLink(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
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

// ── Coluna 1: Dados pessoais ────────────────────────────────────
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

// ── Coluna 2: Qualificação ──────────────────────────────────────
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

// ── "Abrir na origem": deep-link montado do vínculo externo ─────
// URL vem de PANEL_URLS + provider/external_id do vínculo. Enquanto o template
// estiver vazio, o botão fica desabilitado (tooltip "configurar URL do painel").
// Nunca inventa rota.
function AbrirNaOrigem({
  provider,
  link,
  label,
}: {
  provider: string;
  link: ContactExternalLink | null;
  label: string;
}) {
  const url = link ? buildPanelUrl(provider, link.externalId) : null;

  if (!url) {
    return (
      <button
        type="button"
        disabled
        title="configurar URL do painel"
        className="text-dark/40 font-body text-sm cursor-not-allowed"
      >
        {label} →
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gold hover:underline font-body text-sm"
    >
      {label} →
    </a>
  );
}

// ── Ações por canal ─────────────────────────────────────────────
// Monta as ações a partir dos canais que o contato TEM (não do campo `origem`):
//  - vínculo ClickMassa → "Mandar WhatsApp" (sendMessage via lib, mensagem inicial).
//  - email              → "Mandar email" (mailto: no cliente da operadora).
function AcoesCard({
  contact: c,
  temClickmassa,
}: {
  contact: Contact;
  temClickmassa: boolean;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const handleWhatsApp = async () => {
    if (!confirm(`Enviar a mensagem inicial de WhatsApp para ${c.name}?`)) return;
    setSending(true);
    setFeedback(null);
    const result = await sendWhatsAppWelcome(c.id);
    setSending(false);
    if (result.success) {
      setFeedback({ type: "ok", text: "Mensagem enviada." });
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível enviar." });
    }
  };

  const semCanal = !temClickmassa && !c.email;

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Ações</h2>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        {temClickmassa && (
          <Button variant="primary" size="md" onClick={handleWhatsApp} disabled={sending}>
            {sending ? "Enviando..." : "💬 Mandar WhatsApp"}
          </Button>
        )}

        {c.email && (
          <a
            href={`mailto:${c.email}?subject=${encodeURIComponent("Spinhardi Turismo")}`}
            className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-base px-6 py-3 border-2 border-gold text-gold hover:bg-gold hover:text-dark transition-colors duration-medium"
          >
            📧 Mandar email
          </a>
        )}

        {semCanal && (
          <p className="font-body text-sm text-dark/50">
            Sem canal disponível — sem vínculo ClickMassa nem e-mail.
          </p>
        )}

        {feedback && (
          <span
            className={`font-body text-sm ${feedback.type === "ok" ? "text-green-700" : "text-red-600"}`}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Coluna 3: Sistemas externos ─────────────────────────────────
function SistemasExternosCard({
  contact: c,
  iddasLink,
  clickmassaLink,
}: {
  contact: Contact;
  iddasLink: ContactExternalLink | null;
  clickmassaLink: ContactExternalLink | null;
}) {
  const handleForcarSync = () => {
    alert(`Forçar nova sincronização com Iddas e ClickMassa.\n\n${LOTE_C_ALERT}.`);
  };

  return (
    <div className={cardClass}>
      <h2 className={cardTitleClass}>Sistemas externos</h2>

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
        <AbrirNaOrigem provider="iddas" link={iddasLink} label="Abrir no Iddas" />
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
        <AbrirNaOrigem provider="clickmassa" link={clickmassaLink} label="Abrir no ClickMassa" />
      </div>

      <hr className="border-dark/10" />

      <Field label="Última sync">
        {c.iddasUltimoSync ? formatDateTime(c.iddasUltimoSync) : <Vazio />}
      </Field>

      <Button variant="secondary" size="sm" onClick={handleForcarSync}>
        Forçar nova sync
      </Button>
    </div>
  );
}

// ── Gestão interna ──────────────────────────────────────────────
function GestaoInternaForm({ contact: c }: { contact: Contact }) {
  const router = useRouter();
  const [estagio, setEstagio] = useState<EstagioFunil>(c.estagio);
  const [followUp, setFollowUp] = useState(c.proximoFollowUp ?? "");
  const [notas, setNotas] = useState(c.notasInternas);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const handleSalvar = async () => {
    setSaving(true);
    setFeedback(null);

    const result = await saveGestaoInterna(c.id, {
      estagio,
      proximoFollowUp: followUp.trim() ? followUp : null,
      notasInternas: notas,
    });

    setSaving(false);
    if (result.success) {
      setFeedback({ type: "ok", text: "Alterações salvas." });
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível salvar." });
    }
  };

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Gestão interna</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
        <div>
          <label
            htmlFor="estagio"
            className="text-gold uppercase tracking-widest text-xs font-body mb-2 block"
          >
            Estágio
          </label>
          <select
            id="estagio"
            value={estagio}
            onChange={(e) => setEstagio(e.target.value as EstagioFunil)}
            className={`${inputClass} w-full`}
          >
            {ESTAGIOS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ESTAGIO_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="followup"
            className="text-gold uppercase tracking-widest text-xs font-body mb-2 block"
          >
            Próximo follow-up
          </label>
          <input
            id="followup"
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">Tags</p>
        <div className="flex flex-wrap items-center gap-2">
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
            <span className="font-body text-sm text-dark/40">Sem tags</span>
          )}
          <button
            type="button"
            onClick={() => alert(`Adicionar tag.\n\n${LOTE_C_ALERT}.`)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dark/20 text-dark/60 hover:border-gold hover:text-gold transition-colors duration-short"
            aria-label="Adicionar tag"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6">
        <label
          htmlFor="notas"
          className="text-gold uppercase tracking-widest text-xs font-body mb-2 block"
        >
          Notas internas
        </label>
        <textarea
          id="notas"
          rows={4}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className={`${inputClass} w-full resize-none`}
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Button variant="primary" size="md" onClick={handleSalvar} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
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
  );
}

// ── Timeline de interações ──────────────────────────────────────
function InteracoesTimeline({ interactions }: { interactions: ContactInteraction[] }) {
  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Interações ({interactions.length})</h2>

      {interactions.length === 0 ? (
        <p className="font-body text-sm text-dark/50 mt-5">Nenhuma interação registrada ainda.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {interactions.map((it) => (
            <li key={it.id} className="flex gap-4">
              <span className="text-xl shrink-0" aria-hidden="true">
                {INTERACTION_ICON[it.tipo]}
              </span>
              <div className="min-w-0">
                <p className="font-body text-sm text-dark">{it.descricao}</p>
                <p className="font-body text-xs text-dark/50 mt-0.5">
                  {formatDateTime(it.criadoEm)} · {it.criadoPor}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function ContactDetailClient({
  contact,
  interactions,
  externalLinks,
}: {
  contact: Contact;
  interactions: ContactInteraction[];
  externalLinks: ContactExternalLink[];
}) {
  // Canais e deep-links vêm do VÍNCULO externo, não das colunas de origem.
  const clickmassaLink = findLink(externalLinks, "clickmassa");
  const iddasLink = findLink(externalLinks, "iddas");

  return (
    <div>
      <Link
        href="/admin/contatos"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        ← Voltar pra lista
      </Link>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-navy">{contact.name}</h1>
          <StageBadge estagio={contact.estagio} />
        </div>
        <p className="font-body text-sm text-dark/60 mt-2">
          Recebida em {formatDateTime(contact.createdAt)} · Via {ORIGEM_LABELS[contact.origem]}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <DadosCard contact={contact} />
        <QualificacaoCard contact={contact} />
        <SistemasExternosCard
          contact={contact}
          iddasLink={iddasLink}
          clickmassaLink={clickmassaLink}
        />
      </div>

      <AcoesCard contact={contact} temClickmassa={clickmassaLink !== null} />

      <GestaoInternaForm contact={contact} />

      <FinanceiroForm contactId={contact.id} />

      <InteracoesTimeline interactions={interactions} />
    </div>
  );
}
