# Fase 0 — Planilha de diff (UI da fonte · raw_payload · coluna bronze)

**Objetivo:** por campo de consumo, confirmar de onde o dado sai e classificar o gap. Tudo verificado contra MOAS (colunas bronze reais), samples (raw cru) e as UIs/dashboards das fontes. Nada de memória.

**Legenda de gap:**
- **(a)** já temos coluna bronze própria
- **(b)** está no `raw_payload`, promove pra coluna quando precisar (não é perda)
- **(c)** gap real de ETL: não veio nem no raw, endpoint não expôs ou não chamamos
- **(d)** é conta de gold, não falta no bronze (a fonte calcula no cliente a partir do que já temos)

**Critério de parada (combinado):** fechado para os campos que alimentam o operacional da Nina e o gerencial da Julia. Não o universo de campos.

---

## BLOCO 1 — Operacional / Pessoa (Contatos) · origem ClickMassa

Fonte: `GET /contacts/:id` (200 OK). Bronze: `bronze_clickmassa_contacts`.

| Campo de consumo | UI da fonte mostra | raw_payload tem | coluna bronze | Gap | Nota |
|---|---|---|---|---|---|
| nome | sim | `name` | `name` | (a) | nome-lixo (emoji, "."), limpar na silver |
| telefone | sim | `number` | `number` | (a) | chave de identidade; 100% preenchido |
| email | campo existe | `email` (null) | `email` | (a) | 0% preenchido na base |
| origem do lead | só no agregado, não no contato | `leadOriginId` (null) | `lead_status_id` / `lead_status` | (a) col / (c) valor | **a coluna existe, o dado por-pessoa não vem.** Origem real só existe no agregado (Bloco 4) |
| estágio/status lead | idem | `leadStatusId` (null) | `lead_status`, `lead_status_id` | (a) col / (c) valor | mesma história: somatório existe, por-pessoa não |
| tags (semânticas) | só no agregado | `tags: []` (vazio no contato) | `tags` | (a) col / (c) valor | tag rica está no agregado, não no registro |
| valor negociado | não na UI de contato | `negotiatedValue` (null) | (sem coluna) | (b) | está no raw, promove se virar consumo |
| gênero | só no agregado | `gender` (null) | `gender` | (a) col / (c) valor | |
| nascimento | não | `birthDate` (null) | `birth_date` | (a) col / (c) valor | |
| cidade/estado/cep | não | `cidade`/`estado`/`cep` (null) | `cidade`,`estado`,`cep`,`bairro`,`logradouro`... | (a) col / (c) valor | endereço modelado, vem vazio |
| empresa | não | `company` (null) | `company` | (a) | |
| canal | sim | `channel` ("whatsapp") | `channel` | (a) | |
| custom fields | não | `customFields: {}` | (só no raw_payload) | (b) | vazio hoje, mas é o campo extensível do CM |
| memória do agente | não | `agentMemory: {}` | (só no raw_payload) | (b) | vazio hoje |
| primeira conexão | não | `firstConnection` | `first_connection` | (a) | |

**Leitura do bloco:** o cadastro por-pessoa do CM é magro (quase tudo null), mas o **schema bronze já modela tudo** que a fonte expõe. Não há perda. O dado rico (origem, tag, estado) existe só na forma agregada, não no contato individual, pela API que acessamos. Isso é fato da fonte, não falha nossa.

---

## BLOCO 2 — Operacional / Pessoa · origem Iddas

Fonte: `GET /pessoa` (data[]). Bronze: `bronze_iddas_pessoa`. **Raw traz 44 campos, bronze guardou 18.**

| Campo de consumo | UI da fonte mostra | raw_payload tem | coluna bronze | Gap | Nota |
|---|---|---|---|---|---|
| nome | sim | `nome` | `nome` | (a) | nome limpo (Iddas ganha do CM em qualidade de cadastro) |
| celular | sim | `celular` | `celular` | (a) | 79% preenchido; segunda chave de identidade |
| email | sim | `email` | `email` | (a) | 25% |
| cpf/cnpj | sim | `cpf_cnpj` | `cpf_cnpj` | (a) | |
| sexo | sim | `sexo` | `sexo` | (a) | |
| nascimento | sim | `nascimento` | `nascimento` | (a) | |
| tipo de cliente | sim | `tipo_cliente` | `tipo_cliente` | (a) | |
| canal de venda | sim | `canal_venda` | `canal_venda` | (a) | |
| cidade/estado | sim | `cidade`/`estado` | `cidade`,`estado` | (a) | |
| observação | sim | `observacao` | `observacao` | (a) | 0% preenchido |
| aceita comunicação | sim | `aceita_comunicacao` | `aceita_comunicacao` | (a) | flag de opt-in, importa pra mail-mkt futuro |
| **passaporte + validade** | sim | `passaporte`,`validade_visto`,`vencimento_passaporte` | (sem coluna) | **(b)** | ouro pra viagem internacional, está no raw |
| **profissão / renda** | sim | `profissao`,`renda` | (sem coluna) | **(b)** | qualificação de lead high-ticket, no raw |
| **estado civil** | sim | `estado_civil` | (sem coluna) | (b) | no raw |
| **contato emergência** | sim | `nome_emergencia`,`celular_emergencia` | (sem coluna) | (b) | no raw |
| endereço completo | sim | `endereco`,`numero`,`bairro`,`complemento`,`pais_endereco` | parcial (`cidade`/`estado`/`cep` só) | (b) | resto no raw |
| chave pix / rede social / site | sim | `chave_pix`,`rede_social`,`site` | (sem coluna) | (b) | no raw |

**Leitura do bloco:** o Iddas tem o cadastro de pessoa mais rico das duas fontes, e a maior parte está **no raw_payload sem coluna própria**. Zero perda de ETL. Quando o contrato decidir que passaporte/profissão/renda viram consumo (qualificação de lead), é promoção de coluna, não nova ingestão. Esse é o caso (b) clássico e é boa notícia.

---

## BLOCO 3 — Operacional / Funil · origem ClickMassa (ao vivo) + Iddas

Funil vive de duas fontes. CM: `bronze_clickmassa_opportunities` + `pipeline_steps` (e API ao vivo). Iddas: `bronze_iddas_orcamento` + `situacao`.

| Campo de consumo | UI da fonte mostra | raw_payload tem | coluna bronze | Gap | Nota |
|---|---|---|---|---|---|
| estágio (nome/cor/ordem) CM | sim | `name`,`color`,`ordem` | `pipeline_steps.name/color/ordem` | (a) | |
| oportunidade (nome/valor) | sim | `name`,`value` | `opportunities.name/value` | (a) | bloqueio: `/opportunities` 404 até ativar módulo |
| responsável | sim | `responsible_id` | `opportunities.responsible_id` | (a) | resolve nome via `users` |
| data prevista fecho | sim | `expectedCloseDate` | `opportunities.expected_close_date` | (a) | |
| orçamento (Iddas) valor | sim (Cotações) | `valor` | `orcamento.valor` | (a) | |
| situação do orçamento | sim (kanban Iddas) | `situacao`,`nome_situacao`,`cor_situacao` | `orcamento.situacao`,`nome_situacao` | (a) | `cor_situacao` está no raw, sem coluna → (b) |
| código do orçamento | sim | `identificador` | `orcamento.identificador` | (a) | o `8kh6z`, `h9y6r` da UI |
| passageiros | sim | `passageiros_adulto/crianca/bebe` | colunas próprias | (a) | |
| etiquetas do orçamento | sim | `etiquetas` | (sem coluna, no raw) | (b) | |
| **conversão cotado→vendido** | dashboard Iddas (pizza) | derivável de orcamento+venda | n/a | **(d)** | conta de gold: "cotei X vendi Y" |

---

## BLOCO 4 — Gerencial / Agregados · origem ClickMassa

Fonte: `GET /contacts-dashboard` (200 OK). Bronze: `bronze_clickmassa_contacts_dashboard`. **Este é o dado gerencial rico que eu achava perdido nos tickets. Não está. Veio pronto.**

| Campo de consumo | UI da fonte mostra | raw_payload tem | coluna bronze | Gap | Nota |
|---|---|---|---|---|---|
| total de contatos | sim | `total` (1483) | `total` | (a) | |
| novos na semana | sim | `weeklyNew` (26) | `weekly_new` | (a) | |
| recência d30/d90/d180/d360 | sim | `recency.*` | `recency_d30..d360plus` | (a) | |
| ranking por estado | sim (SP 646, MG 96...) | `states[]` | (só no raw_payload) | (b) | promove pra view gerencial quando o gráfico pedir |
| origem do lead (agregada) | sim (Tráfego Pago 191...) | `origins[]` | (só no raw_payload) | (b) | **a origem que falta por-pessoa existe aqui em soma** |
| tags semânticas (agregada) | sim (Interesse em pacote 155...) | `tags[]` | (só no raw_payload) | (b) | idem |
| gênero / faixa etária | sim | `gender[]`,`ageGroups[]` | (só no raw_payload) | (b) | |
| agentes (volume) | sim | `agents[]` | (só no raw_payload) | (b) | Angelina 14 |
| top clientes | sim | `topClients[]` | (só no raw_payload) | (b) | |

**Leitura do bloco:** o agregado inteiro está no `raw_payload` de uma tabela que a gente já tem. Para o gerencial do Dashboard, é só promover os arrays que cada gráfico consumir. Nenhum gap de ETL, nenhuma chamada nova. Caso (b) em peso.

---

## BLOCO 5 — Gerencial / Financeiro · origem Iddas

Fontes: `bronze_iddas_venda`, `receita`, `despesa`, `orcamento`. Dashboard Iddas confirma os números.

| Campo de consumo | UI da fonte mostra | raw_payload tem | coluna bronze | Gap | Nota |
|---|---|---|---|---|---|
| venda (valor) | sim | `venda` | `venda.venda` | (a) | |
| custo | sim | `custo` | `venda.custo` | (a) | |
| lucro | sim | `lucro` | `venda.lucro` | (a) | |
| % lucro / margem | sim | `percentual_lucro` | `venda.percentual_lucro` | (a) | a margem que a Julia persegue |
| comissão (+/-) | sim | `comissao_mais`,`comissao_menos` | colunas próprias | (a) | |
| receita por categoria | sim (pizza 41% passagem...) | `categoria`,`valor` | `receita.categoria/valor` | (a) | agregação = (d) sobre dado (a) |
| despesa por categoria | sim (67% fornecedor...) | `categoria`,`valor` | `despesa.categoria/valor` | (a) | idem |
| conta (banco) | sim (Fluxo de Caixa) | `conta` | `receita.conta`,`despesa.conta` | (a) | |
| previsto vs realizado | sim (Fluxo de Caixa) | `vencimento`,`pagamento` | colunas próprias | (a) | realizado = pagamento preenchido |
| **faturamento total** | sim (R$1.148.902) | n/a | n/a | **(d)** | soma de venda, conta de gold |
| **ticket médio** | sim (R$9.340) | n/a | n/a | **(d)** | faturamento / nº vendas |
| **margem líquida mensal** | a Julia calcula fora | n/a | n/a | **(d)** | conta de gold, o -2,1% de maio |
| reprovações (motivo) | sim (relatório) | no orcamento + `motivoreprovacao` | `motivoreprovacao.nome` | (a) | "aprovações" vazio é da fonte, não nosso |

**Leitura do bloco:** o financeiro do Iddas é o dado mais limpo de tudo, tudo com coluna própria. Os números grandes do dashboard (faturamento, ticket, margem) são todos **conta de gold (d)** sobre colunas que já temos. Nada falta no bronze.

---

## Resumo executivo do diff

- **Gap (c) real de ETL: praticamente zero pra dado de consumo.** O único (c) é estrutural e da fonte, não nosso: o ClickMassa não devolve origem/tag/estado **no contato individual** pela API que acessamos, só no agregado. Não dá pra "consertar" no ETL sem o endpoint de ticket (que dá 500). E não precisa: a origem por-pessoa vai vir do enriquecimento via conversa (o evento de atendimento finalizado) e do cruzamento com Iddas.
- **Maioria dos "buracos" é (b):** está no raw_payload, promove quando o contrato pedir. Iddas pessoa (passaporte, profissão, renda), agregados CM (states, origins, tags), cor de situação, etiquetas. Bronze cumpriu o papel: comeu tudo cru.
- **Os números gerenciais grandes são (d):** faturamento, ticket, margem, conversão. Conta de gold sobre dado (a). Não falta nada no bronze pra calculá-los.
- **O que tem coluna e vem vazio (a + valor null):** cadastro por-pessoa do CM. Não é problema de pipeline, é base magra na origem. É exatamente o que os cards-de-gap do Lote 2 vão atacar, virando a ausência em tarefa.

**Conclusão pro contrato (Fase 2):** o bronze está completo pro consumo que a gente conhece. O trabalho do contrato não é tapar gap de ETL (quase não tem), é decidir **o que promover de (b) pra coluna** e **o que calcular em (d) no gold**. A silver pode ser rica sem medo, porque a matéria-prima está lá.

**Critério de parada batido:** todos os campos das perguntas de Nina (operacional) e Julia (gerencial) têm origem confirmada. Fase 0 fecha aqui.
