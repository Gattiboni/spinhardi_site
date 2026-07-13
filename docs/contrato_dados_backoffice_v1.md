# CONTRATO DE DADOS — BACK-OFFICE SPINHARDI · v1

Fechado em: 13/07/2026
Partes: Alan (decisor) · Claudinho (planejamento) · Codinho (implementação)
Status: **CONGELADO.** Este documento não muda até o fim da implementação de
todas as unidades. Divergência encontrada durante implementação não altera o
contrato: vira registro no DECISION_LOG e, se necessário, contrato v2.

Como este documento nasceu: auditoria completa do `/admin` (13/07), leitura do
DECISION_LOG (D001–D085), das atas e áudio da reunião de 19/06, e consultas ao
banco de produção. Cada unidade foi fechada individualmente, uma por vez, em
perguntas binárias, com evidência de produção na mesa.

---

## A LEI (decidida em 19/06 e 13/07, não se re-litiga)

1. **O back-office é a fonte da verdade do CRM e do funil.**
2. **O Iddas é a fonte da verdade do financeiro e do contábil.** Homologado.
   Oficial. O back-office NUNCA digita venda, receita ou despesa.
3. **O back-office não duplica função do Iddas.** "Deixa o Iddas fazer."
4. **O ClickMassa é a operação do WhatsApp.** O back-office LÊ dele, não opera
   nele.
5. **O back-office existe pra minimizar troca de sistema.**
6. **Linguagem única de funil** entre back-office, Iddas e ClickMassa
   (vocabulário canônico do D072).
7. **Nina é a usuária.** Tolerância a complexidade é restrição de produto.
8. **Trabalho de usuário no back-office nunca é desfeito por sync.**
   (Princípio transversal, concretizado nas Unidades 2 e 6.)

---

## OBRIGAÇÃO PRÉVIA — CONSERTO DO SYNC (não é decisão, é conserto)

Desde 10/07 10:55 a promoção bronze → silver está 100% quebrada
(`duplicate key value violates unique constraint
"contacts_clickmassa_contact_id_key"`, ~400 ocorrências em 3 dias).
Causa: duas representações do vínculo externo (coluna em `contacts` + linha em
`contact_external_links`); o formulário do site grava só a coluna; a RPC decide
pela tabela; o INSERT bate no UNIQUE da coluna; rollback da transação inteira,
Iddas junto. Linha-veneno: `Amanda Teste` (`clickmassa_contact_id = 114015`,
`origem = site_contato`). O problema é estrutural e se regenera a cada lead do
site.

Conserto contratado (pré-requisito de tudo):

1. `contact_external_links` é o **único escritor** do vínculo externo. As
   colunas em `contacts` viram projeção mantida por trigger. O UNIQUE sai das
   colunas. `syncContactFlow` grava a linha.
2. A RPC deixa de ser tudo-ou-nada: `ON CONFLICT DO NOTHING` nos INSERTs de
   contato; um registro ruim não derruba as duas fontes.
3. **`ingestion_log` só fecha DEPOIS da promoção.** RPC estourou → run
   `failed`, com a mensagem gravada. (Hoje o log fecha antes: 3033 runs verdes
   escondendo promoção morta.)
4. Limpeza da linha-veneno `Amanda Teste` (+ jornada + interaction associadas).

---

## CONTRATO — UNIDADE 1: IDENTIDADE DO CONTATO
Data: 13/07/2026 · Status: FECHADO

**1.1 — O que faz um contato existir**
Contato existe se tem identidade própria: UUID interno + pelo menos UM
identificador de origem (iddas_pessoa_id, clickmassa_contact_id, telefone
ou email). Telefone é ATRIBUTO, não requisito de existência.
→ contacts.whatsapp deixa de ser NOT NULL.

**1.2 — Qualidade é indicador, não filtro**
Ter WhatsApp válido vira indicador de qualidade, visível no banco e na UI
(ex.: tem_whatsapp boolean, derivado de isWAContact/isNumber da fonte +
telefone normalizável). Nenhum indicador de qualidade barra entrada.

**1.3 — LID entra**
Contato do ClickMassa com number = LID entra normalmente. Evidência de
produção: dos 1114 não promovidos hoje, 1096 (98%) têm nome real de pessoa
(Nora Dutra, Priscila Vasconcelos, ...). LID é privacidade do WhatsApp,
não ruído. Grupos (is_group = true, 30 hoje) NÃO entram.

**Consequências técnicas (para o lote de implementação)**
- Migração: dropar NOT NULL de contacts.whatsapp
- Promoção: critério de entrada = identificador de origem presente e
  is_group = false. Fim da regex de telefone como porteira.
- UI: contato sem telefone renderiza com ação de WhatsApp desabilitada.

**Números de referência (13/07/2026)**
- Iddas: 857 no bronze, 665 promovidos, 192 fora (entram após este contrato)
- ClickMassa: 1630* no bronze, 516 promovidos, 1114 fora, dos quais 30 grupos
  → ~1084 entram após este contrato
  (*1630 inclui grupos e registros já vinculados por telefone a contatos do
  Iddas; a fusão por telefone continua valendo — LID não cria duplicata de
  quem já existe)

---

## CONTRATO — UNIDADE 2: RE-IMPORTAÇÃO E CONFLITO FONTE × MANUAL
Data: 13/07/2026 · Status: FECHADO (confirma o já implementado)

**2.1 — Idempotência: JÁ IMPLEMENTADA, mantém**
promote_contacts_from_bronze decide por contact_external_links:
quem tem vínculo não é re-inserido, é atualizado. Sem mudança.

**2.2 — Conflito fonte × manual: JÁ RESOLVIDO, mantém**
Semântica vigente é fill-null: a fonte só preenche campo VAZIO
(coalesce(c.campo, fonte.campo)). Campo preenchido nunca é sobrescrito
pelo sync, tenha vindo de edição manual ou de sync anterior.
Trade-off aceito: se o dado mudar na fonte (ex.: e-mail novo no Iddas),
o back-office mantém o antigo até alguém editar. Simplicidade > frescor.

**2.3 — Visibilidade do que fica de fora**
Após a Unidade 1, exclusões são definicionais, não perda de dado:
is_group = true (grupos), is_user = true (agentes da agência),
deleted_at preenchido (deletado na fonte). Não geram card nem tela.
O que exige visibilidade é FALHA de promoção → coberto pela Obrigação
Prévia (ingestion_log só fecha DEPOIS da promoção; RPC estourou = run
failed).

**Consequência técnica**
Nenhuma mudança de código nesta unidade. Ela existe para blindar a
semântica atual contra "melhorias" futuras que reintroduzam sobrescrita.

---

## CONTRATO — UNIDADE 3: JORNADAS
Data: 13/07/2026 · Status: FECHADO

**3.1 — Entrada: orçamento do Iddas vira jornada VIA FILA DE APROVAÇÃO**
promote_jornadas_from_bronze (a criar) gera a jornada a partir do
orçamento e a coloca na fila de aprovação existente. A fila é a porteira
de ENTRADA: passo visual, simples, que dá às usuárias a confiança de que
a importação está correta. D076 permanece válido integralmente.

**3.2 — Movimento: Iddas sobrescreve o estágio, sem fila**
Jornada já aprovada cujo estágio mudou no Iddas se move sozinha no
kanban. A fila não é porteira de MOVIMENTO. Vale também para fechamento:
venda confirmada / reprovada no Iddas fecha a jornada automaticamente.

**Regras derivadas (sem decisão nova, só consequência)**
- Orçamento de pessoa ainda não promovida: com a Unidade 1 em vigor isso
  tende a zero; se ocorrer, a jornada espera o contato existir (próxima
  rodada resolve) em vez de ser descartada.
- jornada.valor = proposta enviada (peso da etapa no funil), não dinheiro.
  O ciclo financeiro fecha quando o sync traz a venda do Iddas. (Lei já
  decidida em 13/07, registrada aqui por pertencer a esta unidade.)
- Transições de estágio passam a ser registradas (jornada_transicoes,
  mantida por trigger em jornadas — nenhum escritor consegue furar).
  Histórico começa a existir a partir da implementação; passado não é
  recuperável pois o Iddas não guarda transição.

**Estado que esta unidade corrige (13/07/2026)**
- 54 orçamentos sem jornada correspondente
- 11 jornadas abertas com estágio defasado (4 já vendidas, 6 já perdidas
  no Iddas) → serão movidas/fechadas pelo primeiro sync após implementação

---

## CONTRATO — UNIDADE 4: FINANCEIRO
Data: 13/07/2026 · Status: FECHADO

**Lei reafirmada (decidida em 19/06 e 13/07, não se re-litiga)**
- Iddas é a fonte da verdade financeira e contábil. Homologado. Oficial.
- O back-office NUNCA digita venda, receita ou despesa.
- Morrem: FinanceiroForm, registrarNegocio, registrarLancamento,
  createLancamento, src/lib/financeiro/, tabelas negocios e lancamentos.
- Dashboard entrega as 4 caixinhas da Amanda: orçado · realizado · custo ·
  lucro bruto. Tudo já existe no bronze (venda.orcado/custo/venda/lucro).

**4.1 — Faturamento só conta venda fechada**
gold_* passa a somar apenas vendas com situação fechada/confirmada,
lendo venda.situacao e venda.status_pagamento do bronze (colunas já
preenchidas pela fonte). Critério documentado no código. Venda cancelada
ou pendente sai da soma.

**4.2 — RAV: valor cheio até resposta das sócias**
Enquanto a pergunta da RAV (levantada pela Amanda em 19/06, nunca
respondida) estiver aberta, o número exibido é o valor cheio da venda,
como o Iddas registra. Nenhum campo ou cálculo novo é inventado.
PENDÊNCIA EXTERNA: definição de RAV × faturamento → sócias.

**Dívidas conhecidas desta área (não bloqueiam, ficam registradas)**
- receita.categoria e receita.forma_pagamento: 100% nulas porque o sync
  só lê o endpoint de LISTA do Iddas. Relatório por produto (pedido da
  Amanda) exige o endpoint de DETALHE → lote próprio, após C1–C3.
- Bronze acumula fantasma (registro apagado no Iddas permanece aqui):
  venda 229 vs 221, receita 481 vs 463. Reconciliação → mesmo lote.

---

## CONTRATO — UNIDADE 5: CONVERSAS DO CLICKMASSA
Data: 13/07/2026 · Status: FECHADO

**Lei reafirmada**
Prometido ao vivo em 19/06: "quando termina a conversa lá no ClickMassa,
ele busca a conversa (...) vai aparecer aqui na interação" — Julia: "Ela
entra aí já, né?" — Alan: "Exato". Não se discute SE, só COMO.
Estado atual: contact_interactions = 3 linhas. Nenhuma mensagem jamais
ingerida.

**5.1 — Granularidade: 1 interação por conversa encerrada**
A timeline do contato recebe UMA interação por conversa/ticket encerrado,
com o conteúdo das mensagens dentro dela. Não é 1 interação por mensagem.

**5.2 — Spike de investigação ANTES de qualquer DDL**
Este dado é OURO e os dois caminhos conhecidos são não-provados. Nenhuma
tabela bronze_clickmassa_messages/tickets é criada antes do spike provar
o shape real. O spike investiga a fundo, na ordem:
1. GET /tickets (API interna) — o 500 atual nomeia o parâmetro que falta
   ("WHERE parameter userId has invalid undefined value"). Testar com
   userId de cada um dos 4 agentes já presentes no bronze.
2. GET /v1/api/external/messages/{apiId}/{externalKey} — testado uma
   única vez, num contato com 0 mensagens. Re-testar com contatos que
   comprovadamente têm conversa (ex.: number de ticket ativo recente).
3. Esgotar variações antes de declarar impossível: combinações de
   query params, tickets por status, mensagens por ticket. O produto é
   white-label; a doc mente por omissão — o código responde.
Saída do spike: relatório com shape real (envelope, campos, paginação,
volume, rate limit), no padrão dos docs de exploração existentes.
DDL e promoção só depois, desenhados sobre o shape provado.

**Regras derivadas**
- Ingestão respeita a Lei: ClickMassa continua sendo a operação do
  WhatsApp; o back-office LÊ conversas, nunca envia por aqui.
- Conversa vinculada ao contato via clickmassa_contact_id já existente
  no vínculo externo (Unidade 1/2). Sem contato correspondente → espera,
  não descarta.

---

## CONTRATO — UNIDADE 6: TAGS
Data: 13/07/2026 · Status: FECHADO

**Regra central (decidida pelo Alan, 13/07)**
Tag é trabalho de usuário. Editável no back-office. O sync é APENAS
ADITIVO: adiciona tags vindas da fonte, nunca remove nem sobrescreve
aplicação ou edição feita por usuário. Mesma filosofia do fill-null
dos contatos (Unidade 2).

**6.1 — Remoção do usuário é lembrada**
Se o usuário remove uma tag que veio da fonte, o sync NÃO re-adiciona.
Implementação: soft-remove na tabela de aplicação (a linha permanece,
marcada como removida; o sync a enxerga e pula). Trabalho do usuário
nunca é desfeito pelo ciclo de 15 minutos.

**Modelo (mínimo desvio do que existe)**
- tags (silver, JÁ EXISTE, com clickmassa_tag_id): vira catálogo único.
  Sync popula a partir dos catálogos bronze (CM: 20, Iddas: 20),
  identificando a origem. Tags criadas no back-office convivem no mesmo
  catálogo, sem id externo.
- contact_tags (A CRIAR): aplicação de tag a contato, com origem
  (clickmassa | iddas | backoffice), aplicada_em e removida_em
  (soft-remove). Sync CM insere por nome com ON CONFLICT DO NOTHING.

**O que dá pra fazer JÁ vs o que espera o endpoint de detalhe**
- ClickMassa: COMPLETO no bronze hoje. Catálogo + aplicação
  (382 contatos com tag em contact.tags[]). Implementável de ponta a
  ponta sem dependência externa.
- Iddas: SÓ o catálogo chegou. A associação orçamento↔etiqueta NÃO vem
  no endpoint de lista (verificado em produção: raw_payload do orçamento
  tem 17 chaves, etiquetas não é uma delas). Depende do endpoint de
  DETALHE do Iddas → mesmo lote da dívida registrada na Unidade 4
  (receita.categoria / forma_pagamento).

**UI (consequência, sem decisão nova)**
Tag visível no contato e na jornada, filtrável na lista. CRUD que já
existe no admin passa a operar sobre o catálogo unificado.

---

## ANEXO A — PENDÊNCIAS EXTERNAS (sócias; não bloqueiam o contrato)

| pendência | dona | efeito enquanto aberta |
|---|---|---|
| RAV × faturamento | Amanda/Julia/Nina | dashboard exibe valor cheio da venda (U4.2) |
| Procedimento de follow-up por tipo de produto | Amanda | sem alerta de follow-up automatizado |
| Ponto de equilíbrio (o número) | Julia/Nina | sem barra de progresso no dashboard |
| Higiene do Iddas (pessoas sem telefone com orçamento) | Nina/Julia | contatos entram sem telefone, com indicador de qualidade (U1) |
| Categorias de produto (prints da Julia) | Julia | catálogo do Iddas (30 categorias) supre; prints só confirmam |

## ANEXO B — ORDEM DE IMPLEMENTAÇÃO (execução, não contrato)

Referência de sequência; mudar a ordem não altera o contrato:

1. Obrigação Prévia (conserto do sync)
2. U1 + U2 (identidade)
3. U3 (jornadas)
4. U4 (financeiro, itens sem dependência de endpoint de detalhe)
5. U5 (conversas, começando pelo spike)
6. U6 (tags, lado ClickMassa)
7. Lote "endpoint de detalhe do Iddas": tags-Iddas (U6) + categoria/forma
   de pagamento (U4) + reconciliação do bronze (U4)

Faxina (FinanceiroForm, negocios, lancamentos, mocks, gold_dashboard.sql
desatualizado, campos mortos) acompanha os lotes que tocam cada área.
