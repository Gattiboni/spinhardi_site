/**
 * Fumaça do WEBHOOK do Resend — CP2 / β checks 6 e 11.
 *
 * Prova a borda inteira sem depender do Resend: monta payloads no formato
 * declarado pelo próprio SDK (`BaseEmailEventData`), assina com o esquema Svix
 * usando `RESEND_WEBHOOK_SECRET`, e bate na rota `/api/webhooks/resend` do
 * servidor local. Verifica:
 *
 *   1. request SEM assinatura → 401
 *   2. request COM assinatura válida → 200 e linha em `campanha_eventos`
 *   3. MESMA request repetida → 200 e NENHUMA linha nova (dedup V4)
 *   4. correlação evento→campanha pelo `broadcast_id` (Z1, rota direta)
 *   5. correlação best-effort por e-mail + janela, sem `broadcast_id`
 *   6. bounce HARD → contato vira `invalido` com origem `bounce` e SOME da
 *      view de elegíveis; no fim o script RESTAURA o estado anterior pelo
 *      caminho de back-office que o contrato autoriza (P3).
 *
 * Uso (NÃO precisa de servidor de dev):
 *   npx tsx --conditions=react-server scripts/smoke-webhook-resend.ts
 *
 * O script importa o `POST` da própria rota e o chama com um `Request` montado
 * à mão. Chamar por HTTP exigiria `RESEND_WEBHOOK_SECRET` no `.env.local` (env
 * é configuração manual do Alan) e derrubar o dev server que já está de pé.
 * Testar o handler direto cobre a mesma coisa que importa aqui — verificação de
 * assinatura, códigos de retorno e ingestão; o roteamento em si o build já
 * garante.
 *
 * PLANO DE REVERSÃO: apagar este arquivo.
 */

import { createHmac } from "crypto";
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

// Segredo só deste teste, injetado no processo. Não toca `.env.local`.
//
// O fallback NÃO usa o prefixo `whsec_`: com ele, o secret scanning do GitHub
// abria alerta em cima de um valor fabricado (já fechado como "used in tests").
// Sem prefixo o comportamento é idêntico — o `replace(/^whsec_/, "")` abaixo
// vira no-op e os dois lados (este script e o `standardwebhooks`, que só
// remove o prefixo QUANDO ele existe) decodificam a mesma base64. O valor é
// base64 de "TESTE-LOCAL-NAO-E-SEGREDO-smoke"; base64 válida é requisito, o
// decoder do SDK é estrito.
const SEGREDO = process.env.RESEND_WEBHOOK_SECRET ?? "VEVTVEUtTE9DQUwtTkFPLUUtU0VHUkVETy1zbW9rZQ==";
process.env.RESEND_WEBHOOK_SECRET = SEGREDO;

/** Assinatura Svix: HMAC-SHA256 de `${id}.${timestamp}.${body}` com o segredo. */
function assinar(id: string, timestamp: string, body: string) {
  const chave = Buffer.from(SEGREDO.replace(/^whsec_/, ""), "base64");
  const assinatura = createHmac("sha256", chave)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${assinatura}`,
    "content-type": "application/json",
  };
}

type Handler = (r: Request) => Promise<Response>;
let POST: Handler;
let n = 0;

async function postar(payload: unknown, opts: { assinado: boolean } = { assinado: true }) {
  const body = JSON.stringify(payload);
  const id = `msg_smoke_${++n}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const headers = opts.assinado ? assinar(id, ts, body) : { "content-type": "application/json" };

  const r = await POST(
    new Request("http://local/api/webhooks/resend", { method: "POST", headers, body }),
  );
  return { status: r.status, json: await r.json().catch(() => null) };
}

/** Reenvia EXATAMENTE o mesmo corpo com uma nova assinatura (reentrega Svix). */
async function reenviar(payload: unknown) {
  return postar(payload);
}

function titulo(t: string) {
  console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`);
}

function eventoEmail(
  tipo: string,
  campos: {
    emailId: string;
    to: string;
    broadcastId?: string;
    ocorridoEm: string;
    bounce?: unknown;
  },
) {
  return {
    type: tipo,
    created_at: campos.ocorridoEm,
    data: {
      email_id: campos.emailId,
      created_at: campos.ocorridoEm,
      from: "Spinhardi Turismo <contato@spinharditurismo.com.br>",
      to: [campos.to],
      subject: "Fumaça do webhook (ignore)",
      ...(campos.broadcastId ? { broadcast_id: campos.broadcastId } : {}),
      ...(campos.bounce ? { bounce: campos.bounce } : {}),
    },
  };
}

async function main() {
  POST = (await import("@/app/api/webhooks/resend/route")).POST as unknown as Handler;
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const { criarCampanha, salvarConteudo, atualizar, congelarDestinatarios, getEventosDaCampanha } =
    await import("@/lib/campanhas");
  const sb = supabaseAdmin();

  titulo("0 · Preparar campanha e destinatários congelados");
  // O congelamento normalmente é feito pelo pipeline; aqui é chamado direto
  // porque a chave do Resend em produção é restrita a envio e não deixa criar
  // broadcast. A borda testada abaixo é a mesma dos dois jeitos.
  const campanha = await criarCampanha({
    nomeInterno: `Fumaça webhook — ${new Date().toISOString().slice(0, 16)}`,
    tipo: "newsletter",
    criadoPor: null,
  });
  await salvarConteudo(campanha.id, {
    assunto: "Fumaça do webhook",
    titulo: "teste",
    intro: null,
    corpo: "teste",
    ctaTexto: null,
    ctaLink: null,
    notaRodape: null,
    imagemPath: null,
    imagemAlt: null,
  });

  const BROADCAST = `bc_smoke_${Date.now()}`;
  await atualizar(campanha.id, {
    estado: "enviada",
    resendBroadcastId: BROADCAST,
    enviadoEm: new Date().toISOString(),
  });

  // Escolhe UM contato elegível real pro teste de supressão (β check 6).
  const { data: elegivel } = await sb
    .from("contatos_elegiveis_email")
    .select("id, name, email")
    .limit(1)
    .maybeSingle();
  const alvo = elegivel as { id: string; name: string; email: string } | null;
  if (!alvo) throw new Error("Nenhum contato elegível pra testar a supressão.");

  const { data: antes } = await sb
    .from("contacts")
    .select("email_marketing_status, email_marketing_status_em, email_marketing_status_origem")
    .eq("id", alvo.id)
    .single();
  const estadoAnterior = antes as {
    email_marketing_status: string;
    email_marketing_status_em: string | null;
    email_marketing_status_origem: string | null;
  };

  const mascara = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");
  console.log("campanha:", campanha.id);
  console.log("broadcast simulado:", BROADCAST);
  console.log("contato alvo:", alvo.id, mascara(alvo.email), "→", estadoAnterior);

  await congelarDestinatarios(campanha.id, [
    { contactId: alvo.id, email: alvo.email, nome: alvo.name },
    { contactId: null, email: "delivered@resend.dev", nome: "Teste — entrega" },
  ]);

  try {
    titulo("1 · Request SEM assinatura → 401 (β check 11a)");
    console.log(await postar({ type: "email.delivered", data: {} }, { assinado: false }));

    titulo("2 · Assinatura válida → 200 e grava (correlação por broadcast_id · Z1)");
    const entregue = eventoEmail("email.delivered", {
      emailId: "email_smoke_entregue",
      to: "delivered@resend.dev",
      broadcastId: BROADCAST,
      ocorridoEm: new Date().toISOString(),
    });
    console.log(await postar(entregue));

    titulo("3 · Reentrega do MESMO evento → sem linha duplicada (β check 11b)");
    console.log(await reenviar(entregue));

    titulo("4 · Correlação best-effort SEM broadcast_id (por e-mail + janela)");
    console.log(
      await postar(
        eventoEmail("email.opened", {
          emailId: "email_smoke_aberto",
          to: "delivered@resend.dev",
          ocorridoEm: new Date().toISOString(),
        }),
      ),
    );

    titulo("5 · Tipo desconhecido → gravado e fora da agregação (V2)");
    console.log(
      await postar({
        type: "email.inventado_pelo_resend",
        created_at: new Date().toISOString(),
        data: { email_id: "email_smoke_desconhecido", to: ["delivered@resend.dev"] },
      }),
    );

    titulo("6 · Bounce HARD → invalido + origem bounce (β check 6)");
    console.log(
      await postar(
        eventoEmail("email.bounced", {
          emailId: "email_smoke_bounce",
          to: alvo.email,
          broadcastId: BROADCAST,
          ocorridoEm: new Date().toISOString(),
          bounce: { type: "Permanent", subType: "General", message: "smoke test" },
        }),
      ),
    );

    const { data: depois } = await sb
      .from("contacts")
      .select("email_marketing_status, email_marketing_status_em, email_marketing_status_origem")
      .eq("id", alvo.id)
      .single();
    console.log("status depois:", depois);

    const { data: aindaElegivel } = await sb
      .from("contatos_elegiveis_email")
      .select("id")
      .eq("id", alvo.id)
      .maybeSingle();
    console.log("ainda aparece na view de elegíveis?", aindaElegivel ? "SIM (PROBLEMA)" : "não");

    titulo("7 · Soft bounce NÃO suprime (V5)");
    const { data: outro } = await sb
      .from("contatos_elegiveis_email")
      .select("id, name, email")
      .limit(1)
      .maybeSingle();
    const alvo2 = outro as { id: string; name: string; email: string } | null;
    if (alvo2) {
      await congelarDestinatarios(campanha.id, [
        { contactId: alvo2.id, email: alvo2.email, nome: alvo2.name },
      ]);
      await postar(
        eventoEmail("email.bounced", {
          emailId: "email_smoke_bounce_soft",
          to: alvo2.email,
          broadcastId: BROADCAST,
          ocorridoEm: new Date().toISOString(),
          bounce: { type: "Transient", subType: "MailboxFull", message: "smoke soft" },
        }),
      );
      const { data: d2 } = await sb
        .from("contacts")
        .select("email_marketing_status")
        .eq("id", alvo2.id)
        .single();
      console.log("contato do soft bounce:", mascara(alvo2.email), "→", d2);
    }

    titulo("8 · Eventos gravados na campanha");
    for (const e of await getEventosDaCampanha(campanha.id)) {
      console.log(`  ${e.tipo}  ·  ${e.resendEmailId}  ·  contato=${e.contactId ?? "—"}`);
    }

    titulo("9 · Métricas derivadas");
    const { getMetricas } = await import("@/lib/campanhas/metricas");
    console.log(await getMetricas(campanha.id));
  } finally {
    titulo("10 · RESTAURAR o contato usado no bounce (caminho de back-office, P3)");
    const { error } = await sb
      .from("contacts")
      .update({
        email_marketing_status: estadoAnterior.email_marketing_status,
        email_marketing_status_em: estadoAnterior.email_marketing_status_em,
        email_marketing_status_origem: estadoAnterior.email_marketing_status_origem,
      })
      .eq("id", alvo.id);
    const { data: restaurado } = await sb
      .from("contacts")
      .select("email_marketing_status, email_marketing_status_em, email_marketing_status_origem")
      .eq("id", alvo.id)
      .single();
    console.log(error ? `FALHOU: ${error.message}` : "restaurado:", restaurado);

    const { data: voltou } = await sb
      .from("contatos_elegiveis_email")
      .select("id")
      .eq("id", alvo.id)
      .maybeSingle();
    console.log("voltou pra view de elegíveis?", voltou ? "sim" : "NÃO (PROBLEMA)");
    console.log(`\n>>> CAMPANHA DA FUMAÇA DE WEBHOOK: ${campanha.id}\n`);
  }
}

main().catch((err) => {
  console.error("FUMAÇA DE WEBHOOK FALHOU:", err);
  process.exit(1);
});
