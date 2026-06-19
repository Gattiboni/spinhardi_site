-- ════════════════════════════════════════════════════════════════════════════
-- Funções de gap de CONTATOS — REGISTRO (Codinho Passo B / correções L3)
--
-- AUTORIA: Claudinho (lado-banco). Estas funções JÁ ESTÃO LIVES e validadas no
-- Supabase Spinhardi — gold_contatos_duplicados() = 48, gold_contatos_sem_iddas()
-- = 170. Este arquivo é só registro do que está no banco (igual gold_dashboard.sql);
-- NÃO precisa aplicar.
--
-- ⚠️ O corpo abaixo é RECONSTRUÍDO do contrato que o Claudinho passou (assinatura
-- + semântica + contagens). A definição AUTORITATIVA é a que está aplicada no
-- banco — se divergir em detalhe de implementação, vale a do banco. Claudinho:
-- cola aqui o source exato quando puder, pra virar registro fiel.
--
-- Contrato consumido pelo front (src/lib/contacts/index.ts):
--   • ambas retornam UMA coluna `id` (uuid) = id do contato.
--   • o front faz UMA chamada via supabase.rpc(): contagem do card = tamanho do
--     resultado; lista filtrada = contatos com esses ids. Mesma fonte (mata o
--     desync do #8). Conjunto já filtrado no Postgres, sem varredura no JS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Possíveis duplicados: contatos que dividem o mesmo telefone ──────────────
-- Detecção estrutural por whatsapp (só dígitos). Como só olha o telefone, salvar
-- estágio/follow-up/nota não muda a membresia.
create or replace function gold_contatos_duplicados()
returns table (id uuid)
language sql
stable
as $$
  with norm as (
    select id, regexp_replace(whatsapp, '\D', '', 'g') as digits
    from contacts
    where status = 'ativo'
  ),
  dups as (
    select digits
    from norm
    where digits <> ''
    group by digits
    having count(*) > 1
  )
  select n.id
  from norm n
  join dups d on d.digits = n.digits;
$$;

-- ── Sem cadastro no Iddas: tem ClickMassa, não tem Iddas ─────────────────────
-- Contato com vínculo clickmassa no contact_external_links e SEM vínculo iddas.
create or replace function gold_contatos_sem_iddas()
returns table (id uuid)
language sql
stable
as $$
  select c.id
  from contacts c
  where c.status = 'ativo'
    and exists (
      select 1 from contact_external_links l
      where l.contact_id = c.id and l.provider = 'clickmassa'
    )
    and not exists (
      select 1 from contact_external_links l
      where l.contact_id = c.id and l.provider = 'iddas'
    );
$$;
