/**
 * Normalizações e mappers por recurso do Iddas, lift verbatim de
 * scripts/backfill-iddas.ts. Funções puras — nenhum quirk de parsing alterado
 * (dd/MM/yyyy, 0000-00-00 → null, float artefato, IATA, parseBool S/N).
 */

import type { BronzeIngestionMeta } from "../types";

export type Mapper = (
  item: Record<string, unknown>,
  audit: BronzeIngestionMeta,
) => Record<string, unknown>;

// ─── Normalizações ────────────────────────────────────────────────────────────

export function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val);
  return s === "" ? null : s;
}

export function normalizeDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  return s;
}

// Converte dd/MM/yyyy → yyyy-MM-dd; outros formatos passam por normalizeDate
export function parseDateBR(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return normalizeDate(val);
}

export function parseMonetary(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val));
  if (isNaN(n)) return null;
  return Number(n.toFixed(2));
}

export function parseBool(val: unknown): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase().trim();
  if (s === "s" || s === "1" || s === "true" || s === "sim") return true;
  if (s === "n" || s === "0" || s === "false" || s === "nao" || s === "não") return false;
  return null;
}

// Extrai código IATA de "São Paulo (GRU)" → "GRU"
export function extractIATA(airport: unknown): string | null {
  if (!airport || typeof airport !== "string") return null;
  const m = airport.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : null;
}

// ─── Mappers por recurso ───────────────────────────────────────────────────────

export function mapCanal(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapSituacao(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    cor: str(item.cor),
    codigo: str(item.codigo),
    ordem: item.ordem != null ? Number(item.ordem) : null,
    situacao_final: parseBool(item.situacao_final),
    situacao_padrao: parseBool(item.situacao_padrao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapMotivoreprovacao(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    ativo: parseBool(item.ativo),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapEtiqueta(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    cor: str(item.cor),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapUsuario(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    situacao: str(item.situacao),
    email: str(item.email),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapConta(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    saldo_inicial: parseMonetary(item.saldo_inicial),
    agencia: str(item.agencia),
    numero_conta: str(item.numero_conta),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapCartao(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    descricao: str(item.descricao),
    digitos: str(item.digitos),
    fechamento: str(item.fechamento), // dia do mês, não data
    vencimento: str(item.vencimento), // dia do mês, não data
    limite: parseMonetary(item.limite),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapCategoriaReceitasDespesas(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    tipo: str(item.tipo),
    ativo: parseBool(item.ativo),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapAeroporto(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapCompanhia(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapPessoa(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    nome: str(item.nome),
    sexo: str(item.sexo),
    tipo_cliente: str(item.tipo_cliente),
    celular: str(item.celular),
    email: str(item.email),
    cpf_cnpj: str(item.cpf_cnpj),
    canal_venda: str(item.canal_venda),
    cidade: str(item.cidade),
    estado: str(item.estado),
    nascimento: normalizeDate(item.nascimento), // 0000-00-00 → NULL
    aceita_comunicacao: str(item.aceita_comunicacao),
    observacao: str(item.observacao),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapOrcamento(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    titulo: str(item.titulo),
    identificador: str(item.identificador),
    situacao: str(item.situacao),
    nome_situacao: str(item.nome_situacao),
    cliente: str(item.cliente),
    canal_venda: str(item.canal_venda),
    usuario: str(item.usuario),
    valor: parseMonetary(item.valor),
    passageiros_adulto: str(item.passageiros_adulto),
    passageiros_crianca: str(item.passageiros_crianca),
    passageiros_bebe: str(item.passageiros_bebe),
    informacoes: str(item.informacoes),
    detalhes_viagem: str(item.detalhes_viagem),
    outras_informacoes: str(item.outras_informacoes),
    data_orcamento: normalizeDate(item.data_orcamento),
    data_ultima_situacao: normalizeDate(item.data_ultima_situacao),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapVenda(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    cliente: str(item.cliente), // Quirk 5: nome do cliente, não ID
    id_orcamento: str(item.id_orcamento),
    data: parseDateBR(item.data), // Quirk 3: dd/MM/yyyy → ISO
    orcado: parseMonetary(item.orcado),
    custo: parseMonetary(item.custo),
    venda: parseMonetary(item.venda), // Quirk 4: float artefato
    lucro: parseMonetary(item.lucro),
    percentual_lucro: str(item.percentual_lucro),
    comissao_mais: parseMonetary(item.comissao_mais),
    comissao_menos: parseMonetary(item.comissao_menos),
    situacao: str(item.situacao),
    vencimento: normalizeDate(item.vencimento),
    status_pagamento: str(item.status_pagamento),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapReceita(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    pessoa: str(item.pessoa),
    conta: str(item.conta),
    categoria: str(item.categoria),
    descricao: str(item.descricao),
    lancamento: normalizeDate(item.lancamento),
    vencimento: normalizeDate(item.vencimento),
    pagamento: normalizeDate(item.pagamento),
    forma_lancamento: str(item.forma_lancamento),
    forma_pagamento: str(item.forma_pagamento),
    valor: parseMonetary(item.valor),
    observacao: str(item.observacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapDespesa(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    pessoa: str(item.pessoa),
    conta: str(item.conta),
    categoria: str(item.categoria),
    descricao: str(item.descricao),
    lancamento: normalizeDate(item.lancamento),
    vencimento: normalizeDate(item.vencimento),
    pagamento: normalizeDate(item.pagamento),
    forma_lancamento: str(item.forma_lancamento),
    forma_pagamento: str(item.forma_pagamento),
    valor: parseMonetary(item.valor),
    parcela: str(item.parcela),
    observacao: str(item.observacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapTarefa(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    assunto: str(item.assunto),
    descricao: str(item.descricao),
    data: normalizeDate(item.data),
    hora: str(item.hora),
    situacao: str(item.situacao),
    tipo: str(item.tipo),
    id_orcamento: str(item.id_orcamento),
    id_responsavel: str(item.id_responsavel),
    id_usuario_origem: str(item.id_usuario_origem),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapVoo(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  const ao = str(item.aeroporto_origem);
  const ad = str(item.aeroporto_destino);
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    tipo_trecho: str(item.tipo_trecho),
    voo: str(item.voo),
    companhia: str(item.companhia),
    id_companhia: str(item.id_companhia),
    classe: str(item.classe),
    aeroporto_origem: ao,
    aeroporto_origem_iata: extractIATA(ao), // "São Paulo (GRU)" → "GRU"
    aeroporto_destino: ad,
    aeroporto_destino_iata: extractIATA(ad),
    data_embarque: normalizeDate(item.data_embarque),
    hora_embarque: str(item.hora_embarque),
    data_chegada: normalizeDate(item.data_chegada),
    hora_chegada: str(item.hora_chegada),
    duracao: str(item.duracao),
    localizador: str(item.localizador),
    numero_compra: str(item.numero_compra),
    checkin: str(item.checkin),
    observacao: str(item.observacao),
    assento: str(item.assento),
    portao: str(item.portao),
    terminal: str(item.terminal),
    qtd_paradas: str(item.qtd_paradas),
    bagagem_bolsa: str(item.bagagem_bolsa),
    bagagem_demao: str(item.bagagem_demao),
    bagagem_despachada: str(item.bagagem_despachada),
    source_created_at: normalizeDate(item.created_at),
    source_updated_at: normalizeDate(item.updated_at),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapCruzeiro(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    embarque: str(item.embarque),
    desembarque: str(item.desembarque),
    tipo_cabine: str(item.tipo_cabine),
    data_entrada: normalizeDate(item.data_entrada),
    data_saida: normalizeDate(item.data_saida),
    localizador: str(item.localizador),
    cliente: str(item.cliente),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapHospedagem(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    data_entrada: normalizeDate(item.data_entrada),
    data_saida: normalizeDate(item.data_saida),
    localizador: str(item.localizador),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapSeguro(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    identificador_orcamento: str(item.identificador_orcamento),
    nome: str(item.nome),
    inicio_vigencia: normalizeDate(item.inicio_vigencia),
    fim_vigencia: normalizeDate(item.fim_vigencia),
    localizador: str(item.localizador),
    cliente: str(item.cliente),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapTransporte(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  // Só id e id_orcamento como colunas planas; resto vai no raw_payload
  return {
    id: str(item.id),
    id_orcamento: str(item.id_orcamento),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

export function mapSolicitacao(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    id: str(item.id),
    identificador: str(item.identificador),
    nome: str(item.nome),
    email: str(item.email),
    telefone: str(item.telefone),
    origem: str(item.origem),
    destino: str(item.destino),
    data_ida: normalizeDate(item.data_ida),
    data_volta: normalizeDate(item.data_volta),
    adultos: str(item.adultos),
    criancas: str(item.criancas),
    bagagem_despachada: str(item.bagagem_despachada),
    possui_flexibilidade: str(item.possui_flexibilidade),
    observacao: str(item.observacao),
    data_solicitacao: normalizeDate(item.data_solicitacao),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}

// Snapshot: cada run cria N linhas novas; snapshot_id é BIGSERIAL gerado pelo banco
export function mapInfosolicitacao(item: Record<string, unknown>, audit: BronzeIngestionMeta): Record<string, unknown> {
  return {
    snapshot_at: audit.ingested_at,
    nome: str(item.nome),
    campo: str(item.campo),
    tipo: str(item.tipo),
    opcoes: item.opcoes ?? null,
    obrigatorio: parseBool(item.obrigatorio),
    raw_payload: item,
    ingested_at: audit.ingested_at,
    ingestion_run_id: audit.ingestion_run_id,
    ingestion_source: audit.ingestion_source,
  };
}
