# Contrato de dados do back-office refatorado v1

**Projeto:** Presença Digital Spinhardi · back-office
**Autor:** Alan + Claudinho · **Data:** 2026-06-18
**Status:** rascunho pra aprovação. Vira o norte de todos os lotes da Fase 3.

Este documento define, por tela e por viés, o shape que o gold serve, lendo qual silver, com qual origem. É o reflexo do diff (Fase 0), das decisões da pesquisa (Fase 1) e das seis leis. Tudo ancorado no schema silver real (49 colunas em `contacts`) e nas colunas bronze confirmadas no MOAS.

Padrões adotados da Fase 1: **SCV** (Single Customer View) nomeia a fonte-da-verdade. **Progressive Profiling** nomeia os cards-de-gap. **3 a 6 indicadores** na primeira dobra. **Overview → drill → records** com mesma linguagem. **Etiqueta de proveniência** visível.

---

## 1. Modelo canônico da pessoa (SCV) na silver

### 1.1 O que `contacts` é hoje (real, do MOAS)

49 colunas. Agrupam em: identidade/contato (name, whatsapp, email, cpf, data_nascimento, nacionalidade, cep, cidade, estado, pais), qualificação (origem, origem_detalhe, destino_tipo, destino_texto, orcamento_estimado, prazo_ideal, perfil_viajante, data_ida, data_volta, passageiros_*, experiencia_anterior, restricoes), gestão interna (estagio, estagio_atualizado_em, proximo_follow_up, notas_internas, status, arquivado_em, motivo_arquivamento), engajamento (ultima_interacao, emails_abertos), e **14 colunas-ponte** cravadas em duas fontes.

### 1.2 A decisão de modularidade (TUA chamada, com recomendação)

**Fato medido:** das 49 colunas, 14 (28%) são ponte hardcoded: `iddas_pessoa_id`, `iddas_cotacao_code`, `iddas_orcamento_id`, `iddas_venda_id`, `iddas_ultimo_sync`, `iddas_sync_status`, `iddas_sync_error`, `clickmassa_contact_id`, `clickmassa_oportunidade_id`, `clickmassa_pipeline_step`, `clickmassa_ultimo_sync`, `clickmassa_sync_status`, `clickmassa_sync_error`, e `tags.clickmassa_tag_id` na tabela vizinha.

**O conflito direto com a lei 4 (fonte-agnóstico):** se cada origem nova (site, insta, google) adicionar 7 colunas dessas, a tabela cresce por fonte. Isso é o lixão estrutural. Sete fontes = 49 colunas de ponte numa tabela de pessoa.

**Recomendação (sujeita à tua aprovação):** extrair as pontes pra uma tabela `contact_external_links`:

```
contact_external_links
  id
  contact_id        -> contacts.id
  provider          text   (clickmassa | iddas | site | instagram | google_ads | ...)
  external_id       text   (id da pessoa/contato na origem)
  external_ref      text   (cotacao_code, oportunidade_id, etc, quando houver)
  deep_link_url     text   (pra abrir na origem)
  last_synced_at    timestamptz
  sync_status       text
  sync_error        text
  created_at, updated_at
  UNIQUE (contact_id, provider, external_id)
```

Origem nova vira **linha, não coluna.** `contacts` fica só com a pessoa (SCV puro). Casa com a lei 4 e com o padrão SCV da Fase 1 (golden record + source links).

**Por que decidir AGORA e não depois:** a silver tem 3 linhas. Não há dado pra migrar. O Lote 1 vai popular do zero. Popular já na forma certa custa o mesmo que popular na forma errada; refatorar depois de 1484 linhas populadas é o "12 passos pra trás". O custo real é tocar a data layer (`getContactById`) e o `SistemasExternosCard`, que hoje leem `contacts.clickmassa_contact_id` direto. É trabalho pequeno agora, caro depois.

**Contraponto honesto (pra você pesar):** se a decisão for que nunca vão entrar mais que essas 2 ou 3 fontes, a tabela-ponte é over-engineering e as colunas atuais servem. A lei 4 diz que vão entrar mais fontes. Eu recomendo a tabela. Decisão é tua. Resto do contrato assume a tabela; se você vetar, troca-se "linha em external_links" por "coluna em contacts" sem mudar o resto.

### 1.3 Proveniência por campo (lei 6, agora com UI)

Cada campo de `contacts` que pode vir de mais de uma fonte ganha proveniência. Forma recomendada, enxuta: uma coluna `field_provenance jsonb` em `contacts`, mapa `campo -> {origem, em}`. Não é coluna por campo, é um mapa só. O gold lê esse mapa pra mostrar a etiqueta "email veio do site, faturamento veio do Iddas" no detalhe (D-F1.6). O sync escreve nele e respeita a precedência (seção 2.3).

---

## 2. Regra de identidade e merge

### 2.1 Chave primária de identidade (SCV, decisão da Fase 1)

**Telefone normalizado + país.** Uma chave só, nunca alternar com email ou nome (causa nº1 de duplicata, Fase 1). Normalização: tira o 55, absorve o 9º dígito, compara os últimos 10. Email é corroboração secundária, nunca chave primária.

### 2.2 Os três conjuntos e os ambíguos (do diff/sonda)

- só-ClickMassa (~1003), só-Iddas (~166), ambos (~490 cruzados pelo telefone).
- **19 ambíguos** (telefones de PJ tipo "Fattor Credito" que aparecem em vários registros): **nunca auto-merge.** Entram numa fila de revisão manual (vira card operacional, seção 4). Adivinhar identidade é dívida.

### 2.3 Precedência de merge por classe de campo (lei 6)

**Atenção a dois momentos distintos (refinado pela emenda E4):**
- **Construção inicial (Lote 1, uma vez):** a tabela abaixo vale. É aqui que o cadastro nasce e a precedência escolhe o melhor valor por campo.
- **Novo sync depois disso (MVP):** a tabela abaixo NÃO vale. Vigora a regra E4: novo sync é só aditivo e preenche-vazio, nunca sobrescreve, sem exceção. A precedência só volta a valer no pós-MVP de duas vias.

| Classe de campo | Quem manda (só na construção inicial) | Regra |
|---|---|---|
| Financeiro/fiscal (venda, custo, lucro, cpf, orçamento) | Iddas | Iddas é o sistema fiscal. Não sobrescreve com CM. |
| Conversa/interação (última msg, status de atendimento) | ClickMassa | CM é o canal. |
| Contato (nome, telefone, email) | mais recente verificado | Compara timestamp da origem. Nome-lixo do CM perde pra nome limpo do Iddas. |
| Qualificação (destino, perfil, orçamento estimado) | edição manual no backoffice > origem | O que a equipe digitou no painel manda. |

Grava origem+timestamp no `field_provenance`.

---

## 3. Gold gerencial (Dashboard) — viés de gestão

**Regra de tamanho (D-F1.3):** máximo 6 cards na primeira dobra. Semáforo (saudável/atenção/crítico) + comparação vs período anterior. Linguagem da dona (D-F1.4). Todo gráfico desemboca numa lista (D-F1.5, "próximo clique útil").

### 3.1 Primeira dobra — saúde do negócio (Julia cuida, Nina olha)

| Card | Shape | Lê de (silver/origem) | Gap | Drilldown |
|---|---|---|---|---|
| Dinheiro que entrou no mês | valor + semáforo + vs mês passado | gold sobre `bronze_iddas_receita` (pagamento preenchido) | (d) sobre (a) | lista de receitas do mês |
| Dinheiro que saiu | idem | `bronze_iddas_despesa` | (d) sobre (a) | lista de despesas |
| Sobrou (lucro do mês) | valor + semáforo | entrou menos saiu | (d) | quebra receita/despesa |
| Margem líquida | % + semáforo (alvo ~12, vermelho se <0) | gold sobre venda | (d) | vendas do mês |
| Reservas confirmadas próx. 30d | contagem + valor | `bronze_iddas_venda` + datas de viagem | (d) sobre (a) | lista de reservas |
| Clientes em risco / follow-up pendente | contagem | `contacts.proximo_follow_up` vencido | (a) | fila operacional (cruza com seção 4) |

`ticket_medio` e `faturamento_total` ficam em segunda camada (não competem pela primeira dobra). Todos os números grandes são conta de gold (d) sobre colunas que já existem (diff Bloco 5).

### 3.2 Segunda camada — de onde vem o negócio (drill)

| Gráfico | Shape | Lê de | Gap | Drilldown |
|---|---|---|---|---|
| Origem do lead (agregada) | barras | `bronze_clickmassa_contacts_dashboard.raw_payload.origins` | (b) promover | lista de contatos daquela origem |
| Ranking por estado | mapa/barras | `...raw_payload.states` | (b) | contatos do estado |
| Tags semânticas | barras | `...raw_payload.tags` | (b) | contatos com a tag |
| Receita por categoria | pizza | `bronze_iddas_receita.categoria` | (d) sobre (a) | receitas da categoria |
| Funil por estágio | ver seção 5 | — | — | — |

---

## 4. Gold operacional (Contatos) — viés de operação

Lista linha a linha + detalhe + ação. SCV na veia. Mesma linguagem do gerencial (D-F1.4).

### 4.1 Cards-de-gap no topo (Progressive Profiling, D-F1.2)

Cada card é uma fila de tarefa. Clica → lista filtrada → detalhe → nudge de 1 a 3 campos. Quais gaps acusar (do diff: o que vem vazio mas tem coluna):

- **Sem email** (CM email 0%, Iddas 25%) → nudge "adicione o email pra mandar proposta"
- **Sem origem definida** (origem por-pessoa não vem do CM) → nudge de classificar origem
- **Possível duplicado** (os 19 ambíguos + colisões de telefone) → tela de merge lado a lado (Fase 1, Insycle-style)
- **Sem CPF** (só pros que viraram venda, pro fiscal) → nudge contextual
- **Cadastro incompleto pra viagem internacional** (sem passaporte/validade) → puxa do raw Iddas se já tiver (diff Bloco 2, gap b), senão pede

Regra: nudge pede pouco, no momento certo, com uso claro. Nunca formulário gigante.

### 4.2 Lista — shape (redesenho ancorado no binding, seção 8)

Os dados que a lista consome estão certos: nome, origem, estágio (StageBadge), destino, sync (SyncBadge). O que muda no redesenho: a coluna "Sync" (conceito técnico nosso, não da dona) some ou vira coluna de **completude** (semáforo do cadastro) que alimenta os cards-de-gap. Filtros em memória já existem. O design da tabela em si é redesenho livre (presentacional), só o SyncBadge versiona junto com a migração `external_links` (seção 8).

### 4.3 Detalhe — shape (redesenho ancorado no binding, seção 8)

Os dados de Dados, Qualificação, Gestão interna e Timeline (`contact_interactions`) seguem válidos e o redesenho desses blocos é livre. O card "Sistemas externos" **não sobrevive como está**: ele é 100% fonte-cravada (todas as ⚠️). No redesenho ele deixa de ser "lista de IDs de sistema" e vira o lugar onde a **proveniência** (D-F1.6, "email veio do site, faturamento do Iddas") e a **ação por canal** (4.4) se materializam, lendo `contact_external_links` (seção 1.2). Esse card é o que mais muda, e muda versionado junto com a migração.

### 4.4 Ação por canal (lei do egress por canal)

- **WhatsApp** sempre via ClickMassa, pela abstração `lib/integrations/`. Lead de origem CM: deep-link real (lê `external_links` provider=clickmassa). Lead de outra origem: empurra pro CM via API e interage lá. Mata os `alert()` stub.
- **Email** via Resend (pós-MVP, entra como provider, não reescrita).
- Botão "abrir na origem" forma URL real a partir de `external_links.deep_link_url`.

---

## 5. Funil nas duas lentes

| Lente | Onde | Shape | Lê de | Drilldown |
|---|---|---|---|---|
| Gerencial | Dashboard | gráfico de estágios: contagem + valor por estágio + conversão cotado→vendido | `bronze_clickmassa_opportunities` + `pipeline_steps`; conversão = (d) sobre orcamento+venda Iddas | clica no estágio → kanban filtrado |
| Operacional | `/funil` | kanban (Lote G.1 existente): cards de oportunidade, header com count+soma | API CM ao vivo + JOIN `contacts` via external_links | clica no card → detalhe da oportunidade |

**Bloqueador conhecido:** `/opportunities` dá 404 até ativação do módulo no admin do CM (Nina/Julia). Trava a lente operacional do funil e o merge de `feature/lote-g1-funil`. A lente gerencial pode usar Iddas (orcamento.situacao) enquanto o CM não destrava.

---

## 6. Origens (capture_origins) como ponto de plug

`capture_origins` já existe como lookup (slug, name, campanha_ativa). É o registro das fontes. Toda origem nova (site, insta, google) entra aqui e ganha linha em `external_links`. É o que torna fonte-agnóstico operacional, não só teórico. O `provider` de `external_links` referencia o slug de `capture_origins`.

---

## 7. Resumo das decisões que este contrato trava

1. `contacts` = SCV puro. Pontes saem pra `contact_external_links` (recomendado, **decisão de Alan**).
2. Proveniência num `field_provenance jsonb`, visível como etiqueta no detalhe.
3. Identidade = telefone normalizado + país, chave única. 19 ambíguos = fila manual, nunca auto-merge.
4. Precedência de merge por classe de campo (tabela seção 2.3).
5. Dashboard = máx 6 cards primeira dobra, semáforo, linguagem da dona, tudo drilla pra lista.
6. Contatos = cards-de-gap (progressive profiling), lista e detalhe **redesenhados** ancorados no binding (seção 8), ação WhatsApp via CM.
7. Funil = gráfico no Dashboard, kanban em `/funil`, bloqueado pelo módulo Opportunities.
8. Números grandes são gold (d); agregados CM são promoção de raw (b); financeiro Iddas é (a). Bronze não precisa de mais ETL pro consumo conhecido.

**O que precisa do teu OK antes do Lote 1:** decisão 1 (tabela de vínculo) e a tabela de precedência (decisão 4). As duas moldam como a promoção bronze→silver vai escrever. Sem elas travadas, o Lote 1 não roda certo.

---

## 8. Camada de binding de UI e regras de redesenho (o nó fechado)

O design das telas vai mudar, e o mapa elemento-versus-fonte do Codinho (anexo de referência, não colado aqui) liga cada elemento visível à sua fonte: origem → bronze → silver → gold → elemento. Isso permite redesenhar sabendo o custo de mover cada peça. O que o contrato fixa:

### 8.1 Fronteira da migração `external_links` (estreita, versionar UI+dado junto)

Os campos fonte-cravada (`clickmassa_*` / `iddas_*` em `contacts`) tocam exatamente quatro pontos de UI. Qualquer redesenho que dependa deles versiona junto com a migração; o resto é livre.

| Ponto de UI | Tela | Hoje lê | Depois lê |
|---|---|---|---|
| Card Sistemas Externos (inteiro) | Contatos-detalhe | colunas cravadas | `contact_external_links` + proveniência |
| SyncBadge (coluna + filtro) | Contatos-lista | `*_sync_status` | status por provider em `external_links` |
| Card "Pendentes de sync" | Dashboard | `*_sync_status` | ver 8.3 (sai da primeira dobra) |
| JOIN nome do contato | Funil-kanban | `clickmassa_contact_id` | `external_links` provider=clickmassa |

### 8.2 Blast-radius dos componentes compartilhados

| Componente | Redesenho afeta | Cuidado |
|---|---|---|
| `Button` | todas as telas admin **e o site público** | mudança visual propaga global; testar fora do admin |
| `DashboardCard` | os cards do dashboard de uma vez | agnóstico a dado, redesenho livre e consistente |
| `StageBadge` | lista + detalhe | mexer em `ESTAGIO_LABELS` afeta filtros e kanban junto |
| `SyncBadge` | lista | campo cravado, versiona com 8.1 |
| `AdminHeader` / `AdminSidebar` | todas as telas autenticadas | visual livre; nav depende de role (auth), sem tocar data layer |
| `Field` (helper) | local | sem cascata |

### 8.3 Regras de redesenho

- **Livre (não toca dado):** grid, layout, paginação, estados vazios, atalhos, badges de nav, qualquer `DashboardCard`, os blocos Dados/Qualificação/Gestão/Timeline do detalhe.
- **Versiona com a migração `external_links`:** os quatro pontos de 8.1. Não redesenhar isolado.
- **Não enfatizar (é fumaça até o Lote 3):** os 3 cards Iddas do dashboard são mock seedado por dia. Redesenho não pode dar destaque a número inventado, engana a Nina. Morrem lendo `bronze_iddas_*` real no Lote 3.
- **Métrica de engenharia fora da primeira dobra gerencial:** "Pendentes de sync" é conceito nosso, não da dona (D-F1.3 e D-F1.4). Vira item de fila operacional (higiene), não card de saúde do negócio.
- **Corrigir no caminho:** "Motivo (ID)" no funil-detalhe mostra ID cru sem label (TODO G.2); vira `select` quando o endpoint de motivos for mapeado.

### 8.4 Matéria-prima ociosa (Índice A) — registrada, não-MVP

A silver já carrega campos que nenhum elemento exibe: `emails_abertos`, `ultima_interacao`, `campanhas_ativas`, `posts_lidos`, `contact_interactions.metadata`. É um viés de relacionamento/engajamento inteiro parado. Não entra no MVP (mkt via Resend é ~45 dias), mas fica registrado: quando o canal de email/campanha entrar, a matéria-prima já está na silver, é só promover pra gold. Confirma de novo a tese do diff: a silver é rica, o front mostra pouco.

**Consequência pro Lote 1:** a promoção bronze→silver já escreve na forma de `external_links` (se decisão 1 = sim), pra nascer na forma que o redesenho do detalhe vai consumir. UI e dado andam juntos a partir daqui, nunca um na frente do outro.

---

## 9. Emendas pós-aprovação (refinamentos do Alan, vinculantes)

Aprovadas junto com as 12 decisões. Dobram sobre as seções 1, 2 e 4.

- **E1 (sobre decisão 3, identidade).** Telefone é chave válida porque está preenchido na maioria. A minoria sem telefone, as exceções de dedupe e os ambíguos **não falham em silêncio**: viram ação no front (card-de-gap "sem telefone" e fila de "contatos a tratar"). Identidade incerta é tarefa visível, nunca descarte nem adivinhação.
- **E2 (sobre decisão 4, ambíguos PJ).** Contato pessoa jurídica (CNPJ) ganha campo **`pessoa_contato`** no modelo canônico (`contacts`), exibido e editável no detalhe **só quando o tipo é PJ**. É a pessoa humana de contato dentro da empresa. Campo de dado novo, não só UI.
- **E3 (sobre decisão 5, merge).** O backoffice **empilha**. Orçamento, venda, receita ou qualquer registro de negócio, de qualquer origem (Iddas, CM, futuro), é **guardado e acumulado** sob o contato (1:N), nunca colapsado num campo único nem sobrescrito. Reforça a decisão 1: registro de negócio é coleção, não id solto em `contacts`. O detalhe do contato mostra a pilha (bloco "Negócios"). Write-back pro Iddas é pós-MVP.

- **E4 (sobre E3 + decisão 5, entrada manual de financeiro no painel). Entra no MVP.**
  - **Funcionalidade (ganho real pra Julia e Nina):** no bloco "Negócios" do detalhe do contato, dá pra adicionar manualmente um registro financeiro e complementar campo vazio de um registro que veio do Iddas. A Julia fecha uma venda no WhatsApp que não está no Iddas, adiciona ali; o Iddas mandou um orçamento sem data, ela preenche a data.
  - **Onde mora:** numa tabela silver de negócios cujo **nome e colunas são definidos no DDL contra o repo real, não inventados aqui** (D024). Ela une, com etiqueta de origem por linha: registros promovidos do `bronze_iddas_*`, registros de origem CM, e os digitados no painel.
  - **Sem inventar campo financeiro:** o formulário não cria campo novo. Os rótulos do front são livres ("Valor da venda", "Custo"), mas cada um alimenta o MESMO conjunto que já vem do Iddas e que o dashboard soma: de venda → `venda`, `custo`, `lucro`, `percentual_lucro`, `data`, `situacao`; de receita/despesa → `categoria`, `valor`, `data`. O registro manual cai na mesma conta do dash financeiro, sem estrutura paralela.
  - **Regra de sync (MVP, sem exceção):** um **novo** sync nunca sobrescreve. Só adiciona linha nova e preenche vazio (fill-null). Protege principalmente o que foi digitado no painel. Isso supera a precedência da seção 2.3, que só vale na construção inicial (Lote 1). Reconciliação de conflito real fica pro pós-MVP de duas vias.
  - **Edge aceito no MVP:** se a Julia digitar uma venda e a mesma venda chegar depois pelo Iddas, viram duas linhas na pilha (possível dupla contagem). Dedupe no nível de negócio é pós-MVP (duas vias), conforme tua call.
