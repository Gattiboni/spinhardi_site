import type {
  Contact,
  ContactInteraction,
  ContactInteractionType,
  CaptureOrigin,
  DestinoTipo,
  OrcamentoEstimado,
  PrazoIdeal,
  PerfilViajante,
  SyncStatus,
  ContactStatus,
} from "./types";
import type { EmailMarketingOrigem, EmailMarketingStatus } from "@/lib/campanhas/types";

/**
 * Mapeamento EXPLÍCITO por campo entre o banco (snake_case) e o TS (camelCase).
 *
 * Por que à mão e não um conversor genérico de chaves:
 *  1. Type safety — o tipo de retorno `Contact` / `ContactRow` faz o compilador
 *     cobrar que nenhum dos campos ficou de fora.
 *  2. Crítico — um conversor genérico converteria também as chaves DENTRO do
 *     `metadata` jsonb das interações e corromperia o payload. Aqui o `metadata`
 *     passa direto, intacto.
 *
 * Regra de conversão uniforme: snake_case no banco ↔ camelCase no TS
 * (`created_at` ↔ `createdAt`, `iddas_pessoa_id` ↔ `iddasPessoaId`, sem exceção).
 */

// ─────────────────────────────────────────────────────────────────
// Shapes das rows do banco (snake_case)
// ─────────────────────────────────────────────────────────────────

export type ContactRow = {
  id: string;
  created_at: string;
  updated_at: string;

  // Carimbo de edição humana por card da ficha (M1). Só as server actions dos
  // cards escrevem aqui; o sync nunca toca. `null` = nunca editado à mão.
  dados_editado_em: string | null;
  qualificacao_editado_em: string | null;

  name: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  nacionalidade: string;

  cep: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string;

  origem: CaptureOrigin;
  origem_detalhe: string | null;
  destino_tipo: DestinoTipo;
  destino_texto: string | null;
  orcamento_estimado: OrcamentoEstimado;
  prazo_ideal: PrazoIdeal;
  data_ida: string | null;
  data_volta: string | null;
  passageiros_adultos: number;
  passageiros_criancas: number;
  passageiros_bebes: number;
  perfil_viajante: PerfilViajante;
  experiencia_anterior: string | null;
  restricoes: string | null;

  // `estagio`/`estagio_atualizado_em` saíram do contato (migraram pra `jornadas`).
  // A coluna `estagio` em contacts será dropada por último (ver report). Não
  // lemos nem escrevemos mais essas colunas por aqui.
  proximo_follow_up: string | null;
  notas_internas: string;

  tags: string[];

  // Permissão de e-mail marketing (bloco P). Opcionais no shape porque o
  // SELECT `*` pode rodar contra um banco anterior à migração — aí o mapper cai
  // no default do contrato ('legitimo_interesse') em vez de quebrar.
  email_marketing_status?: EmailMarketingStatus;
  email_marketing_status_em?: string | null;
  email_marketing_status_origem?: EmailMarketingOrigem | null;

  iddas_pessoa_id: string | null;
  iddas_cotacao_code: string | null;
  iddas_orcamento_id: string | null;
  iddas_venda_id: string | null;
  iddas_ultimo_sync: string | null;
  iddas_sync_status: SyncStatus;
  iddas_sync_error: string | null;

  clickmassa_contact_id: string | null;
  clickmassa_ticket_ids: string[];
  clickmassa_tags_id: number[];
  clickmassa_oportunidade_id: string | null;
  clickmassa_pipeline_step: string | null;
  clickmassa_ultimo_sync: string | null;
  clickmassa_sync_status: SyncStatus;
  clickmassa_sync_error: string | null;

  posts_lidos: string[];
  ultima_interacao: string | null;

  status: ContactStatus;
  arquivado_em: string | null;
  motivo_arquivamento: string | null;

  // Indicador de qualidade (U1.2): coluna GENERATED `whatsapp is not null`.
  // Opcional no shape porque o SELECT `*` pode rodar antes da migração existir —
  // aí `row.tem_whatsapp` chega undefined e o mapper usa o fallback local.
  tem_whatsapp?: boolean;
};

// Payload de insert: o banco gera id / created_at (default) e updated_at (trigger).
// `iddas_pessoa_id` / `clickmassa_contact_id` também saem: são colunas-PROJEÇÃO
// mantidas por trigger a partir de `contact_external_links`. Nenhum código de
// aplicação escreve nelas (nem null) — a escrita do vínculo vive na tabela de link.
// `tem_whatsapp` sai também: é coluna GENERATED (derivada de whatsapp), read-only.
export type ContactInsertRow = Omit<
  ContactRow,
  "id" | "created_at" | "updated_at" | "iddas_pessoa_id" | "clickmassa_contact_id" | "tem_whatsapp"
>;

export type ContactInteractionRow = {
  id: string;
  contact_id: string;
  tipo: ContactInteractionType;
  descricao: string;
  metadata: Record<string, unknown>;
  criado_por: string;
  criado_em: string;
};

// Payload de insert: o banco gera id e criado_em (default).
export type ContactInteractionInsertRow = Omit<ContactInteractionRow, "id" | "criado_em">;

// ─────────────────────────────────────────────────────────────────
// Contact: row → Contact (leitura)
// ─────────────────────────────────────────────────────────────────

export function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dadosEditadoEm: row.dados_editado_em ?? null,
    qualificacaoEditadoEm: row.qualificacao_editado_em ?? null,

    name: row.name,
    whatsapp: row.whatsapp,
    email: row.email,
    cpf: row.cpf,
    dataNascimento: row.data_nascimento,
    nacionalidade: row.nacionalidade,

    cep: row.cep,
    cidade: row.cidade,
    estado: row.estado,
    pais: row.pais,

    origem: row.origem,
    origemDetalhe: row.origem_detalhe,
    destinoTipo: row.destino_tipo,
    destinoTexto: row.destino_texto,
    orcamentoEstimado: row.orcamento_estimado,
    prazoIdeal: row.prazo_ideal,
    dataIda: row.data_ida,
    dataVolta: row.data_volta,
    passageirosAdultos: row.passageiros_adultos,
    passageirosCriancas: row.passageiros_criancas,
    passageirosBebes: row.passageiros_bebes,
    perfilViajante: row.perfil_viajante,
    experienciaAnterior: row.experiencia_anterior,
    restricoes: row.restricoes,

    proximoFollowUp: row.proximo_follow_up,
    notasInternas: row.notas_internas,

    tags: row.tags,

    // Default do contrato quando a coluna ainda nao veio no SELECT.
    emailMarketingStatus: row.email_marketing_status ?? "legitimo_interesse",
    emailMarketingStatusEm: row.email_marketing_status_em ?? null,
    emailMarketingStatusOrigem: row.email_marketing_status_origem ?? null,

    iddasPessoaId: row.iddas_pessoa_id,
    iddasCotacaoCode: row.iddas_cotacao_code,
    iddasOrcamentoId: row.iddas_orcamento_id,
    iddasVendaId: row.iddas_venda_id,
    iddasUltimoSync: row.iddas_ultimo_sync,
    iddasSyncStatus: row.iddas_sync_status,
    iddasSyncError: row.iddas_sync_error,

    clickmassaContactId: row.clickmassa_contact_id,
    clickmassaTicketIds: row.clickmassa_ticket_ids,
    clickmassaTagsId: row.clickmassa_tags_id,
    clickmassaOportunidadeId: row.clickmassa_oportunidade_id,
    clickmassaPipelineStep: row.clickmassa_pipeline_step,
    clickmassaUltimoSync: row.clickmassa_ultimo_sync,
    clickmassaSyncStatus: row.clickmassa_sync_status,
    clickmassaSyncError: row.clickmassa_sync_error,

    postsLidos: row.posts_lidos,
    ultimaInteracao: row.ultima_interacao,

    status: row.status,
    arquivadoEm: row.arquivado_em,
    motivoArquivamento: row.motivo_arquivamento,

    // Lê a coluna GENERATED quando presente; fallback local enquanto a migração
    // não existir (o build não pode depender dela — U1.2 / consequência técnica).
    temWhatsapp: row.tem_whatsapp ?? row.whatsapp !== null,
  };
}

// ─────────────────────────────────────────────────────────────────
// Contact: Contact → row de insert (escrita)
// ─────────────────────────────────────────────────────────────────

export function contactToInsertRow(
  contact: Omit<Contact, "id" | "createdAt" | "updatedAt">,
): ContactInsertRow {
  return {
    // Contato novo nasce sem edição humana de card (a captura não é edição).
    dados_editado_em: contact.dadosEditadoEm,
    qualificacao_editado_em: contact.qualificacaoEditadoEm,

    name: contact.name,
    whatsapp: contact.whatsapp,
    email: contact.email,
    cpf: contact.cpf,
    data_nascimento: contact.dataNascimento,
    nacionalidade: contact.nacionalidade,

    cep: contact.cep,
    cidade: contact.cidade,
    estado: contact.estado,
    pais: contact.pais,

    origem: contact.origem,
    origem_detalhe: contact.origemDetalhe,
    destino_tipo: contact.destinoTipo,
    destino_texto: contact.destinoTexto,
    orcamento_estimado: contact.orcamentoEstimado,
    prazo_ideal: contact.prazoIdeal,
    data_ida: contact.dataIda,
    data_volta: contact.dataVolta,
    passageiros_adultos: contact.passageirosAdultos,
    passageiros_criancas: contact.passageirosCriancas,
    passageiros_bebes: contact.passageirosBebes,
    perfil_viajante: contact.perfilViajante,
    experiencia_anterior: contact.experienciaAnterior,
    restricoes: contact.restricoes,

    proximo_follow_up: contact.proximoFollowUp,
    notas_internas: contact.notasInternas,

    tags: contact.tags,

    // As tres colunas de permissao de e-mail marketing NAO entram no insert:
    // contato novo nasce com o default do banco ('legitimo_interesse'), e quem
    // muda depois e o webhook ou o back-office (P3). Nenhum caminho de criacao
    // decide permissao.

    // iddas_pessoa_id: coluna-projeção (trigger a partir de contact_external_links) — não escrita aqui.
    iddas_cotacao_code: contact.iddasCotacaoCode,
    iddas_orcamento_id: contact.iddasOrcamentoId,
    iddas_venda_id: contact.iddasVendaId,
    iddas_ultimo_sync: contact.iddasUltimoSync,
    iddas_sync_status: contact.iddasSyncStatus,
    iddas_sync_error: contact.iddasSyncError,

    // clickmassa_contact_id: coluna-projeção (trigger a partir de contact_external_links) — não escrita aqui.
    clickmassa_ticket_ids: contact.clickmassaTicketIds,
    clickmassa_tags_id: contact.clickmassaTagsId,
    clickmassa_oportunidade_id: contact.clickmassaOportunidadeId,
    clickmassa_pipeline_step: contact.clickmassaPipelineStep,
    clickmassa_ultimo_sync: contact.clickmassaUltimoSync,
    clickmassa_sync_status: contact.clickmassaSyncStatus,
    clickmassa_sync_error: contact.clickmassaSyncError,

    posts_lidos: contact.postsLidos,
    ultima_interacao: contact.ultimaInteracao,
    // emails_abertos / campanhas_ativas: colunas MORTAS (D1). Nao entram no
    // insert; o default do banco (0 e '{}') cobre ate o DROP acontecer.

    status: contact.status,
    arquivado_em: contact.arquivadoEm,
    motivo_arquivamento: contact.motivoArquivamento,
  };
}

// ─────────────────────────────────────────────────────────────────
// Contact: patch parcial → row de update (escrita)
//
// Explícito por campo, sem conversão algorítmica de chaves. Só inclui no
// payload as colunas presentes no patch. `id`, `created_at` e `updated_at`
// nunca são mapeados aqui — o trigger cuida de `updated_at`.
// ─────────────────────────────────────────────────────────────────

export function contactPatchToRow(patch: Partial<Contact>): Partial<ContactInsertRow> {
  const row: Partial<ContactInsertRow> = {};

  // Carimbo de edição humana: só entra quando a action da ficha o inclui de
  // propósito. Nenhum outro caminho de escrita (sync incluso) passa esses campos.
  if ("dadosEditadoEm" in patch) row.dados_editado_em = patch.dadosEditadoEm;
  if ("qualificacaoEditadoEm" in patch) row.qualificacao_editado_em = patch.qualificacaoEditadoEm;

  if ("name" in patch) row.name = patch.name;
  if ("whatsapp" in patch) row.whatsapp = patch.whatsapp;
  if ("email" in patch) row.email = patch.email;
  if ("cpf" in patch) row.cpf = patch.cpf;
  if ("dataNascimento" in patch) row.data_nascimento = patch.dataNascimento;
  if ("nacionalidade" in patch) row.nacionalidade = patch.nacionalidade;

  if ("cep" in patch) row.cep = patch.cep;
  if ("cidade" in patch) row.cidade = patch.cidade;
  if ("estado" in patch) row.estado = patch.estado;
  if ("pais" in patch) row.pais = patch.pais;

  if ("origem" in patch) row.origem = patch.origem;
  if ("origemDetalhe" in patch) row.origem_detalhe = patch.origemDetalhe;
  if ("destinoTipo" in patch) row.destino_tipo = patch.destinoTipo;
  if ("destinoTexto" in patch) row.destino_texto = patch.destinoTexto;
  if ("orcamentoEstimado" in patch) row.orcamento_estimado = patch.orcamentoEstimado;
  if ("prazoIdeal" in patch) row.prazo_ideal = patch.prazoIdeal;
  if ("dataIda" in patch) row.data_ida = patch.dataIda;
  if ("dataVolta" in patch) row.data_volta = patch.dataVolta;
  if ("passageirosAdultos" in patch) row.passageiros_adultos = patch.passageirosAdultos;
  if ("passageirosCriancas" in patch) row.passageiros_criancas = patch.passageirosCriancas;
  if ("passageirosBebes" in patch) row.passageiros_bebes = patch.passageirosBebes;
  if ("perfilViajante" in patch) row.perfil_viajante = patch.perfilViajante;
  if ("experienciaAnterior" in patch) row.experiencia_anterior = patch.experienciaAnterior;
  if ("restricoes" in patch) row.restricoes = patch.restricoes;

  if ("proximoFollowUp" in patch) row.proximo_follow_up = patch.proximoFollowUp;
  if ("notasInternas" in patch) row.notas_internas = patch.notasInternas;

  // `tags` NAO entra no patch (contrato de tags v1, T3). A coluna e escrita
  // EXCLUSIVAMENTE por `lib/tags`, que valida slug contra o catalogo antes de
  // gravar; um patch generico passando por aqui gravava array cru, sem
  // validacao nenhuma. Nenhum caller usava (grep em 18/08/2026) — era porta
  // aberta, nao caminho vivo. Quem precisar escrever tag chama
  // `definirTagsDoContato` ou `tagEmMassa`.

  // Permissao de e-mail marketing: so o webhook e o pipeline passam por aqui,
  // e sempre com as tres juntas (sem status_em/origem nao existe prova, P4).
  if ("emailMarketingStatus" in patch) row.email_marketing_status = patch.emailMarketingStatus;
  if ("emailMarketingStatusEm" in patch)
    row.email_marketing_status_em = patch.emailMarketingStatusEm;
  if ("emailMarketingStatusOrigem" in patch)
    row.email_marketing_status_origem = patch.emailMarketingStatusOrigem;

  // iddasPessoaId: coluna-projeção (mantida por trigger) — não escrita aqui.
  if ("iddasCotacaoCode" in patch) row.iddas_cotacao_code = patch.iddasCotacaoCode;
  if ("iddasOrcamentoId" in patch) row.iddas_orcamento_id = patch.iddasOrcamentoId;
  if ("iddasVendaId" in patch) row.iddas_venda_id = patch.iddasVendaId;
  if ("iddasUltimoSync" in patch) row.iddas_ultimo_sync = patch.iddasUltimoSync;
  if ("iddasSyncStatus" in patch) row.iddas_sync_status = patch.iddasSyncStatus;
  if ("iddasSyncError" in patch) row.iddas_sync_error = patch.iddasSyncError;

  // clickmassaContactId: coluna-projeção (mantida por trigger) — não escrita aqui.
  if ("clickmassaTicketIds" in patch) row.clickmassa_ticket_ids = patch.clickmassaTicketIds;
  if ("clickmassaTagsId" in patch) row.clickmassa_tags_id = patch.clickmassaTagsId;
  if ("clickmassaOportunidadeId" in patch)
    row.clickmassa_oportunidade_id = patch.clickmassaOportunidadeId;
  if ("clickmassaPipelineStep" in patch)
    row.clickmassa_pipeline_step = patch.clickmassaPipelineStep;
  if ("clickmassaUltimoSync" in patch) row.clickmassa_ultimo_sync = patch.clickmassaUltimoSync;
  if ("clickmassaSyncStatus" in patch) row.clickmassa_sync_status = patch.clickmassaSyncStatus;
  if ("clickmassaSyncError" in patch) row.clickmassa_sync_error = patch.clickmassaSyncError;

  if ("postsLidos" in patch) row.posts_lidos = patch.postsLidos;
  if ("ultimaInteracao" in patch) row.ultima_interacao = patch.ultimaInteracao;
  // emails_abertos / campanhas_ativas: sem caller e sem patch (D1).

  if ("status" in patch) row.status = patch.status;
  if ("arquivadoEm" in patch) row.arquivado_em = patch.arquivadoEm;
  if ("motivoArquivamento" in patch) row.motivo_arquivamento = patch.motivoArquivamento;

  return row;
}

// ─────────────────────────────────────────────────────────────────
// ContactInteraction: row ↔ interação
//
// O `metadata` (jsonb) passa DIRETO, sem tocar nas chaves internas.
// ─────────────────────────────────────────────────────────────────

export function rowToInteraction(row: ContactInteractionRow): ContactInteraction {
  return {
    id: row.id,
    contactId: row.contact_id,
    tipo: row.tipo,
    descricao: row.descricao,
    metadata: row.metadata,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
  };
}

export function interactionToInsertRow(
  interaction: Omit<ContactInteraction, "id" | "criadoEm">,
): ContactInteractionInsertRow {
  return {
    contact_id: interaction.contactId,
    tipo: interaction.tipo,
    descricao: interaction.descricao,
    metadata: interaction.metadata,
    criado_por: interaction.criadoPor,
  };
}
