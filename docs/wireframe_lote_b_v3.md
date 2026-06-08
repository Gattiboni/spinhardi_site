# Wireframe — Lote B v3 · Spinhardi como source of truth

**Versão:** 3.0 (substitui v1 e v2)
**Status:** alinhado com decisão arquitetural: Supabase nosso é fonte da verdade. Iddas e ClickMassa são canais operacionais.
**Escopo:** Fases 1.8 + 1.9 + 1.10 do plano v3, reescopadas

---

## Princípio arquitetural

```
Site form / Google Ads / Indicação / Eventos / Manual / ...
                          ↓
                  Supabase nosso (FONTE DA VERDADE)
                          │
            ┌─────────────┼─────────────┐
            ↓             ↓             ↓
          Iddas        ClickMassa      Outros (futuro)
       (operacional   (atendimento     (campanhas,
        cotações)       WhatsApp)       email, etc)
```

- **Nosso Supabase guarda TUDO.** Toda pessoa com quem Spinhardi se relaciona vira `contact`.
- **Iddas e ClickMassa são consumidores especializados.** Recebem o subset de dados que cada um trata.
- **Inteligência (segmentação, automação, IA) mora aqui.** Iddas/ClickMassa não têm como cruzar nossos dados com comportamento de blog, campanhas, etc.

---

## Modelagem da tabela `contacts`

Estrutura desenhada pra **nascer rica e crescer sem refactor**. No Lote C vira SQL direto. Por enquanto vive em mock TypeScript.

### Campos por agrupamento

**1. Identificação (sempre presente):**

```
id                  uuid
createdAt           timestamp
updatedAt           timestamp
```

**2. Dados pessoais (vêm do form, são canônicos):**

```
name                string (obrigatório)
whatsapp            string (obrigatório, formato +5511999998888)
email               string (opcional mas valioso)
cpf                 string (opcional, requerido pelo Iddas pra venda)
dataNascimento      date (opcional, requerido pra passagens/seguros)
nacionalidade       string (default "Brasileira")
```

**3. Endereço (relevante pra Iddas):**

```
cep                 string
cidade              string
estado              string
pais                string (default "Brasil")
```

**4. Qualificação (campos NOSSOS pra inteligência de CRM):**

```
origem              enum: "site_contato" | "google_ads" | "instagram" |
                          "indicacao" | "evento" | "manual" | "importado"
origemDetalhe       string (livre — ex: "Campanha Itália Setembro", nome do indicador)

destinoTipo         enum: "italia" | "europa_geral" | "cruzeiro" |
                          "america_sul" | "outro" | "indefinido"
destinoTexto        string (livre — descrição complementar do destino)

orcamentoEstimado   enum: "ate_5k" | "5k_15k" | "15k_30k" | "30k_50k" |
                          "acima_50k" | "nao_informado"

prazoIdeal          enum: "1_3_meses" | "3_6_meses" | "6_12_meses" |
                          "acima_12_meses" | "flexivel" | "data_fixa"

dataIda             date (opcional, se já tem data)
dataVolta           date (opcional)

passageirosAdultos  int (default 1)
passageirosCriancas int (default 0)
passageirosBebes    int (default 0)

perfilViajante      enum: "primeira_viagem_internacional" | "viajante_frequente" |
                          "lua_de_mel" | "familia" | "grupo_amigos" |
                          "negocios" | "outro"

experienciaAnterior string (livre — "já visitou Itália, Portugal, Espanha")
restricoes          string (livre — "vegetariano, mobilidade reduzida")
```

**5. Estágio interno (NOSSO funil):**

```
estagio             enum: "novo" | "qualificado" | "proposta_enviada" |
                          "em_negociacao" | "aguardando_pagamento" |
                          "fechado_confirmado" | "viagem_realizada" |
                          "em_espera" | "perdido"

estagioAtualizadoEm timestamp
proximoFollowUp     date (opcional)
notasInternas       text (campo livre rico)
```

**6. Tags (segmentação livre):**

```
tags                string[] (ex: ["italia_2026", "vip", "indicado_patricia"])
```

**7. Espelho do Iddas:**

```
iddasPessoaId       string (id no sistema Iddas após sync)
iddasCotacaoCode    string (código da cotação criada)
iddasOrcamentoId    string (se virou orçamento ativo)
iddasVendaId        string (se virou venda fechada)
iddasUltimoSync     timestamp
iddasSyncStatus     enum: "synced" | "pending" | "failed"
iddasSyncError      string (mensagem do último erro)
```

**8. Espelho do ClickMassa:**

```
clickmassaContactId    string
clickmassaTicketIds    string[] (pode ter múltiplos tickets ao longo do tempo)
clickmassaTagsId       int[] (ids das tags do ClickMassa, espelhadas)
clickmassaOportunidadeId string
clickmassaPipelineStep string
clickmassaUltimoSync   timestamp
clickmassaSyncStatus   enum: "synced" | "pending" | "failed"
clickmassaSyncError    string
```

**9. Comportamento (vai virar valioso conforme cresce):**

```
postsLidos          string[] (slugs dos posts do blog que o contato leu)
ultimaInteracao     timestamp (qualquer canal)
emailsAbertos       int (futuro, quando email marketing entrar)
campanhasAtivas     string[] (futuro)
```

**10. Metadados gerais:**

```
status              enum: "ativo" | "arquivado" | "duplicado" | "anonimizado_lgpd"
arquivadoEm         timestamp
motivoArquivamento  string
```

---

### Tabelas relacionadas (modeladas conceitualmente, SQL no Lote C)

**`contact_interactions`** — histórico de tudo que aconteceu com o contato

```
id              uuid
contactId       uuid (FK → contacts.id)
tipo            enum: "form_submission" | "whatsapp_recebido" |
                      "whatsapp_enviado" | "email_recebido" |
                      "email_enviado" | "ligacao" | "reuniao" |
                      "nota_interna" | "mudanca_estagio" |
                      "sync_iddas" | "sync_clickmassa"
descricao       text
metadata        jsonb (payload variável por tipo)
criadoPor       string (usuário interno ou "sistema")
criadoEm        timestamp
```

**`capture_origins`** — origens de captura configuráveis

```
id              uuid
slug            string (único — ex: "site_contato", "ads_italia_set")
nome            string (display — "Site - Formulário de Contato")
descricao       string
ativo           boolean
campanhaAtiva   boolean (se é campanha temporária)
criadoEm        timestamp
```

**`tags`** — vocabulário controlado de tags

```
id              uuid
slug            string
nome            string
cor             string (hex)
grupo           string (ex: "destino", "perfil", "campanha")
ativo           boolean
```

---

## Fluxo de captação

```
┌──────────────────────────────────┐
│ Form do site (/contato)          │
│ ou endpoint /api/capture/[slug]  │ ← Google Ads, Instagram apontam aqui
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Server Action: captureContact()  │
│                                  │
│ 1. CRIA contact no Supabase com  │
│    todos os campos preenchidos   │
│    do form + origem identificada │
│                                  │
│ 2. Cria interação                │
│    tipo "form_submission"        │
│                                  │
│ 3. Promise.allSettled:           │
│    - POST Iddas (subset)         │
│    - POST ClickMassa (subset)    │
│                                  │
│ 4. Atualiza contact com IDs      │
│    retornados + sync_status      │
│                                  │
│ 5. Cria 2 interações tipo        │
│    sync_iddas / sync_clickmassa  │
│                                  │
│ 6. Retorna sucesso pro usuário   │
└──────────────────────────────────┘
```

**Princípio crítico:** o contact é criado **antes** de qualquer chamada externa. Se Iddas/ClickMassa caírem, o contact existe no Supabase com `syncStatus = "pending"` e pode ser re-sincronizado depois. **Zero perda de lead.**

---

## Formulário do site `/contato`

### Estrutura visual em 4 grupos

```
┌─ Sobre você ───────────────────────────────┐
│ Nome *                                     │
│ WhatsApp *                                 │
│ E-mail                                     │
└────────────────────────────────────────────┘

┌─ Sobre a viagem ───────────────────────────┐
│ Para onde você quer ir? *                  │
│ [Select: Itália / Europa em geral /        │
│         Cruzeiro / América do Sul /        │
│         Outro destino / Ainda não sei]     │
│                                            │
│ Pode contar mais sobre o destino?          │
│ [textarea curto - opcional]                │
│                                            │
│ Quando você quer viajar?                   │
│ [Select: Próximos 3 meses / 3 a 6 meses /  │
│         6 a 12 meses / Mais de 1 ano /     │
│         Tenho flexibilidade /              │
│         Tenho data fixa]                   │
│                                            │
│ Se tiver data fixa, qual?                  │
│ [Date opcional]                            │
│                                            │
│ Quantas pessoas vão viajar?                │
│ Adultos: [num]  Crianças: [num]  Bebês: [num]│
└────────────────────────────────────────────┘

┌─ Sobre o perfil da viagem ─────────────────┐
│ Qual o perfil dessa viagem?                │
│ [Select: Primeira viagem internacional /   │
│         Viajante frequente / Lua de mel /  │
│         Família / Grupo de amigos /        │
│         A negócios / Outro]                │
│                                            │
│ Faixa de orçamento que tem em mente?       │
│ [Select: Até R$ 5 mil / R$ 5 a 15 mil /    │
│         R$ 15 a 30 mil / R$ 30 a 50 mil /  │
│         Acima de R$ 50 mil /               │
│         Prefiro conversar sobre isso]      │
└────────────────────────────────────────────┘

┌─ Quer compartilhar algo mais? ─────────────┐
│ [Textarea livre]                           │
│ Placeholder: "Conta um pouco mais sobre o  │
│ que tem em mente. Quanto mais a gente      │
│ souber, melhor a conversa fica."           │
└────────────────────────────────────────────┘

[Enviar pedido de cotação]
Também pode chamar direto no WhatsApp.
```

### Decisões críticas

- **Select estruturado pra destino** (não texto livre) — permite segmentação. Mas tem textarea complementar pra detalhes.
- **Prazo + Orçamento + Perfil** são os 3 campos de **qualificação** que o setor de turismo considera ouro (confirmados pela pesquisa de CRM boutique).
- **Form longo, sim.** É deliberadamente longo porque cada campo extra preenchido é qualificação prévia que salva tempo de atendimento depois. Como o público da Spinhardi é boutique (ticket alto, viagem internacional), eles aceitam preencher mais. Não é form de e-commerce.
- **CPF, data de nascimento, endereço** **não** entram no form do site. Vêm depois na conversa, ou na hora de fechar a venda no Iddas. Form do site = qualificação inicial, não dossiê completo.

---

## Telas do admin

### TELA 1 — `/admin` (Dashboard)

```
┌──────────────────────────────────────────────────────────┐
│ Bom dia, Alan                                            │
│ Sexta, 7 de junho                                        │
│                                                          │
│ ── HOJE ──                                               │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│ │ Novos    │ │ A fazer  │ │ Pendentes│                   │
│ │ contatos │ │ follow-up│ │ de sync  │                   │
│ │   3      │ │    7     │ │    0  ✓  │                   │
│ └──────────┘ └──────────┘ └──────────┘                   │
│                                                          │
│ ── ESTE MÊS ──                                           │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│ │ Capturas │ │ Em       │ │ Fechados │                   │
│ │ totais   │ │ negociação│ │          │                   │
│ │   28     │ │    9     │ │    4     │                   │
│ └──────────┘ └──────────┘ └──────────┘                   │
│                                                          │
│ ── ATALHOS ──                                            │
│ [📥 Ver contatos]  [📝 Novo post]  [⚙ Config]            │
└──────────────────────────────────────────────────────────┘
```

**6 cards. Todos consomem nosso Supabase.** Sem badges "Em breve" — tudo é nosso, tudo é real.

- **Novos contatos (hoje):** `count(contacts WHERE createdAt = today)`
- **A fazer follow-up:** `count(contacts WHERE proximoFollowUp <= today)`
- **Pendentes de sync:** `count(contacts WHERE iddasSyncStatus = 'pending' OR clickmassaSyncStatus = 'pending')`
- **Capturas totais (mês):** `count(contacts WHERE createdAt >= primeiro_dia_mes)`
- **Em negociação:** `count(contacts WHERE estagio = 'em_negociacao')`
- **Fechados:** `count(contacts WHERE estagio = 'fechado_confirmado' AND mes_atual)`

**Em dev (mock):** valores plausíveis baseados nos contatos mockados.

### TELA 2 — `/admin/contatos` (lista unificada)

Esta é a tela mais importante do back office.

```
┌────────────────────────────────────────────────────────────────────┐
│ Contatos                                       [+ Novo contato]    │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ [Buscar por nome, WhatsApp, e-mail, tag...]                  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ [Estágio ▾] [Origem ▾] [Tags ▾] [Sync ▾]    [Ações em massa ▾]    │
│                                                                    │
│ ┌─ Tabela ────────────────────────────────────────────────────┐    │
│ │ ☐ Nome           Origem    Estágio       Destino    Sync    │    │
│ ├─────────────────────────────────────────────────────────────┤    │
│ │ ☐ Maria Silva    Site      Qualificado   Itália     ✓✓      │    │
│ │ ☐ João Pereira   GoogleAds Em negoc.     Europa     ✓✓      │    │
│ │ ☐ Ana Mendes     Site      Proposta      Cruzeiro   ✓✓      │    │
│ │ ☐ Carlos Lima    Indicação Novo          Indefinido ⏳⏳    │    │
│ │ ☐ Patrícia       GoogleAds Aguard. pgto  América Sul ✓⚠    │    │
│ │ ☐ Fernando       Site      Fechado       Outro       ✓✓     │    │
│ │ ☐ Luciana        Site      Em espera     Itália      ✓✓     │    │
│ │ ☐ Roberto        Manual    Perdido       Europa      ✓✓     │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ Mostrando 8 de 28        [← Anterior]  Página 1 de 4  [Próxima →]  │
└────────────────────────────────────────────────────────────────────┘
```

**Decisões:**

- **Checkbox por linha + "Ações em massa"** — base da inteligência futura. Selecionar N contatos → "Enviar WhatsApp", "Adicionar tag", "Mudar estágio", "Exportar".
- **Coluna Sync com 2 ícones** — primeiro Iddas, segundo ClickMassa. `✓✓` = ambos OK. `⏳` = pendente. `⚠` = um falhou. `✗` = ambos falharam.
- **4 filtros** (Estágio, Origem, Tags, Sync). Frontend-only por enquanto, sem query params.
- **Coluna "Origem"** mostra de onde veio (site, GoogleAds, Indicação, Manual, etc).
- **Botão "+ Novo contato"** no canto superior direito — abre form de criação manual (cliente que ligou sem passar pelo site, etc).
- **8 mockados** com mix de estágios, origens, status de sync.

### TELA 3 — `/admin/contatos/[id]` (visão 360)

A tela mais densa, organizada em **3 colunas + 1 área de interações**.

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Voltar pra lista                                                 │
│                                                                    │
│ Maria Silva                                       [Editar]         │
│ Recebida em 07/06/2026 às 09h23 · Via Site                         │
│                                                                    │
│ ┌─ DADOS ─────┐  ┌─ QUALIFICAÇÃO ──┐  ┌─ SISTEMAS EXTERNOS ─────┐  │
│ │             │  │                 │  │                          │  │
│ │ WhatsApp    │  │ Origem          │  │ Iddas        ✓ Sincronz. │  │
│ │ +55 11...   │  │ Site            │  │ Pessoa: 1234            │  │
│ │ [Abrir]     │  │                 │  │ Cotação: v5bnh          │  │
│ │             │  │ Destino         │  │ Orçamento: 9876         │  │
│ │ E-mail      │  │ Itália          │  │ [Abrir no Iddas]         │  │
│ │ maria@...   │  │                 │  │                          │  │
│ │             │  │ Prazo           │  │ ClickMassa   ✓ Sincronz. │  │
│ │ CPF         │  │ 3 a 6 meses     │  │ Contact: 5678           │  │
│ │ (não inf.)  │  │                 │  │ Ticket atual: 193937    │  │
│ │             │  │ Orçamento       │  │ Etapa: Qualificado      │  │
│ │ Nascimento  │  │ R$ 15 a 30 mil  │  │ [Abrir no CM]            │  │
│ │ (não inf.)  │  │                 │  │                          │  │
│ │             │  │ Perfil          │  │ Última sync:             │  │
│ │ Cidade      │  │ Lua de mel      │  │ 07/06 09h24              │  │
│ │ São Paulo   │  │                 │  │                          │  │
│ │             │  │ Passageiros     │  │ [Forçar nova sync]       │  │
│ │             │  │ 2 adultos       │  │                          │  │
│ └─────────────┘  └─────────────────┘  └──────────────────────────┘  │
│                                                                    │
│ ┌─ GESTÃO INTERNA ──────────────────────────────────────────────┐  │
│ │ Estágio  [Em negociação ▾]                                    │  │
│ │ Tags     [italia_2026] [lua_de_mel] [+]                       │  │
│ │ Follow-up  [12/06/2026]                                       │  │
│ │ Notas internas                                                │  │
│ │ ┌───────────────────────────────────────────────────────────┐ │  │
│ │ │ Cliente bem qualificada. Quer Roma + Toscana, 14 dias.    │ │  │
│ │ │ Próxima conversa: terça pra falar de hospedagem boutique. │ │  │
│ │ └───────────────────────────────────────────────────────────┘ │  │
│ │ [Salvar alterações]                                           │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ ┌─ INTERAÇÕES (8) ─────────────────────────────────────────────┐   │
│ │ 07/06 09h23  📝 Captura via site (form de contato)          │   │
│ │ 07/06 09h24  🔄 Sincronizado com Iddas (cotação v5bnh)      │   │
│ │ 07/06 09h24  🔄 Sincronizado com ClickMassa (ticket 193937) │   │
│ │ 07/06 10h15  💬 Primeira mensagem enviada (atendente Maria) │   │
│ │ 07/06 14h30  💬 Cliente respondeu                           │   │
│ │ 07/06 15h00  📝 Nota interna (Amanda)                       │   │
│ │ 08/06 11h00  🎯 Mudança de estágio: Novo → Qualificado      │   │
│ │ 08/06 11h05  🏷️ Tag adicionada: italia_2026                 │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Decisões críticas:**

- **3 colunas no topo:** Dados pessoais / Qualificação / Sistemas externos. Cada uma cumpre função distinta. Sistemas externos são **resumo** dos sistemas espelho, com links pra abrir lá.
- **Gestão interna** é onde Nina/Julia trabalham no nosso CRM (estágio, tags, follow-up, notas). Aqui é diferente do que está no Iddas/ClickMassa porque é **a nossa visão de funil**, não a deles.
- **Botão "Salvar alterações"** vai mostrar alert "Implementação completa virá no Lote C" nesta fase. Visualmente funciona, mas não persiste ainda.
- **Linha do tempo de interações** — fundamental pra contexto. Ícones diferentes por tipo. Vem da tabela `contact_interactions`.
- **"Forçar nova sync"** vai mostrar alert no mock; no Lote C dispara re-sync.

### TELA 4 — `/admin/contatos/novo` (criação manual)

Mesmo form do site (mesmos campos), mas dentro do admin, com botão "Salvar". Em dev mostra alert. No Lote C cria contact com `origem: "manual"`.

### TELA 5 — `/admin/blog` (já existe, mantém)

Sem mudança.

### TELA 6 — `/admin/configuracoes`

```
┌──────────────────────────────────────────────────────┐
│ Configurações                                        │
│                                                      │
│ ┌─ Integração Iddas ────────────────────────────────┐│
│ │ Status:  ✓ Conectado                              ││
│ │ URL:     https://apiagencia.iddas.com.br          ││
│ │ Link de Solicitação público:                      ││
│ │ https://agencia.iddas.com.br/.../link/X           ││
│ │ Última sync: 07/06/2026 09h24                     ││
│ │ [Testar conexão]                                  ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
│ ┌─ Integração ClickMassa ───────────────────────────┐│
│ │ Status:  ✓ Conectado                              ││
│ │ Modelo:  WABA (Meta oficial)                      ││
│ │ Sessão WhatsApp:  ✓ Online                        ││
│ │ apiId:   xxx                                      ││
│ │ [Testar conexão]                                  ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
│ ┌─ Origens de captura ──────────────────────────────┐│
│ │ ✓ site_contato     Site - Form Contato            ││
│ │ ✓ google_ads       Campanhas Google Ads           ││
│ │ ✓ instagram        Bio/posts Instagram            ││
│ │ ✓ indicacao        Indicação de cliente           ││
│ │ ✓ manual           Cadastro manual                ││
│ │ [+ Adicionar origem]                              ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
│ ┌─ Mensagem padrão WhatsApp ────────────────────────┐│
│ │ Enviada automaticamente após captura:             ││
│ │ ┌───────────────────────────────────────────────┐ ││
│ │ │ Oi {nome}! Recebemos sua solicitação para     │ ││
│ │ │ {destino}. Em breve falo com você por aqui.   │ ││
│ │ └───────────────────────────────────────────────┘ ││
│ │ [Salvar]                                          ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
│ ┌─ Tags do sistema ─────────────────────────────────┐│
│ │ italia_2026   lua_de_mel   vip   indicacao_top    ││
│ │ [+ Nova tag]                                      ││
│ └───────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

Todos os botões `[Testar conexão]`, `[Salvar]`, `[+ Adicionar]`, `[+ Nova tag]` mostram alert "Implementação completa virá no Lote C". Visualmente funciona, lógica fica pra depois.

### TELA 7 — `/admin/usuarios` (placeholder, mantém)

Texto: "Gestão de usuários do back office. Disponível após go-live (Fase 3), quando convidaremos Nina, Julia, Amanda."

### Remoções

- **`/admin/integracoes` removida.** Conteúdo absorvido por `/admin/configuracoes`.

---

## Estrutura de código

```
src/lib/
  contacts/
    types.ts                  # tipos completos da tabela contacts
    mock-contacts.ts          # 8 contatos mockados com diversidade
    mock-interactions.ts      # interações mockadas
    index.ts                  # getContacts, getContactById, createContact, updateContact (stubs)
  integrations/
    iddas.ts                  # createSolicitacao, getOrcamentos, getVendas (stubs)
    clickmassa.ts             # createTicket, getTickets, getOpportunities (stubs)

src/app/admin/
  page.tsx                    # SUBSTITUI dashboard placeholder
  DashboardClient.tsx         # 6 cards + saudação dinâmica
  contatos/
    page.tsx                  # lista (Server)
    ContactsClient.tsx        # filtros + tabela + ações em massa (Client)
    [id]/
      page.tsx                # detalhe 360 (Server)
      ContactDetailClient.tsx # gestão interna editável (Client)
    novo/
      page.tsx                # criação manual
  configuracoes/page.tsx      # configs completas (mock)
  usuarios/page.tsx           # placeholder

src/components/admin/
  DashboardCard.tsx
  SyncBadge.tsx               # ✓✓ / ⏳ / ⚠ / ✗
  StageBadge.tsx              # badge colorido por estágio
  PlaceholderPage.tsx
  
src/app/(public)/contato/
  page.tsx                    # ATUALIZADO: form enriquecido
  actions.ts                  # ATUALIZADO: chama lib/contacts + integrations
src/components/ui/
  ContactForm.tsx             # ATUALIZADO: 4 grupos de campos
```

---

## Mock plausível dos 8 contatos

Distribuição pensada pra demonstrar UX:

| Nome | Origem | Estágio | Destino | Sync (I/C) | Notas chave |
|------|--------|---------|---------|------------|-------------|
| Maria Silva | Site | Qualificado | Itália | ✓ / ✓ | Lua de mel, R$15-30k |
| João Pereira | GoogleAds | Em negoc. | Europa | ✓ / ✓ | Família 4 pax |
| Ana Mendes | Site | Proposta env. | Cruzeiro | ✓ / ✓ | Indicação Patricia |
| Carlos Lima | Indicação | Novo | Indef. | ⏳ / ⏳ | Sem qualificação ainda |
| Patrícia | GoogleAds | Aguard. pgto | América Sul | ✓ / ⚠ | ClickMassa falhou |
| Fernando | Site | Fechado | Outro | ✓ / ✓ | Japão+Coreia 21 dias |
| Luciana | Site | Em espera | Itália | ✓ / ✓ | 2 amigas, alto ticket |
| Roberto | Manual | Perdido | Europa | ✓ / ✓ | Desistiu, motivo registrado |

Cada um com nome, WhatsApp, e-mail (alguns), qualificação completa (alguns), interações (3-8 cada), tags variadas.

---

## Resumo das decisões nessa versão

1. **Tabela `contacts` rica desde nascimento** — 50+ campos cobrindo identificação, qualificação, espelho de Iddas/ClickMassa, comportamento, gestão interna
2. **Form do site enriquecido em 4 grupos** — 12 campos no total, sendo 3 obrigatórios (Nome, WhatsApp, Destino tipo)
3. **Select estruturado + textarea complementar** pra destino — estrutura pra segmentação, texto livre pra detalhes
4. **Lista única `/admin/contatos`** — unifica todas as origens. Filtros e ações em massa.
5. **Detalhe 360 em `/admin/contatos/[id]`** — 3 colunas (Dados, Qualificação, Sistemas externos) + Gestão interna + Interações
6. **Dashboard com 6 cards reais** — todos sobre nossa base, sem badges "Em breve"
7. **Configurações com conteúdo real** (mockado mas funcional visualmente)
8. **`/admin/integracoes` removida**, absorvida em Configurações
9. **8 contatos mockados** com diversidade pra demonstrar todos os estados de UI
10. **Interações como histórico unificado** — pra contexto e auditoria

---

## Decisões pra travar

1. Modelagem da tabela `contacts` (50+ campos) está OK? Algo a remover, algo essencial faltando?
2. Form do site em 4 grupos, 12 campos, com select estruturado pra destino + textarea complementar — OK?
3. Dashboard com 6 cards sobre nossa base — OK?
4. Visão 360 em `/admin/contatos/[id]` com 3 colunas + gestão + interações — OK?
5. Em mock dev, valores realistas (sem alerts) pra navegar a UX, só botões de mutação (Salvar/Testar) mostram alert — OK?

Quando aprovar, prompt único pro Codinho. O Lote C fica trivial: schema SQL é tradução direta dos tipos TypeScript.

---

_Wireframe Lote B v3 · Spinhardi Turismo · Fases 1.8 + 1.9 + 1.10_
