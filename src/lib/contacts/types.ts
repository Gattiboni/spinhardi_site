export type CaptureOrigin =
  | "site_contato"
  | "google_ads"
  | "instagram"
  | "indicacao"
  | "evento"
  | "manual"
  | "importado";

export type DestinoTipo =
  | "italia"
  | "europa_geral"
  | "cruzeiro"
  | "america_sul"
  | "outro"
  | "indefinido";

export type OrcamentoEstimado =
  | "ate_5k"
  | "5k_15k"
  | "15k_30k"
  | "30k_50k"
  | "acima_50k"
  | "nao_informado";

export type PrazoIdeal =
  | "1_3_meses"
  | "3_6_meses"
  | "6_12_meses"
  | "acima_12_meses"
  | "flexivel"
  | "data_fixa";

export type PerfilViajante =
  | "primeira_viagem_internacional"
  | "viajante_frequente"
  | "lua_de_mel"
  | "familia"
  | "grupo_amigos"
  | "negocios"
  | "outro";

export type EstagioFunil =
  | "novo"
  | "qualificado"
  | "proposta_enviada"
  | "em_negociacao"
  | "aguardando_pagamento"
  | "fechado_confirmado"
  | "viagem_realizada"
  | "em_espera"
  | "perdido";

export type SyncStatus = "synced" | "pending" | "failed";

export type ContactStatus = "ativo" | "arquivado" | "duplicado" | "anonimizado_lgpd";

export type Contact = {
  // 1. Identificação
  id: string;
  createdAt: string; // ISO datetime
  updatedAt: string;

  // 2. Dados pessoais
  name: string;
  whatsapp: string;
  email: string | null;
  cpf: string | null;
  dataNascimento: string | null; // YYYY-MM-DD
  nacionalidade: string; // default "Brasileira"

  // 3. Endereço
  cep: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string; // default "Brasil"

  // 4. Qualificação
  origem: CaptureOrigin;
  origemDetalhe: string | null;
  destinoTipo: DestinoTipo;
  destinoTexto: string | null;
  orcamentoEstimado: OrcamentoEstimado;
  prazoIdeal: PrazoIdeal;
  dataIda: string | null;
  dataVolta: string | null;
  passageirosAdultos: number; // default 1
  passageirosCriancas: number; // default 0
  passageirosBebes: number; // default 0
  perfilViajante: PerfilViajante;
  experienciaAnterior: string | null;
  restricoes: string | null;

  // 5. Estágio interno (nosso funil)
  estagio: EstagioFunil;
  estagioAtualizadoEm: string;
  proximoFollowUp: string | null;
  notasInternas: string;

  // 6. Tags (segmentação)
  tags: string[];

  // 7. Espelho do Iddas
  iddasPessoaId: string | null;
  iddasCotacaoCode: string | null;
  iddasOrcamentoId: string | null;
  iddasVendaId: string | null;
  iddasUltimoSync: string | null;
  iddasSyncStatus: SyncStatus;
  iddasSyncError: string | null;

  // 8. Espelho do ClickMassa
  clickmassaContactId: string | null;
  clickmassaTicketIds: string[];
  clickmassaTagsId: number[];
  clickmassaOportunidadeId: string | null;
  clickmassaPipelineStep: string | null;
  clickmassaUltimoSync: string | null;
  clickmassaSyncStatus: SyncStatus;
  clickmassaSyncError: string | null;

  // 9. Comportamento
  postsLidos: string[];
  ultimaInteracao: string | null;
  emailsAbertos: number;
  campanhasAtivas: string[];

  // 10. Metadados
  status: ContactStatus;
  arquivadoEm: string | null;
  motivoArquivamento: string | null;
};

export type ContactInteractionType =
  | "form_submission"
  | "whatsapp_recebido"
  | "whatsapp_enviado"
  | "email_recebido"
  | "email_enviado"
  | "ligacao"
  | "reuniao"
  | "nota_interna"
  | "mudanca_estagio"
  | "sync_iddas"
  | "sync_clickmassa"
  | "tag_adicionada"
  | "tag_removida";

export type ContactInteraction = {
  id: string;
  contactId: string;
  tipo: ContactInteractionType;
  descricao: string;
  metadata: Record<string, unknown>;
  criadoPor: string; // usuário interno ou "sistema"
  criadoEm: string;
};

// Labels pra UI
export const ORIGEM_LABELS: Record<CaptureOrigin, string> = {
  site_contato: "Site",
  google_ads: "Google Ads",
  instagram: "Instagram",
  indicacao: "Indicação",
  evento: "Evento",
  manual: "Manual",
  importado: "Importado",
};

export const DESTINO_LABELS: Record<DestinoTipo, string> = {
  italia: "Itália",
  europa_geral: "Europa em geral",
  cruzeiro: "Cruzeiro",
  america_sul: "América do Sul",
  outro: "Outro destino",
  indefinido: "Ainda não sei",
};

export const ORCAMENTO_LABELS: Record<OrcamentoEstimado, string> = {
  ate_5k: "Até R$ 5 mil",
  "5k_15k": "R$ 5 a 15 mil",
  "15k_30k": "R$ 15 a 30 mil",
  "30k_50k": "R$ 30 a 50 mil",
  acima_50k: "Acima de R$ 50 mil",
  nao_informado: "Prefiro conversar sobre isso",
};

export const PRAZO_LABELS: Record<PrazoIdeal, string> = {
  "1_3_meses": "Próximos 3 meses",
  "3_6_meses": "3 a 6 meses",
  "6_12_meses": "6 a 12 meses",
  acima_12_meses: "Mais de 1 ano",
  flexivel: "Tenho flexibilidade",
  data_fixa: "Tenho data fixa",
};

export const PERFIL_LABELS: Record<PerfilViajante, string> = {
  primeira_viagem_internacional: "Primeira viagem internacional",
  viajante_frequente: "Viajante frequente",
  lua_de_mel: "Lua de mel",
  familia: "Família",
  grupo_amigos: "Grupo de amigos",
  negocios: "A negócios",
  outro: "Outro",
};

export const ESTAGIO_LABELS: Record<EstagioFunil, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  proposta_enviada: "Proposta enviada",
  em_negociacao: "Em negociação",
  aguardando_pagamento: "Aguardando pagamento",
  fechado_confirmado: "Fechado",
  viagem_realizada: "Viagem realizada",
  em_espera: "Em espera",
  perdido: "Perdido",
};

// Listas pra dropdowns
export const DESTINOS_OPTIONS: DestinoTipo[] = [
  "italia",
  "europa_geral",
  "cruzeiro",
  "america_sul",
  "outro",
  "indefinido",
];

export const ORCAMENTOS_OPTIONS: OrcamentoEstimado[] = [
  "ate_5k",
  "5k_15k",
  "15k_30k",
  "30k_50k",
  "acima_50k",
  "nao_informado",
];

export const PRAZOS_OPTIONS: PrazoIdeal[] = [
  "1_3_meses",
  "3_6_meses",
  "6_12_meses",
  "acima_12_meses",
  "flexivel",
  "data_fixa",
];

export const PERFIS_OPTIONS: PerfilViajante[] = [
  "primeira_viagem_internacional",
  "viajante_frequente",
  "lua_de_mel",
  "familia",
  "grupo_amigos",
  "negocios",
  "outro",
];

export const ESTAGIOS_OPTIONS: EstagioFunil[] = [
  "novo",
  "qualificado",
  "proposta_enviada",
  "em_negociacao",
  "aguardando_pagamento",
  "fechado_confirmado",
  "viagem_realizada",
  "em_espera",
  "perdido",
];

// Listas pra dropdowns de filtro (admin)
export const ORIGENS_OPTIONS: CaptureOrigin[] = [
  "site_contato",
  "google_ads",
  "instagram",
  "indicacao",
  "evento",
  "manual",
  "importado",
];
