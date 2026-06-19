-- ════════════════════════════════════════════════════════════════════════════
-- Gold gerencial do dashboard (Codinho Passo B / L3)
--
-- APLICAÇÃO MANUAL (SQL é do Alan). Rodar no SQL editor do Supabase do projeto
-- Spinhardi. Idempotente (CREATE OR REPLACE). Sem isto, o dashboard degrada pra
-- zeros — não quebra, mas os cards financeiros e o funil ficam vazios.
--
-- Princípio (lição do L2): contagem e soma NASCEM em SQL. O front nunca puxa
-- linha pra somar no JS — o teto de 1000 do PostgREST inflaria o número quando a
-- base crescer. Estas funções agregam no Postgres e devolvem só o resultado.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Resumo financeiro de um período ──────────────────────────────────────────
-- Faturamento (soma de `venda`) + nº de vendas (contagem), unindo a fonte Iddas
-- (bronze_iddas_venda) com os negócios manuais (negocios, origem_dado='manual').
-- Período [p_inicio, p_fim] inclusive sobre a coluna `data`; NULL = sem limite
-- naquele lado (passar (NULL, NULL) = "tudo"). Ticket médio é derivado no front
-- (faturamento / vendas) — divisão de dois escalares, não varredura de linhas.
create or replace function gold_iddas_financeiro_resumo(
  p_inicio date default null,
  p_fim date default null
)
returns table (faturamento numeric, vendas bigint)
language sql
stable
as $$
  with vendas_periodo as (
    select venda, data
    from bronze_iddas_venda
    where venda is not null
      and (p_inicio is null or data >= p_inicio)
      and (p_fim is null or data <= p_fim)
    union all
    select venda, data
    from negocios
    where origem_dado = 'manual'
      and venda is not null
      and (p_inicio is null or data >= p_inicio)
      and (p_fim is null or data <= p_fim)
  )
  select
    coalesce(sum(venda), 0)::numeric as faturamento,
    count(*)::bigint as vendas
  from vendas_periodo;
$$;

-- ── Distribuição do funil interno por estágio ────────────────────────────────
-- Conta contatos ativos agrupados por `estagio`. Hoje nasce degenerado (todos
-- 'novo'), mas a estrutura popula sozinha conforme a Nina trabalha os leads.
create or replace function gold_funil_por_estagio()
returns table (estagio text, total bigint)
language sql
stable
as $$
  select estagio::text, count(*)::bigint as total
  from contacts
  where status = 'ativo'
  group by estagio;
$$;
