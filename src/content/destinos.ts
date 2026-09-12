/**
 * Destinos — fonte ÚNICA dos 4 destinos do site (copy aprovada da Amanda, 12/09).
 *
 * Consumido pela seção da home, pelo índice `/destinos` e pela rota dinâmica
 * `/destinos/[slug]`. Trocar por Sanity no futuro é trocar a origem deste array;
 * nenhuma página muda. Ordem do array = ordem de exibição em todo lugar.
 *
 * Contrato de conteúdo (não é estilo): sem preço, sem "a partir de", sem
 * contagem, sem urgência, um único CTA de WhatsApp por página.
 *
 * `imagem`: nome do arquivo em `public/images/` (COM extensão, pra não adivinhar
 * formato), ou `null`. Regra do lote: só preenche se o arquivo existir, e ou os
 * quatro têm ou nenhum tem — não se mistura card com foto e card sem foto. Em
 * 12/09 `public/images/` não existe no repo, então os quatro estão `null`.
 *
 * `depoimento`: `null` = a página não renderiza o bloco (nada de placeholder).
 */

export type DestinoDepoimento = {
  quote: string;
  author: string;
  /** Contexto opcional, ex.: "Cliente Itália · Mar/2026". */
  context?: string;
};

export type Destino = {
  /** Segmento da URL: `/destinos/<slug>`. */
  slug: string;
  /** Nome do país: breadcrumb e `<title>`. */
  nome: string;
  cardTitulo: string;
  cardApoio: string;
  /** H1 da página interna (igual ao `cardTitulo`). */
  h1: string;
  /** Parágrafos de abertura, na ordem. */
  intro: string[];
  listaTitulo: string;
  /** Sempre 6 itens neste lote. */
  lista: string[];
  depoimento: DestinoDepoimento | null;
  ctaLabel: string;
  whatsappMensagem: string;
  imagem: string | null;
};

/** Cabeçalho da seção de destinos (home e índice). */
export const DESTINOS_SECAO_TITULO = "Para onde a gente mais leva gente";
export const DESTINOS_SECAO_APOIO =
  "Quatro destinos que a Spinhardi conhece de perto. Escolha um e conte o que você tem em mente.";

export const DESTINOS: Destino[] = [
  {
    slug: "italia",
    nome: "Itália",
    cardTitulo: "Onde tudo começou",
    cardApoio: "Desde 1987, em quase quarenta anos de viagens à Itália.",
    h1: "Onde tudo começou",
    intro: [
      "Em 1987, uma viagem à Itália com 40 pessoas deu início a tudo isso. A Spinhardi nasceu de um grupo indo para a Itália, e de lá para cá foram quase quarenta anos voltando ao mesmo país por motivos diferentes: a família que queria conhecer a cidade dos bisavós, o casal que queria comer bem e andar devagar, o cliente que queria ficar três semanas e não ter que pensar em nada.",
      "É por isso que a Itália não é só mais um destino na nossa lista. É o destino sobre o qual a gente tem mais conhecimento. Sabemos qual região combina com quem viaja pela primeira vez e qual pede mais tempo. Sabemos onde vale ficar duas noites e onde vale ficar cinco. E sabemos, principalmente, como equilibrar o roteiro para que a viagem tenha o ritmo que você quer.",
    ],
    listaTitulo: "O que entra em um roteiro nosso na Itália",
    lista: [
      "Definição de regiões e ritmo antes de qualquer reserva, para você aproveitar cada lugar sem correria",
      "Hospedagem escolhida uma a uma, por localização e por perfil, não por classificação de site",
      "Experiências à mesa: vinícolas, produtores, cozinhas e mercados que a gente já conhece ou já validou",
      "Deslocamentos resolvidos, incluindo o que não é óbvio, como as zonas de tráfego restrito nas cidades históricas",
      "Roteiro de busca de origem familiar, quando é esse o motivo da viagem",
      "Acompanhamento antes, durante e depois, com alguém de verdade do outro lado",
    ],
    depoimento: null,
    ctaLabel: "Me conta sobre a sua ideia de viagem para a Itália",
    whatsappMensagem:
      "Oi! Vi a página da Itália no site e queria conversar sobre um roteiro por lá.",
    imagem: null,
  },
  {
    slug: "africa-do-sul",
    nome: "África do Sul",
    cardTitulo: "Safári, vinho e litoral",
    cardApoio: "Um país grande demais para um roteiro só.",
    h1: "Safári, vinho e litoral",
    intro: [
      "A África do Sul é grande de um jeito difícil de imaginar antes de chegar. Tem safári em reservas que são bem diferentes entre si, tem uma região de vinhos a menos de duas horas da Cidade do Cabo, tem litoral, montanha, cidade e estrada. Cada uma dessas coisas rende uma viagem inteira sozinha, e todas elas cabem no mesmo país.",
      "Por isso a pergunta aqui nunca é o que fazer. É quais dessas experiências combinam com você, em que ordem e com quanto tempo em cada uma. Qual reserva escolher entre tantas, quais vinícolas valem a visita, quanto tempo reservar para a Cidade do Cabo. São escolhas que ficam muito mais fáceis quando quem está montando o roteiro já viveu o país de dentro, e não só leu sobre ele.",
    ],
    listaTitulo: "O que entra em um roteiro nosso na África do Sul",
    lista: [
      "Escolha da reserva ou parque de acordo com a época do ano e com o que você quer viver no safári",
      "Lodges selecionados por perfil: mais rústico, mais confortável, mais isolado, com ou sem crianças",
      "Cidade do Cabo e a rota dos vinhos com o tempo que elas realmente pedem, e as vinícolas escolhidas uma a uma",
      "Voos internos, estradas e transfers organizados para o roteiro fluir entre uma região e outra",
      "Orientação sobre documentação, saúde e o que levar, com antecedência confortável",
      "Acompanhamento antes, durante e depois, com alguém de verdade do outro lado",
    ],
    depoimento: null,
    ctaLabel: "Me conta sobre a sua ideia de viagem para a África do Sul",
    whatsappMensagem:
      "Oi! Vi a página da África do Sul no site e queria conversar sobre um roteiro por lá.",
    imagem: null,
  },
  {
    slug: "portugal",
    nome: "Portugal",
    cardTitulo: "Muito além de Lisboa e Porto",
    cardApoio: "Douro, Alentejo, Algarve. O país inteiro, no ritmo certo.",
    h1: "Muito além de Lisboa e Porto",
    intro: [
      "Quase todo roteiro de Portugal que chega até nós tem as mesmas duas cidades e o mesmo número de dias. E não tem nada de errado com Lisboa e Porto: são duas cidades lindas, que merecem cada hora que recebem.",
      "O ponto é que Portugal tem muito mais do que costuma aparecer nesses roteiros, e é um país feito para ser atravessado de carro. As distâncias são curtas, as estradas são boas e a paisagem muda de personalidade a cada duas horas de viagem. O Douro tem os vinhedos em terraços sobre o rio e almoços que não têm hora para acabar. O Alentejo tem planície, vilas brancas e o melhor custo-benefício gastronômico do país. O Algarve tem falésias e praias que mudam completamente conforme onde você fica e em que mês vai. E há ainda Sintra, Évora, Óbidos, Coimbra, a Serra da Estrela, as ilhas.",
      "Nossa parte é essa: entender quanto tempo você tem e distribuir esse tempo do jeito que faz a viagem valer mais.",
    ],
    listaTitulo: "O que entra em um roteiro nosso em Portugal",
    lista: [
      "Distribuição de dias entre cidade, vinho, campo e litoral, de acordo com o que você quer da viagem",
      "Roteiro de carro planejado com trajetos realistas, para a estrada ser parte do passeio e não um problema",
      "Hospedagem escolhida uma a uma, de hotel em centro histórico a quinta no interior",
      "Visitas a produtores e vinícolas no Douro e no Alentejo, com hora marcada e no ritmo certo",
      "Mesas reservadas onde reserva faz diferença",
      "Acompanhamento antes, durante e depois, com alguém de verdade do outro lado",
    ],
    depoimento: null,
    ctaLabel: "Me conta sobre a sua ideia de viagem por Portugal",
    whatsappMensagem:
      "Oi! Vi a página de Portugal no site e queria conversar sobre um roteiro por lá.",
    imagem: null,
  },
  {
    slug: "argentina",
    nome: "Argentina",
    cardTitulo: "Perto, e muito melhor do que você imagina",
    cardApoio: "Mendoza, Bariloche, Buenos Aires. Cada uma com um roteiro diferente.",
    h1: "Perto, e muito melhor do que você imagina",
    intro: [
      "A Argentina costuma entrar na conversa como a viagem mais fácil: perto, sem fuso, sem visto, sem grande produção. E é tudo isso mesmo. O que quase ninguém percebe é o tanto de viagem diferente que cabe dentro do mesmo país.",
      "Para quem quer vinho, Mendoza tem bodegas aos pés da cordilheira e almoços longos entre vinhedos. Para quem busca natureza, há os lagos e as trilhas da região dos Andes, e o Sul com paisagem de fim de mundo. Para quem busca neve, o inverno em Bariloche e Las Leñas resolve sem travessia de oceano. E para quem gosta de cidade grande, Buenos Aires tem mesa, teatro, livraria e caminhada para muitos dias.",
      "Escolher qual dessas Argentinas é a sua, ou combinar duas sem correria, é o que a gente faz aqui.",
    ],
    listaTitulo: "O que entra em um roteiro nosso na Argentina",
    lista: [
      "Definição de qual Argentina faz sentido para você, e em qual época do ano",
      "Hospedagem escolhida por região e por perfil, de hotel de bairro em Buenos Aires a bodega em Mendoza",
      "Visitas a vinícolas com almoço e horário marcados, incluindo as que não recebem sem agendamento",
      "Bariloche montada de acordo com a estação, com clareza sobre o que cada época oferece",
      "Trechos internos e transfers resolvidos, quando a viagem combina mais de uma região",
      "Acompanhamento antes, durante e depois, com alguém de verdade do outro lado",
    ],
    depoimento: null,
    ctaLabel: "Me conta sobre a sua ideia de viagem para a Argentina",
    whatsappMensagem:
      "Oi! Vi a página da Argentina no site e queria conversar sobre um roteiro por lá.",
    imagem: null,
  },
];

/** Busca por slug. `undefined` = slug desconhecido (a página responde 404). */
export function getDestino(slug: string): Destino | undefined {
  return DESTINOS.find((d) => d.slug === slug);
}

/** Teto da meta description (recomendação de SERP). */
const DESCRIPTION_MAX = 155;

/**
 * Primeira frase de um texto, pra `<meta name="description">`: corta na primeira
 * pontuação final (. ! ?) seguida de espaço ou fim, e nunca passa de 155
 * caracteres (se passar, corta no último espaço antes do teto e fecha com "…").
 */
export function primeiraFrase(texto: string): string {
  const match = texto.match(/^(.+?[.!?])(\s|$)/);
  const frase = (match ? match[1] : texto).trim();
  if (frase.length <= DESCRIPTION_MAX) return frase;
  const corte = frase.lastIndexOf(" ", DESCRIPTION_MAX - 1);
  return `${frase.slice(0, corte > 0 ? corte : DESCRIPTION_MAX - 1).trimEnd()}…`;
}
