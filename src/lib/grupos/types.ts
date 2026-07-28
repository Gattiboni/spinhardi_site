/**
 * Grupos — tipos puros (a UI cliente importa daqui).
 *
 * Grupo é ESTÁTICO E HUMANO (G2): conjunto explícito de contatos, curado pela
 * operadora. Não existe grupo dinâmico por regra em v1.
 *
 * Grupo é VIVO, destinatário é CONGELADO (G5): mexer no grupo depois do envio
 * não altera nenhum registro de campanha já enviada.
 */

export type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  /**
   * Segment do Resend. Fica `null` até o primeiro uso em envio — a
   * materialização é preguiçosa e mora no pipeline (F5). Nenhum CRUD de grupo
   * fala com o Resend.
   */
  resendSegmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Grupo + contagens pra lista e pro cabeçalho da tela do grupo. */
export type GrupoComContagens = Grupo & {
  /** Total de membros, sem filtro nenhum. */
  membros: number;
  /**
   * Quantos DESTE grupo receberiam hoje. Calculado contra
   * `contatos_elegiveis_email` — a definição única (E1). Grupo não filtra
   * elegibilidade: ele pode conter gente sem e-mail, e é por isso que os dois
   * números existem.
   */
  elegiveis: number;
};

export type MembroDoGrupo = {
  contactId: string;
  nome: string;
  email: string | null;
  adicionadoEm: string;
  /** Passa na view de elegibilidade agora? */
  elegivel: boolean;
  /** Frase curta do porquê, quando não passa. `null` quando passa. */
  motivoInelegivel: string | null;
};
