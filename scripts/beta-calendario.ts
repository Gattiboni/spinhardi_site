/**
 * Critério de aceite (β) do lote CALENDÁRIO — checks de SERVIDOR, executados.
 *
 * LEITURA PURA. Este script não escreve uma linha: criação, conclusão, arrasto e
 * check-in ficam pro smoke pós-deploy, como o enunciado do lote determina. O que
 * se prova aqui é o caminho de leitura inteiro (RPC → mapper → tipos) e a LÓGICA
 * DA UI exercitada sobre o retorno real — filtro de categoria, escopo admin vs
 * editor, atrasadas, faixa multi-dia e ordenação de célula.
 *
 * Os números de agosto/2026 são o β de banco combinado no contrato:
 *   41 voos · 25 check-ins · 18 aniversários · 13 hospedagens · 5 tarefas_iddas
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/beta-calendario.ts
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

import { readFileSync } from "fs";
import { join } from "path";

// ─── .env.local (last-wins, como o @next/env) ───────────────────────────────
try {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const valor = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (valor) process.env[t.slice(0, eq).trim()] = valor;
  }
} catch {
  console.error("AVISO: não foi possível carregar .env.local");
}

const resultados: { n: string; ok: boolean; nota: string }[] = [];

function check(n: string, ok: boolean, nota: string) {
  resultados.push({ n, ok, nota });
  console.log(`[${ok ? "PASSOU" : "NÃO PASSOU"}] ${n} — ${nota}`);
}

/** β do banco, contrato do lote. */
const ESPERADO_AGOSTO: Record<string, number> = {
  voo: 41,
  checkin: 25,
  aniversario: 18,
  hospedagem: 13,
  tarefa_iddas: 5,
};

async function main() {
  const { getCalendarEvents, getPessoasAprovadas } = await import("@/lib/calendario");
  const {
    CATEGORIAS_ORDENADAS,
    categoriaDe,
    chaveEvento,
    compararNaCelula,
    estaAtrasada,
    eventoVisivel,
    ocupaODia,
    podeArrastar,
  } = await import("@/lib/calendario/types");
  const { gradeDoMes, diffDias } = await import("@/lib/calendario/datas");

  const RAIZ = process.cwd();
  const HOJE = "2026-08-14";

  // ───────────────────────────────────────────────────────────────
  // 1. Leitura real: mês civil de agosto/2026 bate com o β do banco
  // ───────────────────────────────────────────────────────────────
  const mesCivil = await getCalendarEvents("2026-08-01", "2026-08-31");

  const contagem: Record<string, number> = {};
  for (const ev of mesCivil) contagem[ev.eventType] = (contagem[ev.eventType] ?? 0) + 1;

  for (const [tipo, esperado] of Object.entries(ESPERADO_AGOSTO)) {
    const obtido = contagem[tipo] ?? 0;
    check(`1.${tipo}`, obtido === esperado, `${tipo}: esperado ${esperado}, obtido ${obtido}`);
  }

  // Nada além do combinado apareceu (tarefa local ainda não existe; seguro,
  // transporte e cruzeiro não têm dado em agosto).
  const inesperados = Object.keys(contagem).filter((t) => !(t in ESPERADO_AGOSTO));
  check(
    "1.fechamento",
    inesperados.length === 0,
    inesperados.length === 0
      ? `só os 5 tipos combinados, ${mesCivil.length} linhas no total`
      : `tipos inesperados: ${inesperados.join(", ")}`,
  );

  // O mapper não perdeu campo obrigatório nem título.
  const semTitulo = mesCivil.filter((e) => !e.titulo.trim()).length;
  const semData = mesCivil.filter((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.dataInicio)).length;
  check(
    "1.mapper",
    semTitulo === 0 && semData === 0,
    `sem título: ${semTitulo}, data inválida: ${semData}`,
  );

  // ───────────────────────────────────────────────────────────────
  // 2. O range que a visão Mês realmente pede (grade de 42 dias)
  // ───────────────────────────────────────────────────────────────
  const grade = gradeDoMes(HOJE);
  const daGrade = await getCalendarEvents(grade.inicio, grade.fim);

  check(
    "2.grade",
    grade.dias.length === 42 && grade.inicio === "2026-07-26" && grade.fim === "2026-09-05",
    `42 dias de ${grade.inicio} a ${grade.fim} (inclui as células de borda)`,
  );
  check(
    "2.superset",
    daGrade.length >= mesCivil.length,
    `grade traz ${daGrade.length} eventos ⊇ ${mesCivil.length} do mês civil`,
  );

  // ───────────────────────────────────────────────────────────────
  // 3. Categoria: 9 event_types viram 8 chips; tarefa_iddas mora em "tarefa"
  // ───────────────────────────────────────────────────────────────
  const categorias = new Set(daGrade.map((e) => categoriaDe(e.eventType)));
  const foraDoVocabulario = [...categorias].filter((c) => !CATEGORIAS_ORDENADAS.includes(c));
  check(
    "3.vocabulario",
    foraDoVocabulario.length === 0 && CATEGORIAS_ORDENADAS.length === 8,
    `8 chips no vocabulário; presentes na grade: ${[...categorias].sort().join(", ")}`,
  );
  check(
    "3.tarefa_iddas",
    categoriaDe("tarefa_iddas") === "tarefa" && categoriaDe("tarefa") === "tarefa",
    "tarefa_iddas e tarefa caem no mesmo chip",
  );

  // Filtrar um chip remove exatamente os eventos daquela categoria.
  const semVoos = daGrade.filter((e) => categoriaDe(e.eventType) !== "voo");
  const voosNaGrade = daGrade.filter((e) => e.eventType === "voo").length;
  check(
    "3.filtro",
    semVoos.length === daGrade.length - voosNaGrade,
    `desligar "Voos" tira ${voosNaGrade} de ${daGrade.length}`,
  );

  // ───────────────────────────────────────────────────────────────
  // 4. Escopo e hierarquia (C5) — sobre o dado real
  // ───────────────────────────────────────────────────────────────
  const pessoas = await getPessoasAprovadas();
  const admins = pessoas.filter((p) => p.ehAdmin);
  const naoAdmins = pessoas.filter((p) => !p.ehAdmin);
  check(
    "4.pessoas",
    pessoas.length > 0 && admins.length > 0,
    `${pessoas.length} aprovados (${admins.length} admin, ${naoAdmins.length} demais), lidos do banco`,
  );

  const todosIds = new Set(pessoas.map((p) => p.id));
  const semDono = daGrade.filter((e) => e.responsavelUserId === null);
  const comDono = daGrade.filter((e) => e.responsavelUserId !== null);

  // Quem tem dono é só tarefa/tarefa_iddas — a divergência decidida no C5.2.
  const donoForaDeTarefa = comDono.filter(
    (e) => e.eventType !== "tarefa" && e.eventType !== "tarefa_iddas",
  );
  check(
    "4.dono",
    donoForaDeTarefa.length === 0,
    `${comDono.length} com responsável (só tarefas), ${semDono.length} do time (derivados)`,
  );

  // Escolhe pra teste QUEM DE FATO TEM tarefa no range — pegar o primeiro da
  // ordem alfabética faria o check passar com "0 próprias + N do time", que é
  // verdadeiro e não prova nada sobre o ramo do dono.
  const porDono = new Map<string, number>();
  for (const e of daGrade) {
    if (e.responsavelUserId)
      porDono.set(e.responsavelUserId, (porDono.get(e.responsavelUserId) ?? 0) + 1);
  }
  const comMaisTarefas = (lista: typeof pessoas) =>
    [...lista].sort((a, b) => (porDono.get(b.id) ?? 0) - (porDono.get(a.id) ?? 0))[0];

  const admin = comMaisTarefas(admins);
  check(
    "4.amostra",
    (porDono.get(admin.id) ?? 0) > 0,
    `admin de teste tem ${porDono.get(admin.id) ?? 0} tarefas próprias no range (ramo do dono exercitado)`,
  );
  const visaoAdminTime = daGrade.filter((e) =>
    eventoVisivel(e, {
      ehAdmin: true,
      escopo: "time",
      usuarioId: admin.id,
      pessoasSelecionadas: todosIds,
    }),
  );
  check(
    "4.admin_time",
    visaoAdminTime.length === daGrade.length,
    `admin/time vê ${visaoAdminTime.length} de ${daGrade.length}`,
  );

  // Admin em "meu": as próprias + TUDO que não tem dono.
  const visaoAdminMeu = daGrade.filter((e) =>
    eventoVisivel(e, {
      ehAdmin: true,
      escopo: "meu",
      usuarioId: admin.id,
      pessoasSelecionadas: todosIds,
    }),
  );
  const dele = comDono.filter((e) => e.responsavelUserId === admin.id).length;
  check(
    "4.admin_meu",
    visaoAdminMeu.length === dele + semDono.length,
    `admin/meu vê ${visaoAdminMeu.length} = ${dele} próprias + ${semDono.length} do time`,
  );

  // Não-admin: travado em "meu", e a operação do time NÃO some.
  if (naoAdmins.length > 0) {
    const editor = comMaisTarefas(naoAdmins);
    const visaoEditor = daGrade.filter((e) =>
      eventoVisivel(e, {
        ehAdmin: false,
        escopo: "time", // mesmo pedindo "time", a regra trava em "meu"
        usuarioId: editor.id,
        pessoasSelecionadas: todosIds,
      }),
    );
    const doEditor = comDono.filter((e) => e.responsavelUserId === editor.id).length;
    check(
      "4.editor",
      visaoEditor.length === doEditor + semDono.length,
      `editor vê ${visaoEditor.length} = ${doEditor} próprias + ${semDono.length} do time (travado em "meu")`,
    );
    check(
      "4.editor_nao_cega",
      semDono.every((e) =>
        eventoVisivel(e, {
          ehAdmin: false,
          escopo: "meu",
          usuarioId: editor.id,
          pessoasSelecionadas: new Set(),
        }),
      ),
      "nenhum derivado de viagem some pro não-admin (C5.2)",
    );
  }

  // Filtro por pessoa não engole evento sem responsável.
  const filtroUmaPessoa = daGrade.filter((e) =>
    eventoVisivel(e, {
      ehAdmin: true,
      escopo: "time",
      usuarioId: admin.id,
      pessoasSelecionadas: new Set([admin.id]),
    }),
  );
  check(
    "4.filtro_pessoa",
    filtroUmaPessoa.length === dele + semDono.length,
    `filtrando só ${admin.nome}: ${filtroUmaPessoa.length} (derivados preservados)`,
  );

  // ───────────────────────────────────────────────────────────────
  // 5. Atrasadas, multi-dia, ordenação e arrasto
  // ───────────────────────────────────────────────────────────────
  const atrasadas = daGrade.filter((e) => estaAtrasada(e, HOJE));
  const atrasadaInvalida = atrasadas.filter(
    (e) => !e.editavel || e.concluida === true || e.dataInicio >= HOJE,
  );
  check(
    "5.atrasadas",
    atrasadaInvalida.length === 0,
    `${atrasadas.length} atrasadas hoje (${HOJE}), todas editáveis + pendentes + anteriores a hoje`,
  );

  // Hoje não há nada atrasado no dado real (não existe tarefa local ainda, e os
  // check-ins são todos futuros por construção da RPC). Pra o predicado não
  // passar sem ser exercitado, roda-se ele de novo com a MESMA linha real e uma
  // data de referência à frente: o que era pendente e editável vira atrasado.
  const REF_FUTURA = "2026-12-31";
  const atrasadasFuturo = daGrade.filter((e) => estaAtrasada(e, REF_FUTURA));
  const editaveisPendentes = daGrade.filter((e) => e.editavel && !e.concluida);
  const naoEditaveisAtrasados = atrasadasFuturo.filter((e) => !e.editavel);
  check(
    "5.atrasadas_predicado",
    atrasadasFuturo.length === editaveisPendentes.length &&
      atrasadasFuturo.length > 0 &&
      naoEditaveisAtrasados.length === 0,
    `com referência ${REF_FUTURA}: ${atrasadasFuturo.length} atrasadas = todos os editáveis pendentes; nenhum derivado read-only entrou`,
  );

  // A contagem "Nd atrasada" da agenda é diferença de dias, não de horas.
  const amostraAtraso = atrasadasFuturo[0];
  check(
    "5.dias_atraso",
    diffDias(amostraAtraso.dataInicio, REF_FUTURA) > 0,
    `contagem de atraso da amostra: ${diffDias(amostraAtraso.dataInicio, REF_FUTURA)}d`,
  );

  // Faixa multi-dia: aparece em TODOS os dias entre início e fim.
  const multi = daGrade.filter((e) => e.multiDia && e.dataFim && e.dataFim > e.dataInicio);
  const spanOk = multi.every((e) => {
    const dias = grade.dias.filter((d) => ocupaODia(e, d));
    const esperado = grade.dias.filter((d) => d >= e.dataInicio && d <= e.dataFim!).length;
    return dias.length === esperado && dias.length > 0;
  });
  check(
    "5.multi_dia",
    multi.length > 0 && spanOk,
    `${multi.length} faixas multi-dia cobrem todas as células do intervalo`,
  );

  // Ordenação da célula: multi-dia primeiro, depois por hora.
  const diaCheio = grade.dias
    .map((d) => ({ d, evs: daGrade.filter((e) => ocupaODia(e, d)) }))
    .sort((a, b) => b.evs.length - a.evs.length)[0];
  const ordenados = [...diaCheio.evs].sort(compararNaCelula);
  const multiAntes = ordenados.findIndex((e) => !e.multiDia);
  const ordemOk = multiAntes === -1 || ordenados.slice(multiAntes).every((e) => !e.multiDia);
  check(
    "5.ordenacao",
    ordemOk,
    `dia mais cheio (${diaCheio.d}, ${diaCheio.evs.length} eventos): multi-dia à frente, depois por hora`,
  );

  // Só tarefa LOCAL arrasta — check-in é editável mas não tem data pra gravar.
  const arrastaveis = daGrade.filter(podeArrastar);
  const checkinsArrastaveis = daGrade.filter((e) => e.eventType === "checkin" && podeArrastar(e));
  check(
    "5.arrasto",
    checkinsArrastaveis.length === 0 && arrastaveis.every((e) => e.eventType === "tarefa"),
    `${arrastaveis.length} arrastáveis (só tarefa local); nenhum check-in arrastável`,
  );

  // Chave de evento é única — é ela que indexa override otimista e React key.
  const chaves = new Set(daGrade.map(chaveEvento));
  check(
    "5.chave",
    chaves.size === daGrade.length,
    `${chaves.size} chaves únicas pra ${daGrade.length} eventos`,
  );

  // ───────────────────────────────────────────────────────────────
  // 6. Agenda: o range hoje−60/hoje+30 e as seções
  // ───────────────────────────────────────────────────────────────
  const daAgenda = await getCalendarEvents("2026-06-15", "2026-09-13");
  const secAtrasadas = daAgenda.filter((e) => estaAtrasada(e, HOJE));
  const secHoje = daAgenda.filter((e) => ocupaODia(e, HOJE));
  const secProximos = daAgenda.filter((e) => e.dataInicio > HOJE);
  const semSecao = daAgenda.filter(
    (e) => !estaAtrasada(e, HOJE) && !ocupaODia(e, HOJE) && !(e.dataInicio > HOJE),
  );
  check(
    "6.agenda",
    secAtrasadas.length + secHoje.length + secProximos.length <= daAgenda.length,
    `${daAgenda.length} no range · atrasadas ${secAtrasadas.length} · hoje ${secHoje.length} · próximos ${secProximos.length} · fora de seção ${semSecao.length} (passado já concluído/não editável)`,
  );
  check(
    "6.janela",
    diffDias("2026-06-15", HOJE) === 60 && diffDias(HOJE, "2026-09-13") === 30,
    "janela da agenda é exatamente hoje−60 / hoje+30",
  );

  // ───────────────────────────────────────────────────────────────
  // 7. Leitura estática: nenhuma query de exibição fora da RPC
  // ───────────────────────────────────────────────────────────────
  const ler = (p: string) => readFileSync(join(RAIZ, p), "utf-8");
  const rota = "src/app/admin/(painel)/calendario";
  const arquivosRota = [
    `${rota}/page.tsx`,
    `${rota}/CalendarioClient.tsx`,
    `${rota}/Visoes.tsx`,
    `${rota}/DrawerEvento.tsx`,
    `${rota}/FormTarefa.tsx`,
    `${rota}/actions.ts`,
  ];
  const libIndex = ler("src/lib/calendario/index.ts");

  const rpcs = libIndex.match(/\.rpc\(\s*"([^"]+)"/g) ?? [];
  check(
    "7.rpc_unica",
    rpcs.length === 1 && rpcs[0].includes("calendar_events_between"),
    `a única RPC do módulo é ${rpcs.join(", ") || "(nenhuma)"}`,
  );

  // Nenhuma leitura de bronze em lugar nenhum do módulo.
  const bronzeNoModulo = [libIndex, ...arquivosRota.map(ler)].some((src) =>
    /from\(\s*["']bronze_/.test(src),
  );
  check("7.sem_bronze", !bronzeNoModulo, "nenhum acesso direto a tabela bronze");

  // Componentes da rota não falam com o Supabase — só o lib server-only fala.
  const componentes = arquivosRota.filter((f) => f.endsWith(".tsx")).map(ler);
  check(
    "7.componentes_limpos",
    !componentes.some((src) => src.includes("@/lib/supabase")),
    "nenhum componente da rota importa client do Supabase",
  );

  // A tabela `tarefas` só é tocada por escrita + a RPC; nunca lida pra exibir.
  const selectTarefas = /from\(\s*["']tarefas["']\s*\)\s*\.\s*select/.test(libIndex);
  check(
    "7.tarefas_sem_select",
    !selectTarefas || /tarefaExiste/.test(libIndex),
    "`tarefas` não é lida pra exibição",
  );

  // ───────────────────────────────────────────────────────────────
  // 8. Zero hardcoding de identidade
  // ───────────────────────────────────────────────────────────────
  const fonteToda = [libIndex, ...arquivosRota.map(ler), ler("src/lib/calendario/types.ts")].join(
    "\n",
  );

  const nomesVazados = pessoas
    .map((p) => p.nome.split(/\s+/)[0])
    .filter((primeiro) => primeiro.length > 2)
    .filter((primeiro) => new RegExp(`\\b${primeiro}\\b`, "i").test(fonteToda));
  check(
    "8.sem_nomes",
    nomesVazados.length === 0,
    nomesVazados.length === 0
      ? `nenhum dos ${pessoas.length} nomes aprovados aparece no código`
      : `nomes no código: ${nomesVazados.join(", ")}`,
  );

  const idsVazados = pessoas.filter((p) => fonteToda.includes(p.id));
  check(
    "8.sem_ids",
    idsVazados.length === 0,
    idsVazados.length === 0
      ? "nenhum uuid de usuário no código"
      : `${idsVazados.length} uuid(s) no código`,
  );

  const roleHardcoded = /role\s*===\s*["'](?!admin["'])/.test(fonteToda);
  check(
    "8.role",
    !roleHardcoded,
    'a única comparação de role é `role === "admin"` (C5: admin vê tudo, o resto trava em "meu")',
  );

  // ───────────────────────────────────────────────────────────────
  console.log("\n─────────────── RESUMO ───────────────");
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`${resultados.length - falhas.length}/${resultados.length} checks passaram.`);
  if (falhas.length > 0) {
    console.log("\nNÃO PASSARAM:");
    for (const f of falhas) console.log(`  · ${f.n} — ${f.nota}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exitCode = 1;
});
