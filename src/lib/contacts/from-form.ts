import type {
  Contact,
  CaptureOrigin,
  DestinoTipo,
  OrcamentoEstimado,
  PrazoIdeal,
  PerfilViajante,
} from "./types";
import { DESTINO_LABELS } from "./types";
import { normalizeBrPhone } from "./phone";

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
 * `iddas*`/`clickmassa*` nascem em `pending` (estado transitório). A sync outbound
 * do ClickMassa (boas-vindas no WhatsApp) é disparada pela server action depois do
 * insert — ver `submitContact` —, que grava o desfecho terminal (`synced`/`failed`)
 * por cima do `pending`. A sync do Iddas ainda não é feita na captura.
 *
 * O tipo de retorno `Omit<Contact, ...>` faz o compilador cobrar todos os campos.
 */
export function draftContactFromForm(
  input: ContactFormInput,
  opts: { origem: CaptureOrigin; hadInteraction: boolean },
): Omit<Contact, "id" | "createdAt" | "updatedAt"> {
  const now = new Date().toISOString();
  const observacao = input.observacao?.trim() ?? "";

  // Persiste SEMPRE o WhatsApp no formato canônico (só dígitos, com DDD, sem 55 —
  // ver phone.ts). O que entra no banco daqui pra frente é canônico; o dedup
  // passa a comparar canônico vs canônico. Se por acaso não normalizar (caminho
  // do cadastro manual, que não passa por validação), degrada pro trim cru —
  // nunca perde o dado.
  //
  // Campo vazio → null (U1): o cadastro manual do admin aceita contato sem
  // telefone. Gravar "" marcaria `tem_whatsapp` como falso-positivo (só dígitos
  // é que contam), então vazio vira null explícito. O form público exige o campo
  // (validação separada), nunca chega aqui vazio.
  const rawWhatsapp = input.whatsapp?.trim() ?? "";
  const phone = rawWhatsapp ? normalizeBrPhone(rawWhatsapp) : null;

  return {
    // Contato nascendo da captura/cadastro: nenhuma edição humana de card ainda.
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: input.name.trim(),
    whatsapp: rawWhatsapp === "" ? null : phone?.ok ? phone.canonical : rawWhatsapp,
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

    // Estágio saiu do contato (vive em `jornadas`). Montar o Contact aqui NÃO cria
    // jornada — quem liga a captura ao funil é a server action `submitContact`,
    // que cria uma jornada `origem_dado: "site"` logo após persistir o contato.
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

    // Espelha o whatsapp que acabou de ser resolvido (null quando o campo veio
    // vazio no cadastro manual). Valor in-memory; ao persistir, o read-back lê a
    // coluna GENERATED do banco como fonte real.
    temWhatsapp: rawWhatsapp !== "",
  };
}

// Cap de tamanho do título da jornada — o banco é nullable, a borda é enxuta.
const TITULO_JORNADA_MAX = 80;

/**
 * Título automático da jornada criada pela captura do site: `Site: {destino}`.
 *
 * Destino = `destinoTexto` livre se preenchido; senão o rótulo humano do
 * `destinoTipo` (exceto "indefinido", que não diz nada); senão o fallback
 * "destino a definir". Trim + cap de 80 chars.
 */
export function buildJornadaTituloFromForm(
  input: Pick<ContactFormInput, "destinoTexto" | "destinoTipo">,
): string {
  const texto = input.destinoTexto?.trim();
  let destino: string;
  if (texto) {
    destino = texto;
  } else if (input.destinoTipo && input.destinoTipo !== "indefinido") {
    destino = DESTINO_LABELS[input.destinoTipo];
  } else {
    destino = "destino a definir";
  }

  const titulo = `Site: ${destino}`.trim();
  return titulo.length > TITULO_JORNADA_MAX
    ? titulo.slice(0, TITULO_JORNADA_MAX).trimEnd()
    : titulo;
}

/**
 * Payload COMPLETO do form gravado no `metadata` da interaction `form_submission`
 * — shape ESTÁVEL, espelhando os mesmos campos que o cadastro de contato novo usa.
 *
 * Serve pros dois caminhos da captura (contato novo E reincidente): no dedup, o
 * contato existente reusa o registro antigo, então sem isto o que a pessoa digitou
 * (nome, destino, prazo, passageiros, perfil, orçamento, observação) se perderia.
 * A ficha do contato renderiza esse payload de forma legível — ver
 * `ContactDetailClient` (`FormSubmissionDetails`). Nada de JSON cru na tela.
 */
export type FormSubmissionPayload = {
  nome: string;
  whatsapp: string;
  email: string | null;
  destinoTipo: DestinoTipo;
  destinoTexto: string | null;
  prazoIdeal: PrazoIdeal;
  dataIda: string | null;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;
  perfilViajante: PerfilViajante;
  orcamentoEstimado: OrcamentoEstimado;
  observacao: string | null;
};

export function buildFormSubmissionPayload(input: ContactFormInput): FormSubmissionPayload {
  return {
    nome: input.name.trim(),
    whatsapp: input.whatsapp.trim(),
    email: blankToNull(input.email),
    destinoTipo: input.destinoTipo,
    destinoTexto: blankToNull(input.destinoTexto),
    prazoIdeal: input.prazoIdeal,
    dataIda: blankToNull(input.dataIda),
    passageirosAdultos: input.passageirosAdultos,
    passageirosCriancas: input.passageirosCriancas,
    passageirosBebes: input.passageirosBebes,
    perfilViajante: input.perfilViajante,
    orcamentoEstimado: input.orcamentoEstimado,
    observacao: blankToNull(input.observacao),
  };
}

// Tira o DDI 55 só quando o resto vira 10–11 dígitos (mesma regra do phone.ts),
// pra comparar dígitos de nome vs whatsapp sem tropeçar no 55 (o canônico não tem).
function stripLead55(digits: string): string {
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}

/**
 * Nome placeholder = candidato a ser sobrescrito pelo nome real do form (item 0c).
 *
 * Critério ESTRITO:
 *  - nome vazio/whitespace; OU
 *  - nome SEM nenhuma letra cujos dígitos batem com os do whatsapp do contato
 *    (cobre importados tipo "5511983340447"). A comparação tolera o DDI 55 em
 *    qualquer lado.
 *
 * Qualquer nome que contenha ao menos uma letra é nome real e NUNCA é placeholder
 * (jamais sobrescrito).
 */
export function isPlaceholderName(currentName: string, whatsapp: string | null): boolean {
  const n = (currentName ?? "").trim();
  if (n === "") return true;
  if (/\p{L}/u.test(n)) return false; // tem letra → nome real
  const nameDigits = stripLead55(n.replace(/\D/g, ""));
  const waDigits = stripLead55((whatsapp ?? "").replace(/\D/g, ""));
  return nameDigits !== "" && waDigits !== "" && nameDigits === waDigits;
}
