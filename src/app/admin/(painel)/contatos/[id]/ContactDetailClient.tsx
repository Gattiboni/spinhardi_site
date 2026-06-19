"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StageBadge from "@/components/admin/StageBadge";
import FinanceiroForm from "@/components/admin/FinanceiroForm";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import {
  saveGestaoInterna,
  sendWhatsAppWelcome,
  addContactNote,
  editContactNote,
  deleteContactNote,
} from "./actions";
import type { ContactComercial } from "@/lib/contacts/comercial";
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

// BRL com centavos — detalhe operacional do contato (o dashboard gerencial usa
// uma versão sem centavos; aqui valores individuais importam no detalhe).
const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const handleSalvar = async () => {
    setSaving(true);
    setFeedback(null);

    const result = await saveGestaoInterna(c.id, {
      estagio,
      proximoFollowUp: followUp.trim() ? followUp : null,
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
            disabled
            title="Tags entram numa rodada própria (o bulk de tags ainda não persiste)"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dark/15 text-dark/30 cursor-not-allowed"
            aria-label="Adicionar tag (em breve — rodada de tags própria)"
          >
            +
          </button>
        </div>
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

// ── Resumo comercial e financeiro ───────────────────────────────
// Duas fontes lado a lado, proveniência visível: Iddas (bronze, lido server-only)
// e manual (silver `negocios`). A soma do topo separa as duas. Sem valor → "—".
function ComercialResumoCard({ comercial }: { comercial: ContactComercial }) {
  const { iddas, manual, temPessoaIddas } = comercial;
  const totalGeral = iddas.totalVendas + manual.totalVenda;

  const semNada =
    iddas.orcamentos.length === 0 && iddas.vendas.length === 0 && manual.negocios.length === 0;

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Comercial &amp; financeiro</h2>

      {/* Soma unificada, separando Iddas de manual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
        <div className="rounded-md bg-dark/5 p-4">
          <p className="font-body text-xs uppercase tracking-widest text-dark/50">
            Vendas Iddas
          </p>
          <p className="font-display text-2xl text-navy mt-1">{moedaBRL.format(iddas.totalVendas)}</p>
          <p className="font-body text-xs text-dark/50 mt-1">
            {iddas.vendas.length} venda(s) · {iddas.orcamentos.length} orçamento(s)
          </p>
        </div>
        <div className="rounded-md bg-dark/5 p-4">
          <p className="font-body text-xs uppercase tracking-widest text-dark/50">
            Vendas manuais
          </p>
          <p className="font-display text-2xl text-navy mt-1">{moedaBRL.format(manual.totalVenda)}</p>
          <p className="font-body text-xs text-dark/50 mt-1">{manual.negocios.length} negócio(s)</p>
        </div>
        <div className="rounded-md bg-gold/10 p-4">
          <p className="font-body text-xs uppercase tracking-widest text-gold">Total</p>
          <p className="font-display text-2xl text-navy mt-1">{moedaBRL.format(totalGeral)}</p>
          <p className="font-body text-xs text-dark/50 mt-1">Iddas + manual</p>
        </div>
      </div>

      {semNada && (
        <p className="font-body text-sm text-dark/50 mt-5">
          {temPessoaIddas
            ? "Nenhum orçamento, venda ou negócio registrado pra este contato."
            : "Contato sem cadastro no Iddas e sem negócio manual registrado."}
        </p>
      )}

      {/* Iddas */}
      {(iddas.orcamentos.length > 0 || iddas.vendas.length > 0) && (
        <div className="mt-6">
          <p className="font-body font-medium text-dark mb-3">
            Iddas <span className="text-dark/40 text-xs">(do ERP, leitura)</span>
          </p>

          {iddas.vendas.length > 0 && (
            <div className="mb-4">
              <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">Vendas</p>
              <ul className="divide-y divide-dark/5 border border-dark/10 rounded-md">
                {iddas.vendas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="font-body text-sm text-dark/70">
                      {v.data ? formatDate(v.data) : "—"}
                      {v.situacaoLabel ? ` · ${v.situacaoLabel}` : ""}
                    </span>
                    <span className="font-body text-sm text-dark">
                      {v.valor !== null ? moedaBRL.format(v.valor) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {iddas.orcamentos.length > 0 && (
            <div>
              <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">
                Orçamentos
              </p>
              <ul className="divide-y divide-dark/5 border border-dark/10 rounded-md">
                {iddas.orcamentos.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="font-body text-sm text-dark/70 min-w-0 truncate">
                      {o.data ? formatDate(o.data) : "—"}
                      {o.situacaoLabel ? ` · ${o.situacaoLabel}` : ""}
                      {o.titulo ? ` · ${o.titulo}` : ""}
                    </span>
                    <span className="font-body text-sm text-dark shrink-0">
                      {o.valor !== null ? moedaBRL.format(o.valor) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Manual */}
      {manual.negocios.length > 0 && (
        <div className="mt-6">
          <p className="font-body font-medium text-dark mb-3">
            Manual <span className="text-dark/40 text-xs">(lançado no back-office)</span>
          </p>
          <ul className="divide-y divide-dark/5 border border-dark/10 rounded-md">
            {manual.negocios.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="font-body text-sm text-dark/70">
                  {n.data ? formatDate(n.data) : "—"}
                  {n.situacao ? ` · ${n.situacao}` : ""}
                  {n.lucro !== null ? ` · lucro ${moedaBRL.format(n.lucro)}` : ""}
                </span>
                <span className="font-body text-sm text-dark">
                  {n.venda !== null ? moedaBRL.format(n.venda) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Timeline de interações ──────────────────────────────────────
// Cronológica, mais recente no topo. Eventos de sistema são read-only; só notas
// internas (tipo `nota_interna`) têm menu de Editar/Excluir. Campo de nova nota
// grava uma `nota_interna` (criadoPor = back-office, sem identidade inventada).
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

  // Mais recente no topo, sem depender da ordem que veio do servidor.
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

      {/* Nova nota */}
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

// Uma linha da timeline. Notas internas ganham menu (Editar/Excluir) e modo de
// edição inline; eventos de sistema renderizam só leitura.
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

  // Fecha o menu ao clicar fora.
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
  comercial,
}: {
  contact: Contact;
  interactions: ContactInteraction[];
  externalLinks: ContactExternalLink[];
  comercial: ContactComercial;
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

      <ComercialResumoCard comercial={comercial} />

      <FinanceiroForm contactId={contact.id} />

      <InteracoesTimeline contactId={contact.id} interactions={interactions} />
    </div>
  );
}
