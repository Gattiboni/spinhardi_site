/**
 * Processor genérico do Iddas (fetchAllPages → mapper → upsert/insert) e a
 * tabela declarativa de recursos, lift verbatim de scripts/backfill-iddas.ts.
 * Globais do script viraram campos de `IddasCtx`.
 */

import type { SupabaseRest } from "../supabase-rest";
import type { IngestionSource, Logger, ResourceResult, RunError } from "../types";
import { buildMeta } from "../meta";
import type { IddasTransport } from "./transport";
import {
  type Mapper,
  mapCanal,
  mapSituacao,
  mapMotivoreprovacao,
  mapEtiqueta,
  mapUsuario,
  mapConta,
  mapCartao,
  mapCategoriaReceitasDespesas,
  mapAeroporto,
  mapCompanhia,
  mapPessoa,
  mapOrcamento,
  mapVenda,
  mapReceita,
  mapDespesa,
  mapTarefa,
  mapVoo,
  mapCruzeiro,
  mapHospedagem,
  mapSeguro,
  mapTransporte,
  mapSolicitacao,
  mapInfosolicitacao,
} from "./mappers";

export type IddasResource =
  | "canal"
  | "situacao"
  | "motivoreprovacao"
  | "etiqueta"
  | "usuario"
  | "conta"
  | "cartao"
  | "categoriareceitasdespesas"
  | "aeroporto"
  | "companhia"
  | "pessoa"
  | "orcamento"
  | "venda"
  | "receita"
  | "despesa"
  | "tarefa"
  | "voo"
  | "cruzeiro"
  | "hospedagem"
  | "seguro"
  | "transporte"
  | "solicitacao"
  | "infosolicitacao";

export interface IddasResourceSpec {
  resource: IddasResource;
  path: string;
  table: string;
  expected: number;
  mapper: Mapper;
  isSnapshot?: boolean;
}

/** Tabela de recursos na MESMA ordem/grupos da main() original. */
export const IDDAS_RESOURCES: IddasResourceSpec[] = [
  // Grupo 1: referência pequena
  { resource: "canal", path: "canal", table: "bronze_iddas_canal", expected: 9, mapper: mapCanal },
  { resource: "situacao", path: "situacao", table: "bronze_iddas_situacao", expected: 8, mapper: mapSituacao },
  { resource: "motivoreprovacao", path: "motivoreprovacao", table: "bronze_iddas_motivoreprovacao", expected: 8, mapper: mapMotivoreprovacao },
  { resource: "etiqueta", path: "etiqueta", table: "bronze_iddas_etiqueta", expected: 20, mapper: mapEtiqueta },
  { resource: "usuario", path: "usuario", table: "bronze_iddas_usuario", expected: 4, mapper: mapUsuario },
  { resource: "conta", path: "conta", table: "bronze_iddas_conta", expected: 2, mapper: mapConta },
  { resource: "cartao", path: "cartao", table: "bronze_iddas_cartao", expected: 7, mapper: mapCartao },
  { resource: "categoriareceitasdespesas", path: "categoriareceitasdespesas", table: "bronze_iddas_categoriareceitasdespesas", expected: 30, mapper: mapCategoriaReceitasDespesas },
  // Grupo 2: referência grande (paginada)
  { resource: "aeroporto", path: "aeroporto", table: "bronze_iddas_aeroporto", expected: 4564, mapper: mapAeroporto },
  { resource: "companhia", path: "companhia", table: "bronze_iddas_companhia", expected: 1018, mapper: mapCompanhia },
  // Grupo 3: núcleo
  { resource: "pessoa", path: "pessoa", table: "bronze_iddas_pessoa", expected: 838, mapper: mapPessoa },
  { resource: "orcamento", path: "orcamento", table: "bronze_iddas_orcamento", expected: 614, mapper: mapOrcamento },
  // Grupo 4: transacionais
  { resource: "venda", path: "venda", table: "bronze_iddas_venda", expected: 208, mapper: mapVenda },
  { resource: "receita", path: "receita", table: "bronze_iddas_receita", expected: 441, mapper: mapReceita },
  { resource: "despesa", path: "despesa", table: "bronze_iddas_despesa", expected: 327, mapper: mapDespesa },
  { resource: "tarefa", path: "tarefa", table: "bronze_iddas_tarefa", expected: 629, mapper: mapTarefa },
  { resource: "voo", path: "voo", table: "bronze_iddas_voo", expected: 387, mapper: mapVoo },
  // Grupo 5: sub-recursos de orcamento
  { resource: "cruzeiro", path: "cruzeiro", table: "bronze_iddas_cruzeiro", expected: 6, mapper: mapCruzeiro },
  { resource: "hospedagem", path: "hospedagem", table: "bronze_iddas_hospedagem", expected: 109, mapper: mapHospedagem },
  { resource: "seguro", path: "seguro", table: "bronze_iddas_seguro", expected: 3, mapper: mapSeguro },
  { resource: "transporte", path: "transporte", table: "bronze_iddas_transporte", expected: 11, mapper: mapTransporte },
  // Grupo 6: lead
  { resource: "solicitacao", path: "solicitacao", table: "bronze_iddas_solicitacao", expected: 9, mapper: mapSolicitacao },
  // Grupo 7: snapshot (INSERT puro, snapshot_id gerado pelo banco)
  { resource: "infosolicitacao", path: "infosolicitacao", table: "bronze_iddas_infosolicitacao", expected: 3, mapper: mapInfosolicitacao, isSnapshot: true },
];

export interface IddasCtx {
  runId: string;
  source: IngestionSource;
  dryRun: boolean;
  transport: IddasTransport;
  rest: SupabaseRest;
  logger: Logger;
  results: Record<string, ResourceResult>;
  runErrors: RunError[];
}

function recordResult(ctx: IddasCtx, resource: string, r: ResourceResult): void {
  ctx.results[resource] = r;
}

export async function fetchAndProcess(ctx: IddasCtx, spec: IddasResourceSpec): Promise<void> {
  const { resource, path, table, expected: expectedTotal, mapper, isSnapshot = false } = spec;
  ctx.logger.sep(`${resource} → ${table}`);
  const audit = buildMeta(ctx.runId, ctx.source);

  let items: unknown[];
  let total: number;
  let pages: number;

  try {
    const result = await ctx.transport.fetchAllPages(path);
    items = result.items;
    total = result.total;
    pages = result.pages;
  } catch (err) {
    const msg = `Falha ao buscar ${resource}: ${String(err)}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource, message: msg });
    recordResult(ctx, resource, { fetched: 0, mapped: 0, would_insert: 0, expected: expectedTotal });
    return;
  }

  if (ctx.source === "backfill" && expectedTotal > 0 && total !== expectedTotal) {
    ctx.logger.log(`BANDEIRA: esperado ${expectedTotal}, meta.total=${total}`);
    ctx.runErrors.push({
      resource,
      message: `total inesperado: ${total} (esperado ${expectedTotal})`,
    });
  }

  const rows: Record<string, unknown>[] = [];
  let mapFailures = 0;
  for (const item of items) {
    try {
      rows.push(mapper(item as Record<string, unknown>, audit));
    } catch (err) {
      mapFailures++;
      ctx.logger.verbose(`  Mapper falhou: ${String(err)}`);
    }
  }
  if (mapFailures > 0) {
    const msg = `${mapFailures} item(ns) falharam no mapper`;
    ctx.logger.log(`AVISO: ${msg}`);
    ctx.runErrors.push({ resource, message: msg });
  }

  ctx.logger.log(
    `API: ${items.length} fetchados (meta.total=${total}, esperado=${expectedTotal}) em ${pages} página(s)`,
  );
  recordResult(ctx, resource, {
    fetched: items.length,
    mapped: rows.length,
    would_insert: rows.length,
    pages,
    expected: expectedTotal,
    sample: rows[0],
  });

  if (ctx.dryRun) {
    ctx.logger.log(
      `[dry-run] ${rows.length} rows seriam ${isSnapshot ? "inseridas" : "upsertadas"} em ${table}`,
    );
    return;
  }

  const r = isSnapshot
    ? await ctx.rest.sbInsert(table, rows)
    : await ctx.rest.sbUpsert(table, rows, "id");

  if (r.error) {
    const msg = `Falha ao ${isSnapshot ? "inserir" : "upsert"} ${resource}: ${r.error}`;
    ctx.logger.log(`ERRO: ${msg}`);
    ctx.runErrors.push({ resource, message: msg });
  } else {
    ctx.logger.log(`${isSnapshot ? "Insert" : "Upsert"}: ${r.inserted} rows em ${table}`);
  }
  ctx.results[resource].actual_inserted = r.inserted;
}
