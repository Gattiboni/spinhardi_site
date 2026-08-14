import type { DataISO, HoraISO } from "./datas";

/**
 * Vocabulário do calendário — contrato `docs/contrato_calendario_v1.md`.
 *
 * Este módulo é COMPARTILHADO (servidor e cliente): nada de `server-only` aqui.
 * A leitura fica em `./index.ts`, que é server-only.
 *
 * Regra que o módulo inteiro serve: a definição do que aparece no calendário
 * mora na RPC `calendar_events_between` (C4). Aqui só existem tipos, vocabulário
 * de exibição e predicados PUROS que derivam da linha já lida. Nenhuma query.
 */

// ─────────────────────────────────────────────────────────────────
// A linha da RPC
// ─────────────────────────────────────────────────────────────────

/**
 * Os nove `event_type` que a RPC emite. Conferido contra `pg_get_functiondef`
 * em 14/08/2026 — a ordem é a dos `union all` da função.
 */
export type EventType =
  | "tarefa"
  | "tarefa_iddas"
  | "checkin"
  | "voo"
  | "hospedagem"
  | "transporte"
  | "cruzeiro"
  | "seguro"
  | "aniversario";

/** Uma linha de `calendar_events_between`, em camelCase. */
export type CalendarEvent = {
  eventType: EventType;
  /** Tabela de origem (`tarefas`, `bronze_iddas_voo`, `contacts`…). */
  sourceType: string;
  /** Id na origem. Pra `checkin` é o `voo_bronze_id` de `calendar_checkins`. */
  sourceId: string;
  titulo: string;
  dataInicio: DataISO;
  horaInicio: HoraISO | null;
  dataFim: DataISO | null;
  multiDia: boolean;
  /** `true` só em `tarefa` e `checkin` — as duas únicas com escritor na UI. */
  editavel: boolean;
  /** `null` no que não é concluível (voo, hospedagem, aniversário…). */
  concluida: boolean | null;
  /** Preenchido só em `tarefa` e `tarefa_iddas`. Derivado de viagem NÃO tem dono. */
  responsavelUserId: string | null;
  contactId: string | null;
  clienteNome: string | null;
  /** Metadados por tipo. As chaves de cada `eventType` estão em `META_POR_TIPO`. */
  meta: Record<string, unknown>;
  sourceUpdatedAt: string | null;
};

/** Chave estável de um evento na UI (React key, overrides otimistas, drawer). */
export function chaveEvento(ev: Pick<CalendarEvent, "eventType" | "sourceId">): string {
  return `${ev.eventType}:${ev.sourceId}`;
}

// ─────────────────────────────────────────────────────────────────
// Categorias (os 8 chips)
// ─────────────────────────────────────────────────────────────────

/**
 * Oito categorias pra nove `event_type`: `tarefa_iddas` mora sob "Tarefas".
 *
 * É o mock (8 chips) casando com o dado real (9 origens): pra quem usa, a tarefa
 * espelhada do Iddas é uma tarefa — muda o cadeado, não a gaveta.
 */
export type Categoria =
  | "tarefa"
  | "checkin"
  | "voo"
  | "hospedagem"
  | "transporte"
  | "cruzeiro"
  | "seguro"
  | "aniversario";

export function categoriaDe(eventType: EventType): Categoria {
  return eventType === "tarefa_iddas" ? "tarefa" : eventType;
}

/**
 * PALETA DE CATEGORIA — decisão documentada (contrato C6).
 *
 * Estas oito cores são FUNCIONAIS DE ADMIN, não cromo de marca: distinguir oito
 * trilhas de operação num mesmo dia é uma tarefa que a paleta de marca (navy +
 * ouro + verde) não resolve — ela tem três cores e duas são protagonistas. Por
 * isso `docs/identidade_visual.md` reserva explicitamente a escala numérica do
 * Tailwind pra estados de UI no admin, e é dela que estas cores saem (nível 700
 * em toda a fila, o mais escuro que ainda lê como "colorido").
 *
 * Regras da identidade respeitadas, uma a uma:
 *  • Navy e ouro seguem protagonistas onde há cromo de marca — cabeçalho da
 *    página, botão primário, chip ativo, anel de foco. Nenhuma cor daqui invade
 *    esses lugares.
 *  • Verde-pinheiro (#3F5B30) NÃO entra nesta paleta. "Tarefas" usa emerald-700,
 *    um verde funcional distinto — o que também mata na raiz a restrição crítica
 *    de verde-pinheiro adjacente a navy: eles nunca se encostam porque o
 *    verde-pinheiro não é usado nesta tela.
 *  • Todos os oito passam AA (≥4,5:1) com texto branco por cima, que é como o
 *    chip de evento é pintado. Menor margem: emerald-700 (~4,9:1).
 *
 * Correspondência com o mock: o mock usou os Material 800; estes são os
 * equivalentes Tailwind mais próximos, mantendo a MESMA ordem de matiz (verde ·
 * teal · azul · roxo · laranja · rosa · ardósia · ciano), pra quem aprovou o
 * mock reconhecer a tela.
 */
export const CATEGORIAS: Record<
  Categoria,
  { nome: string; cor: string; icone: string; ordem: number }
> = {
  tarefa: { nome: "Tarefas", cor: "#047857", icone: "✓", ordem: 1 }, // emerald-700
  checkin: { nome: "Check-in", cor: "#0f766e", icone: "🛄", ordem: 2 }, // teal-700
  voo: { nome: "Voos", cor: "#1d4ed8", icone: "✈", ordem: 3 }, // blue-700
  hospedagem: { nome: "Hospedagens", cor: "#6d28d9", icone: "🛏", ordem: 4 }, // violet-700
  transporte: { nome: "Transportes", cor: "#c2410c", icone: "🚐", ordem: 5 }, // orange-700
  cruzeiro: { nome: "Cruzeiros", cor: "#be185d", icone: "🚢", ordem: 6 }, // pink-700
  seguro: { nome: "Seguros", cor: "#475569", icone: "🛡", ordem: 7 }, // slate-600
  aniversario: { nome: "Aniversários", cor: "#0e7490", icone: "🎂", ordem: 8 }, // cyan-700
};

export const CATEGORIAS_ORDENADAS = (Object.keys(CATEGORIAS) as Categoria[]).sort(
  (a, b) => CATEGORIAS[a].ordem - CATEGORIAS[b].ordem,
);

export function ehCategoria(valor: unknown): valor is Categoria {
  return typeof valor === "string" && valor in CATEGORIAS;
}

// ─────────────────────────────────────────────────────────────────
// Tipos de tarefa (vocabulário herdado do Iddas — contrato C2)
// ─────────────────────────────────────────────────────────────────

/**
 * 1 Tarefa · 2 Ligar · 3 E-mail · 4 Reunião · 5 Almoço · 6 Visita · 7 WhatsApp.
 *
 * Os números são do Iddas (a coluna `tarefas.tipo` herdou o vocabulário pra que
 * tarefa local e tarefa espelhada leiam igual). Os ÍCONES são escolha desta
 * implementação: o mock especifica ícone por categoria, não por tipo de tarefa.
 */
export const TIPOS_TAREFA: Record<number, { nome: string; icone: string }> = {
  1: { nome: "Tarefa", icone: "✓" },
  2: { nome: "Ligar", icone: "📞" },
  3: { nome: "E-mail", icone: "✉" },
  4: { nome: "Reunião", icone: "👥" },
  5: { nome: "Almoço", icone: "🍽" },
  6: { nome: "Visita", icone: "📍" },
  7: { nome: "WhatsApp", icone: "💬" },
};

export const TIPOS_TAREFA_ORDENADOS = Object.entries(TIPOS_TAREFA).map(([valor, t]) => ({
  valor: Number(valor),
  ...t,
}));

/** Ícone do chip: tipo da tarefa quando houver, senão o da categoria. */
export function iconeDoEvento(ev: CalendarEvent): string {
  const cat = categoriaDe(ev.eventType);
  if (cat === "tarefa") {
    const tipo = typeof ev.meta.tipo === "number" ? ev.meta.tipo : null;
    return (tipo && TIPOS_TAREFA[tipo]?.icone) || CATEGORIAS.tarefa.icone;
  }
  return CATEGORIAS[cat].icone;
}

// ─────────────────────────────────────────────────────────────────
// Metadados por tipo (drawer)
// ─────────────────────────────────────────────────────────────────

/**
 * Chaves de `meta` por `event_type`, com rótulo pt-BR, na ordem de exibição.
 *
 * Extraído de `jsonb_build_object` da RPC, chave a chave, em 14/08/2026. Chave
 * ausente ou nula no jsonb simplesmente não vira linha no drawer.
 */
export const META_POR_TIPO: Record<EventType, { chave: string; rotulo: string }[]> = {
  tarefa: [{ chave: "descricao", rotulo: "Descrição" }],
  tarefa_iddas: [
    { chave: "descricao", rotulo: "Descrição" },
    { chave: "id_orcamento", rotulo: "Orçamento" },
  ],
  checkin: [
    { chave: "voo", rotulo: "Voo" },
    { chave: "data_embarque", rotulo: "Embarque" },
    { chave: "hora_embarque", rotulo: "Hora do embarque" },
    { chave: "localizador", rotulo: "Localizador" },
  ],
  voo: [
    { chave: "voo", rotulo: "Voo" },
    { chave: "companhia", rotulo: "Companhia" },
    { chave: "classe", rotulo: "Classe" },
    { chave: "data_chegada", rotulo: "Chegada" },
    { chave: "hora_chegada", rotulo: "Hora da chegada" },
    { chave: "localizador", rotulo: "Localizador" },
  ],
  hospedagem: [{ chave: "localizador", rotulo: "Localizador" }],
  transporte: [
    { chave: "retirada", rotulo: "Retirada" },
    { chave: "devolucao", rotulo: "Devolução" },
    { chave: "descricao", rotulo: "Descrição" },
    { chave: "localizador", rotulo: "Localizador" },
  ],
  cruzeiro: [
    { chave: "embarque", rotulo: "Porto de embarque" },
    { chave: "desembarque", rotulo: "Porto de desembarque" },
    { chave: "tipo_cabine", rotulo: "Cabine" },
    { chave: "localizador", rotulo: "Localizador" },
  ],
  seguro: [{ chave: "localizador", rotulo: "Localizador" }],
  aniversario: [
    { chave: "idade", rotulo: "Faz" },
    { chave: "nascimento", rotulo: "Nascimento" },
  ],
};

/** Microtexto de origem do derivado (drawer). `null` = nasceu aqui, sem cadeado. */
export function origemDoEvento(ev: CalendarEvent): string | null {
  switch (ev.eventType) {
    case "tarefa":
      return null;
    case "tarefa_iddas":
      return `Iddas · tarefa #${ev.sourceId}`;
    case "checkin":
      return `Regra D-2 do voo #${ev.sourceId}`;
    case "aniversario":
      return "Cadastro do contato";
    default:
      return `Iddas · ${ev.eventType} #${ev.sourceId}`;
  }
}

// ─────────────────────────────────────────────────────────────────
// Pessoas, escopo e filtro
// ─────────────────────────────────────────────────────────────────

/** Perfil aprovado — vem de `user_profiles`, nunca de lista em código (C5). */
export type Pessoa = {
  id: string;
  nome: string;
  iniciais: string;
  ehAdmin: boolean;
};

export type Escopo = "meu" | "time";

export type Visao = "mes" | "semana" | "agenda";

export function ehVisao(valor: unknown): valor is Visao {
  return valor === "mes" || valor === "semana" || valor === "agenda";
}

/** `Nina Ferreira` → `NI`; nome de uma palavra → duas primeiras letras. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Visibilidade de um evento — hierarquia do contrato C5, zero hardcoding.
 *
 * A regra que o mock NÃO tinha e o contrato decidiu (C5.2): **evento sem
 * responsável é do time e aparece pra todo mundo, sempre**. Voo, hospedagem,
 * cruzeiro, seguro, transporte, check-in e aniversário não têm dono no dado —
 * filtrá-los por pessoa esvaziaria o calendário de quem não é admin e faria o
 * filtro por avatar esconder a operação inteira. O mock aplicava `e.resp === user`
 * em tudo porque no mock TODO evento tinha responsável fictício.
 *
 * Com dono (só `tarefa` e `tarefa_iddas`):
 *  • não-admin  → só as suas;
 *  • admin/meu  → só as suas;
 *  • admin/time → as das pessoas marcadas no seletor de avatares.
 */
export function eventoVisivel(
  ev: CalendarEvent,
  opts: {
    ehAdmin: boolean;
    escopo: Escopo;
    usuarioId: string;
    pessoasSelecionadas: ReadonlySet<string>;
  },
): boolean {
  if (ev.responsavelUserId === null) return true;
  if (!opts.ehAdmin || opts.escopo === "meu") return ev.responsavelUserId === opts.usuarioId;
  return opts.pessoasSelecionadas.has(ev.responsavelUserId);
}

/** Atrasada = editável, não concluída e com data anterior a hoje (C2, derivado). */
export function estaAtrasada(ev: CalendarEvent, hoje: DataISO): boolean {
  return ev.editavel && !ev.concluida && ev.dataInicio < hoje;
}

/** Um evento ocupa o dia se cai nele ou se a faixa multi-dia o cobre. */
export function ocupaODia(ev: CalendarEvent, dia: DataISO): boolean {
  if (ev.dataFim) return dia >= ev.dataInicio && dia <= ev.dataFim;
  return ev.dataInicio === dia;
}

/**
 * Ordem dentro da célula: faixas multi-dia primeiro (elas são a "régua" visual
 * do dia), depois por hora, e quem não tem hora fecha o bloco.
 */
export function compararNaCelula(a: CalendarEvent, b: CalendarEvent): number {
  const multi = Number(b.multiDia) - Number(a.multiDia);
  if (multi !== 0) return multi;
  if (a.horaInicio && b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio);
  if (a.horaInicio) return -1;
  if (b.horaInicio) return 1;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/**
 * Só `tarefa` local é arrastável.
 *
 * `editavel` marca "tem escritor na UI", e o check-in tem — mas o escritor dele
 * é concluir/desfazer (`calendar_checkins`), não remarcar: a data do check-in é
 * DERIVADA (D-2 do embarque) e não existe coluna onde gravar outra. Arrastar um
 * check-in não teria onde salvar. Mudar essa data é mudar o voo, na origem.
 */
export function podeArrastar(ev: CalendarEvent): boolean {
  return ev.eventType === "tarefa" && !ev.concluida;
}
