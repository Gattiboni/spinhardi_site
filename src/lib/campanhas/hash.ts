import "server-only";
import { createHash } from "node:crypto";
import { serializarConteudo } from "./conteudo";
import type { CampanhaConteudo } from "./types";

/**
 * `conteudo_hash` (C4). SHA-256 da serialização canônica, calculado **sempre no
 * servidor** — a tela nunca manda hash, manda conteúdo.
 *
 * A serialização vive no módulo puro (`conteudo.ts`) de propósito: se um dia
 * alguém quiser comparar hash no cliente, compara a MESMA string. O que não sai
 * daqui é o `node:crypto`.
 */
export function calcularConteudoHash(c: CampanhaConteudo): string {
  return createHash("sha256").update(serializarConteudo(c), "utf8").digest("hex");
}
