| column_name        | data_type | udt_name | is_nullable | column_default |
| ------------------ | --------- | -------- | ----------- | -------------- |
| destino_tipo       | text      | text     | NO          | null           |
| estagio            | text      | text     | NO          | 'novo'::text   |
| orcamento_estimado | text      | text     | NO          | null           |
| origem             | text      | text     | NO          | null           |
| perfil_viajante    | text      | text     | NO          | null           |
| prazo_ideal        | text      | text     | NO          | null           |
| status             | text      | text     | NO          | 'ativo'::text  |

| conname                               | definicao                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contacts_clickmassa_sync_status_check | CHECK ((clickmassa_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])))                                                                                                                                             |
| contacts_destino_tipo_check           | CHECK ((destino_tipo = ANY (ARRAY['italia'::text, 'europa_geral'::text, 'cruzeiro'::text, 'america_sul'::text, 'outro'::text, 'indefinido'::text])))                                                                                        |
| contacts_estagio_check                | CHECK ((estagio = ANY (ARRAY['novo'::text, 'qualificado'::text, 'proposta_enviada'::text, 'em_negociacao'::text, 'aguardando_pagamento'::text, 'fechado_confirmado'::text, 'viagem_realizada'::text, 'em_espera'::text, 'perdido'::text]))) |
| contacts_iddas_sync_status_check      | CHECK ((iddas_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])))                                                                                                                                                  |
| contacts_orcamento_estimado_check     | CHECK ((orcamento_estimado = ANY (ARRAY['ate_5k'::text, '5k_15k'::text, '15k_30k'::text, '30k_50k'::text, 'acima_50k'::text, 'nao_informado'::text])))                                                                                      |
| contacts_origem_check                 | CHECK ((origem = ANY (ARRAY['site_contato'::text, 'google_ads'::text, 'instagram'::text, 'indicacao'::text, 'evento'::text, 'manual'::text, 'importado'::text])))                                                                           |
| contacts_perfil_viajante_check        | CHECK ((perfil_viajante = ANY (ARRAY['primeira_viagem_internacional'::text, 'viajante_frequente'::text, 'lua_de_mel'::text, 'familia'::text, 'grupo_amigos'::text, 'negocios'::text, 'outro'::text])))                                      |
| contacts_prazo_ideal_check            | CHECK ((prazo_ideal = ANY (ARRAY['1_3_meses'::text, '3_6_meses'::text, '6_12_meses'::text, 'acima_12_meses'::text, 'flexivel'::text, 'data_fixa'::text])))                                                                                  |
| contacts_status_check                 | CHECK ((status = ANY (ARRAY['ativo'::text, 'arquivado'::text, 'duplicado'::text, 'anonimizado_lgpd'::text])))                                                                                                                               |

| schema   | enum_type                  | valores                                                                                                                            |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| auth     | aal_level                  | aal1, aal2, aal3                                                                                                                   |
| auth     | code_challenge_method      | s256, plain                                                                                                                        |
| auth     | factor_status              | unverified, verified                                                                                                               |
| auth     | factor_type                | totp, webauthn, phone                                                                                                              |
| auth     | oauth_authorization_status | pending, approved, denied, expired                                                                                                 |
| auth     | oauth_client_type          | public, confidential                                                                                                               |
| auth     | oauth_registration_type    | dynamic, manual                                                                                                                    |
| auth     | oauth_response_type        | code                                                                                                                               |
| auth     | one_time_token_type        | confirmation_token, reauthentication_token, recovery_token, email_change_token_new, email_change_token_current, phone_change_token |
| realtime | action                     | INSERT, UPDATE, DELETE, TRUNCATE, ERROR                                                                                            |
| realtime | equality_op                | eq, neq, lt, lte, gt, gte, in                                                                                                      |
| storage  | buckettype                 | STANDARD, ANALYTICS, VECTOR                                                                                                        |

| ordinal_position | column_name                | data_type                | udt_name    | is_nullable | column_default     |
| ---------------- | -------------------------- | ------------------------ | ----------- | ----------- | ------------------ |
| 1                | id                         | uuid                     | uuid        | NO          | gen_random_uuid()  |
| 2                | created_at                 | timestamp with time zone | timestamptz | NO          | now()              |
| 3                | updated_at                 | timestamp with time zone | timestamptz | NO          | now()              |
| 4                | name                       | text                     | text        | NO          | null               |
| 5                | whatsapp                   | text                     | text        | NO          | null               |
| 6                | email                      | text                     | text        | YES         | null               |
| 7                | cpf                        | text                     | text        | YES         | null               |
| 8                | data_nascimento            | date                     | date        | YES         | null               |
| 9                | nacionalidade              | text                     | text        | NO          | 'Brasileira'::text |
| 10               | cep                        | text                     | text        | YES         | null               |
| 11               | cidade                     | text                     | text        | YES         | null               |
| 12               | estado                     | text                     | text        | YES         | null               |
| 13               | pais                       | text                     | text        | NO          | 'Brasil'::text     |
| 14               | origem                     | text                     | text        | NO          | null               |
| 15               | origem_detalhe             | text                     | text        | YES         | null               |
| 16               | destino_tipo               | text                     | text        | NO          | null               |
| 17               | destino_texto              | text                     | text        | YES         | null               |
| 18               | orcamento_estimado         | text                     | text        | NO          | null               |
| 19               | prazo_ideal                | text                     | text        | NO          | null               |
| 20               | data_ida                   | date                     | date        | YES         | null               |
| 21               | data_volta                 | date                     | date        | YES         | null               |
| 22               | passageiros_adultos        | integer                  | int4        | NO          | 1                  |
| 23               | passageiros_criancas       | integer                  | int4        | NO          | 0                  |
| 24               | passageiros_bebes          | integer                  | int4        | NO          | 0                  |
| 25               | perfil_viajante            | text                     | text        | NO          | null               |
| 26               | experiencia_anterior       | text                     | text        | YES         | null               |
| 27               | restricoes                 | text                     | text        | YES         | null               |
| 28               | estagio                    | text                     | text        | NO          | 'novo'::text       |
| 29               | estagio_atualizado_em      | timestamp with time zone | timestamptz | NO          | now()              |
| 30               | proximo_follow_up          | date                     | date        | YES         | null               |
| 31               | notas_internas             | text                     | text        | NO          | ''::text           |
| 32               | tags                       | ARRAY                    | _text       | NO          | '{}'::text[]       |
| 33               | iddas_pessoa_id            | text                     | text        | YES         | null               |
| 34               | iddas_cotacao_code         | text                     | text        | YES         | null               |
| 35               | iddas_orcamento_id         | text                     | text        | YES         | null               |
| 36               | iddas_venda_id             | text                     | text        | YES         | null               |
| 37               | iddas_ultimo_sync          | timestamp with time zone | timestamptz | YES         | null               |
| 38               | iddas_sync_status          | text                     | text        | NO          | 'pending'::text    |
| 39               | iddas_sync_error           | text                     | text        | YES         | null               |
| 40               | clickmassa_contact_id      | text                     | text        | YES         | null               |
| 41               | clickmassa_ticket_ids      | ARRAY                    | _text       | NO          | '{}'::text[]       |
| 42               | clickmassa_tags_id         | ARRAY                    | _int4       | NO          | '{}'::integer[]    |
| 43               | clickmassa_oportunidade_id | text                     | text        | YES         | null               |
| 44               | clickmassa_pipeline_step   | text                     | text        | YES         | null               |
| 45               | clickmassa_ultimo_sync     | timestamp with time zone | timestamptz | YES         | null               |
| 46               | clickmassa_sync_status     | text                     | text        | NO          | 'pending'::text    |
| 47               | clickmassa_sync_error      | text                     | text        | YES         | null               |
| 48               | posts_lidos                | ARRAY                    | _text       | NO          | '{}'::text[]       |
| 49               | ultima_interacao           | timestamp with time zone | timestamptz | YES         | null               |
| 50               | emails_abertos             | integer                  | int4        | NO          | 0                  |
| 51               | campanhas_ativas           | ARRAY                    | _text       | NO          | '{}'::text[]       |
| 52               | status                     | text                     | text        | NO          | 'ativo'::text      |
| 53               | arquivado_em               | timestamp with time zone | timestamptz | YES         | null               |
| 54               | motivo_arquivamento        | text                     | text        | YES         | null               |


| id                                   | name           | whatsapp        | origem       | estagio | status | clickmassa_contact_id | iddas_pessoa_id | created_at                    |
| ------------------------------------ | -------------- | --------------- | ------------ | ------- | ------ | --------------------- | --------------- | ----------------------------- |
| ea99e84a-fda4-408b-a4c4-562792ffbb89 | Alan Gattiboni | (11) 98334-0447 | site_contato | novo    | ativo  | null                  | null            | 2026-06-14 04:46:01.361228+00 |
| 7561fa6f-bc52-4982-bd84-73f7022434ed | postgres       | (11) 98334-0447 | manual       | novo    | ativo  | null                  | null            | 2026-06-14 04:49:14.744745+00 |
| 2c7e063d-9b91-4d6d-aba2-751387694464 | 5511983340447  | 5511983340447   | importado    | novo    | ativo  | 109710                | null            | 2026-06-18 13:28:25.252214+00 |


| total | grupos | usuarios | deletados | sem_numero | pessoas_reais_estimado |
| ----- | ------ | -------- | --------- | ---------- | ---------------------- |
| 1484  | 30     | 209      | 0         | 0          | 1245                   |


| total | grupos | usuarios | deletados | sem_numero | pessoas_reais_estimado |
| ----- | ------ | -------- | --------- | ---------- | ---------------------- |
| 1484  | 30     | 209      | 0         | 0          | 1245                   |


| qtd_digitos | count |
| ----------- | ----- |
| 13          | 599   |
| 15          | 482   |
| 14          | 234   |
| 12          | 117   |
| 18          | 29    |
| 11          | 21    |
| 23          | 1     |
| 10          | 1     |


| number          | so_digitos      |
| --------------- | --------------- |
| 10011719807012  | 10011719807012  |
| 101279808393444 | 101279808393444 |
| 101816595415246 | 101816595415246 |
| 10183384236082  | 10183384236082  |
| 102091506868329 | 102091506868329 |
| 102697130831947 | 102697130831947 |
| 10290859139285  | 10290859139285  |
| 103139378257964 | 103139378257964 |
| 103165181608122 | 103165181608122 |
| 103624759844974 | 103624759844974 |
| 104603995607073 | 104603995607073 |
| 104698434576602 | 104698434576602 |
| 104775928520848 | 104775928520848 |
| 104900482613480 | 104900482613480 |
| 105226782666808 | 105226782666808 |


| total | sem_celular | pj_cnpj | pf_cpf | sem_documento |
| ----- | ----------- | ------- | ------ | ------------- |
| 838   | 176         | 0       | 0      | 838           |


| qtd_digitos | count |
| ----------- | ----- |
| 13          | 639   |
| 12          | 13    |
| 11          | 10    |


| celular        | so_digitos    |
| -------------- | ------------- |
| +5519993682791 | 5519993682791 |
| +5516988098089 | 5516988098089 |
| +5511996263570 | 5511996263570 |
| +5519981097098 | 5519981097098 |
| +5517991972064 | 5517991972064 |
| +5517996383818 | 5517996383818 |
| +5519971286333 | 5519971286333 |
| +5519995342662 | 5519995342662 |
| +5511953366492 | 5511953366492 |
| +5519999545457 | 5519999545457 |
| +5519997859556 | 5519997859556 |
| +5519997167860 | 5519997167860 |
| +5519997341847 | 5519997341847 |
| +5511962240555 | 5511962240555 |
| +5535998181619 | 5535998181619 |


| cm_distintos | idd_distintos | ambos | so_cm | so_idd |
| ------------ | ------------- | ----- | ----- | ------ |
| 1245         | 643           | 338   | 907   | 305    |


| fonte      | linhas | distintos | ocorrencias_duplicadas |
| ---------- | ------ | --------- | ---------------------- |
| clickmassa | 1245   | 1245      | 0                      |
| iddas      | 662    | 643       | 19                     |


| tel        | quantos | nomes                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------- |
| 8992117207 | 2       | Renato Borges Medeiros de Miranda | Renato Miranda                          |
| 7991816022 | 2       | Joao Zapaterra Rinaldi | João Zappa                                         |
| 4991368647 | 2       | Maria Luiza Silva de Brito | Maria Luzia Silva de Brito                     |
| 1958587006 | 2       | Cesar Carneiro | Cesar Carneiro                                             |
| 5988037705 | 2       | Auristela Siva | Auristela Siva                                             |
| 9997442622 | 2       | Luis Coli | Luisa Coli                                                      |
| 1973927489 | 2       | Lucas Francisco | Lucas Fransisco                                           |
| 4981804068 | 2       | Fabiana da Silva | Fabiana da Silva                                         |
| 9996168246 | 2       | Késsie Mello | Késsie Mello                                                 |
| 9995117357 | 2       | Rafa Fonseca | Rafaela Fonseca                                              |
| 1954878522 | 2       | Maycoln | Mycoln                                                            |
| 9994975779 | 2       | Gabi Betiol | Gabi Betiol                                                   |
| 9992903131 | 2       | Gabriela Moraes Tavolaro | Gabriela Tavolaro                                |
| 9996674446 | 2       | Edilene Gomes Oliveira | Edilene Gomes Oliveira                             |
| 9981110593 | 2       | Heloisa Filomena Avancini Del Nero | Luiz Sergio Batista Fernandes Del Nero |
| 2996788008 | 2       | Enrico Mendonça Gomes Panunzio | Kristiane Mendonça Gomes Panunzio          |
| 9991806488 | 2       | Claudia De Souza Godoi | Sergio Panico Grecco                               |
| 9996146357 | 2       | Angelina Spinhardi Saragiotto | Lilian Maria Marson Spinhardi               |
| 9997858566 | 2       | Ana | Aninha                                                                |


| cm_com_telefone | cm_lid_ou_invalido | cm_tel_distintos | idd_com_telefone | idd_sem_telefone | idd_tel_distintos | ambos | so_cm | so_idd |
| --------------- | ------------------ | ---------------- | ---------------- | ---------------- | ----------------- | ----- | ----- | ------ |
| 498             | 747                | 498              | 656              | 6                | 637               | 338   | 160   | 299    |


| indexname                          | indexdef                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| contacts_pkey                      | CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id)                                         |
| idx_contacts_status                | CREATE INDEX idx_contacts_status ON public.contacts USING btree (status)                                      |
| idx_contacts_estagio               | CREATE INDEX idx_contacts_estagio ON public.contacts USING btree (estagio)                                    |
| idx_contacts_origem                | CREATE INDEX idx_contacts_origem ON public.contacts USING btree (origem)                                      |
| idx_contacts_created_at            | CREATE INDEX idx_contacts_created_at ON public.contacts USING btree (created_at DESC)                         |
| idx_contacts_proximo_follow_up     | CREATE INDEX idx_contacts_proximo_follow_up ON public.contacts USING btree (proximo_follow_up)                |
| idx_contacts_iddas_sync            | CREATE INDEX idx_contacts_iddas_sync ON public.contacts USING btree (iddas_sync_status)                       |
| idx_contacts_clickmassa_sync       | CREATE INDEX idx_contacts_clickmassa_sync ON public.contacts USING btree (clickmassa_sync_status)             |
| idx_contacts_tags                  | CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags)                                            |
| contacts_clickmassa_contact_id_key | CREATE UNIQUE INDEX contacts_clickmassa_contact_id_key ON public.contacts USING btree (clickmassa_contact_id) |




