import type {
  Contact,
  CaptureOrigin,
  DestinoTipo,
  OrcamentoEstimado,
  PrazoIdeal,
  PerfilViajante,
} from "./types";

/**
 * Campos que tanto o form do site quanto o cadastro manual coletam.
 * Mesmo shape nos dois — a diferença é só a `origem` (site_contato vs manual).
 */
export type ContactFormInput = {
  name: string;
  whatsapp: string;
  email?: string;
  destinoTipo: DestinoTipo;
  destinoTexto?: string;
  prazoIdeal: PrazoIdeal;
  dataIda?: string;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;
  perfilViajante: PerfilViajante;
  orcamentoEstimado: OrcamentoEstimado;
  observacao?: string;
};

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Monta o `Contact` (sem id/created_at/updated_at — o banco gera) a partir dos
 * campos do formulário, aplicando os defaults dos campos não preenchidos.
 *
 * `iddas*`/`clickmassa*` ficam em `pending`: a sync real é Fase 4. Aqui o
 * contato nasce no nosso banco, nada é enviado pra fora.
 *
 * O tipo de retorno `Omit<Contact, ...>` faz o compilador cobrar todos os campos.
 */
export function draftContactFromForm(
  input: ContactFormInput,
  opts: { origem: CaptureOrigin; hadInteraction: boolean },
): Omit<Contact, "id" | "createdAt" | "updatedAt"> {
  const now = new Date().toISOString();
  const observacao = input.observacao?.trim() ?? "";

  return {
    name: input.name.trim(),
    whatsapp: input.whatsapp.trim(),
    email: blankToNull(input.email),
    cpf: null,
    dataNascimento: null,
    nacionalidade: "Brasileira",

    cep: null,
    cidade: null,
    estado: null,
    pais: "Brasil",

    origem: opts.origem,
    origemDetalhe: null,
    destinoTipo: input.destinoTipo,
    destinoTexto: blankToNull(input.destinoTexto),
    orcamentoEstimado: input.orcamentoEstimado,
    prazoIdeal: input.prazoIdeal,
    dataIda: blankToNull(input.dataIda),
    dataVolta: null,
    passageirosAdultos: input.passageirosAdultos,
    passageirosCriancas: input.passageirosCriancas,
    passageirosBebes: input.passageirosBebes,
    perfilViajante: input.perfilViajante,
    experienciaAnterior: null,
    restricoes: null,

    // Estágio saiu do contato (vive em `jornadas`). A criação de contato NÃO cria
    // jornada automática — a jornada nasce por outro caminho ("novo atendimento"
    // na ficha, ou o sync quando passar a gerar pendentes).
    proximoFollowUp: null,
    notasInternas: observacao,

    tags: [],

    iddasPessoaId: null,
    iddasCotacaoCode: null,
    iddasOrcamentoId: null,
    iddasVendaId: null,
    iddasUltimoSync: null,
    iddasSyncStatus: "pending",
    iddasSyncError: null,

    clickmassaContactId: null,
    clickmassaTicketIds: [],
    clickmassaTagsId: [],
    clickmassaOportunidadeId: null,
    clickmassaPipelineStep: null,
    clickmassaUltimoSync: null,
    clickmassaSyncStatus: "pending",
    clickmassaSyncError: null,

    postsLidos: [],
    ultimaInteracao: opts.hadInteraction ? now : null,
    emailsAbertos: 0,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  };
}
