/**
 * Fumaça do módulo de campanhas — CP2 do lote CAMP.
 *
 * Roda o pipeline INTEIRO contra o Resend de verdade, com MODO SEGURO ligado:
 * público real é resolvido e logado, mas quem recebe é a lista de teste
 * (`CAMPANHAS_EMAILS_TESTE`, com `delivered@resend.dev` e `bounced@resend.dev`
 * como piso). Nenhum contato real é contatado.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/smoke-campanhas.ts
 *   npx tsx --conditions=react-server scripts/smoke-campanhas.ts --limpar
 *
 * `--conditions=react-server` é obrigatório: os módulos de `lib/campanhas`
 * declaram `import "server-only"`, que fora dessa condição lança de propósito.
 *
 * `--limpar` só imprime o que a fumaça criou (id da campanha, broadcast,
 * destinatários) pra conferência — NÃO apaga nada: `campanha_destinatarios` e
 * `campanha_eventos` são append-only por contrato.
 *
 * PLANO DE REVERSÃO: apagar este arquivo. Nada em `src/` importa daqui.
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
    // Last-wins de propósito: o .env.local tem bloco duplicado e é assim que o
    // @next/env resolve — a fumaça precisa ver o mesmo valor que o app vê.
    if (valor) process.env[t.slice(0, eq).trim()] = valor;
  }
} catch {
  console.error("AVISO: não foi possível carregar .env.local");
}

// Trava de segurança do próprio script: MODO SEGURO é ligado à força aqui,
// independente do que a env disser. Fumaça não dispara pra base real, ponto.
process.env.CAMPANHAS_MODO_SEGURO = "1";

// Import DINÂMICO, depois do bloco de env acima: os módulos leem
// `process.env` no topo (Supabase, Resend) e import estático rodaria antes.
async function modulos() {
  return {
    ...(await import("@/lib/campanhas")),
    ...(await import("@/lib/campanhas/envio")),
    ...(await import("@/lib/campanhas/publico")),
    ...(await import("@/lib/campanhas/modo-seguro")),
    ...(await import("@/lib/campanhas/conteudo")),
    ...(await import("@/lib/campanhas/resend-cliente")),
  };
}

function titulo(t: string) {
  console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`);
}

const OPERADOR = "smoke-cp2";

async function main() {
  const {
    criarCampanha,
    salvarConteudo,
    salvarPublico,
    getCampanhaById,
    getDestinatarios,
    getAuditoria,
    urlImagemCampanha,
    enviarTesteDaCampanha,
    dispararCampanha,
    checarEnvio,
    resolverPublico,
    emailsDeTeste,
    modoSeguroAtivo,
    montarEmailHtml,
    preflight,
    conteudoDe,
    resend,
  } = await modulos();

  titulo("0 · Ambiente");
  console.log("MODO SEGURO:", modoSeguroAtivo());
  console.log("Emails de teste:", emailsDeTeste());
  console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "presente" : "AUSENTE");
  console.log("RESEND_FROM_EMAIL:", process.env.RESEND_FROM_EMAIL ?? "AUSENTE");

  titulo("1 · Público real (só leitura — ninguém é contatado)");
  const publico = await resolverPublico("todos_elegiveis", null);
  console.log("elegíveis agora:", publico.destinatarios.length);
  console.log("exclusões:", publico.exclusoes);

  titulo("2 · Criar campanha de fumaça");
  const campanha = await criarCampanha({
    nomeInterno: `Fumaça CP2 — ${new Date().toISOString().slice(0, 16)}`,
    tipo: "newsletter",
    criadoPor: null,
  });
  console.log("campanha:", campanha.id);

  await salvarConteudo(campanha.id, {
    assunto: "Fumaça do módulo de campanhas (ignore)",
    titulo: "Isto é um teste técnico",
    intro: "Se você recebeu isto por engano, pode apagar.",
    corpo:
      "Mensagem de fumaça do lote CAMP.\n\nServe pra provar broadcast, congelamento de destinatários e o ciclo de eventos do webhook.",
    ctaTexto: "Ver o site",
    ctaLink: "https://www.spinharditurismo.com.br",
    notaRodape: null,
    imagemPath: null,
    imagemAlt: null,
  });
  await salvarPublico(campanha.id, "todos_elegiveis", null);

  titulo("3 · Preflight");
  const comConteudo = (await getCampanhaById(campanha.id))!;
  const html = montarEmailHtml(conteudoDe(comConteudo), {
    imagemUrl: urlImagemCampanha(comConteudo.imagemPath),
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });
  for (const item of preflight(conteudoDe(comConteudo), html)) {
    console.log(`  ${item.ok ? "PASSOU" : "FALHOU"}  ${item.label}`);
  }

  titulo("4 · Envio bloqueado antes do teste (E8)");
  console.log(await checarEnvio(comConteudo));

  titulo("5 · Envio de teste");
  const teste = await enviarTesteDaCampanha(campanha.id, ["delivered@resend.dev"], OPERADOR);
  console.log(teste);

  titulo("6 · Disparo em MODO SEGURO");
  const resultado = await dispararCampanha(campanha.id, OPERADOR);
  console.log(resultado);

  titulo("7 · Segunda tentativa (idempotência, β check 4)");
  console.log(await dispararCampanha(campanha.id, OPERADOR));

  titulo("8 · Edição pós-envio recusada (β check 5)");
  // Só faz sentido se a campanha REALMENTE chegou em `enviada`. Com o disparo
  // reprovado (ex: chave do Resend sem permissão), ela segue `testada` e a
  // edição passa — corretamente. Sem esta guarda o check dá falso negativo.
  if (resultado.ok) {
    try {
      await salvarConteudo(campanha.id, { ...conteudoDe(comConteudo), assunto: "adulterado" });
      console.log("PROBLEMA: a edição passou!");
    } catch (err) {
      console.log("recusado como esperado:", (err as Error).message);
    }
  } else {
    console.log("PULADO: a campanha não chegou em `enviada` (o disparo falhou acima).");
  }

  titulo("9 · Destinatários congelados");
  for (const d of await getDestinatarios(campanha.id)) {
    console.log(`  ${d.email}  ·  ${d.nome}  ·  contact_id=${d.contactId}`);
  }

  titulo("10 · Auditoria");
  for (const a of await getAuditoria(campanha.id)) {
    console.log(` ${a.tipo}`, JSON.stringify(a.rawPayload).slice(0, 400));
  }

  titulo("11 · Estado no Resend (pra pescar o payload real do Z1)");
  if (resultado.ok) {
    const b = await resend().broadcasts.get(resultado.broadcastId);
    console.log("broadcast:", JSON.stringify(b.data, null, 2)?.slice(0, 900));
  }

  console.log(`\n>>> CAMPANHA DE FUMAÇA: ${campanha.id}`);
  console.log(`>>> BROADCAST: ${resultado.ok ? resultado.broadcastId : "—"}\n`);
}

main().catch((err) => {
  console.error("FUMAÇA FALHOU:", err);
  process.exit(1);
});
