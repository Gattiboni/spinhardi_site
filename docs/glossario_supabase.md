| glossario_markdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| # Glossário Supabase - schema `public`

Gerado em: 2026-06-18 03:16:27 (BRT)\n\n---

## Sumário de Tabelas

- `capture_origins`
- `contact_interactions`
- `contacts`
- `tags`
- `user_profiles`

---

## Detalhamento por Tabela

### `capture_origins`

**Colunas**

- `id` uuid NOT NULL default `gen_random_uuid()`
- `name` text NOT NULL
- `slug` text NOT NULL
- `descricao` text NULL
- `is_active` boolean NOT NULL default `true`
- `campanha_ativa` boolean NOT NULL default `false`
- `created_at` timestamp with time zone NOT NULL default `now()`
- `updated_at` timestamp with time zone NOT NULL default `now()`

**Constraints**

- **PRIMARY KEY** `capture_origins_pkey`: PRIMARY KEY (id)
- **UNIQUE** `capture_origins_slug_key`: UNIQUE (slug)

**Indexes**

- `capture_origins_pkey`: `CREATE UNIQUE INDEX capture_origins_pkey ON public.capture_origins USING btree (id)`
- `capture_origins_slug_key`: `CREATE UNIQUE INDEX capture_origins_slug_key ON public.capture_origins USING btree (slug)`

**RLS**: habilitado

**Policies**

- `authenticated can read capture_origins` (SELECT, roles: authenticated)
  - USING: `true`

**Triggers**

- `touch_capture_origins_updated_at` (BEFORE UPDATE): `EXECUTE FUNCTION touch_updated_at()`


---

### `contact_interactions`

**Colunas**

- `id` uuid NOT NULL default `gen_random_uuid()`
- `contact_id` uuid NOT NULL
- `tipo` text NOT NULL
- `descricao` text NOT NULL
- `metadata` jsonb NOT NULL default `'{}'::jsonb`
- `criado_por` text NOT NULL
- `criado_em` timestamp with time zone NOT NULL default `now()`

**Constraints**

- **CHECK** `contact_interactions_tipo_check`: CHECK ((tipo = ANY (ARRAY['form_submission'::text, 'whatsapp_recebido'::text, 'whatsapp_enviado'::text, 'email_recebido'::text, 'email_enviado'::text, 'ligacao'::text, 'reuniao'::text, 'nota_interna'::text, 'mudanca_estagio'::text, 'sync_iddas'::text, 'sync_clickmassa'::text, 'tag_adicionada'::text, 'tag_removida'::text])))
- **FOREIGN KEY** `contact_interactions_contact_id_fkey`: FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
- **PRIMARY KEY** `contact_interactions_pkey`: PRIMARY KEY (id)

**Indexes**

- `contact_interactions_pkey`: `CREATE UNIQUE INDEX contact_interactions_pkey ON public.contact_interactions USING btree (id)`
- `idx_interactions_contact_timeline`: `CREATE INDEX idx_interactions_contact_timeline ON public.contact_interactions USING btree (contact_id, criado_em)`

**RLS**: habilitado

**Policies**

- `authenticated_all_interactions` (ALL, roles: authenticated)
  - USING: `true`
  - WITH CHECK: `true`


---

### `contacts`

**Colunas**

- `id` uuid NOT NULL default `gen_random_uuid()`
- `created_at` timestamp with time zone NOT NULL default `now()`
- `updated_at` timestamp with time zone NOT NULL default `now()`
- `name` text NOT NULL
- `whatsapp` text NOT NULL
- `email` text NULL
- `cpf` text NULL
- `data_nascimento` date NULL
- `nacionalidade` text NOT NULL default `'Brasileira'::text`
- `cep` text NULL
- `cidade` text NULL
- `estado` text NULL
- `pais` text NOT NULL default `'Brasil'::text`
- `origem` text NOT NULL
- `origem_detalhe` text NULL
- `destino_tipo` text NOT NULL
- `destino_texto` text NULL
- `orcamento_estimado` text NOT NULL
- `prazo_ideal` text NOT NULL
- `data_ida` date NULL
- `data_volta` date NULL
- `passageiros_adultos` integer NOT NULL default `1`
- `passageiros_criancas` integer NOT NULL default `0`
- `passageiros_bebes` integer NOT NULL default `0`
- `perfil_viajante` text NOT NULL
- `experiencia_anterior` text NULL
- `restricoes` text NULL
- `estagio` text NOT NULL
- `estagio_atualizado_em` timestamp with time zone NOT NULL default `now()`
- `proximo_follow_up` date NULL
- `notas_internas` text NOT NULL default `''::text`
- `tags` ARRAY NOT NULL default `'{}'::text[]`
- `iddas_pessoa_id` text NULL
- `iddas_cotacao_code` text NULL
- `iddas_orcamento_id` text NULL
- `iddas_venda_id` text NULL
- `iddas_ultimo_sync` timestamp with time zone NULL
- `iddas_sync_status` text NOT NULL default `'pending'::text`
- `iddas_sync_error` text NULL
- `clickmassa_contact_id` text NULL
- `clickmassa_ticket_ids` ARRAY NOT NULL default `'{}'::text[]`
- `clickmassa_tags_id` ARRAY NOT NULL default `'{}'::integer[]`
- `clickmassa_oportunidade_id` text NULL
- `clickmassa_pipeline_step` text NULL
- `clickmassa_ultimo_sync` timestamp with time zone NULL
- `clickmassa_sync_status` text NOT NULL default `'pending'::text`
- `clickmassa_sync_error` text NULL
- `posts_lidos` ARRAY NOT NULL default `'{}'::text[]`
- `ultima_interacao` timestamp with time zone NULL
- `emails_abertos` integer NOT NULL default `0`
- `campanhas_ativas` ARRAY NOT NULL default `'{}'::text[]`
- `status` text NOT NULL default `'ativo'::text`
- `arquivado_em` timestamp with time zone NULL
- `motivo_arquivamento` text NULL

**Constraints**

- **CHECK** `contacts_clickmassa_sync_status_check`: CHECK ((clickmassa_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])))
- **CHECK** `contacts_destino_tipo_check`: CHECK ((destino_tipo = ANY (ARRAY['italia'::text, 'europa_geral'::text, 'cruzeiro'::text, 'america_sul'::text, 'outro'::text, 'indefinido'::text])))
- **CHECK** `contacts_estagio_check`: CHECK ((estagio = ANY (ARRAY['novo'::text, 'qualificado'::text, 'proposta_enviada'::text, 'em_negociacao'::text, 'aguardando_pagamento'::text, 'fechado_confirmado'::text, 'viagem_realizada'::text, 'em_espera'::text, 'perdido'::text])))
- **CHECK** `contacts_iddas_sync_status_check`: CHECK ((iddas_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])))
- **CHECK** `contacts_orcamento_estimado_check`: CHECK ((orcamento_estimado = ANY (ARRAY['ate_5k'::text, '5k_15k'::text, '15k_30k'::text, '30k_50k'::text, 'acima_50k'::text, 'nao_informado'::text])))
- **CHECK** `contacts_origem_check`: CHECK ((origem = ANY (ARRAY['site_contato'::text, 'google_ads'::text, 'instagram'::text, 'indicacao'::text, 'evento'::text, 'manual'::text, 'importado'::text])))
- **CHECK** `contacts_perfil_viajante_check`: CHECK ((perfil_viajante = ANY (ARRAY['primeira_viagem_internacional'::text, 'viajante_frequente'::text, 'lua_de_mel'::text, 'familia'::text, 'grupo_amigos'::text, 'negocios'::text, 'outro'::text])))
- **CHECK** `contacts_prazo_ideal_check`: CHECK ((prazo_ideal = ANY (ARRAY['1_3_meses'::text, '3_6_meses'::text, '6_12_meses'::text, 'acima_12_meses'::text, 'flexivel'::text, 'data_fixa'::text])))
- **CHECK** `contacts_status_check`: CHECK ((status = ANY (ARRAY['ativo'::text, 'arquivado'::text, 'duplicado'::text, 'anonimizado_lgpd'::text])))
- **PRIMARY KEY** `contacts_pkey`: PRIMARY KEY (id)

**Indexes**

- `contacts_pkey`: `CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id)`
- `idx_contacts_clickmassa_sync`: `CREATE INDEX idx_contacts_clickmassa_sync ON public.contacts USING btree (clickmassa_sync_status)`
- `idx_contacts_created_at`: `CREATE INDEX idx_contacts_created_at ON public.contacts USING btree (created_at DESC)`
- `idx_contacts_estagio`: `CREATE INDEX idx_contacts_estagio ON public.contacts USING btree (estagio)`
- `idx_contacts_iddas_sync`: `CREATE INDEX idx_contacts_iddas_sync ON public.contacts USING btree (iddas_sync_status)`
- `idx_contacts_origem`: `CREATE INDEX idx_contacts_origem ON public.contacts USING btree (origem)`
- `idx_contacts_proximo_follow_up`: `CREATE INDEX idx_contacts_proximo_follow_up ON public.contacts USING btree (proximo_follow_up)`
- `idx_contacts_status`: `CREATE INDEX idx_contacts_status ON public.contacts USING btree (status)`
- `idx_contacts_tags`: `CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags)`

**RLS**: habilitado

**Policies**

- `authenticated_all_contacts` (ALL, roles: authenticated)
  - USING: `true`
  - WITH CHECK: `true`

**Triggers**

- `trg_contacts_updated_at` (BEFORE UPDATE): `EXECUTE FUNCTION set_updated_at()`


---

### `tags`

**Colunas**

- `id` uuid NOT NULL default `gen_random_uuid()`
- `name` text NOT NULL
- `slug` text NOT NULL
- `cor` text NOT NULL
- `grupo` text NULL
- `is_active` boolean NOT NULL default `true`

**Constraints**

- **PRIMARY KEY** `tags_pkey`: PRIMARY KEY (id)
- **UNIQUE** `tags_slug_key`: UNIQUE (slug)

**Indexes**

- `tags_pkey`: `CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id)`
- `tags_slug_key`: `CREATE UNIQUE INDEX tags_slug_key ON public.tags USING btree (slug)`

**RLS**: habilitado

**Policies**

- `authenticated can read tags` (SELECT, roles: authenticated)
  - USING: `true`


---

### `user_profiles`

**Colunas**

- `id` uuid NOT NULL
- `name` text NOT NULL
- `email` text NOT NULL
- `status` text NOT NULL default `'pending'::text`
- `role` text NULL
- `created_at` timestamp with time zone NOT NULL default `now()`
- `updated_at` timestamp with time zone NOT NULL default `now()`
- `approved_at` timestamp with time zone NULL
- `approved_by` uuid NULL

**Constraints**

- **CHECK** `user_profiles_role_check`: CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text])))
- **CHECK** `user_profiles_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
- **FOREIGN KEY** `user_profiles_approved_by_fkey`: FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL
- **FOREIGN KEY** `user_profiles_id_fkey`: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
- **PRIMARY KEY** `user_profiles_pkey`: PRIMARY KEY (id)

**Indexes**

- `idx_user_profiles_email`: `CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email)`
- `idx_user_profiles_status`: `CREATE INDEX idx_user_profiles_status ON public.user_profiles USING btree (status)`
- `user_profiles_pkey`: `CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id)`

**RLS**: habilitado

**Policies**

- `users can read own profile` (SELECT, roles: public)
  - USING: `(auth.uid() = id)`

**Triggers**

- `touch_user_profiles_updated_at` (BEFORE UPDATE): `EXECUTE FUNCTION touch_updated_at()`


---

## Foreign Keys (Cross-Tabelas)

- `contact_interactions.contact_id` → `contacts.id` (ON DELETE CASCADE, ON UPDATE NO ACTION)

---

## Functions Customizadas

- `set_updated_at()` → `trigger`
- `touch_updated_at()` → `trigger`
 |