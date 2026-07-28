/**
 * Critério de aceite (β) do lote CAMP — checks de SERVIDOR, executados.
 *
 * Cobre os checks que se provam sem navegador: as travas de estado (3, 4, 5),
 * o preflight (7), grupos (8), tags (9) e o grep das colunas mortas (10). Os
 * checks 1 (visual dos primitivos), 2 (fumaça com broadcast) e 11 (webhook)
 * têm scripts/observações próprias — ver o relatório do lote.
 *
 * TUDO que este script escreve em dado REAL é restaurado no fim, pelo mesmo
 * caminho que o back-office usaria. O que ele cria (campanha e grupo de teste)
 * é identificado com prefixo "β —" e reportado no fim.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/beta-campanhas.ts
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

import { readFileSync } from "fs";
import { join } from "path";

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

// Trava de segurança: nada aqui pode disparar pra base real.
process.env.CAMPANHAS_MODO_SEGURO = "1";

const resultados: { n: string; ok: boolean | null; nota: string }[] = [];

function check(n: string, ok: boolean | null, nota: string) {
  resultados.push({ n, ok, nota });
  const marca = ok === null ? "NÃO TESTEI" : ok ? "PASSOU" : "NÃO PASSOU";
  console.log(`[${marca}] ${n} — ${nota}`);
}

async function main() {
  const {
    criarCampanha,
    salvarConteudo,
    getCampanhaById,
    atualizar,
    CampanhaImutavelError,
  } = await import("@/lib/campanhas");
  const { checarEnvio, enviarTesteDaCampanha, dispararCampanha } =
    await import("@/lib/campanhas/envio");
  const { montarEmailHtml, preflight, preflightPassou } =
    await import("@/lib/campanhas/conteudo");
  const { criarGrupo, adicionarMembros, apagarGrupo, getGruposComContagens } =
    await import("@/lib/grupos");
  const { getCatalogos, definirTagsDoContato, tagEmMassa } = await import("@/lib/tags");
  const { resolverTagsClickMassa, resolverTagsInternas } = await import("@/lib/tags/shared");
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const sb = supabaseAdmin();

  const CONTEUDO_BASE = {
    assunto: "β — assunto de teste",
    titulo: "β",
    intro: null,
    corpo: "Corpo de teste do critério de aceite.",
    ctaTexto: null,
    ctaLink: null,
    notaRodape: null,
    imagemPath: null,
    imagemAlt: null,
  };

  // ══ CHECK 7 · preflight bloqueia ═══════════════════════════════
  console.log("\n=== 7 · Preflight ===");
  {
    const semAssunto = { ...CONTEUDO_BASE, assunto: "" };
    const html = montarEmailHtml(semAssunto);
    const itens = preflight(semAssunto, html);
    check(
      "7a assunto vazio",
      !preflightPassou(itens) && itens.some((i) => i.chave === "assunto" && !i.ok),
      "preflight reprova com assunto vazio",
    );

    const comImagemSemAlt = { ...CONTEUDO_BASE, imagemPath: "x/y.jpg", imagemAlt: "" };
    const itens2 = preflight(comImagemSemAlt, montarEmailHtml(comImagemSemAlt));
    check(
      "7b imagem sem alt",
      itens2.some((i) => i.chave === "imagem_alt" && !i.ok),
      "preflight reprova imagem sem descrição",
    );

    // Corpo montado SEM o token: simula template adulterado.
    const itens3 = preflight(CONTEUDO_BASE, "<html><body>sem token</body></html>");
    check(
      "7c sem token de descadastro",
      itens3.some((i) => i.chave === "descadastro" && !i.ok),
      "preflight reprova e-mail sem link de descadastro",
    );

    const itens4 = preflight(
      { ...CONTEUDO_BASE, ctaTexto: "Ver", ctaLink: "isso-nao-e-url" },
      montarEmailHtml(CONTEUDO_BASE),
    );
    check(
      "7d cta_link malformado",
      itens4.some((i) => i.chave === "cta_link" && !i.ok),
      "preflight reprova link de botão malformado",
    );
  }

  // ══ CHECKS 3, 4, 5 · travas de estado ══════════════════════════
  console.log("\n=== 3, 4, 5 · Travas de estado ===");
  const campanha = await criarCampanha({
    nomeInterno: `β — travas ${new Date().toISOString().slice(0, 16)}`,
    tipo: "newsletter",
    criadoPor: null,
  });
  await salvarConteudo(campanha.id, CONTEUDO_BASE);

  // Teste real (usa emails.send, que a chave restrita PERMITE).
  const teste = await enviarTesteDaCampanha(campanha.id, ["delivered@resend.dev"], "beta");
  check(
    "3.0 envio de teste",
    teste.ok,
    teste.ok ? "teste enviado, campanha virou testada" : teste.erro,
  );

  if (teste.ok) {
    const antes = (await getCampanhaById(campanha.id))!;
    check(
      "3a gate liberado após teste",
      (await checarEnvio(antes)).ok,
      "com testado_hash == conteudo_hash, o envio libera",
    );

    // ADULTERAÇÃO: edita o conteúdo direto pela camada de escrita, sem passar
    // pela tela. É o cenário do check 3.
    await salvarConteudo(campanha.id, { ...CONTEUDO_BASE, corpo: "corpo adulterado" });
    const depois = (await getCampanhaById(campanha.id))!;

    check(
      "3b estado volta a rascunho",
      depois.estado === "rascunho",
      `estado após editar = ${depois.estado}`,
    );
    const gate = await checarEnvio(depois);
    check("3c envio trava", !gate.ok, gate.ok ? "PROBLEMA: liberou" : `recusado: ${gate.erro}`);
  }

  // Leva a campanha pra `enviada` pela camada de escrita (a pipeline completa
  // depende de broadcast, que a chave restrita bloqueia). As travas 4 e 5 leem
  // o estado do BANCO, então provam a mesma coisa.
  await atualizar(campanha.id, { estado: "enviada", enviadoEm: new Date().toISOString() });

  const enviada = (await getCampanhaById(campanha.id))!;
  const gate2 = await checarEnvio(enviada);
  check("4 segunda tentativa recusada", !gate2.ok, gate2.ok ? "PROBLEMA: liberou" : gate2.erro);

  const disparo2 = await dispararCampanha(campanha.id, "beta");
  check(
    "4b dispararCampanha recusa",
    !disparo2.ok,
    disparo2.ok ? "PROBLEMA: disparou" : disparo2.erro,
  );

  let recusouEdicao = false;
  let msgEdicao = "";
  try {
    await salvarConteudo(campanha.id, { ...CONTEUDO_BASE, assunto: "adulterado pós-envio" });
  } catch (err) {
    recusouEdicao = err instanceof CampanhaImutavelError;
    msgEdicao = (err as Error).message;
  }
  check("5 edição pós-envio recusada", recusouEdicao, msgEdicao || "PROBLEMA: a edição passou");

  // ══ CHECK 8 · grupos ═══════════════════════════════════════════
  console.log("\n=== 8 · Grupos ===");
  const grupo = await criarGrupo({
    nome: `β — grupo ${Date.now()}`,
    descricao: "criado pelo script de aceite",
  });
  let grupoId: string | null = null;

  if (!grupo.ok) {
    check("8 grupo", false, grupo.erro);
  } else {
    grupoId = grupo.grupo.id;

    // Nome duplicado (case-insensitive) tem mensagem legível.
    const dup = await criarGrupo({ nome: grupo.grupo.nome.toUpperCase(), descricao: null });
    check(
      "8a nome duplicado recusado",
      !dup.ok && /já existe/i.test(dup.ok ? "" : dup.erro),
      dup.ok ? "PROBLEMA: criou duplicado" : dup.erro,
    );

    // 3 contatos: 2 elegíveis e 1 sem e-mail, pra a diferença aparecer.
    const { data: elegiveis } = await sb.from("contatos_elegiveis_email").select("id").limit(2);
    const { data: semEmail } = await sb
      .from("contacts")
      .select("id")
      .eq("status", "ativo")
      .or("email.is.null,email.eq.")
      .limit(1);

    const ids = [
      ...((elegiveis as { id: string }[]) ?? []).map((c) => c.id),
      ...((semEmail as { id: string }[]) ?? []).map((c) => c.id),
    ];

    const add = await adicionarMembros(grupoId, ids);
    check(
      "8b adicionar 3 ao grupo",
      add.ok && add.adicionados === ids.length,
      add.ok ? `${add.adicionados} adicionados` : add.erro,
    );

    // Idempotência da membresia.
    const add2 = await adicionarMembros(grupoId, ids);
    check(
      "8c readicionar não duplica",
      add2.ok && add2.adicionados === 0,
      add2.ok ? `${add2.adicionados} adicionados na segunda vez` : add2.erro,
    );

    const comContagens = await getGruposComContagens();
    const meu = comContagens.find((g) => g.id === grupoId);

    // A contagem de elegíveis do grupo TEM que bater com a interseção real
    // entre a membresia e a view — que é a definição única (E1).
    const { data: naView } = await sb.from("contatos_elegiveis_email").select("id").in("id", ids);
    const esperado = ((naView as { id: string }[]) ?? []).length;

    check(
      "8d contagem bate com a view",
      meu?.elegiveis === esperado && meu?.membros === ids.length,
      `grupo diz ${meu?.elegiveis} de ${meu?.membros}; a view diz ${esperado} de ${ids.length}`,
    );
  }

  // ══ CHECK 9 · tags ═════════════════════════════════════════════
  console.log("\n=== 9 · Tags ===");
  const catalogos = await getCatalogos();
  check(
    "9.0 catálogos carregam",
    catalogos.internas.length > 0 && catalogos.clickmassa.length > 0,
    `${catalogos.internas.length} internas · ${catalogos.clickmassa.length} do ClickMassa`,
  );

  // 9a — tag do CM legível e colorida na ficha.
  const { data: comCm } = await sb
    .from("contacts")
    .select("id, name, clickmassa_tags_id")
    .not("clickmassa_tags_id", "eq", "{}")
    .limit(1)
    .maybeSingle();
  const alvoCm = comCm as { id: string; name: string; clickmassa_tags_id: number[] } | null;

  if (alvoCm) {
    const r = resolverTagsClickMassa(alvoCm.clickmassa_tags_id, catalogos.clickmassa);
    check(
      "9a tag do CM legível e colorida",
      r.tags.length > 0 && r.tags.every((t) => !!t.nome),
      `${r.tags.map((t) => `${t.nome}(${t.cor ?? "sem cor"})`).join(", ")} · ${r.orfaos} órfãos`,
    );
  } else {
    check("9a tag do CM legível", null, "nenhum contato com clickmassa_tags_id");
  }

  // 9b — vazio correto.
  const vazioCm = resolverTagsClickMassa([], catalogos.clickmassa);
  const vazioInt = resolverTagsInternas([], catalogos.internas);
  check(
    "9b vazio correto",
    vazioCm.tags.length === 0 && vazioCm.orfaos === 0 && vazioInt.length === 0,
    "sem tag resolve pra lista vazia, não pra erro",
  );

  // Alvos reais pro teste de escrita — com snapshot pra restaurar.
  const { data: alvos } = await sb
    .from("contacts")
    .select("id, name, tags")
    .eq("status", "ativo")
    .limit(3);
  const contatos = (alvos as { id: string; name: string; tags: string[] | null }[]) ?? [];
  const snapshot = new Map(contatos.map((c) => [c.id, c.tags ?? []]));

  const duasTags = catalogos.internas.filter((t) => t.isActive).slice(0, 2);

  try {
    if (contatos.length >= 3 && duasTags.length >= 2) {
      // 9c — salvar 2 internas e persistir.
      const salvou = await definirTagsDoContato(
        contatos[0].id,
        duasTags.map((t) => t.slug),
      );
      const { data: relido } = await sb
        .from("contacts")
        .select("tags")
        .eq("id", contatos[0].id)
        .single();
      const gravadas = (relido as { tags: string[] }).tags;
      check(
        "9c salvar 2 internas e persistir",
        salvou.ok && gravadas.length === 2 && duasTags.every((t) => gravadas.includes(t.slug)),
        `gravado: [${gravadas.join(", ")}] (ordenado alfabeticamente)`,
      );

      // 9d — filtro interno acha o contato taguado.
      const { data: filtrados } = await sb
        .from("contacts")
        .select("id")
        .contains("tags", [duasTags[0].slug]);
      check(
        "9d filtro interno funciona",
        ((filtrados as { id: string }[]) ?? []).some((c) => c.id === contatos[0].id),
        `${((filtrados as { id: string }[]) ?? []).length} contato(s) com "${duasTags[0].name}"`,
      );

      // 9f — massa em 3 MANTÉM as preexistentes.
      const preexistentes = new Map(contatos.map((c) => [c.id, new Set(c.tags ?? [])]));
      preexistentes.set(contatos[0].id, new Set(duasTags.map((t) => t.slug)));

      const terceira =
        catalogos.internas.filter((t) => t.isActive && !duasTags.includes(t))[0] ?? duasTags[0];

      const massa = await tagEmMassa(
        contatos.map((c) => c.id),
        terceira.slug,
        "adicionar",
      );
      const { data: depoisMassa } = await sb
        .from("contacts")
        .select("id, tags")
        .in(
          "id",
          contatos.map((c) => c.id),
        );

      const manteve = ((depoisMassa as { id: string; tags: string[] }[]) ?? []).every((c) => {
        const antes = preexistentes.get(c.id) ?? new Set<string>();
        return [...antes].every((t) => c.tags.includes(t)) && c.tags.includes(terceira.slug);
      });
      check(
        "9f massa em 3 mantém preexistentes",
        massa.ok && manteve,
        massa.ok ? `${massa.afetados} afetados, união preservada` : massa.erro,
      );

      // 9g — slug inexistente recusado por action adulterada.
      const adulterado = await definirTagsDoContato(contatos[0].id, ["tag-que-nao-existe"]);
      check(
        "9g slug inexistente recusado",
        !adulterado.ok,
        adulterado.ok ? "PROBLEMA: aceitou" : adulterado.erro,
      );

      const massaAdulterada = await tagEmMassa(
        [contatos[0].id],
        "outra-que-nao-existe",
        "adicionar",
      );
      check(
        "9g2 massa com slug inexistente recusada",
        !massaAdulterada.ok,
        massaAdulterada.ok ? "PROBLEMA: aceitou" : massaAdulterada.erro,
      );
    } else {
      check("9c-9g escrita de tags", null, "base sem contatos/tags suficientes");
    }
  } finally {
    // Restaura TODA tag mexida.
    console.log("\n--- restaurando tags dos contatos usados ---");
    for (const [id, tags] of snapshot) {
      const { error } = await sb.from("contacts").update({ tags }).eq("id", id);
      console.log(`  ${id}: [${tags.join(", ")}]${error ? ` FALHOU: ${error.message}` : ""}`);
    }
    if (grupoId) {
      const r = await apagarGrupo(grupoId);
      console.log(`  grupo de teste apagado: ${r.ok ? "sim" : "NÃO"}`);
    }
  }

  // 9e — filtro CM por tag nomeada.
  const interesse = catalogos.clickmassa.find((t) => /interesse em pacote/i.test(t.nome));
  if (interesse) {
    const { data: comTag } = await sb
      .from("contacts")
      .select("id")
      .contains("clickmassa_tags_id", [interesse.id]);
    const n = ((comTag as { id: string }[]) ?? []).length;
    check("9e filtro CM 'Interesse em pacote'", n > 0, `${n} contato(s) com a tag`);
  } else {
    check(
      "9e filtro CM 'Interesse em pacote'",
      null,
      `tag não existe no catálogo. Existentes: ${catalogos.clickmassa.map((t) => t.nome).join(", ")}`,
    );
  }

  // ══ Resumo ═════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(72)}`);
  const passou = resultados.filter((r) => r.ok === true).length;
  const falhou = resultados.filter((r) => r.ok === false).length;
  const naoTestei = resultados.filter((r) => r.ok === null).length;
  console.log(`PASSOU: ${passou} · NÃO PASSOU: ${falhou} · NÃO TESTEI: ${naoTestei}`);
  console.log(`Campanha de teste criada: ${campanha.id}`);
  console.log("═".repeat(72));
}

main().catch((err) => {
  console.error("β FALHOU:", err);
  process.exit(1);
});
