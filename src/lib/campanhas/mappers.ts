import type {
  Campanha,
  CampanhaDestinatario,
  CampanhaEstado,
  CampanhaEvento,
  CampanhaTipo,
  PublicoTipo,
} from "./types";

/**
 * Mapeamento explícito por campo entre banco (snake_case) e TS (camelCase),
 * no mesmo padrão de `lib/contacts/mappers.ts`: à mão, pro compilador cobrar
 * campo esquecido, e com o `raw_payload` jsonb passando DIRETO, sem tocar nas
 * chaves internas (é payload de terceiro, não nosso).
 */

export type CampanhaRow = {
  id: string;
  nome_interno: string;
  tipo: CampanhaTipo;
  assunto: string | null;
  titulo: string | null;
  intro: string | null;
  corpo: string | null;
  cta_texto: string | null;
  cta_link: string | null;
  nota_rodape: string | null;
  imagem_path: string | null;
  imagem_alt: string | null;
  estado: CampanhaEstado;
  conteudo_hash: string | null;
  publico_tipo: PublicoTipo;
  grupo_id: string | null;
  testado_em: string | null;
  testado_hash: string | null;
  testado_para: string | null;
  agendado_para: string | null;
  enviado_em: string | null;
  resend_broadcast_id: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** O banco gera id/created_at/updated_at. */
export type CampanhaInsertRow = Omit<CampanhaRow, "id" | "created_at" | "updated_at">;

export function rowToCampanha(row: CampanhaRow): Campanha {
  return {
    id: row.id,
    nomeInterno: row.nome_interno,
    tipo: row.tipo,
    assunto: row.assunto,
    titulo: row.titulo,
    intro: row.intro,
    corpo: row.corpo,
    ctaTexto: row.cta_texto,
    ctaLink: row.cta_link,
    notaRodape: row.nota_rodape,
    imagemPath: row.imagem_path,
    imagemAlt: row.imagem_alt,
    estado: row.estado,
    conteudoHash: row.conteudo_hash,
    publicoTipo: row.publico_tipo,
    grupoId: row.grupo_id,
    testadoEm: row.testado_em,
    testadoHash: row.testado_hash,
    testadoPara: row.testado_para,
    agendadoPara: row.agendado_para,
    enviadoEm: row.enviado_em,
    resendBroadcastId: row.resend_broadcast_id,
    criadoPor: row.criado_por,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Patch parcial → row. Só entra no payload o que veio no patch. `updated_at`
 * nunca é mapeado: o trigger do banco cuida.
 */
export function campanhaPatchToRow(patch: Partial<Campanha>): Partial<CampanhaInsertRow> {
  const row: Partial<CampanhaInsertRow> = {};

  if ("nomeInterno" in patch) row.nome_interno = patch.nomeInterno;
  if ("tipo" in patch) row.tipo = patch.tipo;

  if ("assunto" in patch) row.assunto = patch.assunto;
  if ("titulo" in patch) row.titulo = patch.titulo;
  if ("intro" in patch) row.intro = patch.intro;
  if ("corpo" in patch) row.corpo = patch.corpo;
  if ("ctaTexto" in patch) row.cta_texto = patch.ctaTexto;
  if ("ctaLink" in patch) row.cta_link = patch.ctaLink;
  if ("notaRodape" in patch) row.nota_rodape = patch.notaRodape;
  if ("imagemPath" in patch) row.imagem_path = patch.imagemPath;
  if ("imagemAlt" in patch) row.imagem_alt = patch.imagemAlt;

  if ("estado" in patch) row.estado = patch.estado;
  if ("conteudoHash" in patch) row.conteudo_hash = patch.conteudoHash;

  if ("publicoTipo" in patch) row.publico_tipo = patch.publicoTipo;
  if ("grupoId" in patch) row.grupo_id = patch.grupoId;

  if ("testadoEm" in patch) row.testado_em = patch.testadoEm;
  if ("testadoHash" in patch) row.testado_hash = patch.testadoHash;
  if ("testadoPara" in patch) row.testado_para = patch.testadoPara;

  if ("agendadoPara" in patch) row.agendado_para = patch.agendadoPara;
  if ("enviadoEm" in patch) row.enviado_em = patch.enviadoEm;
  if ("resendBroadcastId" in patch) row.resend_broadcast_id = patch.resendBroadcastId;

  if ("criadoPor" in patch) row.criado_por = patch.criadoPor;

  return row;
}

// ─────────────────────────────────────────────────────────────────

export type DestinatarioRow = {
  id: string;
  campanha_id: string;
  contact_id: string | null;
  email: string;
  nome: string;
  enviado_em: string;
};

export function rowToDestinatario(row: DestinatarioRow): CampanhaDestinatario {
  return {
    id: row.id,
    campanhaId: row.campanha_id,
    contactId: row.contact_id,
    email: row.email,
    nome: row.nome,
    enviadoEm: row.enviado_em,
  };
}

// ─────────────────────────────────────────────────────────────────

export type EventoRow = {
  id: string;
  campanha_id: string | null;
  contact_id: string | null;
  resend_email_id: string | null;
  tipo: string;
  ocorrido_em: string;
  recebido_em: string;
  raw_payload: Record<string, unknown>;
};

/** O banco gera id e recebido_em. */
export type EventoInsertRow = Omit<EventoRow, "id" | "recebido_em">;

export function rowToEvento(row: EventoRow): CampanhaEvento {
  return {
    id: row.id,
    campanhaId: row.campanha_id,
    contactId: row.contact_id,
    resendEmailId: row.resend_email_id,
    tipo: row.tipo,
    ocorridoEm: row.ocorrido_em,
    recebidoEm: row.recebido_em,
    // jsonb passa direto — chaves de terceiro não são convertidas.
    rawPayload: row.raw_payload,
  };
}
