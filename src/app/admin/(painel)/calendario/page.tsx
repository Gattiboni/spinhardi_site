import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getCalendarEvents, getPessoasAprovadas } from "@/lib/calendario";
import { getCatalogoInterno, getTagsPorContato } from "@/lib/tags";
import { ehVisao, type Visao } from "@/lib/calendario/types";
import {
  diasDaSemana,
  ehDataISOValida,
  gradeDoMes,
  hojeEmSaoPaulo,
  somaDias,
  type DataISO,
} from "@/lib/calendario/datas";
import CalendarioClient from "./CalendarioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendário · Admin",
};

/**
 * Calendário — leitura server-side, uma chamada à RPC por visão.
 *
 * Visão e data-âncora vivem na QUERY STRING (`?v=mes&d=2026-08-14`), não no
 * estado do cliente. Navegar de mês é navegar de URL: o servidor recalcula o
 * range e refaz a chamada à RPC. É o que mantém a promessa do contrato C4 — a UI
 * nunca guarda um cache de eventos que ela mesma remenda — e de quebra torna
 * cada visão linkável e o botão "voltar" do browser correto.
 *
 * Os três ranges:
 *  • Mês    → a grade inteira de 42 dias (inclui as células de borda esmaecidas);
 *  • Semana → os 7 dias exibidos;
 *  • Agenda → hoje−60 / hoje+30. Decisão local: as seções da agenda são
 *    Atrasadas · Hoje · Próximos 30 dias, e "atrasada" não tem piso natural —
 *    60 dias pra trás cobrem o atraso que ainda é acionável sem transformar a
 *    tela num relatório histórico. Trocar o número é trocar esta constante.
 */
const AGENDA_DIAS_ATRAS = 60;
const AGENDA_DIAS_FRENTE = 30;

function calcularRange(
  visao: Visao,
  ancora: DataISO,
  hoje: DataISO,
): { inicio: DataISO; fim: DataISO } {
  if (visao === "mes") {
    const { inicio, fim } = gradeDoMes(ancora);
    return { inicio, fim };
  }
  if (visao === "semana") {
    const dias = diasDaSemana(ancora);
    return { inicio: dias[0], fim: dias[6] };
  }
  return {
    inicio: somaDias(hoje, -AGENDA_DIAS_ATRAS),
    fim: somaDias(hoje, AGENDA_DIAS_FRENTE),
  };
}

export default async function CalendarioPage({
  searchParams,
}: {
  // PONTO DE EXTENSÃO (T8): `?tag=` pra deep-link de calendário filtrado (e
  // pro caminho jornada/contato → calendário, que hoje não existe). Ficou de
  // fora por decisão: o filtro de tag vive em `localStorage`, como os chips.
  // Entrar aqui obriga a definir a precedência URL × preferência, do jeito que
  // `visaoExplicita` já faz pra `?v=`.
  searchParams: Promise<{ v?: string; d?: string }>;
}) {
  const [sessao, params] = await Promise.all([requireSession(), searchParams]);

  // "Hoje" é decidido UMA vez, aqui, no fuso da operação, e desce como prop —
  // servidor (UTC na Vercel) e browser (BRT) discordariam entre 21h e meia-noite,
  // e é "hoje" que define a seção Hoje, o corte de Atrasadas e o contador de dias.
  const hoje = hojeEmSaoPaulo();

  const visao: Visao = ehVisao(params.v) ? params.v : "mes";
  const ancora: DataISO = ehDataISOValida(params.d) ? params.d : hoje;

  const { inicio, fim } = calcularRange(visao, ancora, hoje);

  // O filtro por tag (contrato de tags transversais v1, T5) NÃO passa pela RPC:
  // `calendar_events_between` já devolve `contact_id` em todos os nove ramos, e
  // o que falta é só o vocabulário. Duas leituras em paralelo resolvem — o mapa
  // `contactId → slugs` (a mesma varredura única que o kanban usa) e o catálogo
  // interno pro select. A RPC fica intocada, zero migration.
  const [eventos, pessoas, tagsPorContato, catalogoTags] = await Promise.all([
    getCalendarEvents(inicio, fim),
    getPessoasAprovadas(),
    getTagsPorContato(),
    getCatalogoInterno().catch((err) => {
      // Sem catálogo o select nasce vazio e o calendário segue de pé — mesmo
      // degradê do kanban.
      console.error("[calendario] catálogo de tags:", err);
      return [];
    }),
  ]);

  return (
    <CalendarioClient
      eventos={eventos}
      pessoas={pessoas}
      // Map não atravessa a fronteira servidor→cliente na serialização do RSC:
      // vai como array de pares e o cliente remonta.
      tagsPorContato={[...tagsPorContato.entries()]}
      catalogoTags={catalogoTags}
      hoje={hoje}
      visao={visao}
      ancora={ancora}
      visaoExplicita={ehVisao(params.v)}
      usuario={{ id: sessao.id, nome: sessao.name, ehAdmin: sessao.role === "admin" }}
      agendaDias={{ atras: AGENDA_DIAS_ATRAS, frente: AGENDA_DIAS_FRENTE }}
    />
  );
}
