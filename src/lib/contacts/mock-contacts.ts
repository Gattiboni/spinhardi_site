import type { Contact } from "./types";

/**
 * 8 contatos mockados com diversidade total — cobrem todos os estados de UI
 * (estágios, origens, sync parcial/falho/pendente, qualificação rica vs. crua).
 *
 * MOCK na Fase 1 (Lote B). Vira SELECT no Supabase no Lote C; a interface
 * `Contact` é tradução direta do schema SQL futuro.
 *
 * Datas ancoradas em torno de junho/2026 pra produzir números plausíveis no
 * dashboard (novos hoje, follow-ups, capturas do mês).
 */
export const MOCK_CONTACTS: Contact[] = [
  // 1. Maria Silva — qualificada, lua de mel Itália, tudo sincronizado
  {
    id: "c1a2b3c4-0001-4a1b-8c2d-000000000001",
    createdAt: "2026-06-08T09:23:00-03:00",
    updatedAt: "2026-06-08T11:05:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Maria Silva",
    whatsapp: "+5511998765432",
    email: "maria.silva@gmail.com",
    cpf: null,
    dataNascimento: null,
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "01310-100",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",

    origem: "site_contato",
    origemDetalhe: null,
    destinoTipo: "italia",
    destinoTexto: "Roma e Toscana, com foco em hospedagem boutique e gastronomia.",
    orcamentoEstimado: "15k_30k",
    prazoIdeal: "3_6_meses",
    dataIda: null,
    dataVolta: null,
    passageirosAdultos: 2,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "lua_de_mel",
    experienciaAnterior: "Já visitou Portugal e Espanha em 2023.",
    restricoes: null,

    proximoFollowUp: "2026-06-08",
    notasInternas:
      "Cliente bem qualificada. Quer Roma + Toscana, 14 dias. Próxima conversa: terça pra falar de hospedagem boutique.",

    tags: ["italia_2026", "lua_de_mel"],

    iddasPessoaId: "1234",
    iddasCotacaoCode: "v5bnh",
    iddasOrcamentoId: "9876",
    iddasVendaId: null,
    iddasUltimoSync: "2026-06-08T09:24:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5678",
    clickmassaTicketIds: ["193937"],
    clickmassaTagsId: [12, 45],
    clickmassaOportunidadeId: "op-2201",
    clickmassaPipelineStep: "Qualificado",
    clickmassaUltimoSync: "2026-06-08T09:24:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: ["europa-primeira-vez"],
    ultimaInteracao: "2026-06-08T11:05:00-03:00",
    emailsAbertos: 2,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 2. João Pereira — família, Europa, em negociação
  {
    id: "c1a2b3c4-0002-4a1b-8c2d-000000000002",
    createdAt: "2026-06-05T14:10:00-03:00",
    updatedAt: "2026-06-07T16:42:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "João Pereira",
    whatsapp: "+5511991234567",
    email: "joao.pereira@outlook.com",
    cpf: "123.456.789-00",
    dataNascimento: "1982-03-15",
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "04543-011",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",

    origem: "google_ads",
    origemDetalhe: "Campanha Europa Verão 2026",
    destinoTipo: "europa_geral",
    destinoTexto: "França e Suíça, roteiro pensado pra crianças (Disneyland Paris incluído).",
    orcamentoEstimado: "30k_50k",
    prazoIdeal: "6_12_meses",
    dataIda: "2027-01-10",
    dataVolta: "2027-01-25",
    passageirosAdultos: 2,
    passageirosCriancas: 2,
    passageirosBebes: 0,
    perfilViajante: "familia",
    experienciaAnterior: "Primeira viagem internacional com as crianças.",
    restricoes: "Filho mais novo tem alergia a frutos do mar.",

    proximoFollowUp: "2026-06-08",
    notasInternas:
      "Família de 4. Sensível a preço de alta temporada — apresentar opção em janeiro. Aguardando aprovação da esposa sobre roteiro.",

    tags: ["familia", "alta_temporada"],

    iddasPessoaId: "1310",
    iddasCotacaoCode: "k9wzt",
    iddasOrcamentoId: "10044",
    iddasVendaId: null,
    iddasUltimoSync: "2026-06-05T14:12:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5712",
    clickmassaTicketIds: ["194012"],
    clickmassaTagsId: [12, 33],
    clickmassaOportunidadeId: "op-2230",
    clickmassaPipelineStep: "Em negociação",
    clickmassaUltimoSync: "2026-06-05T14:12:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: ["europa-primeira-vez", "10-coisas-antes-de-montar-roteiro"],
    ultimaInteracao: "2026-06-07T16:42:00-03:00",
    emailsAbertos: 4,
    campanhasAtivas: ["europa_verao_2026"],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 3. Ana Carolina Mendes — cruzeiro, proposta enviada, indicação
  {
    id: "c1a2b3c4-0003-4a1b-8c2d-000000000003",
    createdAt: "2026-06-02T10:05:00-03:00",
    updatedAt: "2026-06-06T09:30:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Ana Carolina Mendes",
    whatsapp: "+5521997654321",
    email: "ana.mendes@gmail.com",
    cpf: null,
    dataNascimento: "1990-07-22",
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "22041-001",
    cidade: "Rio de Janeiro",
    estado: "RJ",
    pais: "Brasil",

    origem: "site_contato",
    origemDetalhe: null,
    destinoTipo: "cruzeiro",
    destinoTexto: "Cruzeiro pelo Mediterrâneo, saindo de Barcelona, 7 noites.",
    orcamentoEstimado: "15k_30k",
    prazoIdeal: "6_12_meses",
    dataIda: null,
    dataVolta: null,
    passageirosAdultos: 2,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "grupo_amigos",
    experienciaAnterior: "Já fez cruzeiro pela costa brasileira.",
    restricoes: null,

    proximoFollowUp: "2026-06-11",
    notasInternas:
      "Indicada pela Patrícia Souza. Proposta MSC Mediterrâneo enviada dia 06. Aguardando retorno sobre cabine com varanda.",

    tags: ["cruzeiro", "indicacao_patricia"],

    iddasPessoaId: "1356",
    iddasCotacaoCode: "p2mxr",
    iddasOrcamentoId: "10090",
    iddasVendaId: null,
    iddasUltimoSync: "2026-06-02T10:07:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5740",
    clickmassaTicketIds: ["194090"],
    clickmassaTagsId: [22],
    clickmassaOportunidadeId: "op-2255",
    clickmassaPipelineStep: "Proposta enviada",
    clickmassaUltimoSync: "2026-06-02T10:07:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: [],
    ultimaInteracao: "2026-06-06T09:30:00-03:00",
    emailsAbertos: 3,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 4. Carlos Lima — contato CRU, indicação, sync pendente
  {
    id: "c1a2b3c4-0004-4a1b-8c2d-000000000004",
    createdAt: "2026-06-08T16:40:00-03:00",
    updatedAt: "2026-06-08T16:40:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Carlos Lima",
    whatsapp: "+5519998887766",
    email: null,
    cpf: null,
    dataNascimento: null,
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: null,
    cidade: null,
    estado: null,
    pais: "Brasil",

    origem: "indicacao",
    origemDetalhe: "Indicação de Maria Silva",
    destinoTipo: "indefinido",
    destinoTexto: null,
    orcamentoEstimado: "nao_informado",
    prazoIdeal: "flexivel",
    dataIda: null,
    dataVolta: null,
    passageirosAdultos: 1,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "outro",
    experienciaAnterior: null,
    restricoes: null,

    proximoFollowUp: null,
    notasInternas: "Pediu pra ligar. Ainda não sabemos destino nem orçamento. Qualificar.",

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
    ultimaInteracao: "2026-06-08T16:40:00-03:00",
    emailsAbertos: 0,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 5. Patrícia Souza — Patagônia, aguardando pagamento, ClickMassa FALHOU
  {
    id: "c1a2b3c4-0005-4a1b-8c2d-000000000005",
    createdAt: "2026-05-20T11:15:00-03:00",
    updatedAt: "2026-06-07T18:00:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Patrícia Souza",
    whatsapp: "+5511987651234",
    email: "patricia.souza@gmail.com",
    cpf: "987.654.321-00",
    dataNascimento: "1985-11-30",
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "01419-001",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",

    origem: "google_ads",
    origemDetalhe: "Campanha Patagônia Inverno",
    destinoTipo: "america_sul",
    destinoTexto: "Patagônia argentina e chilena, El Calafate + Torres del Paine.",
    orcamentoEstimado: "30k_50k",
    prazoIdeal: "1_3_meses",
    dataIda: "2026-09-05",
    dataVolta: "2026-09-18",
    passageirosAdultos: 2,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "viajante_frequente",
    experienciaAnterior: "Casal aventureiro, já fez trekking no Peru e Bolívia.",
    restricoes: null,

    proximoFollowUp: "2026-06-07",
    notasInternas:
      "Venda fechada, aguardando 1ª parcela. ATENÇÃO: sync com ClickMassa falhou (token expirado) — confirmar atendimento manualmente até religar a integração.",

    tags: ["patagonia", "casal"],

    iddasPessoaId: "1180",
    iddasCotacaoCode: "t8qpl",
    iddasOrcamentoId: "9901",
    iddasVendaId: "venda-4471",
    iddasUltimoSync: "2026-06-04T15:21:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5601",
    clickmassaTicketIds: ["193800"],
    clickmassaTagsId: [18],
    clickmassaOportunidadeId: "op-2180",
    clickmassaPipelineStep: "Negociação",
    clickmassaUltimoSync: "2026-05-28T09:00:00-03:00",
    clickmassaSyncStatus: "failed",
    clickmassaSyncError: "Token expirado",

    postsLidos: ["10-coisas-antes-de-montar-roteiro"],
    ultimaInteracao: "2026-06-07T18:00:00-03:00",
    emailsAbertos: 6,
    campanhasAtivas: ["patagonia_inverno"],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 6. Fernando Castro — Japão+Coreia, FECHADO, viajante frequente, rastreio de blog
  {
    id: "c1a2b3c4-0006-4a1b-8c2d-000000000006",
    createdAt: "2026-05-10T08:50:00-03:00",
    updatedAt: "2026-06-03T17:10:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Fernando Castro",
    whatsapp: "+5511976543210",
    email: "fernando.castro@empresa.com.br",
    cpf: "456.789.123-00",
    dataNascimento: "1978-09-08",
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "05426-200",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",

    origem: "site_contato",
    origemDetalhe: null,
    destinoTipo: "outro",
    destinoTexto:
      "Japão e Coreia do Sul, 21 dias. Tóquio, Kyoto, Seul. Interesse em culinária e tecnologia.",
    orcamentoEstimado: "acima_50k",
    prazoIdeal: "data_fixa",
    dataIda: "2026-10-12",
    dataVolta: "2026-11-02",
    passageirosAdultos: 2,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "viajante_frequente",
    experienciaAnterior:
      "Mais de 20 países visitados. Conhece bem Europa e EUA, primeira vez na Ásia.",
    restricoes: "Esposa vegetariana.",

    proximoFollowUp: null,
    notasInternas:
      "Cliente premium, fechou rápido. Roteiro Japão+Coreia confirmado e pago. Enviar guia de pré-viagem 30 dias antes. Potencial cliente recorrente.",

    tags: ["japao", "asia", "viajante_frequente", "vip"],

    iddasPessoaId: "1042",
    iddasCotacaoCode: "j3hnd",
    iddasOrcamentoId: "9755",
    iddasVendaId: "venda-4390",
    iddasUltimoSync: "2026-06-03T17:11:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5503",
    clickmassaTicketIds: ["193500", "193980"],
    clickmassaTagsId: [9, 14, 51],
    clickmassaOportunidadeId: "op-2099",
    clickmassaPipelineStep: "Ganho",
    clickmassaUltimoSync: "2026-06-03T17:11:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: ["10-coisas-antes-de-montar-roteiro", "europa-primeira-vez"],
    ultimaInteracao: "2026-06-03T17:10:00-03:00",
    emailsAbertos: 9,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 7. Luciana Almeida — Toscana com amigas, em espera, alto ticket
  {
    id: "c1a2b3c4-0007-4a1b-8c2d-000000000007",
    createdAt: "2026-04-28T13:25:00-03:00",
    updatedAt: "2026-05-30T10:00:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Luciana Almeida",
    whatsapp: "+5511965432109",
    email: "luciana.almeida@gmail.com",
    cpf: null,
    dataNascimento: "1970-02-14",
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: "01451-000",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",

    origem: "site_contato",
    origemDetalhe: null,
    destinoTipo: "italia",
    destinoTexto:
      "Toscana com três amigas, foco em vinícolas e relaxamento. Possível extensão pra Costa Amalfitana.",
    orcamentoEstimado: "acima_50k",
    prazoIdeal: "acima_12_meses",
    dataIda: null,
    dataVolta: null,
    passageirosAdultos: 4,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "grupo_amigos",
    experienciaAnterior: "Grupo viaja junto há anos, já foram à França e Portugal.",
    restricoes: "Uma das amigas tem mobilidade reduzida — evitar roteiros com muita caminhada.",

    proximoFollowUp: "2026-08-01",
    notasInternas:
      "Grupo de 4 amigas, alto ticket. Em espera: decidiram adiar pra 2027 por agenda. Retomar contato em agosto. Lead muito quente, não perder.",

    tags: ["toscana", "amigas", "50_plus"],

    iddasPessoaId: "0998",
    iddasCotacaoCode: "w7krs",
    iddasOrcamentoId: "9620",
    iddasVendaId: null,
    iddasUltimoSync: "2026-04-28T13:27:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5470",
    clickmassaTicketIds: ["193210"],
    clickmassaTagsId: [12, 60],
    clickmassaOportunidadeId: "op-2010",
    clickmassaPipelineStep: "Em espera",
    clickmassaUltimoSync: "2026-04-28T13:27:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: ["europa-primeira-vez"],
    ultimaInteracao: "2026-05-30T10:00:00-03:00",
    emailsAbertos: 5,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: null,
  },

  // 8. Roberto Nunes — cadastro manual, perdido, motivo registrado
  {
    id: "c1a2b3c4-0008-4a1b-8c2d-000000000008",
    createdAt: "2026-04-15T17:00:00-03:00",
    updatedAt: "2026-05-12T14:30:00-03:00",
    dadosEditadoEm: null,
    qualificacaoEditadoEm: null,

    name: "Roberto Nunes",
    whatsapp: "+5511954321098",
    email: "roberto.nunes@gmail.com",
    cpf: null,
    dataNascimento: null,
    nacionalidade: "Brasileira",
    temWhatsapp: true,

    cep: null,
    cidade: "Campinas",
    estado: "SP",
    pais: "Brasil",

    origem: "manual",
    origemDetalhe: null,
    destinoTipo: "europa_geral",
    destinoTexto: "Tinha interesse em Espanha e Portugal, 10 dias.",
    orcamentoEstimado: "ate_5k",
    prazoIdeal: "3_6_meses",
    dataIda: null,
    dataVolta: null,
    passageirosAdultos: 2,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "primeira_viagem_internacional",
    experienciaAnterior: null,
    restricoes: null,

    proximoFollowUp: null,
    notasInternas:
      "Cadastrado manualmente após ligar na agência. Orçamento muito abaixo do necessário pra Europa no período desejado. Desistiu.",

    tags: ["desistencia", "sem_orcamento"],

    iddasPessoaId: "0950",
    iddasCotacaoCode: "r1tvb",
    iddasOrcamentoId: null,
    iddasVendaId: null,
    iddasUltimoSync: "2026-04-15T17:02:00-03:00",
    iddasSyncStatus: "synced",
    iddasSyncError: null,

    clickmassaContactId: "5410",
    clickmassaTicketIds: ["192980"],
    clickmassaTagsId: [7],
    clickmassaOportunidadeId: "op-1955",
    clickmassaPipelineStep: "Perdido",
    clickmassaUltimoSync: "2026-04-15T17:02:00-03:00",
    clickmassaSyncStatus: "synced",
    clickmassaSyncError: null,

    postsLidos: [],
    ultimaInteracao: "2026-05-12T14:30:00-03:00",
    emailsAbertos: 1,
    campanhasAtivas: [],

    status: "ativo",
    arquivadoEm: null,
    motivoArquivamento: "Cliente desistiu por orçamento",
  },
];
