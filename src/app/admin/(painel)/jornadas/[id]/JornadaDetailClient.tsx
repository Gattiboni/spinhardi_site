"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StageBadge from "@/components/admin/StageBadge";
import AnexosBlock from "@/components/admin/AnexosBlock";
import { formatDate } from "@/lib/utils/date";
import {
  isEstagioAberto,
  type EstagioJornada,
  type JornadaComContato,
  type Jornada,
  type FollowUpTarefa,
  type TarefaInterna,
} from "@/lib/jornadas/types";
import type { Anexo } from "@/lib/anexos/types";
import {
  salvarValorAction,
  criarTarefaAction,
  toggleTarefaAction,
  marcarGanhouAction,
  marcarPerdeuAction,
} from "./actions";

const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function dataFormatada(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "");
}

const cardClass = "bg-white border border-dark/10 rounded-md p-6";
const cardTitleClass = "font-display text-xl text-navy mb-2 pb-3 border-b border-dark/10";
const inputClass =
  "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gold uppercase tracking-widest text-xs font-body mb-1">{label}</p>
      <div className="font-body text-sm text-dark">{children}</div>
    </div>
  );
}

// ── Valor da jornada ────────────────────────────────────────────
// Um campo só (`valor`); o significado vem do estágio. VIVA (aberta) é editável —
// cria a cotação que falta ou troca a existente (sobrescreve, sem histórico).
// MORTA (fechada) é read-only: valor congelado pra estatística, com cadeado.
function labelValor(estagio: EstagioJornada): string {
  if (estagio === "aprovado") return "Ganho";
  if (estagio === "reprovado") return "Perda";
  return "Cotação";
}

function ValorField({
  jornadaId,
  valor,
  estagio,
  aberta,
}: {
  jornadaId: string;
  valor: number | null;
  estagio: EstagioJornada;
  aberta: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState(valor != null ? String(valor) : "");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const label = labelValor(estagio);
  const temValor = valor != null && valor > 0;

  // MORTA — read-only, valor congelado (cadeado). Cliente que volta abre jornada
  // nova, então fechada nunca precisa editar valor. Trava de verdade.
  if (!aberta) {
    return (
      <Field label={label}>
        <span className="inline-flex items-center gap-2 text-dark/70">
          <span aria-hidden="true">🔒</span>
          {temValor ? moedaBRL.format(valor) : "—"}
          <span className="font-body text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-dark/5 text-dark/50">
            congelado
          </span>
        </span>
      </Field>
    );
  }

  const handleSalvar = () => {
    const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
    const num = limpo === "" ? null : Number(limpo);
    if (num != null && (!Number.isFinite(num) || num < 0)) {
      setErro("Valor inválido.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const result = await salvarValorAction(jornadaId, num);
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível salvar.");
      }
    });
  };

  // Editando (inserir ou trocar): input inline com prefixo R$.
  if (editing) {
    return (
      <Field label={label}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-sm text-dark/50">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="0"
            className={`${inputClass} w-32`}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSalvar}
            disabled={pending}
            className="font-body text-xs px-3 py-2 rounded-md bg-gold text-dark font-medium hover:bg-gold/90 disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setTexto(valor != null ? String(valor) : "");
              setErro(null);
            }}
            className="font-body text-xs text-dark/60 hover:text-dark"
          >
            Cancelar
          </button>
        </div>
        {erro && <p className="font-body text-xs text-red-600 mt-1">{erro}</p>}
      </Field>
    );
  }

  // Sem valor ainda: botão que CRIA a cotação (não mostra "R$ 0").
  if (!temValor) {
    return (
      <Field label={label}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-body text-sm font-medium text-gold hover:underline"
        >
          + Inserir cotação
        </button>
      </Field>
    );
  }

  // Com valor: mostra + link editar (sobrescreve).
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <span>{moedaBRL.format(valor)}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-body text-xs text-gold hover:underline"
        >
          editar
        </button>
      </div>
    </Field>
  );
}

// ── Tarefas & follow-up (Iddas read-only + internas editáveis) ──
function TarefasBlock({
  jornadaId,
  tarefasIddas,
  tarefasInternas,
}: {
  jornadaId: string;
  tarefasIddas: FollowUpTarefa[];
  tarefasInternas: TarefaInterna[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [data, setData] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const handleToggle = (tarefaId: string, concluida: boolean) => {
    setBusyId(tarefaId);
    setErro(null);
    startTransition(async () => {
      const result = await toggleTarefaAction(jornadaId, tarefaId, concluida);
      setBusyId(null);
      if (result.success) router.refresh();
      else setErro(result.error ?? "Não foi possível atualizar a tarefa.");
    });
  };

  const handleCriar = () => {
    const limpo = assunto.trim();
    if (!limpo) {
      setErro("O assunto não pode ficar vazio.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const result = await criarTarefaAction(jornadaId, limpo, data || null);
      if (result.success) {
        setAssunto("");
        setData("");
        setNovaOpen(false);
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível criar a tarefa.");
      }
    });
  };

  const vazio = tarefasIddas.length === 0 && tarefasInternas.length === 0;

  return (
    <div className={`${cardClass} mt-6`}>
      <div className="flex items-center justify-between gap-4 mb-2 pb-3 border-b border-dark/10">
        <h2 className="font-display text-xl text-navy">Tarefas &amp; follow-up</h2>
        <button
          type="button"
          onClick={() => setNovaOpen((v) => !v)}
          className="font-body text-sm font-medium px-4 py-2 rounded-md border-2 border-gold text-gold hover:bg-gold hover:text-dark transition-colors duration-medium"
        >
          + Nova
        </button>
      </div>

      {novaOpen && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-48">
            <label className="text-gold uppercase tracking-widest text-xs font-body mb-1 block">
              Assunto
            </label>
            <input
              type="text"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ligar pra confirmar datas…"
              className={`${inputClass} w-full`}
              autoFocus
            />
          </div>
          <div>
            <label className="text-gold uppercase tracking-widest text-xs font-body mb-1 block">
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={handleCriar}
            disabled={pending}
            className="font-body text-sm px-4 py-2 rounded-md bg-gold text-dark font-medium hover:bg-gold/90 disabled:opacity-50"
          >
            {pending ? "Criando..." : "Adicionar"}
          </button>
        </div>
      )}

      {erro && <p className="font-body text-sm text-red-600 mt-3">{erro}</p>}

      {vazio ? (
        <p className="font-body text-sm text-dark/50 mt-4">Nenhuma tarefa pra esta jornada.</p>
      ) : (
        <ul className="divide-y divide-dark/5 mt-4">
          {/* Iddas — read-only */}
          {tarefasIddas.map((t) => (
            <li key={`iddas-${t.id}`} className="py-3 flex items-start gap-3">
              <span className="text-lg shrink-0" aria-hidden="true">
                📌
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-body text-sm text-dark">{t.assunto ?? "(sem assunto)"}</p>
                  <span className="font-body text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-dark/5 text-dark/50">
                    do Iddas
                  </span>
                </div>
                {t.descricao && (
                  <p className="font-body text-xs text-dark/60 mt-0.5 whitespace-pre-wrap break-words">
                    {t.descricao}
                  </p>
                )}
                <p className="font-body text-xs text-dark/50 mt-0.5">
                  {t.data ? dataFormatada(t.data) : "—"}
                  {t.hora ? ` · ${t.hora}` : ""}
                </p>
              </div>
            </li>
          ))}

          {/* Internas — editáveis (checkbox) */}
          {tarefasInternas.map((t) => (
            <li key={`int-${t.id}`} className="py-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={t.concluida}
                disabled={pending && busyId === t.id}
                onChange={(e) => handleToggle(t.id, e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-gold cursor-pointer"
                aria-label={`Concluir tarefa: ${t.assunto}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-body text-sm ${
                    t.concluida ? "line-through text-dark/40" : "text-dark"
                  }`}
                >
                  {t.assunto}
                </p>
                {t.descricao && (
                  <p className="font-body text-xs text-dark/60 mt-0.5 whitespace-pre-wrap break-words">
                    {t.descricao}
                  </p>
                )}
                <p className="font-body text-xs text-dark/50 mt-0.5">
                  {t.data ? dataFormatada(t.data) : "Sem data"}
                  {t.hora ? ` · ${t.hora}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Header — desfecho (Ganhou / Perdeu) ─────────────────────────
function DesfechoBotoes({ jornadaId }: { jornadaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const fechar = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setErro(null);
    startTransition(async () => {
      const result = await fn();
      if (result.success) router.refresh();
      else setErro(result.error ?? "Não foi possível fechar a jornada.");
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fechar(() => marcarGanhouAction(jornadaId))}
          disabled={pending}
          className="font-body text-sm px-4 py-2 rounded-md border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white disabled:opacity-50 transition-colors duration-medium"
        >
          Ganhou
        </button>
        <button
          type="button"
          onClick={() => fechar(() => marcarPerdeuAction(jornadaId))}
          disabled={pending}
          className="font-body text-sm px-4 py-2 rounded-md border-2 border-red-500 text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-50 transition-colors duration-medium"
        >
          Perdeu
        </button>
      </div>
      {erro && <p className="font-body text-xs text-red-600">{erro}</p>}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function JornadaDetailClient({
  jornada,
  tarefasIddas,
  tarefasInternas,
  outrasJornadas,
  anexos,
}: {
  jornada: JornadaComContato;
  tarefasIddas: FollowUpTarefa[];
  tarefasInternas: TarefaInterna[];
  outrasJornadas: Jornada[];
  anexos: Anexo[];
}) {
  const aberta = isEstagioAberto(jornada.estagio);

  return (
    <div>
      <Link
        href="/admin/jornadas"
        className="inline-block font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short mb-6"
      >
        ← Voltar pro kanban
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl text-navy">
              {jornada.tituloJornada ?? "Atendimento sem título"}
            </h1>
            <StageBadge estagio={jornada.estagio} />
          </div>
          <p className="font-body text-sm text-dark/60 mt-1">
            Aberta em {dataFormatada(jornada.createdAt)}
            {jornada.contatoNome && (
              <>
                {" · "}
                {jornada.contactId ? (
                  <Link
                    href={`/admin/contatos/${jornada.contactId}`}
                    className="text-navy hover:text-gold transition-colors duration-short"
                  >
                    {jornada.contatoNome}
                  </Link>
                ) : (
                  jornada.contatoNome
                )}
              </>
            )}
          </p>
        </div>
        {aberta && <DesfechoBotoes jornadaId={jornada.id} />}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Dados */}
        <div className={`${cardClass} space-y-5`}>
          <h2 className={cardTitleClass}>Dados</h2>
          <ValorField
            jornadaId={jornada.id}
            valor={jornada.valor}
            estagio={jornada.estagio}
            aberta={aberta}
          />
          <Field label="Destino / título">{jornada.tituloJornada ?? "—"}</Field>
          <Field label="Origem">{jornada.origemDado || "—"}</Field>
          <Field label="Ref. orçamento (Iddas)">{jornada.bronzeRef ?? "—"}</Field>
          {!aberta && <Field label="Fechada em">{dataFormatada(jornada.closedAt)}</Field>}
        </div>

        {/* Tarefas + histórico */}
        <div className="lg:col-span-2">
          <TarefasBlock
            jornadaId={jornada.id}
            tarefasIddas={tarefasIddas}
            tarefasInternas={tarefasInternas}
          />

          {/* Histórico do cliente */}
          <div className={`${cardClass} mt-6`}>
            <h2 className={cardTitleClass}>Histórico do cliente</h2>
            {outrasJornadas.length === 0 ? (
              <p className="font-body text-sm text-dark/50 mt-4">
                Este contato não tem outras jornadas.
              </p>
            ) : (
              <ul className="divide-y divide-dark/5 mt-4">
                {outrasJornadas.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/admin/jornadas/${j.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-gold transition-colors duration-short"
                    >
                      <span className="font-body text-sm text-dark/80 min-w-0 truncate">
                        {j.tituloJornada ?? "Atendimento sem título"}
                        {j.closedAt ? ` · ${formatDate(j.closedAt)}` : ""}
                      </span>
                      <StageBadge estagio={j.estagio} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* contactId vai junto: o anexo subido aqui grava os dois FKs e passa
              a aparecer também na ficha do contato (leitura inalterada). */}
          <AnexosBlock
            owner={{ kind: "jornada", id: jornada.id, contactId: jornada.contactId }}
            anexos={anexos}
          />
        </div>
      </div>
    </div>
  );
}
