// scripts/probe-clickmassa-opportunities.mjs
// Probe READ-ONLY do endpoint externo de Opportunities do ClickMassa.
// Diagnostica o 404 ERR_CONTACT_PIPELINE_NOT_FOUND. Só GET, nada de escrita.
// Descartável: nao commitar.

import { readFileSync } from "node:fs";

// carrega .env.local na mao (sem dep nova), so as chaves que interessam
function loadEnv(path = ".env.local") {
  const env = {};
  try {
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  } catch (e) {
    console.error(`Nao consegui ler ${path}:`, e.message);
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const BASE = (env.CLICKMASSA_API_URL || "").replace(/\/$/, ""); // ja tem o apiId
const KEY = env.CLICKMASSA_API_KEY;

if (!BASE || !KEY) {
  console.error("Faltou CLICKMASSA_API_URL ou CLICKMASSA_API_KEY no .env.local");
  process.exit(1);
}

// header de auth: confirmar no passo 2 contra o client real; ajustar se diferir
const HEADERS = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

function safeUrl(suffix) {
  return `${BASE}${suffix}`; // BASE nao contem a KEY, pode logar
}

async function probe(label, suffix) {
  const url = safeUrl(suffix);
  console.log(`\n==== ${label} ====`);
  console.log(`GET ${url}`);
  try {
    const res = await fetch(url, { method: "GET", headers: HEADERS });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    console.log(`status: ${res.status} ${res.statusText}  content-type: ${ct}`);
    const pretty =
      typeof body === "string" ? body : JSON.stringify(body, null, 2);
    console.log(
      "body:",
      pretty.length > 2000 ? pretty.slice(0, 2000) + "\n...[truncado]" : pretty,
    );
    return { status: res.status, body };
  } catch (e) {
    console.log("erro de rede/fetch:", e.message);
    return { status: 0, body: null };
  }
}

const main = async () => {
  // 1. pipeline-steps: existe pipeline com etapas pela otica externa?
  const steps = await probe("1. pipeline-steps", "/pipeline-steps");

  // 2. opportunities cru: reproduz o erro
  await probe("2. opportunities (sem param)", "/opportunities");

  // 3. se pipeline-steps trouxe id de etapa, escopar por ela
  let firstStepId = null;
  const data = steps?.body?.data ?? steps?.body;
  if (Array.isArray(data) && data.length > 0 && data[0]?.id != null) {
    firstStepId = data[0].id;
  }
  if (firstStepId != null) {
    await probe(
      `3. opportunities?pipelineStepId=${firstStepId}`,
      `/opportunities?pipelineStepId=${firstStepId}`,
    );
  } else {
    console.log(
      "\n==== 3. opportunities?pipelineStepId ====\npulado: pipeline-steps nao devolveu etapa com id",
    );
  }

  // 4. tiro barato: escopar por pipelineId
  await probe("4. opportunities?pipelineId=1", "/opportunities?pipelineId=1");

  console.log("\n==== fim do probe ====");
};

main();
