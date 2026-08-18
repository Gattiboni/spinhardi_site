"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal, { type ConfirmResult } from "@/components/ui/primitives/Modal";
import StageBadge from "@/components/admin/StageBadge";
import WhatsAppBadge from "@/components/admin/WhatsAppBadge";
import AnexosBlock from "@/components/admin/AnexosBlock";
import { formatDate, formatDateTime, formatDateTimeShort } from "@/lib/utils/date";
import {
  criarAtendimento,
  addContactNote,
  editContactNote,
  deleteContactNote,
  updateContactDados,
  updateContactQualificacao,
} from "./actions";
import {
  normalizeDadosPessoais,
  normalizeQualificacao,
  type DadosPessoaisForm,
  type QualificacaoForm,
} from "@/lib/contacts/edit-validation";
import type { Anexo } from "@/lib/anexos/types";
import { diasParado, DIAS_PARADO_ALERTA, type Jornada } from "@/lib/jornadas/types";
import { type ContactExternalLink, findLink } from "@/lib/contacts/external-links-shared";
import { clickmassaContactUrl, iddasPessoaUrl } from "@/lib/integrations/panel-urls";
import {
  type Contact,
  type ContactInteraction,
  type ContactInteractionType,
  type CaptureOrigin,
  type DestinoTipo,
  type OrcamentoEstimado,
  type PerfilViajante,
  type PrazoIdeal,
  ORIGEM_LABELS,
  DESTINO_LABELS,
  ORCAMENTO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
  ORIGENS_OPTIONS,
  DESTINOS_OPTIONS,
  ORCAMENTOS_OPTIONS,
  PERFIS_OPTIONS,
  PRAZOS_OPTIONS,
} from "@/lib/contacts/types";
import type { FormSubmissionPayload } from "@/lib/contacts/from-form";
import TagsCard from "./TagsCard";
import EmailMarketingCard, { type HistoricoEmail } from "./EmailMarketingCard";
import type { TagClickMassa, TagInterna } from "@/lib/tags/shared";
import type { Grupo } from "@/lib/grupos/types";

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

// Tooltip do link de ClickMassa quando ele não abre. Texto pra USUÁRIA: nome de
// env não aparece em lugar nenhum da tela (a Nina não configura Vercel). O
// detalhe técnico — falta `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` — fica aqui no
// código, que é onde serve pra alguma coisa.
function clickmassaIndisponivelTitle(temContactId: boolean): string {
  return temContactId
    ? "integração do ClickMassa ainda não configurada"
    : "contato sem vínculo no ClickMassa";
}

// Tooltip único do Iddas dormente (D3) — mesmo texto no cabeçalho e no card de
// sistemas externos.
const IDDAS_DORMENTE_TITLE = "aguardando mudança de acesso dev";

const cardClass = "bg-white border border-dark/10 rounded-md p-6 space-y-5";
const cardTitleClass = "font-display text-xl text-navy mb-2 pb-3 border-b border-dark/10";

// ── Edição inline dos cards (M1) ────────────────────────────────
// Mesmas classes de input/label da edição rápida da lista e do resto do painel.
const editInputClass =
  "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";
const editLabelClass = "text-gold uppercase tracking-widest text-xs font-body mb-1 block";

// Cabeçalho do card com o botão "Editar" à direita. Mesma régua visual do
// `cardTitleClass` (título + borda inferior), só que em linha com a ação.
//
// `ultimaEdicao` é o carimbo de edição HUMANA daquele card — não o `updatedAt`
// do contato, que o sync também sobe. Nunca editado à mão (null, ou coluna ainda
// não migrada) → não renderiza nada.
function CardHeader({
  title,
  editing,
  ultimaEdicao,
  onEdit,
}: {
  title: string;
  editing: boolean;
  ultimaEdicao: string | null;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2 pb-3 border-b border-dark/10">
      <h2 className="font-display text-xl text-navy">{title}</h2>
      <div className="flex items-center gap-3 shrink-0">
        {ultimaEdicao && (
          <span className="font-body text-xs text-dark/40 whitespace-nowrap">
            ult. edição {formatDateTimeShort(ultimaEdicao, { comAno: true })}
          </span>
        )}
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
          >
            Editar
          </button>
        )}
      </div>
    </div>
  );
}

// Barra Salvar/Cancelar + erro, idêntica nos dois cards editáveis.
function EditActions({
  saving,
  erro,
  onSave,
  onCancel,
}: {
  saving: boolean;
  erro: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-1">
      <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="font-body text-sm text-dark/60 hover:text-dark transition-colors duration-short"
      >
        Cancelar
      </button>
      {erro && <span className="font-body text-sm text-red-600">{erro}</span>}
    </div>
  );
}

function EditField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={editLabelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

// `<select>` de campo com vocabulário fechado. As opções vêm SEMPRE das listas
// de `@/lib/contacts/types` (mesmas do form de criação, iguais aos CHECK do
// banco) — nenhum valor é escrito à mão aqui.
function EditSelect<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <EditField label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${editInputClass} w-full`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </EditField>
  );
}

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
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [criando, setCriando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  const nJornadas = abertas.length + fechadas.length;
  const totalVendas = fechadas
    .filter((j) => j.estagio === "aprovado")
    .reduce((s, j) => s + (j.valor ?? 0), 0);

  const cmUrl = clickmassaContactUrl(contact.clickmassaContactId);
  const temCmId = contact.clickmassaContactId != null;

  // "Ver no Iddas" (D3): DORMENTE. Só aparece pra contato com `iddas_pessoa_id`, e
  // hoje sempre desabilitado — `iddasPessoaUrl()` devolve null enquanto o padrão
  // de URL não for confirmado. Quando for, a ativação é 1 edição em
  // `panel-urls.ts`; este componente não muda.
  const iddasUrl = iddasPessoaUrl(contact.iddasPessoaId);
  const temIddasId = contact.iddasPessoaId != null;

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  const abrirForm = () => {
    setFeedback(null);
    setMostrarForm(true);
  };

  const cancelarForm = () => {
    setMostrarForm(false);
    setTitulo("");
    setFeedback(null);
  };

  const handleCriarAtendimento = async () => {
    const t = titulo.trim();
    if (!t) return;
    setCriando(true);
    setFeedback(null);
    const result = await criarAtendimento(contact.id, t);
    setCriando(false);
    if (result.success) {
      setTitulo("");
      setMostrarForm(false);
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

        <div className="flex flex-col items-end gap-2">
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
                  title={clickmassaIndisponivelTitle(temCmId)}
                  className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-sm px-4 py-2 border border-dark/15 text-dark/40 cursor-not-allowed"
                >
                  💬 WhatsApp
                </button>
              ))}
            {temIddasId &&
              (iddasUrl ? (
                <a
                  href={iddasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-sm px-4 py-2 border border-navy/20 text-navy hover:border-gold hover:text-gold transition-colors duration-medium"
                >
                  🗂️ Ver no Iddas
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={IDDAS_DORMENTE_TITLE}
                  className="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium text-sm px-4 py-2 border border-dark/15 text-dark/40 cursor-not-allowed"
                >
                  🗂️ Ver no Iddas
                </button>
              ))}
            {!mostrarForm && (
              <Button variant="secondary" size="sm" onClick={abrirForm}>
                + Novo atendimento
              </Button>
            )}
          </div>

          {/* Um campo só, obrigatório — a usuária é leiga: label clara + exemplo. */}
          {mostrarForm && (
            <div className="w-72 max-w-full text-left">
              <label
                htmlFor="titulo-atendimento"
                className="text-gold uppercase tracking-widest text-xs font-body mb-1 block"
              >
                Título do atendimento
              </label>
              <input
                id="titulo-atendimento"
                type="text"
                autoFocus
                maxLength={80}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCriarAtendimento();
                  } else if (e.key === "Escape") {
                    cancelarForm();
                  }
                }}
                placeholder="Ex.: Cancún família Silva"
                className={`${inputClass} w-full`}
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelarForm}
                  className="font-body text-sm text-dark/60 hover:text-dark"
                >
                  Cancelar
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCriarAtendimento}
                  disabled={criando || !titulo.trim()}
                >
                  {criando ? "Criando..." : "Criar"}
                </Button>
              </div>
            </div>
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
    </header>
  );
}

// ── Coluna: Dados pessoais ──────────────────────────────────────
// Leitura + edição inline (M1). O WhatsApp aponta pro perfil do contato no
// ClickMassa (W1): nenhum `wa.me` sobrevive na ficha. Sem `clickmassa_contact_id`
// ou sem a env do painel (W2), o número é texto puro — nada de link de fallback.
function dadosFormFrom(c: Contact): DadosPessoaisForm {
  return {
    name: c.name,
    whatsapp: c.whatsapp ?? "",
    email: c.email ?? "",
    cpf: c.cpf ?? "",
    dataNascimento: c.dataNascimento ?? "",
    cidade: c.cidade ?? "",
    estado: c.estado ?? "",
    cep: c.cep ?? "",
  };
}

function DadosCard({ contact: c }: { contact: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Estado do form é semeado ao ABRIR a edição (não na montagem): depois de
  // salvar, o card segue montado e o `contact` chega novo pelo refresh.
  const [form, setForm] = useState<DadosPessoaisForm>(() => dadosFormFrom(c));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Data que o browser não conseguiu interpretar (ex: 31/02/2026). O
  // `<input type="date">` devolve value="" nesse caso — a validação receberia
  // "campo vazio", salvaria null e o erro morreria em silêncio, apagando o que a
  // pessoa digitou sem avisar. `validity.badInput` é o único sinal de que havia
  // algo digitado.
  //
  // Precisa do REF além do estado: quando o campo estava vazio e a pessoa digita
  // uma data impossível, o `value` continua "" e o browser pode não disparar
  // change nenhum — aí o flag do onChange nunca chega. No salvar, perguntamos ao
  // próprio input.
  const [nascimentoIlegivel, setNascimentoIlegivel] = useState(false);
  const nascimentoRef = useRef<HTMLInputElement>(null);

  const cmUrl = clickmassaContactUrl(c.clickmassaContactId);

  const abrirEdicao = () => {
    setForm(dadosFormFrom(c));
    setErro(null);
    setNascimentoIlegivel(false);
    setEditing(true);
  };

  const cancelar = () => {
    setEditing(false);
    setErro(null);
    setNascimentoIlegivel(false);
  };

  const campo = (nome: keyof DadosPessoaisForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [nome]: e.target.value }));

  const campoNascimento = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNascimentoIlegivel(e.target.validity.badInput);
    setForm((f) => ({ ...f, dataNascimento: e.target.value }));
  };

  const salvar = async () => {
    const dataIlegivel = nascimentoIlegivel || (nascimentoRef.current?.validity.badInput ?? false);
    if (dataIlegivel) {
      setNascimentoIlegivel(true);
      setErro("Data de nascimento inválida.");
      return;
    }
    // Mesma regra do servidor, aplicada antes do roundtrip (fonte única em
    // `edit-validation.ts`). A action revalida tudo de novo por conta dela.
    const parsed = normalizeDadosPessoais(form, c);
    if (!parsed.ok) {
      setErro(parsed.error);
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await updateContactDados(c.id, form);
    setSaving(false);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setErro(result.error ?? "Não foi possível salvar.");
    }
  };

  return (
    <div className={cardClass}>
      <CardHeader
        title="Dados"
        editing={editing}
        ultimaEdicao={c.dadosEditadoEm}
        onEdit={abrirEdicao}
      />

      {editing ? (
        <div className="space-y-4">
          <EditField label="Nome *" htmlFor="dados-name">
            <input
              id="dados-name"
              type="text"
              value={form.name}
              onChange={campo("name")}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditField label="WhatsApp *" htmlFor="dados-whatsapp">
            <input
              id="dados-whatsapp"
              type="tel"
              value={form.whatsapp}
              onChange={campo("whatsapp")}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditField label="E-mail" htmlFor="dados-email">
            <input
              id="dados-email"
              type="email"
              value={form.email}
              onChange={campo("email")}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditField label="CPF" htmlFor="dados-cpf">
            <input
              id="dados-cpf"
              type="text"
              value={form.cpf}
              onChange={campo("cpf")}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditField label="Nascimento" htmlFor="dados-nascimento">
            <input
              id="dados-nascimento"
              ref={nascimentoRef}
              type="date"
              value={form.dataNascimento}
              onChange={campoNascimento}
              aria-invalid={nascimentoIlegivel}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <EditField label="Cidade" htmlFor="dados-cidade">
                <input
                  id="dados-cidade"
                  type="text"
                  value={form.cidade}
                  onChange={campo("cidade")}
                  className={`${editInputClass} w-full`}
                />
              </EditField>
            </div>
            <EditField label="UF" htmlFor="dados-estado">
              <input
                id="dados-estado"
                type="text"
                maxLength={2}
                value={form.estado}
                onChange={campo("estado")}
                className={`${editInputClass} w-full`}
              />
            </EditField>
          </div>

          <EditField label="CEP" htmlFor="dados-cep">
            <input
              id="dados-cep"
              type="text"
              value={form.cep}
              onChange={campo("cep")}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditActions saving={saving} erro={erro} onSave={salvar} onCancel={cancelar} />
        </div>
      ) : (
        <>
          <Field label="WhatsApp">
            <span className="inline-flex items-center gap-2">
              {c.whatsapp ? (
                cmUrl ? (
                  <a
                    href={cmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy hover:text-gold transition-colors duration-short"
                  >
                    {c.whatsapp} <span className="text-gold">[Abrir]</span>
                  </a>
                ) : (
                  // W2: sem vínculo no ClickMassa ou sem a env do painel, o
                  // número fica texto puro — sem link nenhum.
                  <span>{c.whatsapp}</span>
                )
              ) : (
                <Vazio />
              )}
              <WhatsAppBadge temWhatsapp={c.temWhatsapp} />
            </span>
          </Field>

          <Field label="E-mail">{c.email ?? <Vazio />}</Field>
          <Field label="CPF">{c.cpf ?? <Vazio />}</Field>
          {/* `formatDate` parseia data-só no fuso LOCAL de propósito — ver
              utils/date.ts. Sem isso, "2008-02-03" viraria 02/02 em -03. */}
          <Field label="Nascimento">
            {c.dataNascimento ? formatDate(c.dataNascimento) : <Vazio />}
          </Field>
          <Field label="Nacionalidade">{c.nacionalidade}</Field>
          <Field label="Cidade">
            {c.cidade ? `${c.cidade}${c.estado ? ` · ${c.estado}` : ""}` : <Vazio />}
          </Field>
          <Field label="CEP">{c.cep ?? <Vazio />}</Field>
        </>
      )}
    </div>
  );
}

// ── Coluna: Qualificação ────────────────────────────────────────
// Campos INTERNOS do back-office (M1): editáveis livremente, o sync nunca os
// toca. Os selects saem das listas de `types.ts` — as mesmas do form de criação,
// iguais aos CHECK constraints da tabela.
function qualificacaoFormFrom(c: Contact): QualificacaoForm {
  return {
    origem: c.origem,
    origemDetalhe: c.origemDetalhe ?? "",
    destinoTipo: c.destinoTipo,
    destinoTexto: c.destinoTexto ?? "",
    prazoIdeal: c.prazoIdeal,
    orcamentoEstimado: c.orcamentoEstimado,
    perfilViajante: c.perfilViajante,
    passageirosAdultos: c.passageirosAdultos,
    passageirosCriancas: c.passageirosCriancas,
    passageirosBebes: c.passageirosBebes,
  };
}

function QualificacaoCard({ contact: c }: { contact: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<QualificacaoForm>(() => qualificacaoFormFrom(c));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abrirEdicao = () => {
    setForm(qualificacaoFormFrom(c));
    setErro(null);
    setEditing(true);
  };

  const cancelar = () => {
    setEditing(false);
    setErro(null);
  };

  const setCampo = <K extends keyof QualificacaoForm>(nome: K, valor: QualificacaoForm[K]) =>
    setForm((f) => ({ ...f, [nome]: valor }));

  const contador =
    (nome: "passageirosAdultos" | "passageirosCriancas" | "passageirosBebes") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCampo(nome, Number(e.target.value));

  const salvar = async () => {
    const parsed = normalizeQualificacao(form);
    if (!parsed.ok) {
      setErro(parsed.error);
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await updateContactQualificacao(c.id, form);
    setSaving(false);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setErro(result.error ?? "Não foi possível salvar.");
    }
  };

  return (
    <div className={cardClass}>
      <CardHeader
        title="Qualificação"
        editing={editing}
        ultimaEdicao={c.qualificacaoEditadoEm}
        onEdit={abrirEdicao}
      />

      {editing ? (
        <div className="space-y-4">
          <EditSelect
            id="qual-origem"
            label="Origem"
            value={form.origem}
            options={ORIGENS_OPTIONS}
            labels={ORIGEM_LABELS}
            onChange={(v: CaptureOrigin) => setCampo("origem", v)}
          />

          <EditField label="Detalhe da origem" htmlFor="qual-origem-detalhe">
            <input
              id="qual-origem-detalhe"
              type="text"
              value={form.origemDetalhe}
              onChange={(e) => setCampo("origemDetalhe", e.target.value)}
              className={`${editInputClass} w-full`}
            />
          </EditField>

          <EditSelect
            id="qual-destino"
            label="Destino"
            value={form.destinoTipo}
            options={DESTINOS_OPTIONS}
            labels={DESTINO_LABELS}
            onChange={(v: DestinoTipo) => setCampo("destinoTipo", v)}
          />

          <EditField label="Detalhes do destino" htmlFor="qual-destino-texto">
            <textarea
              id="qual-destino-texto"
              rows={2}
              value={form.destinoTexto}
              onChange={(e) => setCampo("destinoTexto", e.target.value)}
              className={`${editInputClass} w-full resize-none`}
            />
          </EditField>

          <EditSelect
            id="qual-prazo"
            label="Prazo"
            value={form.prazoIdeal}
            options={PRAZOS_OPTIONS}
            labels={PRAZO_LABELS}
            onChange={(v: PrazoIdeal) => setCampo("prazoIdeal", v)}
          />

          <EditSelect
            id="qual-orcamento"
            label="Orçamento"
            value={form.orcamentoEstimado}
            options={ORCAMENTOS_OPTIONS}
            labels={ORCAMENTO_LABELS}
            onChange={(v: OrcamentoEstimado) => setCampo("orcamentoEstimado", v)}
          />

          <EditSelect
            id="qual-perfil"
            label="Perfil"
            value={form.perfilViajante}
            options={PERFIS_OPTIONS}
            labels={PERFIL_LABELS}
            onChange={(v: PerfilViajante) => setCampo("perfilViajante", v)}
          />

          <div>
            <p className={editLabelClass}>Passageiros</p>
            <div className="grid grid-cols-3 gap-3">
              <EditField label="Adultos" htmlFor="qual-adultos">
                <input
                  id="qual-adultos"
                  type="number"
                  min={1}
                  value={form.passageirosAdultos}
                  onChange={contador("passageirosAdultos")}
                  className={`${editInputClass} w-full`}
                />
              </EditField>
              <EditField label="Crianças" htmlFor="qual-criancas">
                <input
                  id="qual-criancas"
                  type="number"
                  min={0}
                  value={form.passageirosCriancas}
                  onChange={contador("passageirosCriancas")}
                  className={`${editInputClass} w-full`}
                />
              </EditField>
              <EditField label="Bebês" htmlFor="qual-bebes">
                <input
                  id="qual-bebes"
                  type="number"
                  min={0}
                  value={form.passageirosBebes}
                  onChange={contador("passageirosBebes")}
                  className={`${editInputClass} w-full`}
                />
              </EditField>
            </div>
          </div>

          <EditActions saving={saving} erro={erro} onSave={salvar} onCancel={cancelar} />
        </div>
      ) : (
        <>
          <Field label="Origem">
            {ORIGEM_LABELS[c.origem]}
            {c.origemDetalhe ? ` · ${c.origemDetalhe}` : ""}
          </Field>

          <Field label="Destino">
            <p>{DESTINO_LABELS[c.destinoTipo]}</p>
            {c.destinoTexto && (
              <p className="text-dark/60 mt-1 leading-relaxed">{c.destinoTexto}</p>
            )}
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

          {c.experienciaAnterior && (
            <Field label="Experiência anterior">{c.experienciaAnterior}</Field>
          )}
          {c.restricoes && <Field label="Restrições">{c.restricoes}</Field>}
        </>
      )}
    </div>
  );
}

// ── Jornadas do contato (D072) ──────────────────────────────────
// Abertas em destaque (estágio + dias parado); fechadas como histórico (valor +
// desfecho), recolhidas além de um teto com "ver todas as fechadas". Cada uma
// linka pro detalhe da jornada.
const FECHADAS_VISIVEIS = 5;

function JornadasZone({ abertas, fechadas }: { abertas: Jornada[]; fechadas: Jornada[] }) {
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
              {verTodas ? "Mostrar menos" : `Ver todas as fechadas (${fechadas.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sistemas externos (recolhido) ───────────────────────────────
// <details> fechado por padrão: encanamento de integração não fica na cara, mas o
// card FICA — ids e status de sync são a informação que ninguém mais mostra.
//
// Os dois links consomem os MESMOS helpers dos botões do cabeçalho
// (`iddasPessoaUrl` / `clickmassaContactUrl`), então ligam e desligam juntos. A
// repetição cabeçalho↔card é de propósito: aqui é diagnóstico, lá é atalho.
function SistemasExternosDetails({
  contact: c,
  iddasLink,
}: {
  contact: Contact;
  iddasLink: ContactExternalLink | null;
}) {
  // Mesmo ponto único de ativação do botão do cabeçalho (D3): quando o padrão de
  // URL do Iddas for confirmado, os dois ligam juntos com uma edição só.
  const iddasUrl = iddasPessoaUrl(iddasLink?.externalId ?? c.iddasPessoaId);
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
              title={IDDAS_DORMENTE_TITLE}
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
              title={clickmassaIndisponivelTitle(c.clickmassaContactId != null)}
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !novaNota.trim()}
          >
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

// Payload do form gravado no metadata da interaction `form_submission` (ver
// `buildFormSubmissionPayload`). Leitura defensiva: metadata é jsonb solto e
// interactions antigas não têm `formSubmission`.
function parseFormSubmission(
  metadata: Record<string, unknown>,
): Partial<FormSubmissionPayload> | null {
  const fs = metadata?.formSubmission;
  if (!fs || typeof fs !== "object") return null;
  return fs as Partial<FormSubmissionPayload>;
}

function labelOf<K extends string>(map: Record<K, string>, key: unknown): string | null {
  return typeof key === "string" && key in map ? map[key as K] : null;
}

function passageirosLinha(a: number, c: number, b: number): string {
  const partes = [`${a} adulto${a !== 1 ? "s" : ""}`];
  if (c > 0) partes.push(`${c} criança${c !== 1 ? "s" : ""}`);
  if (b > 0) partes.push(`${b} bebê${b !== 1 ? "s" : ""}`);
  return partes.join(" · ");
}

// Renderização legível (nada de JSON cru) do que a pessoa preencheu no form —
// pros dois caminhos da captura (contato novo e reincidente). Só mostra os campos
// que vieram preenchidos.
function FormSubmissionDetails({ data }: { data: Partial<FormSubmissionPayload> }) {
  const rows: Array<{ label: string; value: string }> = [];

  if (data.nome) rows.push({ label: "Nome informado", value: data.nome });
  if (data.whatsapp) rows.push({ label: "WhatsApp", value: data.whatsapp });
  if (data.email) rows.push({ label: "E-mail", value: data.email });

  const destino = labelOf(DESTINO_LABELS, data.destinoTipo);
  if (destino) {
    rows.push({
      label: "Destino",
      value: data.destinoTexto ? `${destino} — ${data.destinoTexto}` : destino,
    });
  }

  const prazo = labelOf(PRAZO_LABELS, data.prazoIdeal);
  if (prazo) {
    rows.push({ label: "Quando", value: data.dataIda ? `${prazo} · data ${data.dataIda}` : prazo });
  }

  if (typeof data.passageirosAdultos === "number") {
    rows.push({
      label: "Passageiros",
      value: passageirosLinha(
        data.passageirosAdultos,
        data.passageirosCriancas ?? 0,
        data.passageirosBebes ?? 0,
      ),
    });
  }

  const perfil = labelOf(PERFIL_LABELS, data.perfilViajante);
  if (perfil) rows.push({ label: "Perfil", value: perfil });

  const orcamento = labelOf(ORCAMENTO_LABELS, data.orcamentoEstimado);
  if (orcamento) rows.push({ label: "Orçamento", value: orcamento });

  if (rows.length === 0 && !data.observacao) return null;

  return (
    <div className="mt-3 rounded-md border border-dark/10 bg-dark/3 px-4 py-3">
      <p className="text-gold uppercase tracking-widest text-[11px] font-body mb-2">
        O que pediu no formulário
      </p>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-body text-xs text-dark/50 min-w-[92px]">{r.label}</dt>
            <dd className="font-body text-sm text-dark flex-1 min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      {data.observacao && (
        <div className="mt-2">
          <p className="font-body text-xs text-dark/50 mb-0.5">Observação</p>
          <p className="font-body text-sm text-dark whitespace-pre-wrap break-words">
            {data.observacao}
          </p>
        </div>
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
  const formSub = it.tipo === "form_submission" ? parseFormSubmission(it.metadata) : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
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

  // Modal destrutivo do padrão da casa no lugar do `confirm()` nativo — mesma
  // troca feita na exclusão de tag e de origem neste lote. Devolve `null` em
  // sucesso ou a mensagem, que é o contrato do primitivo.
  const handleDelete = async (): Promise<ConfirmResult> => {
    setErro(null);
    const result = await deleteContactNote(contactId, it.id);
    if (!result.success) return result.error ?? "Não foi possível excluir.";
    setMenuOpen(false);
    router.refresh();
    return null;
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
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmandoExclusao(true);
                      }}
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

        <Modal
          open={confirmandoExclusao}
          onClose={() => setConfirmandoExclusao(false)}
          variant="destrutiva"
          titulo="Excluir esta nota?"
          descricao="A nota sai da timeline do contato. Isso não tem como desfazer."
          primarioLabel="Excluir nota"
          onConfirmar={handleDelete}
          data-testid="modal-excluir-nota"
        />

        {!editing && formSub && <FormSubmissionDetails data={formSub} />}

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
  catalogoTagsInternas,
  catalogoTagsClickmassa,
  grupos,
  historicoEmail,
  ehAdmin,
}: {
  contact: Contact;
  interactions: ContactInteraction[];
  externalLinks: ContactExternalLink[];
  jornadas: { abertas: Jornada[]; fechadas: Jornada[] };
  anexos: Anexo[];
  catalogoTagsInternas: TagInterna[];
  catalogoTagsClickmassa: TagClickMassa[];
  grupos: Grupo[];
  historicoEmail: HistoricoEmail[];
  /** Só admin vê "Gerenciar tags" no bloco de tags (T2 do contrato de tags v1). */
  ehAdmin: boolean;
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

      {/* Substitui o antigo card "Preferências", que renderizava `tags` cru e
          não mostrava as do ClickMassa. Agora são dois blocos rotulados (T8). */}
      <TagsCard
        contactId={contact.id}
        tagsInternas={contact.tags}
        clickmassaTagsId={contact.clickmassaTagsId}
        catalogoInterno={catalogoTagsInternas}
        catalogoClickmassa={catalogoTagsClickmassa}
        ehAdmin={ehAdmin}
      />

      <EmailMarketingCard
        status={contact.emailMarketingStatus}
        statusEm={contact.emailMarketingStatusEm}
        statusOrigem={contact.emailMarketingStatusOrigem}
        grupos={grupos}
        historico={historicoEmail}
      />

      <SistemasExternosDetails contact={contact} iddasLink={iddasLink} />

      <AnexosBlock owner={{ kind: "contact", id: contact.id }} anexos={anexos} />

      <InteracoesTimeline contactId={contact.id} interactions={interactions} />
    </div>
  );
}
