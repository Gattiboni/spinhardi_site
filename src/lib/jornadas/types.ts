import type { EstagioFunil } from "@/lib/contacts/types";

/**
 * Jornada — um ciclo de venda (D072). O contato é a pessoa; a jornada é o
 * atendimento. 1 contato → N jornadas, várias abertas ao mesmo tempo. O estágio
 * do funil vive AQUI, não mais no contato.
 *
 * Vocabulário (bate exato com o CHECK do banco):
 *  - ABERTAS  (vão pro kanban):  primeiro contato · cotação enviada · pediu pra esperar
 *  - FECHADAS (vão pro histórico): aprovado · reprovado
 *
 * `aprovacao_status`: 'pendente' (cai na tela de aprovação) · 'aprovada' (entra
 * no kanban). O kanban mostra TODAS as aprovadas, cada uma na coluna do seu
 * estágio (abertas e fechadas). `aberta` controla só os agregados do topo
 * ("X jornadas abertas") e relatórios — não some mais do quadro.
 */

// Reusa o vocabulário de 5 estágios já definido em contacts/types (EstagioFunil).
export type EstagioJornada = EstagioFunil;

export type AprovacaoStatus = "pendente" | "aprovada";

export const ESTAGIOS_ABERTOS: EstagioJornada[] = [
  "primeiro contato",
  "cotação enviada",
  "pediu pra esperar",
];

export const ESTAGIOS_FECHADOS: EstagioJornada[] = ["aprovado", "reprovado"];

/**
 * Ordem das colunas do kanban: as 3 abertas, depois as 2 fechadas. O kanban
 * mostra TODAS sempre (estilo CRM) — coluna vazia segue visível com contador 0.
 */
export const ESTAGIOS_KANBAN: EstagioJornada[] = [
  ...ESTAGIOS_ABERTOS,
  ...ESTAGIOS_FECHADOS,
];

export function isEstagioAberto(e: EstagioJornada): boolean {
  return (ESTAGIOS_ABERTOS as string[]).includes(e);
}

export type Jornada = {
  id: string;
  contactId: string | null;
  estagio: EstagioJornada;
  estagioAtualizadoEm: string;
  aberta: boolean;
  aprovacaoStatus: AprovacaoStatus;
  tituloJornada: string | null;
  /**
   * Valor único da jornada (espelha `bronze_iddas_orcamento.valor`). O significado
   * vem do ESTÁGIO: aberta → cotação · aprovado → ganho · reprovado → perda. Não
   * existe campo separado de "fechado" na origem — é um valor só, sobrescrito.
   */
  valor: number | null;
  origemDado: string;
  bronzeRef: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Dias desde a última mudança de estágio ("X dias parado" no card). Deriva de
 * `estagio_atualizado_em`. Acima de `DIAS_PARADO_ALERTA` o card pinta de vermelho.
 */
export const DIAS_PARADO_ALERTA = 14;

export function diasParado(estagioAtualizadoEm: string | null): number {
  if (!estagioAtualizadoEm) return 0;
  const d = new Date(estagioAtualizadoEm);
  if (isNaN(d.getTime())) return 0;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Tarefa interna de uma jornada (`tarefas_jornada`) — to-do editável da operação,
 * separada das tarefas read-only do Iddas (`bronze_iddas_tarefa`).
 */
export type TarefaInterna = {
  id: string;
  jornadaId: string;
  assunto: string;
  descricao: string | null;
  data: string | null; // ISO date
  hora: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Jornada + nome do contato resolvido (pro card do kanban e telas de lista). */
export type JornadaComContato = Jornada & {
  contatoNome: string | null;
};

/** Tarefa futura do Iddas (bronze_iddas_tarefa) usada como follow-up no card. */
export type FollowUpTarefa = {
  id: string;
  assunto: string | null;
  descricao: string | null;
  data: string | null; // ISO date
  hora: string | null;
};

/** Card do kanban: jornada + contato + a tarefa futura mais próxima (badge). */
export type JornadaCard = JornadaComContato & {
  proximaTarefa: FollowUpTarefa | null;
  /**
   * SLUGS das tags internas do contato vinculado (`contacts.tags`), projetados
   * no card só pra exibição. Read-only por definição: a jornada não tem tag
   * própria e não existe edição por aqui — quem edita é a ficha do contato.
   */
  tagsInternas: string[];
};
