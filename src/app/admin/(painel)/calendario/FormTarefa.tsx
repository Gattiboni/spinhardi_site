"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TIPOS_TAREFA_ORDENADOS, type Pessoa } from "@/lib/calendario/types";
import {
  formatarDiaMes,
  formatarHora,
  normalizarHoraDigitada,
  type DataISO,
} from "@/lib/calendario/datas";
import { buscarContatosAction, jornadasDoContatoAction, type TarefaInput } from "./actions";

/**
 * Formulário de tarefa — duas densidades, uma lógica.
 *
 * `compacto` é o composer da célula (título · hora · responsável), o caminho de
 * 3 segundos pra anotar algo no dia certo. Sem ele, é o formulário completo do
 * drawer, com descrição, tipo e os vínculos de contato e jornada.
 *
 * As duas versões produzem o MESMO `TarefaInput` e caem na MESMA action, que
 * revalida tudo do zero no servidor. O que muda é quanto se pede de uma vez.
 */

export type ValoresTarefa = {
  titulo: string;
  descricao: string;
  data: DataISO;
  /** Texto livre; `normalizarHoraDigitada` aceita `14:30`, `1430`, `14h30`. */
  horaTexto: string;
  tipo: number | null;
  responsavelId: string;
  contato: { id: string; nome: string } | null;
  jornadaId: string | null;
};

export function valoresIniciais(data: DataISO, responsavelId: string): ValoresTarefa {
  return {
    titulo: "",
    descricao: "",
    data,
    horaTexto: "",
    tipo: null,
    responsavelId,
    contato: null,
    jornadaId: null,
  };
}

/** Converte o estado do formulário no payload da action (hora normalizada). */
export function paraInput(v: ValoresTarefa): TarefaInput {
  return {
    titulo: v.titulo,
    data: v.data,
    hora: normalizarHoraDigitada(v.horaTexto),
    tipo: v.tipo,
    descricao: v.descricao.trim() || null,
    responsavelId: v.responsavelId,
    contactId: v.contato?.id ?? null,
    jornadaId: v.jornadaId,
  };
}

const CAMPO =
  "w-full px-2.5 py-1.5 rounded-md border border-border-strong bg-white font-body text-sm focus-ring";
const ROTULO =
  "block mb-1 font-body text-[11px] font-semibold text-text-muted uppercase tracking-wide";

export default function FormTarefa({
  valores,
  onChange,
  pessoas,
  usuario,
  compacto = false,
  erro,
  salvando,
  onSubmit,
  onCancelar,
  rotuloSubmit,
}: {
  valores: ValoresTarefa;
  onChange: (v: ValoresTarefa) => void;
  pessoas: Pessoa[];
  usuario: { id: string; ehAdmin: boolean };
  compacto?: boolean;
  erro: string | null;
  salvando: boolean;
  onSubmit: () => void;
  onCancelar: () => void;
  rotuloSubmit: string;
}) {
  const idTitulo = useId();
  const idHora = useId();
  const idData = useId();
  const idResp = useId();
  const idTipo = useId();
  const idDesc = useId();
  const idContato = useId();

  const set = <K extends keyof ValoresTarefa>(chave: K, valor: ValoresTarefa[K]) =>
    onChange({ ...valores, [chave]: valor });

  // Quem não é admin não escolhe responsável: a action recusaria de qualquer
  // forma (C5 — não-admin só cria pra si), e oferecer um select que sempre falha
  // é pior que não oferecer.
  const podeEscolherResponsavel = usuario.ehAdmin && pessoas.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-3"
    >
      <div>
        <label htmlFor={idTitulo} className={ROTULO}>
          {compacto ? `Nova tarefa · ${formatarDiaMes(valores.data)}` : "Título"}
        </label>
        <input
          id={idTitulo}
          autoFocus
          value={valores.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Título"
          maxLength={200}
          className={CAMPO}
        />
      </div>

      {!compacto && (
        <div>
          <label htmlFor={idDesc} className={ROTULO}>
            Descrição
          </label>
          <textarea
            id={idDesc}
            value={valores.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            rows={3}
            className={`${CAMPO} resize-y`}
          />
        </div>
      )}

      <div className={compacto ? "" : "grid grid-cols-2 gap-3"}>
        {!compacto && (
          <div>
            <label htmlFor={idData} className={ROTULO}>
              Data
            </label>
            <input
              id={idData}
              type="date"
              value={valores.data}
              onChange={(e) => set("data", e.target.value)}
              className={CAMPO}
            />
          </div>
        )}

        <div>
          <label htmlFor={idHora} className={ROTULO}>
            Hora {compacto && <span className="normal-case">(opcional)</span>}
          </label>
          <input
            id={idHora}
            value={valores.horaTexto}
            onChange={(e) => set("horaTexto", e.target.value)}
            placeholder="ex 14:30"
            inputMode="numeric"
            className={CAMPO}
          />
        </div>
      </div>

      {!compacto && (
        <div>
          <label htmlFor={idTipo} className={ROTULO}>
            Tipo
          </label>
          <select
            id={idTipo}
            value={valores.tipo ?? ""}
            onChange={(e) => set("tipo", e.target.value ? Number(e.target.value) : null)}
            className={CAMPO}
          >
            <option value="">— sem tipo —</option>
            {TIPOS_TAREFA_ORDENADOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.icone} {t.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor={idResp} className={ROTULO}>
          Responsável
        </label>
        {podeEscolherResponsavel ? (
          <select
            id={idResp}
            value={valores.responsavelId}
            onChange={(e) => set("responsavelId", e.target.value)}
            className={CAMPO}
          >
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : (
          <p className="px-2.5 py-1.5 rounded-md bg-surface-muted font-body text-sm text-text-muted">
            {pessoas.find((p) => p.id === usuario.id)?.nome ?? "Você"}
          </p>
        )}
      </div>

      {!compacto && (
        <>
          <CampoContato
            id={idContato}
            valor={valores.contato}
            onChange={(contato) =>
              // Trocar de contato invalida a jornada escolhida: jornada pertence
              // a um contato, e manter o id antigo criaria um vínculo cruzado.
              onChange({ ...valores, contato, jornadaId: null })
            }
          />
          <CampoJornada
            contatoId={valores.contato?.id ?? null}
            valor={valores.jornadaId}
            onChange={(jornadaId) => set("jornadaId", jornadaId)}
          />
        </>
      )}

      {erro && (
        <p className="px-3 py-2 rounded-md bg-feedback-error-bg font-body text-sm text-feedback-error-fg">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="flex-1 px-4 py-2 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover disabled:bg-surface-selected disabled:text-text-disabled focus-ring transition-colors duration-short"
        >
          {salvando ? "Salvando…" : rotuloSubmit}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 rounded-md border border-border-strong font-body text-sm text-dark hover:bg-surface-app focus-ring transition-colors duration-short"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// Vínculos
// ─────────────────────────────────────────────────────────────────

/** Autocomplete de contato: 2+ caracteres, 250ms de espera, no máximo 10 nomes. */
function CampoContato({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: { id: string; nome: string } | null;
  onChange: (v: { id: string; nome: string } | null) => void;
}) {
  const [termo, setTermo] = useState("");
  // A resposta guarda o TERMO que a produziu. Assim "buscando" e "resultado
  // válido" são derivados na renderização, em vez de estados que o efeito teria
  // de zerar — o efeito só escreve quando a resposta chega, nunca em linha reta.
  const [resposta, setResposta] = useState<{
    termo: string;
    itens: { id: string; nome: string }[];
  } | null>(null);
  // Descarta resposta de busca antiga que chegue depois de uma mais nova.
  const buscaAtual = useRef(0);

  const limpo = termo.trim();

  useEffect(() => {
    if (valor) return;
    const alvo = termo.trim();
    if (alvo.length < 2) return;
    const marca = ++buscaAtual.current;
    const t = setTimeout(async () => {
      const itens = await buscarContatosAction(alvo);
      if (marca !== buscaAtual.current) return;
      setResposta({ termo: alvo, itens });
    }, 250);
    return () => clearTimeout(t);
  }, [termo, valor]);

  const resultados = resposta && resposta.termo === limpo ? resposta.itens : null;
  const buscando = limpo.length >= 2 && resultados === null;

  if (valor) {
    return (
      <div>
        <span className={ROTULO}>Contato</span>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-muted">
          <span className="min-w-0 flex-1 font-body text-sm truncate">{valor.nome}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTermo("");
            }}
            className="font-body text-xs text-text-muted hover:text-dark underline focus-ring rounded-xs"
          >
            trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        Contato
      </label>
      <input
        id={id}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar pelo nome…"
        className={CAMPO}
        autoComplete="off"
      />
      {limpo.length >= 2 && (
        <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-border-soft divide-y divide-border-soft">
          {buscando && (
            <li className="px-2.5 py-1.5 font-body text-xs text-text-muted">Buscando…</li>
          )}
          {resultados?.length === 0 && (
            <li className="px-2.5 py-1.5 font-body text-xs text-text-muted">Nenhum contato.</li>
          )}
          {(resultados ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange(c)}
                className="w-full px-2.5 py-1.5 text-left font-body text-sm hover:bg-surface-app focus-ring"
              >
                {c.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Jornadas abertas do contato escolhido. Sem contato, o campo nem aparece. */
function CampoJornada({
  contatoId,
  valor,
  onChange,
}: {
  contatoId: string | null;
  valor: string | null;
  onChange: (v: string | null) => void;
}) {
  const id = useId();
  // Mesma ideia do campo de contato: a resposta carrega o contato que a gerou,
  // então trocar de contato invalida a lista por derivação, sem efeito de limpeza.
  const [resposta, setResposta] = useState<{
    contatoId: string;
    itens: { id: string; titulo: string }[];
  } | null>(null);

  useEffect(() => {
    if (!contatoId) return;
    let vivo = true;
    jornadasDoContatoAction(contatoId).then((itens) => {
      if (vivo) setResposta({ contatoId, itens });
    });
    return () => {
      vivo = false;
    };
  }, [contatoId]);

  const jornadas = resposta && resposta.contatoId === contatoId ? resposta.itens : [];

  if (!contatoId || jornadas.length === 0) return null;

  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        Jornada
      </label>
      <select
        id={id}
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={CAMPO}
      >
        <option value="">— sem vínculo —</option>
        {jornadas.map((j) => (
          <option key={j.id} value={j.id}>
            {j.titulo}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Hora da RPC (`HH:MM:SS`) → texto do campo. */
export function horaParaTexto(hora: string | null): string {
  return formatarHora(hora) ?? "";
}
