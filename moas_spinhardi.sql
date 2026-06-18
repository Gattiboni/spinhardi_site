-- =====================================================================
-- MOAS Spinhardi v2 — Auto-descoberta TOTAL (zero hardcoding)
-- =====================================================================
-- Princípio: o MOAS NÃO sabe o que existe no banco. Ele DESCOBRE.
--
-- Como usar:
--   1. Cola TUDO no SQL Editor do Supabase
--   2. Run (executa múltiplos statements sequencialmente)
--   3. O resultado do último SELECT vai aparecer
--   4. Export to CSV
--   5. Manda pro Claudinho
--
-- Mecanismo:
--   - Temp table session-scoped acumula o resultado
--   - Seções 00-13, 17 são SELECTs SQL puros sobre catálogos
--   - Seções 14 (counts), 15 (distribution em CHECK), 16 (samples)
--     usam DO block com EXECUTE format() pra iterar sobre tabelas e
--     colunas descobertas em runtime
--   - Cada loop tem EXCEPTION handler: se uma tabela/coluna falhar,
--     registra o erro mas continua o resto
--   - Não modifica o schema nem dados, só temp table de sessão
-- =====================================================================

-- ---------------------------------------------------------------------
-- SETUP: temp table de sessão pra acumular resultado
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS moas_result;
CREATE TEMP TABLE moas_result (
  section text,
  row_num int,
  data jsonb
);

-- ---------------------------------------------------------------------
-- 00: IDENTIDADE DO AMBIENTE
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '00_identidade',
  1,
  jsonb_build_object(
    'ts_now', now(),
    'moas_run_date', current_date,
    'db', current_database(),
    'current_user', current_user,
    'current_schema', current_schema(),
    'server_addr', inet_server_addr()::text,
    'server_port', inet_server_port(),
    'server_version_full', version()
  );

-- ---------------------------------------------------------------------
-- 01: SCHEMAS DO PROJETO
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '01_schemas',
  ROW_NUMBER() OVER (ORDER BY schema_name)::int,
  jsonb_build_object(
    'schema_name', schema_name,
    'schema_owner', schema_owner,
    'i_have_usage', i_have_usage,
    'i_have_create', i_have_create
  )
FROM (
  SELECT
    schema_name,
    schema_owner,
    has_schema_privilege(current_user, schema_name, 'USAGE') AS i_have_usage,
    has_schema_privilege(current_user, schema_name, 'CREATE') AS i_have_create
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND schema_name NOT LIKE 'pg_temp%'
    AND schema_name NOT LIKE 'pg_toast_temp%'
) s;

-- ---------------------------------------------------------------------
-- 02: INVENTÁRIO DE TABELAS NO PUBLIC
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '02_tables_public',
  ROW_NUMBER() OVER (ORDER BY table_name)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'object_type', object_type,
    'total_size', total_size,
    'heap_size', heap_size,
    'indexes_size', indexes_size,
    'estimated_rows', estimated_rows,
    'owner', owner
  )
FROM (
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized_view'
      WHEN 'f' THEN 'foreign_table'
    END AS object_type,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
    c.reltuples::bigint AS estimated_rows,
    pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'v', 'm', 'f')
) s;

-- ---------------------------------------------------------------------
-- 03: TODAS AS COLUNAS DE TODAS AS TABELAS NO PUBLIC
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '03_columns',
  ROW_NUMBER() OVER (ORDER BY table_name, ordinal_position)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'ordinal_position', ordinal_position,
    'column_name', column_name,
    'data_type', data_type,
    'character_maximum_length', character_maximum_length,
    'is_nullable', is_nullable,
    'column_default', column_default
  )
FROM information_schema.columns
WHERE table_schema = 'public';

-- ---------------------------------------------------------------------
-- 04: CONSTRAINTS PK / FK / UNIQUE
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '04_constraints_basic',
  ROW_NUMBER() OVER (ORDER BY table_name, constraint_type, constraint_name)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'constraint_name', constraint_name,
    'constraint_type', constraint_type,
    'column_name', column_name
  )
FROM (
  SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
) s;

-- ---------------------------------------------------------------------
-- 05: CHECK CONSTRAINTS COM CLÁUSULA COMPLETA (crítico)
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '05_check_constraints',
  ROW_NUMBER() OVER (ORDER BY table_name, constraint_name)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'constraint_name', constraint_name,
    'constraint_definition', constraint_definition
  )
FROM (
  SELECT
    n.nspname AS table_schema,
    cl.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'c'
) s;

-- ---------------------------------------------------------------------
-- 06: FOREIGN KEYS DETALHADAS
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '06_foreign_keys',
  ROW_NUMBER() OVER (ORDER BY from_table, from_column)::int,
  jsonb_build_object(
    'from_schema', from_schema,
    'from_table', from_table,
    'from_column', from_column,
    'to_schema', to_schema,
    'to_table', to_table,
    'to_column', to_column,
    'constraint_name', constraint_name
  )
FROM (
  SELECT
    tc.table_schema AS from_schema,
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_schema AS to_schema,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
) s;

-- ---------------------------------------------------------------------
-- 07: ÍNDICES
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '07_indexes',
  ROW_NUMBER() OVER (ORDER BY tablename, indexname)::int,
  jsonb_build_object(
    'table_schema', schemaname,
    'table_name', tablename,
    'index_name', indexname,
    'index_definition', indexdef
  )
FROM pg_indexes
WHERE schemaname = 'public';

-- ---------------------------------------------------------------------
-- 08: SEQUÊNCIAS
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '08_sequences',
  ROW_NUMBER() OVER (ORDER BY sequence_name)::int,
  jsonb_build_object(
    'sequence_schema', sequence_schema,
    'sequence_name', sequence_name,
    'data_type', data_type,
    'start_value', start_value,
    'minimum_value', minimum_value,
    'maximum_value', maximum_value,
    'increment', increment,
    'cycle_option', cycle_option
  )
FROM information_schema.sequences
WHERE sequence_schema = 'public';

-- ---------------------------------------------------------------------
-- 09: RLS — POLÍTICAS POR TABELA
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '09_rls_policies',
  ROW_NUMBER() OVER (ORDER BY tablename, policyname)::int,
  jsonb_build_object(
    'table_schema', schemaname,
    'table_name', tablename,
    'policy_name', policyname,
    'permissive', permissive,
    'roles', roles::text,
    'command', cmd,
    'using_expression', qual,
    'with_check_expression', with_check
  )
FROM pg_policies
WHERE schemaname = 'public';

-- ---------------------------------------------------------------------
-- 10: RLS — STATUS DE ENABLE POR TABELA
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '10_rls_enabled',
  ROW_NUMBER() OVER (ORDER BY table_name)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'rls_enabled', rls_enabled,
    'rls_forced', rls_forced
  )
FROM (
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
) s;

-- ---------------------------------------------------------------------
-- 11: TRIGGERS
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '11_triggers',
  ROW_NUMBER() OVER (ORDER BY event_object_table, trigger_name)::int,
  jsonb_build_object(
    'table_schema', event_object_schema,
    'table_name', event_object_table,
    'trigger_name', trigger_name,
    'action_timing', action_timing,
    'event', event_manipulation,
    'action_statement', action_statement
  )
FROM information_schema.triggers
WHERE event_object_schema = 'public';

-- ---------------------------------------------------------------------
-- 12: FUNÇÕES CUSTOM NO PUBLIC
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '12_functions',
  ROW_NUMBER() OVER (ORDER BY function_name)::int,
  jsonb_build_object(
    'schema_name', schema_name,
    'function_name', function_name,
    'arguments', arguments,
    'return_type', return_type,
    'language', language,
    'security_definer', security_definer
  )
FROM (
  SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    l.lanname AS language,
    p.prosecdef AS security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
) s;

-- ---------------------------------------------------------------------
-- 13: COMENTÁRIOS EM TABELAS E COLUNAS
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '13_comments',
  ROW_NUMBER() OVER (ORDER BY table_name, column_name NULLS FIRST)::int,
  jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'column_name', column_name,
    'comment_target', comment_target,
    'comment', comment_text
  )
FROM (
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    CASE WHEN a.attname IS NULL THEN 'table' ELSE 'column' END AS comment_target,
    COALESCE(col_description(c.oid, a.attnum), obj_description(c.oid)) AS comment_text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (obj_description(c.oid) IS NOT NULL OR col_description(c.oid, a.attnum) IS NOT NULL)
) s;

-- ---------------------------------------------------------------------
-- 17: AUDITORIA DE COLUNAS DE FONTES EXTERNAS (auto-descoberto em TODO public)
-- ---------------------------------------------------------------------
INSERT INTO moas_result
SELECT
  '17_external_fields_audit',
  ROW_NUMBER() OVER (ORDER BY table_name, column_name)::int,
  jsonb_build_object(
    'table_name', table_name,
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable,
    'column_default', column_default
  )
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name LIKE 'clickmassa_%'
    OR column_name LIKE 'iddas_%'
    OR column_name LIKE 'sanity_%'
    OR column_name LIKE 'resend_%'
    OR column_name LIKE 'make_%'
    OR column_name LIKE 'bronze_%'
    OR column_name LIKE 'silver_%'
    OR column_name LIKE 'gold_%'
    OR column_name LIKE 'source_%'
  );

-- =====================================================================
-- BLOCO DINÂMICO: seções 14, 15, 16 (auto-descoberta de tabelas/colunas)
-- =====================================================================
DO $$
DECLARE
  r RECORD;
  sub RECORD;
  cnt bigint;
  sample_json jsonb;
  rownum int;
  query_text text;
BEGIN

  -- -------------------------------------------------------------------
  -- 14: ROW COUNTS REAIS (varre TODAS as tabelas public)
  -- -------------------------------------------------------------------
  rownum := 0;
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', r.table_name) INTO cnt;
      rownum := rownum + 1;
      INSERT INTO moas_result VALUES (
        '14_row_counts',
        rownum,
        jsonb_build_object('table_name', r.table_name, 'row_count', cnt)
      );
    EXCEPTION WHEN OTHERS THEN
      rownum := rownum + 1;
      INSERT INTO moas_result VALUES (
        '14_row_counts',
        rownum,
        jsonb_build_object('table_name', r.table_name, 'row_count', NULL, 'error', SQLERRM)
      );
    END;
  END LOOP;

  -- -------------------------------------------------------------------
  -- 15: DISTRIBUIÇÃO DE VALORES EM COLUNAS COM CHECK CONSTRAINT
  -- Auto-descoberto: pega TODAS as colunas single-column em CHECK
  -- constraints no schema public, e roda distribution top-50 por valor
  -- -------------------------------------------------------------------
  rownum := 0;
  FOR r IN
    SELECT DISTINCT
      cl.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE n.nspname = 'public'
      AND con.contype = 'c'
      AND array_length(con.conkey, 1) = 1
      AND cl.relkind = 'r'
    ORDER BY cl.relname, a.attname
  LOOP
    BEGIN
      query_text := format(
        'SELECT %I::text AS value, COUNT(*) AS cnt FROM public.%I WHERE %I IS NOT NULL GROUP BY %I ORDER BY cnt DESC LIMIT 50',
        r.column_name, r.table_name, r.column_name, r.column_name
      );
      FOR sub IN EXECUTE query_text LOOP
        rownum := rownum + 1;
        INSERT INTO moas_result VALUES (
          '15_check_field_distribution',
          rownum,
          jsonb_build_object(
            'table_name', r.table_name,
            'column_name', r.column_name,
            'value', sub.value,
            'count', sub.cnt
          )
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      rownum := rownum + 1;
      INSERT INTO moas_result VALUES (
        '15_check_field_distribution',
        rownum,
        jsonb_build_object(
          'table_name', r.table_name,
          'column_name', r.column_name,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;

  -- -------------------------------------------------------------------
  -- 16: SAMPLE DE 1 LINHA POR TABELA (auto-descoberto)
  -- -------------------------------------------------------------------
  rownum := 0;
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'SELECT row_to_json(t)::jsonb FROM (SELECT * FROM public.%I LIMIT 1) t',
        r.table_name
      ) INTO sample_json;
      rownum := rownum + 1;
      INSERT INTO moas_result VALUES (
        '16_sample_rows',
        rownum,
        jsonb_build_object('source', r.table_name, 'sample', sample_json)
      );
    EXCEPTION WHEN OTHERS THEN
      rownum := rownum + 1;
      INSERT INTO moas_result VALUES (
        '16_sample_rows',
        rownum,
        jsonb_build_object('source', r.table_name, 'sample', NULL, 'error', SQLERRM)
      );
    END;
  END LOOP;

END $$;

-- =====================================================================
-- OUTPUT FINAL: resultado consolidado ordenado
-- =====================================================================
SELECT section, row_num, data
FROM moas_result
ORDER BY section, row_num;
