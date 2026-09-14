/**
 * Otimização in-place das fotos de destino (lote GALERIA DE DESTINOS, E1).
 *
 * As fotos da Spinhardi chegam direto da câmera/celular: 4K, vários MB cada.
 * Nesse estado não podem ir pro repo — o `next/image` até serviria variantes
 * reduzidas em produção, mas o arquivo-fonte continuaria pesando no git e no
 * build. Este script normaliza os 9 arquivos antes do commit.
 *
 * O que faz, por arquivo:
 *   1. `.rotate()` ANTES do resize — aplica a orientação EXIF nos pixels e
 *      descarta a tag. Sem isso, foto retrato tirada no celular (orientation
 *      6 ou 8) seria redimensionada como paisagem e sairia deitada, porque o
 *      resize opera nos pixels crus, não na orientação declarada.
 *   2. Resize `fit: "inside"` em 2000x2000 com `withoutEnlargement` — limita o
 *      LADO MAIOR a 2000px sem upscale e sem precisar saber se é retrato ou
 *      paisagem (o "inside" resolve as duas orientações com um só par).
 *   3. JPEG qualidade 82 com mozjpeg quando disponível.
 *   4. Metadados descartados (default do sharp: só sobrevive o que se pede com
 *      `withMetadata()`, que aqui não é chamado). Some EXIF, GPS e thumbnail.
 *
 * Idempotência: antes de tocar no arquivo, mede as dimensões JÁ ORIENTADAS; se
 * o lado maior já é <= 2000, PULA. Rodar duas vezes não recomprime nada e não
 * degrada além da primeira passada.
 *
 * Teto de peso: meta de 600 KB por arquivo. Se algum passar disso com q82, só
 * ELE é reencodado a partir do ORIGINAL (não do resultado q82 — recomprimir
 * JPEG em cima de JPEG empilha artefato) com qualidade 78, e a tabela marca.
 *
 * --- DECISÕES LOCAIS (divergências do repo, ver relatório do lote) ---
 * - Extensão: o lote falava em `.jpg`; os arquivos no `public/` são `.jpeg`.
 *   O script aceita as duas e reporta qual achou, em vez de renomear — renomear
 *   está fora do escopo de escrita do lote.
 * - Runner: o lote mandava usar o mesmo de `beta-tags.ts` (`npx tsx`), mas
 *   `tsx` não está instalado e o lote proíbe instalar. Roda-se com o strip de
 *   tipos nativo do Node 22:
 *     node --experimental-strip-types scripts/otimizar-fotos-destinos.ts
 *   Sem dependência nova; `sharp` já vem junto com o Next.
 *
 * Escrita atômica: o sharp não pode ler e gravar o mesmo caminho na mesma
 * pipeline (corromperia a origem no meio da leitura). Grava-se num `.tmp` ao
 * lado e só então se renomeia por cima do original.
 */

import { readFile, writeFile, rename, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const LADO_MAIOR_MAX = 2000;
const QUALIDADE_PADRAO = 82;
const QUALIDADE_FALLBACK = 78;
const TETO_BYTES = 600 * 1024;

const SLUGS = ["argentina", "africa-do-sul", "portugal"];
const NUMEROS = ["01", "02", "03"];

const PUBLIC_DIR = path.join(process.cwd(), "public");

type Resultado = {
  arquivo: string;
  antesW: number;
  antesH: number;
  antesKB: number;
  depoisW: number;
  depoisH: number;
  depoisKB: number;
  qualidade: number | null;
  nota: string;
};

/**
 * Dimensões como o arquivo será VISTO depois de aplicada a orientação EXIF.
 *
 * `metadata.width/height` do sharp são os pixels crus. Nas orientações 5 a 8 a
 * imagem está girada 90 graus, então os lados trocam. É essa dimensão orientada
 * que importa pro teste de idempotência — e é a armadilha clássica aqui.
 */
function dimensoesOrientadas(metadata: sharp.Metadata): { largura: number; altura: number } {
  const largura = metadata.width ?? 0;
  const altura = metadata.height ?? 0;
  const orientacao = metadata.orientation ?? 1;
  const girada = orientacao >= 5 && orientacao <= 8;
  return girada ? { largura: altura, altura: largura } : { largura, altura };
}

/** Codifica o buffer de origem no destino, com resize e qualidade dados. */
async function codificar(origem: Buffer, destino: string, qualidade: number): Promise<void> {
  const tmp = `${destino}.tmp`;
  const saida = await sharp(origem)
    .rotate()
    .resize({
      width: LADO_MAIOR_MAX,
      height: LADO_MAIOR_MAX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: qualidade, mozjpeg: true })
    .toBuffer();

  await writeFile(tmp, saida);
  await rename(tmp, destino);
}

async function main(): Promise<void> {
  // 1. Localiza os 9 arquivos. Aceita .jpg e .jpeg; para tudo se faltar algum.
  const alvos: { nome: string; caminho: string }[] = [];
  const faltando: string[] = [];

  for (const slug of SLUGS) {
    for (const numero of NUMEROS) {
      const base = `destino-${slug}-${numero}`;
      const candidatos = [`${base}.jpg`, `${base}.jpeg`];
      const achado = candidatos.find((nome) => existsSync(path.join(PUBLIC_DIR, nome)));

      if (achado) {
        alvos.push({ nome: achado, caminho: path.join(PUBLIC_DIR, achado) });
      } else {
        faltando.push(`${base}.jpg (ou .jpeg)`);
      }
    }
  }

  if (faltando.length > 0) {
    console.error(`FALTAM ${faltando.length} arquivo(s) em public/:`);
    for (const nome of faltando) console.error(`  - ${nome}`);
    process.exitCode = 1;
    return;
  }

  console.log(`sharp ${sharp.versions.sharp} | mozjpeg: ${sharp.format.jpeg.output.buffer}`);
  console.log(`${alvos.length} arquivos encontrados em public/\n`);

  const resultados: Resultado[] = [];

  for (const alvo of alvos) {
    const original = await readFile(alvo.caminho);
    const antesBytes = original.length;
    const antes = dimensoesOrientadas(await sharp(original).metadata());

    // Idempotência: lado maior já dentro do teto => não encosta no arquivo.
    if (Math.max(antes.largura, antes.altura) <= LADO_MAIOR_MAX) {
      const kb = Math.round(antesBytes / 1024);
      resultados.push({
        arquivo: alvo.nome,
        antesW: antes.largura,
        antesH: antes.altura,
        antesKB: kb,
        depoisW: antes.largura,
        depoisH: antes.altura,
        depoisKB: kb,
        qualidade: null,
        nota: "pulado (ja <= 2000px)",
      });
      continue;
    }

    await codificar(original, alvo.caminho, QUALIDADE_PADRAO);
    let qualidade = QUALIDADE_PADRAO;
    let nota = "";
    let depoisBytes = (await stat(alvo.caminho)).size;

    // Acima do teto: reencoda ESTE arquivo a partir do original, q78.
    if (depoisBytes > TETO_BYTES) {
      await codificar(original, alvo.caminho, QUALIDADE_FALLBACK);
      qualidade = QUALIDADE_FALLBACK;
      depoisBytes = (await stat(alvo.caminho)).size;
      nota = depoisBytes > TETO_BYTES ? "AINDA > 600 KB" : "q78 (q82 passou de 600 KB)";
    }

    const depois = dimensoesOrientadas(await sharp(await readFile(alvo.caminho)).metadata());

    resultados.push({
      arquivo: alvo.nome,
      antesW: antes.largura,
      antesH: antes.altura,
      antesKB: Math.round(antesBytes / 1024),
      depoisW: depois.largura,
      depoisH: depois.altura,
      depoisKB: Math.round(depoisBytes / 1024),
      qualidade,
      nota,
    });
  }

  // Limpeza de .tmp remanescente de execução interrompida.
  for (const alvo of alvos) {
    const tmp = `${alvo.caminho}.tmp`;
    if (existsSync(tmp)) await unlink(tmp);
  }

  // 2. Tabela antes/depois.
  const col = (texto: string, largura: number) => texto.padEnd(largura);
  const regua = "-".repeat(96);

  console.log(regua);
  console.log(
    col("arquivo", 30) + col("antes", 22) + col("depois", 22) + col("q", 5) + col("nota", 17),
  );
  console.log(regua);

  for (const r of resultados) {
    console.log(
      col(r.arquivo, 30) +
        col(`${r.antesW}x${r.antesH}  ${r.antesKB} KB`, 22) +
        col(`${r.depoisW}x${r.depoisH}  ${r.depoisKB} KB`, 22) +
        col(r.qualidade === null ? "-" : String(r.qualidade), 5) +
        col(r.nota, 17),
    );
  }
  console.log(regua);

  const totalAntes = resultados.reduce((soma, r) => soma + r.antesKB, 0);
  const totalDepois = resultados.reduce((soma, r) => soma + r.depoisKB, 0);
  console.log(
    `total: ${totalAntes} KB -> ${totalDepois} KB ` +
      `(-${Math.round((1 - totalDepois / totalAntes) * 100)}%)`,
  );

  const retratos = resultados.filter((r) => r.depoisH > r.depoisW).map((r) => r.arquivo);
  console.log(`retrato apos o script: ${retratos.length > 0 ? retratos.join(", ") : "nenhum"}`);

  const acimaDoTeto = resultados.filter((r) => r.depoisKB * 1024 > TETO_BYTES);
  if (acimaDoTeto.length > 0) {
    console.log(`ACIMA DE 600 KB: ${acimaDoTeto.map((r) => r.arquivo).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("OK: nenhum arquivo acima de 600 KB.");
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
