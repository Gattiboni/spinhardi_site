import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getNegociosByContact } from "@/lib/financeiro";
import type { Negocio } from "@/lib/financeiro/types";

/**
 * Resumo comercial/financeiro do contato — DUAS fontes lidas juntas, com
 * proveniência visível (Iddas vs manual).
 *
 *  - Iddas (bronze, já populado): orçamentos e vendas do contato, ligados pela
 *    cadeia do D058 — `orcamento.cliente -> pessoa.id` e
 *    `venda.id_orcamento -> orcamento.id`. `venda.cliente` é nome denormalizado,
 *    NÃO é FK, e não é usado pra ligar. `orcamento.situacao` é código; o orçamento
 *    já traz `nome_situacao` denormalizado, então usamos esse rótulo direto. A
 *    venda só tem o código, resolvido contra `bronze_iddas_situacao.codigo`.
 *  - Manual: a silver `negocios` por `contact_id` (a mesma que o FinanceiroForm
 *    grava), via o módulo `financeiro`.
 *
 * Server-only, lê bronze via `supabaseAdmin` — mesmo padrão do `dashboard/gold.ts`.
 * O componente de apresentação NUNCA toca bronze. Cada leitura degrada pra vazio
 * em caso de erro (try/catch): o card não quebra a página, fica sem dado.
 */

export type IddasOrcamentoResumo = {
  id: string;
  titulo: string | null;
  situacaoCodigo: string | null;
  situacaoLabel: string | null;
  valor: number | null;
  data: string | null; // data_orcamento (ISO)
};

export type IddasVendaResumo = {
  id: string;
  idOrcamento: string | null;
  situacaoCodigo: string | null;
  situacaoLabel: string | null;
  valor: number | null; // venda.venda
  data: string | null;
};

export type ContactComercial = {
  temPessoaIddas: boolean;
  iddas: {
    orcamentos: IddasOrcamentoResumo[];
    vendas: IddasVendaResumo[];
    totalOrcado: number; // soma de orcamento.valor
    totalVendas: number; // soma de venda.venda
  };
  manual: {
    negocios: Negocio[];
    totalVenda: number; // soma de negocios.venda
    totalLucro: number; // soma de negocios.lucro
  };
};

/** numeric do PostgREST pode chegar como string; normaliza pra number|null. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function somaValores(items: { valor: number | null }[]): number {
  return items.reduce((acc, it) => acc + (it.valor ?? 0), 0);
}

const IDDAS_VAZIO: ContactComercial["iddas"] = {
  orcamentos: [],
  vendas: [],
  totalOrcado: 0,
  totalVendas: 0,
};

async function getIddasComercial(
  pessoaId: string | null,
): Promise<ContactComercial["iddas"]> {
  if (!pessoaId) return IDDAS_VAZIO;

  try {
    const sb = supabaseAdmin();

    // Orçamentos do contato: cliente = iddas_pessoa_id (D058).
    const { data: orcData, error: orcErr } = await sb
      .from("bronze_iddas_orcamento")
      .select("id, titulo, situacao, nome_situacao, valor, data_orcamento")
      .eq("cliente", pessoaId)
      .order("data_orcamento", { ascending: false, nullsFirst: false });
    if (orcErr) throw orcErr;

    const orcRows = (orcData ?? []) as {
      id: string;
      titulo: string | null;
      situacao: string | null;
      nome_situacao: string | null;
      valor: unknown;
      data_orcamento: string | null;
    }[];

    const orcamentos: IddasOrcamentoResumo[] = orcRows.map((o) => ({
      id: o.id,
      titulo: o.titulo,
      situacaoCodigo: o.situacao,
      situacaoLabel: o.nome_situacao ?? o.situacao,
      valor: num(o.valor),
      data: o.data_orcamento,
    }));

    const orcIds = orcamentos.map((o) => o.id);

    // Vendas: venda.id_orcamento dentro dos orçamentos daquele cliente (D058).
    // Sem orçamentos não há venda atribuível — não liga no chute.
    let vendas: IddasVendaResumo[] = [];
    if (orcIds.length > 0) {
      const { data: vendaData, error: vendaErr } = await sb
        .from("bronze_iddas_venda")
        .select("id, id_orcamento, situacao, venda, data")
        .in("id_orcamento", orcIds)
        .order("data", { ascending: false, nullsFirst: false });
      if (vendaErr) throw vendaErr;

      const vendaRows = (vendaData ?? []) as {
        id: string;
        id_orcamento: string | null;
        situacao: string | null;
        venda: unknown;
        data: string | null;
      }[];

      // Rótulo legível da situação da venda: resolve código -> nome contra a
      // tabela situacao (codigo). São ~8 linhas; um SELECT só, mapa em memória.
      const sitMap = new Map<string, string>();
      const codigos = [...new Set(vendaRows.map((v) => v.situacao).filter((c): c is string => !!c))];
      if (codigos.length > 0) {
        const { data: sitData } = await sb
          .from("bronze_iddas_situacao")
          .select("codigo, nome")
          .in("codigo", codigos);
        for (const s of (sitData ?? []) as { codigo: string | null; nome: string | null }[]) {
          if (s.codigo && s.nome) sitMap.set(s.codigo, s.nome);
        }
      }

      vendas = vendaRows.map((v) => ({
        id: v.id,
        idOrcamento: v.id_orcamento,
        situacaoCodigo: v.situacao,
        situacaoLabel: (v.situacao && sitMap.get(v.situacao)) ?? v.situacao,
        valor: num(v.venda),
        data: v.data,
      }));
    }

    return {
      orcamentos,
      vendas,
      totalOrcado: somaValores(orcamentos),
      totalVendas: somaValores(vendas),
    };
  } catch (err) {
    console.error("[comercial] getIddasComercial:", err);
    return IDDAS_VAZIO;
  }
}

async function getManualComercial(
  contactId: string,
): Promise<ContactComercial["manual"]> {
  try {
    const negocios = await getNegociosByContact(contactId);
    return {
      negocios,
      totalVenda: negocios.reduce((acc, n) => acc + (n.venda ?? 0), 0),
      totalLucro: negocios.reduce((acc, n) => acc + (n.lucro ?? 0), 0),
    };
  } catch (err) {
    console.error("[comercial] getManualComercial:", err);
    return { negocios: [], totalVenda: 0, totalLucro: 0 };
  }
}

export async function getContactComercial(
  contactId: string,
  iddasPessoaId: string | null,
): Promise<ContactComercial> {
  const [iddas, manual] = await Promise.all([
    getIddasComercial(iddasPessoaId),
    getManualComercial(contactId),
  ]);

  return {
    temPessoaIddas: !!iddasPessoaId,
    iddas,
    manual,
  };
}
