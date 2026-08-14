"use client";

import {
  CATEGORIAS,
  categoriaDe,
  chaveEvento,
  compararNaCelula,
  estaAtrasada,
  iconeDoEvento,
  ocupaODia,
  podeArrastar,
  type CalendarEvent,
  type Pessoa,
} from "@/lib/calendario/types";
import {
  DIAS_SEMANA_CURTO,
  diaDaSemana,
  diffDias,
  formatarDiaMes,
  formatarHora,
  paraData,
  type DataISO,
} from "@/lib/calendario/datas";

/**
 * As três visões (Mês, Semana, Agenda) e o chip de evento que as três dividem.
 *
 * Nenhum componente aqui busca dado nem decide o que aparece: recebe eventos já
 * lidos da RPC e já filtrados por categoria e escopo. Aqui é só arranjo.
 *
 * Estados visuais, como o mock e o contrato C6 pedem — e nenhum deles depende só
 * de cor: concluída = risco + opacidade + caixa marcada; atrasada = anel + "Nd
 * atrasada" escrito; derivado = cadeado no lugar da caixa.
 */

export type AcoesEvento = {
  abrir: (ev: CalendarEvent) => void;
  alternarConclusao: (ev: CalendarEvent) => void;
  iniciarArrasto: (ev: CalendarEvent) => void;
  /** Arrasto que terminou sem soltar numa célula — desliga o realce das outras. */
  encerrarArrasto: () => void;
  soltarNoDia: (dia: DataISO) => void;
  comporNoDia: (dia: DataISO, ancora: HTMLElement) => void;
  verMais: (dia: DataISO, ancora: HTMLElement) => void;
};

type BaseProps = {
  eventos: CalendarEvent[];
  hoje: DataISO;
  pessoasPorId: Map<string, Pessoa>;
  acoes: AcoesEvento;
};

/** Máximo de eventos numa célula do mês antes do "+N mais" (mock). */
const MAX_NA_CELULA = 3;

function eventosDoDia(eventos: CalendarEvent[], dia: DataISO): CalendarEvent[] {
  return eventos.filter((ev) => ocupaODia(ev, dia)).sort(compararNaCelula);
}

// ─────────────────────────────────────────────────────────────────
// Chip de evento
// ─────────────────────────────────────────────────────────────────

export function EventoChip({
  ev,
  dia,
  hoje,
  pessoasPorId,
  acoes,
  quebraLinha = false,
}: {
  ev: CalendarEvent;
  /** Dia da célula — decide os cantos arredondados da barra multi-dia. */
  dia: DataISO | null;
  hoje: DataISO;
  pessoasPorId: Map<string, Pessoa>;
  acoes: AcoesEvento;
  quebraLinha?: boolean;
}) {
  const cat = CATEGORIAS[categoriaDe(ev.eventType)];
  const atrasada = estaAtrasada(ev, hoje);
  const concluida = ev.concluida === true;
  const responsavel = ev.responsavelUserId ? pessoasPorId.get(ev.responsavelUserId) : null;
  const hora = formatarHora(ev.horaInicio);
  const arrastavel = podeArrastar(ev);

  // Multi-dia: a barra só arredonda na ponta que é de fato início ou fim, o que
  // faz uma hospedagem de 6 dias ler como UMA faixa contínua atravessando a
  // semana, em vez de seis retângulos soltos.
  const ehInicio = dia !== null && dia === ev.dataInicio;
  const ehFim = dia !== null && dia === (ev.dataFim ?? ev.dataInicio);
  const raio = !ev.multiDia
    ? "rounded"
    : [ehInicio ? "rounded-l" : "rounded-l-none", ehFim ? "rounded-r" : "rounded-r-none"].join(" ");

  return (
    <div
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Payload real no dataTransfer além do estado do React: sem ele, o
        // browser cancela o arrasto em alguns alvos por falta de dado.
        e.dataTransfer.setData("text/plain", chaveEvento(ev));
        acoes.iniciarArrasto(ev);
      }}
      // Largar fora de qualquer célula não dispara `drop`: sem isto, o realce de
      // alvo ficaria aceso em toda a grade até o arrasto seguinte.
      onDragEnd={() => acoes.encerrarArrasto()}
      className={[
        "group/ev flex items-center gap-1.5 px-1.5 py-0.5 my-0.5 text-white",
        raio,
        concluida ? "opacity-55" : "",
        // Atraso NUNCA é só cor (C6): filete ouro por dentro + ⚠ no rótulo, e na
        // agenda a contagem escrita "Nd atrasada". Ouro porque a identidade v1.1
        // não tem vermelho — é a mesma solução do `danger-inset` dos primitivos.
        atrasada ? "shadow-[inset_0_0_0_2px_var(--color-gold)]" : "",
        arrastavel ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
      style={{ backgroundColor: cat.cor }}
      title={ev.editavel ? undefined : "Sincronizado da origem — somente leitura"}
    >
      {ev.editavel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={concluida}
          aria-label={`${concluida ? "Reabrir" : "Concluir"}: ${ev.titulo}`}
          onClick={(e) => {
            e.stopPropagation();
            acoes.alternarConclusao(ev);
          }}
          className="shrink-0 w-3.5 h-3.5 rounded-xs border-[1.5px] border-white bg-transparent flex items-center justify-center text-[9px] leading-none focus-ring"
        >
          {concluida && (
            <span aria-hidden="true" className="text-white">
              ✓
            </span>
          )}
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="shrink-0 text-[9.5px] opacity-85"
          title="Somente leitura"
        >
          🔒
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          acoes.abrir(ev);
        }}
        className={[
          "min-w-0 flex-1 flex items-center gap-1 text-left font-body text-[11.5px] focus-ring rounded-xs",
          quebraLinha ? "" : "truncate",
        ].join(" ")}
      >
        {atrasada && (
          <span aria-hidden="true" className="shrink-0 text-[10px]">
            ⚠
          </span>
        )}
        <span aria-hidden="true" className="shrink-0">
          {iconeDoEvento(ev)}
        </span>
        {hora && <span className="shrink-0 font-bold text-[10.5px] opacity-90">{hora}</span>}
        <span
          className={[quebraLinha ? "" : "truncate", concluida ? "line-through" : ""].join(" ")}
        >
          {ev.titulo}
        </span>
      </button>

      {/* Avatar só onde HÁ dono (contrato C5.2): derivado de viagem não tem
          responsável no dado, e inventar uma inicial ali seria mentir. */}
      {responsavel && (
        <span
          className="shrink-0 px-1 rounded-sm bg-white/25 font-body text-[9px] font-bold"
          title={responsavel.nome}
        >
          {responsavel.iniciais}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mês
// ─────────────────────────────────────────────────────────────────

export function VisaoMes({
  dias,
  mesExibido,
  eventos,
  hoje,
  pessoasPorId,
  acoes,
  arrastando,
}: BaseProps & {
  /** Os 42 dias da grade, já calculados no servidor pelo mesmo helper do range. */
  dias: DataISO[];
  /** Mês civil (0-11) — as células fora dele entram esmaecidas. */
  mesExibido: number;
  arrastando: boolean;
}) {
  return (
    <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
      <div className="grid grid-cols-7">
        {DIAS_SEMANA_CURTO.map((d) => (
          <div
            key={d}
            className="px-2 py-2 border-b border-border-soft font-body text-[11.5px] font-semibold text-text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doDia = eventosDoDia(eventos, dia);
          const visiveis = doDia.slice(0, MAX_NA_CELULA);
          const restantes = doDia.length - visiveis.length;
          const ehHoje = dia === hoje;
          const foraDoMes = paraData(dia).getMonth() !== mesExibido;

          return (
            <div
              key={dia}
              data-dia={dia}
              onDragOver={(e) => {
                if (!arrastando) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                acoes.soltarNoDia(dia);
              }}
              className={[
                "relative min-h-30 p-1 border-r border-b border-border-soft last-of-type:border-r-0",
                "nth-[7n]:border-r-0",
                ehHoje ? "bg-attention-bg" : "",
                arrastando
                  ? "hover:outline-2 hover:outline-dashed hover:outline-gold -outline-offset-2"
                  : "",
              ].join(" ")}
            >
              {/* Clicar no vazio da célula abre o composer. É um botão de fundo,
                  irmão dos chips, e não um handler no container: assim ele não
                  engole o clique dos eventos nem some do alcance do teclado. */}
              <button
                type="button"
                aria-label={`Nova tarefa em ${formatarDiaMes(dia)}`}
                onClick={(e) => acoes.comporNoDia(dia, e.currentTarget)}
                className="absolute inset-0 w-full h-full focus-ring rounded-sm"
              />

              <div className="relative pointer-events-none">
                <div
                  className={[
                    "inline-block px-1.5 py-0.5 font-body text-xs font-semibold",
                    foraDoMes ? "text-text-disabled" : "text-text-muted",
                    ehHoje ? "rounded-full bg-navy text-white" : "",
                  ].join(" ")}
                >
                  {paraData(dia).getDate()}
                </div>

                <div className="pointer-events-auto">
                  {visiveis.map((ev) => (
                    <EventoChip
                      key={chaveEvento(ev)}
                      ev={ev}
                      dia={dia}
                      hoje={hoje}
                      pessoasPorId={pessoasPorId}
                      acoes={acoes}
                    />
                  ))}

                  {restantes > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        acoes.verMais(dia, e.currentTarget);
                      }}
                      className="px-1 py-0.5 font-body text-[11px] font-semibold text-navy hover:text-gold focus-ring rounded-xs"
                    >
                      +{restantes} mais
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Semana
// ─────────────────────────────────────────────────────────────────

export function VisaoSemana({
  dias,
  eventos,
  hoje,
  pessoasPorId,
  acoes,
  arrastando,
}: BaseProps & { dias: DataISO[]; arrastando: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
      {dias.map((dia) => {
        const doDia = eventosDoDia(eventos, dia);
        const ehHoje = dia === hoje;

        return (
          <div
            key={dia}
            data-dia={dia}
            onDragOver={(e) => {
              if (!arrastando) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              acoes.soltarNoDia(dia);
            }}
            className={[
              "relative min-h-85 p-1.5 rounded-lg border",
              ehHoje ? "bg-attention-bg border-gold/40" : "bg-surface border-border-soft",
            ].join(" ")}
          >
            <button
              type="button"
              aria-label={`Nova tarefa em ${formatarDiaMes(dia)}`}
              onClick={(e) => acoes.comporNoDia(dia, e.currentTarget)}
              className="absolute inset-0 w-full h-full focus-ring rounded-lg"
            />

            <div className="relative pointer-events-none">
              <h4 className="px-1 mb-1.5 font-body text-xs font-semibold text-text-muted">
                {DIAS_SEMANA_CURTO[diaDaSemana(dia)]}{" "}
                <b
                  className={ehHoje ? "px-1.5 py-0.5 rounded-full bg-navy text-white" : "text-dark"}
                >
                  {paraData(dia).getDate()}
                </b>
              </h4>

              <div className="pointer-events-auto">
                {doDia.map((ev) => (
                  <EventoChip
                    key={chaveEvento(ev)}
                    ev={ev}
                    dia={dia}
                    hoje={hoje}
                    pessoasPorId={pessoasPorId}
                    acoes={acoes}
                    quebraLinha
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Agenda
// ─────────────────────────────────────────────────────────────────

function LinhaAgenda({
  ev,
  hoje,
  pessoasPorId,
  acoes,
}: {
  ev: CalendarEvent;
  hoje: DataISO;
  pessoasPorId: Map<string, Pessoa>;
  acoes: AcoesEvento;
}) {
  const cat = CATEGORIAS[categoriaDe(ev.eventType)];
  const atrasada = estaAtrasada(ev, hoje);
  const concluida = ev.concluida === true;
  const responsavel = ev.responsavelUserId ? pessoasPorId.get(ev.responsavelUserId) : null;
  const hora = formatarHora(ev.horaInicio);
  const diasDeAtraso = atrasada ? diffDias(ev.dataInicio, hoje) : 0;

  return (
    <div
      className={[
        "flex items-center gap-2.5 px-3 py-2 mb-1.5 rounded-md border bg-surface border-border-soft",
        concluida ? "opacity-60" : "",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="self-stretch w-1 rounded-sm"
        style={{ backgroundColor: cat.cor }}
      />

      {ev.editavel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={concluida}
          aria-label={`${concluida ? "Reabrir" : "Concluir"}: ${ev.titulo}`}
          onClick={() => acoes.alternarConclusao(ev)}
          className={[
            "shrink-0 w-4 h-4 rounded-xs border-2 flex items-center justify-center text-[11px] leading-none focus-ring",
            concluida ? "border-navy bg-navy text-white" : "border-icon-muted bg-white",
          ].join(" ")}
        >
          {concluida && <span aria-hidden="true">✓</span>}
        </button>
      ) : (
        <span aria-hidden="true" className="shrink-0 text-xs" title="Somente leitura">
          🔒
        </span>
      )}

      <span className="shrink-0 w-26 font-body text-[11.5px] text-text-muted">
        {DIAS_SEMANA_CURTO[diaDaSemana(ev.dataInicio)]} {formatarDiaMes(ev.dataInicio)}
        {hora ? ` · ${hora}` : ""}
      </span>

      <button
        type="button"
        onClick={() => acoes.abrir(ev)}
        className="min-w-0 flex-1 text-left focus-ring rounded-xs"
      >
        <span className={`font-body text-sm ${concluida ? "line-through" : ""}`}>
          <span aria-hidden="true">{iconeDoEvento(ev)} </span>
          {ev.titulo}
        </span>
        {ev.clienteNome && (
          <small className="block font-body text-[11.5px] text-text-muted truncate">
            {ev.clienteNome}
          </small>
        )}
      </button>

      {atrasada && (
        <span className="shrink-0 font-body text-[11px] font-bold text-navy">
          {diasDeAtraso}d atrasada
        </span>
      )}

      {responsavel && (
        <span
          className="shrink-0 w-5.5 h-5.5 rounded-full bg-surface-selected flex items-center justify-center font-body text-[9.5px] font-bold text-text-muted"
          title={responsavel.nome}
        >
          {responsavel.iniciais}
        </span>
      )}
    </div>
  );
}

function SecaoAgenda({
  titulo,
  destaque = false,
  itens,
  vazio,
  hoje,
  pessoasPorId,
  acoes,
}: {
  titulo: string;
  destaque?: boolean;
  itens: CalendarEvent[];
  vazio: string;
  hoje: DataISO;
  pessoasPorId: Map<string, Pessoa>;
  acoes: AcoesEvento;
}) {
  return (
    <section>
      <h3
        className={[
          "flex items-center gap-2 mt-5 mb-2 font-body text-[13px] font-semibold uppercase tracking-wider",
          destaque ? "text-navy" : "text-text-muted",
        ].join(" ")}
      >
        {destaque && <span aria-hidden="true">⚠</span>}
        {titulo}
        <span className="px-2 rounded-full bg-surface-muted font-body text-[11px] normal-case tracking-normal">
          {itens.length}
        </span>
      </h3>

      {itens.length === 0 ? (
        <p className="font-body text-sm text-text-muted">{vazio}</p>
      ) : (
        itens.map((ev) => (
          <LinhaAgenda
            key={chaveEvento(ev)}
            ev={ev}
            hoje={hoje}
            pessoasPorId={pessoasPorId}
            acoes={acoes}
          />
        ))
      )}
    </section>
  );
}

export function VisaoAgenda({
  eventos,
  hoje,
  pessoasPorId,
  acoes,
  verConcluidas,
  onAlternarConcluidas,
  diasFrente,
}: BaseProps & {
  verConcluidas: boolean;
  onAlternarConcluidas: () => void;
  diasFrente: number;
}) {
  const ordenar = (a: CalendarEvent, b: CalendarEvent) =>
    a.dataInicio.localeCompare(b.dataInicio) ||
    (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") ||
    a.titulo.localeCompare(b.titulo, "pt-BR");

  const mostrar = (ev: CalendarEvent) => ev.concluida !== true || verConcluidas;

  const atrasadas = eventos.filter((ev) => estaAtrasada(ev, hoje)).sort(ordenar);
  const deHoje = eventos
    .filter((ev) => ocupaODia(ev, hoje))
    .filter(mostrar)
    .sort(ordenar);
  // Próximos: começa DEPOIS de hoje. O corte de trás (hoje−60) e o de frente
  // (hoje+30) já vieram no range da RPC — aqui só se separa em seções.
  const proximos = eventos
    .filter((ev) => ev.dataInicio > hoje)
    .filter(mostrar)
    .sort(ordenar);

  return (
    <div className="max-w-3xl">
      <SecaoAgenda
        titulo="Atrasadas"
        destaque
        itens={atrasadas}
        vazio="Nada atrasado. 🎉"
        hoje={hoje}
        pessoasPorId={pessoasPorId}
        acoes={acoes}
      />
      <SecaoAgenda
        titulo="Hoje"
        itens={deHoje}
        vazio="Dia livre."
        hoje={hoje}
        pessoasPorId={pessoasPorId}
        acoes={acoes}
      />
      <SecaoAgenda
        titulo={`Próximos ${diasFrente} dias`}
        itens={proximos}
        vazio="Nada marcado."
        hoje={hoje}
        pessoasPorId={pessoasPorId}
        acoes={acoes}
      />

      <button
        type="button"
        onClick={onAlternarConcluidas}
        className="mt-4 font-body text-[12.5px] text-text-muted underline focus-ring rounded-xs"
      >
        {verConcluidas ? "Ocultar" : "Mostrar"} concluídas
      </button>
    </div>
  );
}
