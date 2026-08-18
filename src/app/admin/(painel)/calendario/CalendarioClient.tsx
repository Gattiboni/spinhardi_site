"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Modal, useToast } from "@/components/ui/primitives";
import {
  CATEGORIAS,
  CATEGORIAS_ORDENADAS,
  categoriaDe,
  chaveEvento,
  compararNaCelula,
  ehCategoria,
  eventoVisivel,
  ocupaODia,
  type CalendarEvent,
  type Categoria,
  type Escopo,
  type Pessoa,
  type Visao,
} from "@/lib/calendario/types";
import {
  diasDaSemana,
  formatarDiaMes,
  formatarMesAno,
  gradeDoMes,
  MESES,
  paraData,
  somaDias,
  somaMeses,
  type DataISO,
} from "@/lib/calendario/datas";
import { casaFiltroPorContato, FILTRO_TAG_TODAS, type TagInterna } from "@/lib/tags/shared";
import { EventoChip, VisaoAgenda, VisaoMes, VisaoSemana, type AcoesEvento } from "./Visoes";
import DrawerEvento from "./DrawerEvento";
import FormTarefa, { paraInput, valoresIniciais, type ValoresTarefa } from "./FormTarefa";
import {
  concluirTarefaAction,
  criarTarefaAction,
  editarTarefaAction,
  excluirTarefaAction,
  reagendarTarefaAction,
  setCheckinAction,
  type TarefaInput,
} from "./actions";

/**
 * Shell do calendário: navegação, filtros, escopo e as escritas.
 *
 * O que este componente NÃO faz: buscar evento. A lista chega pronta do
 * servidor, lida da RPC no range da visão corrente. Mudar de mês é mudar a URL —
 * o servidor recalcula o range e lê de novo. Aqui só se decide o que MOSTRAR da
 * lista recebida (categoria e escopo) e o que ESCREVER de volta.
 *
 * Otimismo com risco visual: concluir e reagendar pintam o resultado na hora e
 * chamam a action; se ela falhar, o estado volta ao que era e o erro aparece em
 * toast. É por isso que existe `overrides` — uma camada fina por cima dos
 * eventos do servidor, zerada assim que a lista real chega.
 */

type Props = {
  eventos: CalendarEvent[];
  pessoas: Pessoa[];
  /**
   * `contactId → slugs`, como array de pares (Map não sobrevive à serialização
   * RSC). Vocabulário do filtro por tag: a RPC entrega `contact_id` em todo
   * evento, mas não as tags do contato (T5).
   */
  tagsPorContato: [string, string[]][];
  catalogoTags: TagInterna[];
  hoje: DataISO;
  visao: Visao;
  ancora: DataISO;
  /** A URL trouxe `?v=` explícito? Se não, a preferência salva pode assumir. */
  visaoExplicita: boolean;
  usuario: { id: string; nome: string; ehAdmin: boolean };
  agendaDias: { atras: number; frente: number };
};

type Override = { concluida?: boolean; dataInicio?: DataISO };

/**
 * `tag` entrou na v1 de tags transversais. Acrescentar chave é retrocompatível
 * por construção: `decodificarPrefs` lê campo a campo e ignora o que não
 * reconhece, então preferência salva antes deste lote simplesmente não tem
 * filtro de tag — não quebra, nasce em "todas".
 */
type Prefs = { cats: string[]; escopo: Escopo; visao: Visao; tag: string };

/** Preferência é de UI, por usuário e por navegador — `localStorage` na v1 (C6). */
function chavePrefs(usuarioId: string): string {
  return `spinhardi:calendario:v1:${usuarioId}`;
}

/**
 * `localStorage` é um sistema EXTERNO ao React, e ler dele é exatamente o caso
 * de `useSyncExternalStore`: a preferência entra sem copiar estado num efeito e
 * sem quebrar a hidratação — no servidor o snapshot é "não há preferência", e o
 * React re-renderiza com o valor do cliente logo depois de hidratar.
 *
 * O snapshot é a STRING crua de propósito: precisa ser estável entre chamadas, e
 * um objeto novo a cada render faria o React acusar loop. O parse acontece uma
 * vez, memoizado sobre essa string.
 */
function assinarPrefs(aoMudar: () => void): () => void {
  // Bônus do `storage`: mudar a preferência numa aba atualiza as outras.
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

function lerPrefs(usuarioId: string): string | null {
  try {
    return localStorage.getItem(chavePrefs(usuarioId));
  } catch {
    // Modo privado / cota estourada: seguir com os defaults é melhor que quebrar.
    return null;
  }
}

type PrefsDecodificadas = {
  cats: Set<Categoria> | null;
  escopo: Escopo | null;
  visao: Visao | null;
  tag: string | null;
};

function decodificarPrefs(bruto: string | null): PrefsDecodificadas {
  const vazio: PrefsDecodificadas = { cats: null, escopo: null, visao: null, tag: null };
  if (!bruto) return vazio;
  try {
    const p = JSON.parse(bruto) as Partial<Prefs>;
    const cats = Array.isArray(p.cats) ? p.cats.filter(ehCategoria) : [];
    return {
      cats: cats.length > 0 ? new Set(cats) : null,
      escopo: p.escopo === "meu" || p.escopo === "time" ? p.escopo : null,
      visao: p.visao === "mes" || p.visao === "semana" || p.visao === "agenda" ? p.visao : null,
      // Slug é texto livre do catálogo: valida-se o TIPO aqui, e a existência
      // fica com o select (tag apagada some da lista e o filtro esvazia a tela
      // até alguém limpar — por isso o estado ativo é sempre visível).
      tag: typeof p.tag === "string" && p.tag ? p.tag : null,
    };
  } catch {
    return vazio;
  }
}

export default function CalendarioClient({
  eventos,
  pessoas,
  tagsPorContato,
  catalogoTags,
  hoje,
  visao,
  ancora,
  visaoExplicita,
  usuario,
  agendaDias,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pendente, startTransition] = useTransition();

  // Preferência salva (externa) × escolha desta sessão (React). A escolha vence
  // quando existe; enquanto não existe, vale o que estiver no `localStorage`, e
  // na primeira renderização — inclusive a do servidor — valem os defaults.
  const prefsBrutas = useSyncExternalStore(
    assinarPrefs,
    () => lerPrefs(usuario.id),
    () => null,
  );
  const prefsSalvas = useMemo(() => decodificarPrefs(prefsBrutas), [prefsBrutas]);

  const [catsEscolhidas, setCatsEscolhidas] = useState<Set<Categoria> | null>(null);
  const [escopoEscolhido, setEscopoEscolhido] = useState<Escopo | null>(null);
  const [tagEscolhida, setTagEscolhida] = useState<string | null>(null);
  const [pessoasSel, setPessoasSel] = useState<Set<string>>(
    () => new Set(pessoas.map((p) => p.id)),
  );
  const [verConcluidas, setVerConcluidas] = useState(false);

  const cats = useMemo(
    () => catsEscolhidas ?? prefsSalvas.cats ?? new Set(CATEGORIAS_ORDENADAS),
    [catsEscolhidas, prefsSalvas],
  );
  // Não-admin não tem escopo: é sempre "meu" (C5), e nem preferência salva nem
  // payload adulterado mudam isso — o filtro real roda em `eventoVisivel`.
  const escopo: Escopo = usuario.ehAdmin
    ? (escopoEscolhido ?? prefsSalvas.escopo ?? "time")
    : "meu";

  // Mesma disciplina dos chips: escolha desta sessão vence, senão a preferência
  // salva, senão o default (sem filtro).
  const tag = tagEscolhida ?? prefsSalvas.tag ?? FILTRO_TAG_TODAS;
  const mapaTags = useMemo(() => new Map(tagsPorContato), [tagsPorContato]);

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  // Sentinela pra saber que a lista do servidor trocou (ver bloco de reset).
  const [eventosVistos, setEventosVistos] = useState(eventos);
  const [selecionado, setSelecionado] = useState<CalendarEvent | null>(null);
  const [popover, setPopover] = useState<{ dia: DataISO; x: number; y: number } | null>(null);
  const [composer, setComposer] = useState<{
    x: number;
    y: number;
    valores: ValoresTarefa;
    erro: string | null;
  } | null>(null);
  const [aExcluir, setAExcluir] = useState<CalendarEvent | null>(null);
  const arrastando = useRef<CalendarEvent | null>(null);
  const [temArrasto, setTemArrasto] = useState(false);

  const pessoasPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  // Lista nova do servidor = verdade nova: o otimismo local perde a validade.
  // Ajuste DURANTE a renderização (padrão oficial do React pra reagir a uma prop
  // que mudou), e não num efeito: um efeito aqui renderizaria uma vez com o
  // override velho por cima do dado novo antes de limpar — que é justamente o
  // pisca-pisca que o otimismo existe pra evitar.
  if (eventos !== eventosVistos) {
    setEventosVistos(eventos);
    setOverrides({});
  }

  /**
   * Grava a preferência. Chamado dos HANDLERS, nunca de um efeito: efeito rodaria
   * na montagem também e escreveria os defaults por cima do que estava salvo,
   * antes mesmo de o valor salvo ter sido lido.
   */
  const persistir = useCallback(
    (parcial: Partial<Prefs>) => {
      try {
        const atual: Prefs = { cats: [...cats], escopo, visao, tag };
        localStorage.setItem(chavePrefs(usuario.id), JSON.stringify({ ...atual, ...parcial }));
      } catch {
        // Preferência não salva não quebra a tela.
      }
    },
    [cats, escopo, visao, tag, usuario.id],
  );

  // A visão salva só assume quando a URL não mandou uma — link compartilhado com
  // `?v=` vence a preferência de quem abre. Efeito legítimo: navega, não seta estado.
  useEffect(() => {
    if (visaoExplicita) return;
    const salva = prefsSalvas.visao;
    if (salva && salva !== visao) {
      router.replace(`/admin/calendario?v=${salva}&d=${ancora}`);
    }
  }, [visaoExplicita, prefsSalvas, visao, ancora, router]);

  // ── Eventos exibidos ────────────────────────────────────────────
  const eventosVisiveis = useMemo(() => {
    return (
      eventos
        .map((ev) => {
          const o = overrides[chaveEvento(ev)];
          return o ? { ...ev, ...o } : ev;
        })
        .filter((ev) => cats.has(categoriaDe(ev.eventType)))
        .filter((ev) =>
          eventoVisivel(ev, {
            ehAdmin: usuario.ehAdmin,
            escopo,
            usuarioId: usuario.id,
            pessoasSelecionadas: pessoasSel,
          }),
        )
        // Filtro por tag, ESTRITO (T5): com filtro ligado passa só quem tem
        // contato resolvido E com a tag. Evento sem contato — 13,6% da janela
        // medida na investigação — some enquanto o filtro está ativo. Foi decisão
        // de 18/08 ("menos é mais"), e é o que exige o estado do filtro ficar
        // sempre visível na barra: senão a tela some sem explicação.
        .filter((ev) => casaFiltroPorContato(ev.contactId, tag, mapaTags))
    );
  }, [eventos, overrides, cats, escopo, pessoasSel, tag, mapaTags, usuario.ehAdmin, usuario.id]);

  /** Pendentes por pessoa pro contador do avatar — do conjunto TOTAL, não do filtrado. */
  const pendentesPorPessoa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const ev of eventos) {
      if (!ev.editavel || ev.concluida || !ev.responsavelUserId) continue;
      mapa.set(ev.responsavelUserId, (mapa.get(ev.responsavelUserId) ?? 0) + 1);
    }
    return mapa;
  }, [eventos]);

  // ── Navegação ───────────────────────────────────────────────────
  const irPara = useCallback(
    (v: Visao, d: DataISO) => {
      persistir({ visao: v });
      startTransition(() => router.push(`/admin/calendario?v=${v}&d=${d}`));
    },
    [router, persistir],
  );

  const navegar = (direcao: 1 | -1) => {
    if (visao === "agenda") return;
    const nova = visao === "mes" ? somaMeses(ancora, direcao) : somaDias(ancora, 7 * direcao);
    irPara(visao, nova);
  };

  const rotulo = useMemo(() => {
    if (visao === "agenda") return "Agenda";
    if (visao === "mes") return formatarMesAno(ancora);
    const dias = diasDaSemana(ancora);
    const a = paraData(dias[0]);
    const b = paraData(dias[6]);
    return `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  }, [visao, ancora]);

  // ── Escritas ────────────────────────────────────────────────────
  const fecharTudo = () => {
    setPopover(null);
    setComposer(null);
  };

  const alternarConclusao = (ev: CalendarEvent) => {
    const chave = chaveEvento(ev);
    const novo = !ev.concluida;

    setOverrides((o) => ({ ...o, [chave]: { ...o[chave], concluida: novo } }));

    startTransition(async () => {
      const r =
        ev.eventType === "checkin"
          ? await setCheckinAction(ev.sourceId, novo)
          : await concluirTarefaAction(ev.sourceId, novo);

      if (r.success) {
        router.refresh();
      } else {
        // Reverte o risco na tela — o otimismo era só uma aposta.
        setOverrides((o) => ({ ...o, [chave]: { ...o[chave], concluida: !novo } }));
        toast.erro(r.error ?? "Não foi possível atualizar.");
      }
    });
  };

  const soltarNoDia = (dia: DataISO) => {
    const ev = arrastando.current;
    arrastando.current = null;
    setTemArrasto(false);
    if (!ev || ev.dataInicio === dia) return;

    const chave = chaveEvento(ev);
    const anterior = ev.dataInicio;
    setOverrides((o) => ({ ...o, [chave]: { ...o[chave], dataInicio: dia } }));

    startTransition(async () => {
      const r = await reagendarTarefaAction(ev.sourceId, dia);
      if (!r.success) {
        setOverrides((o) => ({ ...o, [chave]: { ...o[chave], dataInicio: anterior } }));
        toast.erro(r.error ?? "Não foi possível reagendar.");
        return;
      }
      router.refresh();
      toast.toast({
        variant: "informacao",
        mensagem: `Reagendada pra ${formatarDiaMes(dia)}`,
        // Desfazer é reagendar de volta pela MESMA action — não existe caminho
        // de escrita paralelo só pra desfazer.
        acoes: [
          {
            label: "Desfazer",
            onClick: () =>
              startTransition(async () => {
                const volta = await reagendarTarefaAction(ev.sourceId, anterior);
                if (volta.success) router.refresh();
                else toast.erro(volta.error ?? "Não foi possível desfazer.");
              }),
          },
        ],
      });
    });
  };

  const criar = () => {
    if (!composer) return;
    const valores = composer.valores;
    startTransition(async () => {
      const r = await criarTarefaAction(paraInput(valores));
      if (r.success) {
        setComposer(null);
        router.refresh();
        toast.sucesso(`Tarefa criada em ${formatarDiaMes(valores.data)}`);
      } else {
        setComposer((c) => (c ? { ...c, erro: r.error ?? "Não foi possível criar." } : c));
      }
    });
  };

  const salvarEdicao = async (id: string, input: TarefaInput): Promise<string | null> => {
    const r = await editarTarefaAction(id, input);
    if (r.success) {
      router.refresh();
      toast.sucesso("Tarefa salva.");
      return null;
    }
    return r.error ?? "Não foi possível salvar.";
  };

  const excluir = async (): Promise<string | null> => {
    if (!aExcluir) return null;
    const r = await excluirTarefaAction(aExcluir.sourceId);
    if (!r.success) return r.error ?? "Não foi possível excluir.";
    setSelecionado(null);
    setAExcluir(null);
    router.refresh();
    toast.sucesso("Tarefa excluída.");
    return null;
  };

  // ── Ações passadas às visões ────────────────────────────────────
  const acoes: AcoesEvento = {
    abrir: (ev) => {
      fecharTudo();
      setSelecionado(ev);
    },
    alternarConclusao,
    iniciarArrasto: (ev) => {
      arrastando.current = ev;
      setTemArrasto(true);
    },
    encerrarArrasto: () => {
      arrastando.current = null;
      setTemArrasto(false);
    },
    soltarNoDia,
    comporNoDia: (dia, elemento) => {
      const p = posicionar(elemento);
      setPopover(null);
      setComposer({ ...p, valores: valoresIniciais(dia, usuario.id), erro: null });
    },
    verMais: (dia, elemento) => {
      setComposer(null);
      setPopover({ dia, ...posicionar(elemento) });
    },
  };

  const diasVisiveis = visao === "mes" ? gradeDoMes(ancora).dias : diasDaSemana(ancora);

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-display text-3xl text-navy">Calendário</h1>
        <p className="mt-1 font-body text-sm text-dark/60">
          Operação e trabalho na mesma tela · cadeado = sincronizado do Iddas, edição na origem
        </p>
      </header>

      {/* ── Barra de navegação ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => irPara(visao, hoje)}
          className="px-3 py-1.5 rounded-md border border-border-strong bg-surface font-body text-sm hover:bg-surface-app focus-ring transition-colors duration-short"
        >
          Hoje
        </button>

        {visao !== "agenda" && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => navegar(-1)}
              aria-label={visao === "mes" ? "Mês anterior" : "Semana anterior"}
              className="px-3 py-1.5 rounded-md border border-border-strong bg-surface font-body text-sm hover:bg-surface-app focus-ring transition-colors duration-short"
            >
              <span aria-hidden="true">◀</span>
            </button>
            <button
              type="button"
              onClick={() => navegar(1)}
              aria-label={visao === "mes" ? "Próximo mês" : "Próxima semana"}
              className="px-3 py-1.5 rounded-md border border-border-strong bg-surface font-body text-sm hover:bg-surface-app focus-ring transition-colors duration-short"
            >
              <span aria-hidden="true">▶</span>
            </button>
          </div>
        )}

        <span
          aria-live="polite"
          className={`font-body font-bold text-base first-letter:uppercase ${pendente ? "opacity-60" : ""}`}
        >
          {rotulo}
        </span>

        <div className="ml-auto flex rounded-md border border-border-strong overflow-hidden">
          {(["mes", "semana", "agenda"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={visao === v}
              onClick={() => irPara(v, ancora)}
              className={[
                "px-3.5 py-1.5 font-body text-sm focus-ring transition-colors duration-short",
                visao === v
                  ? "bg-navy text-white font-semibold"
                  : "bg-surface text-text-muted hover:bg-surface-app",
              ].join(" ")}
            >
              {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Agenda"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={(e) =>
            setComposer({
              ...posicionar(e.currentTarget),
              valores: valoresIniciais(visao === "agenda" ? hoje : ancora, usuario.id),
              erro: null,
            })
          }
          className="px-4 py-1.5 rounded-md border-2 border-gold font-body text-sm font-medium text-gold hover:bg-gold hover:text-dark focus-ring transition-colors duration-medium"
        >
          ＋ Nova tarefa
        </button>
      </div>

      {/* ── Chips de categoria ── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => {
            const novo =
              cats.size === CATEGORIAS_ORDENADAS.length
                ? new Set<Categoria>(["tarefa"])
                : new Set(CATEGORIAS_ORDENADAS);
            setCatsEscolhidas(novo);
            persistir({ cats: [...novo] });
          }}
          className={[
            "px-3 py-1 rounded-full border-[1.5px] font-body text-[12.5px] focus-ring transition-colors duration-short",
            cats.size === CATEGORIAS_ORDENADAS.length
              ? "border-navy text-navy font-semibold"
              : "border-border-soft text-text-muted",
          ].join(" ")}
        >
          Todos
        </button>

        {CATEGORIAS_ORDENADAS.map((c) => {
          const ativo = cats.has(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={ativo}
              onClick={() => {
                const novo = new Set(cats);
                if (novo.has(c)) novo.delete(c);
                else novo.add(c);
                setCatsEscolhidas(novo);
                persistir({ cats: [...novo] });
              }}
              className={[
                "flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] font-body text-[12.5px] focus-ring transition-colors duration-short",
                ativo ? "font-semibold" : "border-border-soft text-text-muted",
              ].join(" ")}
              style={
                ativo ? { borderColor: CATEGORIAS[c].cor, color: CATEGORIAS[c].cor } : undefined
              }
            >
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CATEGORIAS[c].cor, opacity: ativo ? 1 : 0.35 }}
              />
              {CATEGORIAS[c].nome}
            </button>
          );
        })}

        {/* Filtro por tag do contato (T5). Entra no FIM da faixa de chips, com
            `ml-auto`, pra não quebrar a leitura dos oito chips como um grupo — o
            arranjo final da barra é aprovação visual do Alan. */}
        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="filtro-tag-calendario"
            className="font-body text-[12.5px] text-text-muted"
          >
            Tag do cliente
          </label>
          <select
            id="filtro-tag-calendario"
            value={tag}
            onChange={(e) => {
              setTagEscolhida(e.target.value);
              persistir({ tag: e.target.value });
            }}
            data-testid="filtro-tag-calendario"
            className={[
              "h-8 px-2 rounded-md border font-body text-[12.5px] bg-surface focus-ring transition-colors duration-short",
              tag === FILTRO_TAG_TODAS
                ? "border-border-strong text-text-muted"
                : "border-navy text-navy font-semibold",
            ].join(" ")}
          >
            <option value={FILTRO_TAG_TODAS}>Todas</option>
            {catalogoTags.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
                {t.isActive ? "" : " (desativada)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* O filtro estrito esconde tudo que não tem contato: sem este aviso, a
          operadora veria o calendário esvaziar sem saber por quê. */}
      {tag !== FILTRO_TAG_TODAS && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 mb-2 px-3 py-1.5 rounded-md bg-attention-bg"
        >
          <span className="font-body text-[12.5px] text-navy">
            Mostrando só o que é de cliente com a tag{" "}
            <b>{catalogoTags.find((t) => t.slug === tag)?.name ?? tag}</b> — eventos sem cliente
            vinculado estão escondidos.
          </span>
          <button
            type="button"
            onClick={() => {
              setTagEscolhida(FILTRO_TAG_TODAS);
              persistir({ tag: FILTRO_TAG_TODAS });
            }}
            className="font-body text-[12.5px] text-navy underline hover:no-underline focus-ring rounded-sm"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* ── Escopo (C5) ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {usuario.ehAdmin ? (
          <>
            <div className="flex rounded-md border border-border-strong overflow-hidden">
              {(["meu", "time"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={escopo === e}
                  onClick={() => {
                    setEscopoEscolhido(e);
                    persistir({ escopo: e });
                  }}
                  className={[
                    "px-3 py-1 font-body text-[13px] focus-ring transition-colors duration-short",
                    escopo === e
                      ? "bg-attention-bg text-navy font-semibold"
                      : "bg-surface text-text-muted hover:bg-surface-app",
                  ].join(" ")}
                >
                  {e === "meu" ? "Meu calendário" : "Calendário do time"}
                </button>
              ))}
            </div>

            {escopo === "time" && (
              <>
                <div className="flex gap-1.5">
                  {pessoas.map((p) => {
                    const ligado = pessoasSel.has(p.id);
                    const pend = pendentesPorPessoa.get(p.id) ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={ligado}
                        title={`${p.nome} · ${pend} pendente${pend === 1 ? "" : "s"}`}
                        onClick={() =>
                          setPessoasSel((atual) => {
                            const novo = new Set(atual);
                            if (novo.has(p.id)) novo.delete(p.id);
                            else novo.add(p.id);
                            // Desmarcar todo mundo esvaziaria a tela sem
                            // explicação: a última pessoa fica.
                            return novo.size === 0 ? new Set([p.id]) : novo;
                          })
                        }
                        className={[
                          "relative w-8 h-8 rounded-full border-2 font-body text-[11.5px] font-bold focus-ring transition-colors duration-short",
                          ligado
                            ? "border-navy bg-attention-bg text-navy"
                            : "border-transparent bg-surface-selected text-text-disabled opacity-40",
                        ].join(" ")}
                      >
                        {p.iniciais}
                        {pend > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 px-1 rounded-full bg-navy text-white font-body text-[9.5px] font-semibold">
                            {pend}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <span className="font-body text-xs text-text-muted">
                  clique no avatar pra filtrar por pessoa
                </span>
              </>
            )}
          </>
        ) : (
          <p className="font-body text-[13px] text-text-muted">
            <span aria-hidden="true">👤 </span>
            Você vê <b className="text-dark">o seu calendário</b> ({usuario.nome}) mais a operação
            do time — voos, hospedagens, check-ins e aniversários não têm responsável.
          </p>
        )}
      </div>

      {/* ── Visão ── */}
      {visao === "mes" && (
        <VisaoMes
          dias={diasVisiveis}
          mesExibido={paraData(ancora).getMonth()}
          eventos={eventosVisiveis}
          hoje={hoje}
          pessoasPorId={pessoasPorId}
          acoes={acoes}
          arrastando={temArrasto}
        />
      )}
      {visao === "semana" && (
        <VisaoSemana
          dias={diasVisiveis}
          eventos={eventosVisiveis}
          hoje={hoje}
          pessoasPorId={pessoasPorId}
          acoes={acoes}
          arrastando={temArrasto}
        />
      )}
      {visao === "agenda" && (
        <VisaoAgenda
          eventos={eventosVisiveis}
          hoje={hoje}
          pessoasPorId={pessoasPorId}
          acoes={acoes}
          verConcluidas={verConcluidas}
          onAlternarConcluidas={() => setVerConcluidas((v) => !v)}
          diasFrente={agendaDias.frente}
        />
      )}

      <p className="mt-4 font-body text-[11.5px] text-text-muted">
        Arraste tarefas pra reagendar · clique num espaço vazio do dia pra criar tarefa
      </p>

      {/* ── Popover "+N mais" ── */}
      {popover && (
        <>
          <div onClick={fecharTudo} aria-hidden="true" className="fixed inset-0 z-40" />
          <div
            role="dialog"
            aria-label={`Eventos de ${formatarDiaMes(popover.dia)}`}
            style={{ left: popover.x, top: popover.y }}
            className="fixed z-50 w-68 max-h-96 overflow-auto p-2.5 rounded-lg bg-surface border border-border-soft shadow-modal anim-modal-in"
          >
            {(() => {
              const doDia = eventosVisiveis
                .filter((ev) => ocupaODia(ev, popover.dia))
                .sort(compararNaCelula);
              const trabalho = doDia.filter((ev) => ev.editavel);
              const operacao = doDia.filter((ev) => !ev.editavel);
              return (
                <>
                  {trabalho.length > 0 && (
                    <>
                      <h5 className="px-1 mb-1 font-body text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        Trabalho
                      </h5>
                      {trabalho.map((ev) => (
                        <EventoChip
                          key={chaveEvento(ev)}
                          ev={ev}
                          dia={popover.dia}
                          hoje={hoje}
                          pessoasPorId={pessoasPorId}
                          acoes={acoes}
                          quebraLinha
                        />
                      ))}
                    </>
                  )}
                  {operacao.length > 0 && (
                    <>
                      <h5 className="px-1 mt-2 mb-1 font-body text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        Operação
                      </h5>
                      {operacao.map((ev) => (
                        <EventoChip
                          key={chaveEvento(ev)}
                          ev={ev}
                          dia={popover.dia}
                          hoje={hoje}
                          pessoasPorId={pessoasPorId}
                          acoes={acoes}
                          quebraLinha
                        />
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Composer ── */}
      {composer && (
        <>
          <div onClick={fecharTudo} aria-hidden="true" className="fixed inset-0 z-40" />
          <div
            role="dialog"
            aria-label="Nova tarefa"
            style={{ left: composer.x, top: composer.y }}
            className="fixed z-50 w-70 p-3 rounded-lg bg-surface border border-border-soft shadow-modal anim-modal-in"
          >
            <FormTarefa
              valores={composer.valores}
              onChange={(valores) => setComposer((c) => (c ? { ...c, valores } : c))}
              pessoas={pessoas}
              usuario={usuario}
              compacto
              erro={composer.erro}
              salvando={pendente}
              onSubmit={criar}
              onCancelar={() => setComposer(null)}
              rotuloSubmit="Criar tarefa"
            />
          </div>
        </>
      )}

      {/* ── Drawer ── */}
      {selecionado && (
        <DrawerEvento
          key={chaveEvento(selecionado)}
          ev={selecionado}
          hoje={hoje}
          pessoas={pessoas}
          pessoasPorId={pessoasPorId}
          usuario={usuario}
          salvando={pendente}
          onFechar={() => setSelecionado(null)}
          onAlternarConclusao={(ev) => {
            alternarConclusao(ev);
            setSelecionado(null);
          }}
          onSalvar={salvarEdicao}
          onPedirExclusao={(ev) => setAExcluir(ev)}
        />
      )}

      {/* ── Confirmação de exclusão (primitivo 02, variante destrutiva) ── */}
      <Modal
        open={aExcluir !== null}
        onClose={() => setAExcluir(null)}
        variant="destrutiva"
        titulo="Excluir tarefa"
        descricao={
          aExcluir
            ? `"${aExcluir.titulo}" será apagada definitivamente. Não dá pra desfazer.`
            : undefined
        }
        primarioLabel="Excluir"
        onConfirmar={excluir}
      />
    </div>
  );
}

/**
 * Coordenadas de um painel ancorado num elemento, em `position: fixed`.
 *
 * Fixed (e não absolute) pra não precisar somar `scrollX/scrollY` — o retângulo
 * do `getBoundingClientRect` já é relativo à viewport. O `Math.min`/`Math.max`
 * mantém o painel dentro da tela quando a âncora está na borda direita ou muito
 * embaixo, que é o caso das últimas colunas e da última semana da grade.
 */
function posicionar(elemento: HTMLElement): { x: number; y: number } {
  const LARGURA = 288;
  const ALTURA_ESTIMADA = 300;
  const r = elemento.getBoundingClientRect();
  return {
    x: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8)),
    y: Math.max(8, Math.min(r.bottom + 6, window.innerHeight - ALTURA_ESTIMADA)),
  };
}
