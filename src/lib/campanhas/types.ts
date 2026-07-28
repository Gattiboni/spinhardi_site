/**
 * Tipos de campanha de e-mail. Módulo PURO (sem `server-only`): a UI cliente
 * importa os rótulos e os tipos daqui.
 *
 * Todo vocabulário fechado abaixo bate EXATO com os CHECK das tabelas em
 * produção — conferido em 27/07/2026 no `information_schema`. Mudar um valor
 * aqui sem mudar o CHECK quebra o insert no servidor, não na tela.
 */

export type CampanhaTipo = "newsletter" | "anuncio" | "saida_grupo";
export type CampanhaEstado = "rascunho" | "testada" | "agendada" | "enviada";
export type PublicoTipo = "todos_elegiveis" | "grupo";

export type EmailMarketingStatus = "legitimo_interesse" | "optin" | "descadastrado" | "invalido";

export type EmailMarketingOrigem =
  | "importacao"
  | "backoffice"
  | "repermissao"
  | "descadastro"
  | "bounce"
  | "reclamacao";

export type Campanha = {
  id: string;
  nomeInterno: string;
  tipo: CampanhaTipo;

  // Conteúdo — os nove campos que entram no `conteudo_hash` (C4).
  assunto: string | null;
  titulo: string | null;
  intro: string | null;
  corpo: string | null;
  ctaTexto: string | null;
  ctaLink: string | null;
  notaRodape: string | null;
  imagemPath: string | null;
  imagemAlt: string | null;

  estado: CampanhaEstado;
  conteudoHash: string | null;

  publicoTipo: PublicoTipo;
  grupoId: string | null;

  testadoEm: string | null;
  testadoHash: string | null;
  testadoPara: string | null;

  agendadoPara: string | null;
  enviadoEm: string | null;
  resendBroadcastId: string | null;

  criadoPor: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Só os campos de conteúdo — é o que o hash cobre e o que a edição salva. */
export type CampanhaConteudo = Pick<
  Campanha,
  | "assunto"
  | "titulo"
  | "intro"
  | "corpo"
  | "ctaTexto"
  | "ctaLink"
  | "notaRodape"
  | "imagemPath"
  | "imagemAlt"
>;

export type CampanhaDestinatario = {
  id: string;
  campanhaId: string;
  contactId: string | null;
  email: string;
  nome: string;
  enviadoEm: string;
};

/**
 * Tipos de evento consumidos (V2). `email.scheduled` e `email.suppressed`
 * existem no SDK 6.12.4 e entram na lista — chegam e são gravados; só não
 * participam da agregação de métricas.
 */
export type EventoTipo =
  | "email.sent"
  | "email.scheduled"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.failed"
  | "email.suppressed"
  | "contact.updated";

export type CampanhaEvento = {
  id: string;
  campanhaId: string | null;
  contactId: string | null;
  resendEmailId: string | null;
  /** Texto livre: evento desconhecido é gravado, nunca descartado (V2). */
  tipo: string;
  ocorridoEm: string;
  recebidoEm: string;
  rawPayload: Record<string, unknown>;
};

/** Métricas derivadas por agregação (V6). Nenhum contador em coluna. */
export type CampanhaMetricas = {
  destinatarios: number;
  enviados: number;
  entregues: number;
  abertos: number;
  cliques: number;
  descadastros: number;
  bouncesHard: number;
  bouncesSoft: number;
  reclamacoes: number;
  falhas: number;
};

export const CAMPANHA_METRICAS_ZERO: CampanhaMetricas = {
  destinatarios: 0,
  enviados: 0,
  entregues: 0,
  abertos: 0,
  cliques: 0,
  descadastros: 0,
  bouncesHard: 0,
  bouncesSoft: 0,
  reclamacoes: 0,
  falhas: 0,
};

/** Contagem de quem ficou de fora e por quê (E2 / passo 2 da tela). */
export type Exclusoes = {
  semEmail: number;
  descadastrado: number;
  invalido: number;
  /** Só faz sentido em público=grupo: membro arquivado/inativo. */
  inativo: number;
};

export const EXCLUSOES_ZERO: Exclusoes = {
  semEmail: 0,
  descadastrado: 0,
  invalido: 0,
  inativo: 0,
};

export type PublicoResolvido = {
  destinatarios: { contactId: string; email: string; nome: string }[];
  exclusoes: Exclusoes;
  /** Total de membros do grupo antes da elegibilidade (null em todos_elegiveis). */
  totalGrupo: number | null;
};

// ─────────────────────────────────────────────────────────────────
// Rótulos de UI (PT-BR, tom de ferramenta)
// ─────────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<CampanhaTipo, string> = {
  newsletter: "Newsletter",
  anuncio: "Anúncio",
  saida_grupo: "Saída de grupo",
};

export const TIPOS_OPTIONS: CampanhaTipo[] = ["newsletter", "anuncio", "saida_grupo"];

/** Badge de estado no padrão `Record<estado, {...}>` já usado no repo. */
export const ESTADO_BADGE: Record<
  CampanhaEstado,
  { label: string; classe: string; icone: string }
> = {
  rascunho: {
    label: "Rascunho",
    icone: "·",
    classe: "bg-surface-selected text-text-muted",
  },
  testada: {
    label: "Testada",
    icone: "✓",
    classe: "bg-success-bg text-green border border-success-border",
  },
  agendada: {
    label: "Agendada",
    icone: "◷",
    classe: "bg-attention-bg text-gold border border-accent-soft",
  },
  enviada: {
    label: "Enviada",
    icone: "→",
    classe: "bg-navy text-white",
  },
};

export const PUBLICO_LABELS: Record<PublicoTipo, string> = {
  todos_elegiveis: "Todos os elegíveis",
  grupo: "Um grupo",
};

export const STATUS_EMAIL_BADGE: Record<
  EmailMarketingStatus,
  { label: string; classe: string; explicacao: string }
> = {
  legitimo_interesse: {
    label: "Recebe",
    classe: "bg-success-bg text-green border border-success-border",
    explicacao: "Relação comercial existente. Recebe as campanhas.",
  },
  optin: {
    label: "Recebe (autorizou)",
    classe: "bg-success-bg text-green border border-success-border",
    explicacao: "Autorizou o envio de forma explícita.",
  },
  descadastrado: {
    label: "Não recebe",
    classe: "bg-navy text-white",
    explicacao: "Pediu pra sair. Só a própria pessoa pode voltar a receber.",
  },
  invalido: {
    label: "E-mail com problema",
    classe: "bg-navy text-white",
    explicacao: "O e-mail voltou. Conserte o endereço na ficha pra voltar a enviar.",
  },
};

export const ORIGEM_STATUS_LABELS: Record<EmailMarketingOrigem, string> = {
  importacao: "importação",
  backoffice: "back-office",
  repermissao: "pedido de permissão",
  descadastro: "descadastro da pessoa",
  bounce: "retorno do e-mail",
  reclamacao: "marcação de spam",
};
