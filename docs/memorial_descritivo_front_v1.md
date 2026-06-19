# Memorial descritivo do front (wireframe descritivo) v1

**O que é:** estado-alvo elemento a elemento, de onde vem pra onde vai, com fonte nomeada. Ancorado no mapa do Codinho (estado atual) e no contrato (estado-alvo, incluindo emendas E1/E2/E3). É a ponte direta pra virar instrução de Codinho.

**Legenda de destino:**
- **INTOCADO** — fica como está, fonte e função. Design pode mudar no redesenho visual, mas não é obrigatório nem custa dado.
- **MUDA-FONTE** — a função permanece, a fonte troca (tipicamente coluna cravada → `contact_external_links`). Versiona junto com a migração.
- **RODA** — sai de cena (cortado da v1 ou substituído por outra coisa).
- **+MELHORA** — funcionalidade que já existe e fica melhor.
- **+ADICIONA** — funcionalidade nova, não existia.

Fontes nomeadas: `contacts`, `contact_interactions`, `contact_external_links` (novo, decisão 1), `bronze_iddas_*`, `bronze_clickmassa_contacts_dashboard`, `ClickMassa API`, `Sanity`, `auth`.

---

## Tela 1 — Dashboard (gerencial)

**Veredito:** é a tela que mais muda. Vira quase um redesenho do zero, porque hoje ela é um amontoado de contadores operacionais e 3 mocks, e o alvo é saúde do negócio em 6 cards (D-F1.3).

| Elemento atual | Destino | Vem de | Vai pra |
|---|---|---|---|
| Saudação + data | INTOCADO | `auth` + clock | igual |
| Labels de seção / atalhos | INTOCADO | — | igual (visual livre) |
| Card "Novos contatos" | RODA | `contacts.created_at` | sai da primeira dobra, vira contexto em Contatos |
| Card "Capturas totais" | RODA | `contacts.created_at` | idem |
| Card "A fazer follow-up" | +MELHORA | `contacts.proximo_follow_up` | vira card de saúde "Clientes em risco" |
| Card "Em negociação" | RODA | `contacts.estagio` | absorvido pelo gráfico de funil (2ª camada) |
| Card "Fechados" | RODA | `contacts.estagio` | idem, vira conversão no gráfico de funil |
| Card "Pendentes de sync" | RODA | `contacts.*_sync_status` | métrica de engenharia, vai pra fila operacional (decisão 7) |
| Card "Orçamentos no Iddas" (mock) | MUDA-FONTE | STUB | `bronze_iddas_orcamento` real |
| Card "Vendas no Iddas" (mock) | MUDA-FONTE | STUB | `bronze_iddas_venda` real |
| Hint "Ticket médio" (mock) | MUDA-FONTE | STUB | conta de gold sobre `bronze_iddas_venda` |
| Card "Tickets abertos (CM)" | RODA | `ClickMassa API` | vira sinal no gráfico de funil |
| Card "Posts publicados" | RODA | `Sanity` | sai do gerencial (blog tem admin próprio) |

**Funcionalidades:**
- **+ADICIONA** primeira dobra de saúde do negócio (6 cards, semáforo, linguagem da dona): Dinheiro que entrou (`bronze_iddas_receita`), Dinheiro que saiu (`bronze_iddas_despesa`), Sobrou/lucro (gold), Margem líquida (`bronze_iddas_venda.percentual_lucro`/gold), Reservas confirmadas 30d (`bronze_iddas_venda` + datas), Clientes em risco (`contacts.proximo_follow_up`).
- **+ADICIONA** segunda camada de gráficos com drilldown: Origem do lead, Ranking por estado, Tags (os três de `bronze_clickmassa_contacts_dashboard.raw_payload`), Receita por categoria (`bronze_iddas_receita.categoria`), Funil por estágio + conversão.
- **+ADICIONA** regra de drilldown: todo gráfico clica e desemboca na lista operacional de Contatos (D-F1.5).
- **RODA** os 3 cards mock como mock (até o Lote 3 nenhum número inventado fica no ar).

---

## Tela 2 — Contatos-lista (operacional)

**Veredito:** estrutura fica, ganha a faixa de cards-de-gap no topo. O que é técnico (sync) sai ou vira completude.

| Elemento atual | Destino | Vem de | Vai pra |
|---|---|---|---|
| Título, "+ Novo contato" | INTOCADO | — | igual |
| Busca livre | INTOCADO | `contacts` (memória) | igual |
| Selects Estágio / Origem / Tags | INTOCADO | `contacts` | igual |
| Select "Sync" | RODA | `contacts.*_sync_status` | substituído por filtro de Completude |
| Select "Ações em massa" (stub) | RODA | alert stub | sai da v1 (volta se virar ação real) |
| Colunas Nome / Origem / Estágio / Destino | INTOCADO | `contacts` | igual |
| Coluna "Sync" (SyncBadge) | MUDA-FONTE | `contacts.*_sync_status` | vira coluna Completude lendo `contacts` + status por provider de `contact_external_links` |
| Contador, paginação, estado vazio | INTOCADO | derivado | igual |

**Funcionalidades:**
- **+ADICIONA** faixa de cards-de-gap no topo (progressive profiling, D-F1.2), cada um vira fila clicável: "Sem email", "Sem telefone" (E1), "Sem origem", "Possível duplicado" (os 19 ambíguos + colisões), "Sem CPF" (pros que viraram venda), "Cadastro internacional incompleto" (sem passaporte). Fonte: `contacts` (campos null) + fila de dedupe.
- **+ADICIONA** coluna/indicador de Completude (semáforo do cadastro), fonte `contacts` derivado.
- **+ADICIONA** fila "Contatos a tratar" (E1): sem telefone, ambíguos, exceções de dedupe.

---

## Tela 3 — Contatos-detalhe (operacional, coração do SCV)

**Veredito:** Dados/Qualificação/Gestão/Timeline ficam (design livre, fonte segue). O card "Sistemas Externos" não sobrevive: vira proveniência + ação. Entram dois blocos novos (Negócios empilhados, Pessoa de contato PJ).

| Elemento atual | Destino | Vem de | Vai pra |
|---|---|---|---|
| Voltar, H1 nome, StageBadge, subtítulo | INTOCADO | `contacts` | igual |
| Card Dados (whatsapp, email, cpf, nasc, nac, cidade/estado, cep) | INTOCADO | `contacts` | igual + etiqueta de proveniência por campo |
| Card Qualificação (origem, destino, prazo, orçamento, perfil, passageiros, datas, exp, restrições) | INTOCADO | `contacts` | igual |
| Card "Sistemas Externos" (inteiro, todos ⚠️) | RODA | `contacts.iddas_*` / `clickmassa_*` | substituído pelos dois blocos abaixo |
| Status sync Iddas / CM | MUDA-FONTE | `contacts.*_sync_status` | status por provider em `contact_external_links` |
| IDs Iddas/CM (pessoa, cotação, orçamento, venda, contact_id, ticket, step) | MUDA-FONTE | `contacts.*` cravado | `contact_external_links` (external_id, external_ref, deep_link_url) |
| Botão "Abrir no Iddas" (stub) | MUDA-FONTE | alert stub | deep-link real de `contact_external_links.deep_link_url` |
| Botão "Abrir no ClickMassa" (stub) | MUDA-FONTE | alert stub | idem |
| Botão "Forçar nova sync" (stub) | RODA | alert stub | sai da v1 (volta com o sync recorrente, fora do MVP) |
| Gestão Interna (estágio, follow-up, notas, salvar) | INTOCADO | `contacts` | igual |
| Tags read-only + botão "+" (stub) | +MELHORA | `tags`/`contacts` | edição de tag real (mata o stub) |
| Timeline de interações | INTOCADO | `contact_interactions` | igual (ganha interações do enriquecimento CM, pós-MVP) |

**Funcionalidades:**
- **+ADICIONA** etiqueta de proveniência por campo (D-F1.6, E3): "email veio do site, faturamento do Iddas", lendo `field_provenance`.
- **+ADICIONA** bloco "Negócios" empilhado (E3): pilha de orçamentos e vendas do contato, 1:N, de qualquer origem, fonte `bronze_iddas_orcamento` + `bronze_iddas_venda` (+ empilhados de origem CM e do painel). Nunca um id solto. Tabela silver de negócios com nome/colunas definidos no DDL contra o repo, não inventados.
- **+ADICIONA** formulário de adicionar/complementar financeiro no bloco Negócios (E4): a Julia/Nina digita uma venda/receita/despesa que não veio do Iddas, ou preenche campo vazio de um registro do Iddas. Rótulos do front livres, mas alimentam os campos reais que o dash soma (venda: `venda`/`custo`/`lucro`/`percentual_lucro`/`data`/`situacao`; receita/despesa: `categoria`/`valor`/`data`). Cada linha leva etiqueta "painel". Regra de sync: novo sync nunca sobrescreve, só adiciona e preenche-vazio (MVP, sem exceção). Edge aceito: venda digitada que depois chega do Iddas pode duplicar; dedupe de negócio é pós-MVP.
- **+ADICIONA** campo "Pessoa de contato" (E2): ativo só quando o contato é PJ (CNPJ), fonte `contacts.pessoa_contato`.
- **+ADICIONA** ação WhatsApp via ClickMassa (egress por canal): deep-link se origem CM, push via API se outra, pela abstração `lib/integrations/`.

---

## Tela 4 — Funil-kanban (operacional)

**Veredito:** quase tudo fica. Só o JOIN do nome troca de fonte. A lente gerencial do funil NÃO mora aqui, mora no Dashboard (gráfico).

| Elemento atual | Destino | Vem de | Vai pra |
|---|---|---|---|
| H1, contador, badge de cache, banner de API | INTOCADO | `ClickMassa API` | igual |
| Colunas (header, cor, count, soma) | INTOCADO | `ClickMassa API` | igual |
| OppCard: nome, valor, responsável, data | INTOCADO | `ClickMassa API` | igual |
| OppCard: nome do contato (JOIN) | MUDA-FONTE | `contacts.clickmassa_contact_id` ⚠️ | JOIN via `contact_external_links` provider=clickmassa |
| Estados vazios | INTOCADO | condicional | igual |

**Funcionalidades:**
- INTOCADAS no geral. Bloqueador: `/opportunities` 404 até ativar módulo no admin do CM (Nina/Julia). Sem isso, a tela toda fica no estado vazio.

---

## Tela 5 — Funil-detalhe da oportunidade (operacional)

**Veredito:** a tela mais limpa, quase nada muda. Só o "Motivo (ID)" cru melhora.

| Elemento atual | Destino | Vem de | Vai pra |
|---|---|---|---|
| Tudo (dados, contato, produtos, ações ganha/perdida, form de edição) | INTOCADO | `ClickMassa API` | igual |
| Campo "Motivo (ID)" free-text (stub G.2) | +MELHORA | usuário digita ID cru | `select` lendo endpoint de motivos quando mapeado |

---

## Resumo de esforço por tela

| Tela | Peso da mudança | Por quê |
|---|---|---|
| Dashboard | **Alto** (quase nova) | 6 cards de saúde novos + 5 gráficos + mata 3 mocks + tira contadores técnicos |
| Contatos-detalhe | **Alto** | mata Sistemas Externos, adiciona proveniência, Negócios empilhados, Pessoa de contato PJ, ação WhatsApp |
| Contatos-lista | **Médio** | ganha cards-de-gap e completude, perde sync técnico |
| Funil-kanban | **Baixo** | só o JOIN troca de fonte |
| Funil-detalhe | **Mínimo** | só o Motivo ID melhora |

**O que trava antes de virar Codinho:** os MUDA-FONTE todos dependem da `contact_external_links` (decisão 1) existir e estar populada (Lote 1). Por isso a ordem dos lotes no plano segue de pé: Lote 1 popula a silver na forma certa, e só então os MUDA-FONTE e os +ADICIONA de cada tela rodam em cima de base real. Este memorial é o contrato que não quebra na hora de instruir o Codinho, tela por tela.
