# Glossario da API ClickMassa - operacao Spinhardi

Gerado em: 2026-06-18 (BRT) - Turno A
Atualizado em: 2026-06-18 (BRT) - Turno D (shapes de users, products, achados novos)
Base URL: `https://enterprise-352napi.clickmassa.com.br/v1/api/external/b14c6651-0f00-4e64-973e-392f82691951` (apiId embutido)
Auth: Bearer JWT (`tenantId: 28`, `profile: admin`, `channelType: whatsapp`, valido ate 2028)

---

## Endpoints confirmados na operacao

| Metodo | Path | Status HTTP | Quirks | Observacao |
|--------|------|-------------|--------|------------|
| GET | `/opportunities/{id}` | 200 | - | Confirmado com opp 8935. Shape rico com embeds. |
| GET | `/opportunities?contactId=X` | 200 | Query param nao documentado | Param obrigatorio (ou `pipelineStepId`) pra desbloquear listagem. |
| GET | `/opportunities?pipelineStepId=X` | 200 | Query param nao documentado | Segundo param que desbloqueia. Retorna todas opps naquele step. |
| GET | `/opportunities` (sem param) | 404 `ERR_CONTACT_PIPELINE_NOT_FOUND` | - | Rota existe, mas sem filtro de contexto falha sempre. |
| GET | `/users/{apiId}` | 200 | Quirk 1: path invertido | URL deve ser `.../users/{apiId}`, nao `.../{apiId}/users`. |
| GET | `/pipeline-steps` | 500 (bug confirmado) | Quirk 2: 500 intermitente | Bug 100% nesta sondagem: falhou em ambas as tentativas (tentativa + retry). |
| GET | `/tags` | 200 | - | Array direto. Campos extras alem da spec: `isActive`, `tenantId`, `createdAt`, `updatedAt`. |
| GET | `/products` | 200 | - | Shape completo confirmado no Turno D. 4 produtos no tenant. |
| GET | `/chat-flows` | 200 | - | Confirmado nos smokes G.1/G.2. Nao re-sondado neste turno. |
| POST | `/{apiId}` (raiz) | 200 | - | Envio de mensagem. Confirmado em G.2. |
| POST | `/opportunities` | 201 | - | Criacao. Confirmado em G.2 (opp 8935). |

---

## Endpoints nao-documentados descobertos

Nenhum endpoint nao-documentado foi encontrado. Todos os 19 paths sondados no Grupo 3 e 4
retornaram HTML `Cannot GET /...` (Express route-not-found), confirmando que as rotas
simplesmente nao existem no backend externo.

Diferenca importante de diagnostico:
- **HTML `Cannot GET /path`** = rota inexistente no Express (endpoint nao exposto)
- **JSON `{"error":"ERR_CONTACT_PIPELINE_NOT_FOUND"}`** = rota existe, erro de negocio (autenticacao passou)

---

## Endpoints sondados que nao existem

Todas as 19 sondagens abaixo retornaram HTML 404 `Cannot GET`:

| Path sondado | Variacao testada |
|---|---|
| `/{apiId}/contacts` | padrao (apiId no meio) |
| `/{apiId}/contacts/109710` | padrao com id |
| `/contacts/{apiId}` | Quirk1-alt (apiId no final) |
| `/{apiId}/tickets` | padrao |
| `/{apiId}/tickets/206673` | padrao com id |
| `/tickets/{apiId}` | Quirk1-alt |
| `/{apiId}/contact-pipelines` | kebab-case |
| `/{apiId}/contactPipelines` | camelCase |
| `/{apiId}/closing-reasons` | kebab-case |
| `/{apiId}/closingReasons` | camelCase |
| `/closing-reasons/{apiId}` | Quirk1-alt |
| `/{apiId}/gain-or-loss-reasons` | kebab-case |
| `/{apiId}/gainOrLossReasons` | camelCase |
| `/gain-or-loss-reasons/{apiId}` | Quirk1-alt |
| `/{apiId}/queues` | padrao |
| `/queues/{apiId}` | Quirk1-alt |
| `/{apiId}/departments` | padrao |
| `/departments/{apiId}` | Quirk1-alt |
| `/{apiId}/channels` | padrao |

---

## Schemas vagos do openapi.json resolvidos empiricamente

### Opportunity (response real - GET /opportunities/8935)

```json
{
  "success": true,
  "data": {
    "tasksCount": {
      "countSchendule": 0,
      "countDelayed": 0,
      "countComplete": 0,
      "countRequiredPending": 0
    },
    "id": 8935,
    "tenantId": 28,
    "contactId": 109710,
    "userId": 164,
    "responsibleId": 164,
    "pipelineStepId": 73,
    "gainOrLossReasonId": null,
    "name": "Lead via Site - Alan Smoke Test",
    "description": null,
    "note": null,
    "expectedCloseDate": "2026-07-17",
    "closeDate": null,
    "pipelineUpdatedAt": "2026-06-18",
    "value": "0.00",
    "status": "open",
    "createdAt": "2026-06-18T05:54:35.358Z",
    "updatedAt": "2026-06-18T05:54:35.358Z",
    "contact": {
      "profilePicUrl": "",
      "address": {
        "cep": null, "pais": null, "estado": null, "cidade": null,
        "bairro": null, "logradouro": null, "numero": null, "complemento": null
      },
      "id": 109710,
      "name": "5511983340447",
      "number": "5511983340447",
      "lid": "false",
      "isNumber": true,
      "email": null,
      "pushname": null,
      "observations": null,
      "channel": "whatsapp",
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "deletedAt": null,
      "negotiatedValue": null,
      "leadStatusId": null,
      "leadOriginId": null,
      "queueId": null,
      "tenantId": 28,
      "birthDate": null,
      "gender": null,
      "company": null,
      "cep": null, "pais": null, "estado": null, "cidade": null,
      "bairro": null, "logradouro": null, "numero": null, "complemento": null,
      "customFields": {},
      "agentMemory": {},
      "tags": [],
      "firstConnection": 31,
      "profilePicId": null,
      "picIsObjectStorage": false,
      "createdAt": "2026-06-18T05:54:35.008Z",
      "updatedAt": "2026-06-18T05:54:35.075Z"
    },
    "user": {
      "name": "Amanda Gattiboni",
      "email": "branding@amandagattiboni.com"
    },
    "responsible": {
      "name": "Amanda Gattiboni",
      "email": "branding@amandagattiboni.com"
    },
    "pipelineStep": {
      "name": "Primeiro contato",
      "color": "#2196F3"
    },
    "gainOrLossReason": null,
    "productsOpportunity": []
  },
  "message": "Oportunidade encontrada"
}
```

**Discrepancias em relacao a spec:**

| Campo | Spec dizia | Realidade |
|---|---|---|
| `value` | `number` | `string` ("0.00") - BREAKING |
| `contact` embed | nao documentado | Objeto completo de ~35 campos |
| `user` embed | nao documentado | `{name, email}` apenas |
| `responsible` embed | nao documentado | `{name, email}` apenas |
| `pipelineStep` embed | nao documentado | `{name, color}` - SEM `id` (id esta em `pipelineStepId`) |
| `gainOrLossReason` embed | nao documentado | null ou objeto (nao testado com valor preenchido) |
| `tasksCount` | nao documentado | `{countSchendule, countDelayed, countComplete, countRequiredPending}` |
| `note` | nao documentado | string ou null (nota interna da opp) |
| `closeDate` | nao documentado | data real de fechamento quando won/lost |
| `pipelineUpdatedAt` | nao documentado | data da ultima mudanca de step |

**Typo no backend:** `countSchendule` (deveria ser `countSchedule`) - e um campo do backend deles, nao nosso.

### Tag (response real - GET /tags)

```json
{
  "id": 1,
  "tag": "Nome da tag",
  "color": "#FF5733",
  "isActive": true,
  "userId": 123,
  "tenantId": 456,
  "createdAt": "2025-01-01T12:00:00.000Z",
  "updatedAt": "2025-01-02T15:30:00.000Z"
}
```

**Discrepancias:** spec define apenas `{tag, color, userId?}`. Na pratica vem tambem `id`, `isActive`, `tenantId`, `createdAt`, `updatedAt`.

### Contact (shape inferido do embed em Opportunity)

O endpoint `/{apiId}/contacts` nao existe na API externa. O acesso a dados de contato
e apenas indireto via embed nas respostas de oportunidade.

Campos observados no embed `contact` dentro de Opportunity:

```
id, name, number, lid, isNumber, email, pushname, observations, channel,
isUser, isWAContact, isGroup, deletedAt, negotiatedValue, leadStatusId,
leadOriginId, queueId, tenantId, birthDate, gender, company,
cep, pais, estado, cidade, bairro, logradouro, numero, complemento,
customFields (object), agentMemory (object), tags (array), firstConnection,
profilePicId, picIsObjectStorage, profilePicUrl,
address (object: {cep,pais,estado,cidade,bairro,logradouro,numero,complemento}),
createdAt, updatedAt
```

**Nota:** `contact.name` no smoke foi "5511983340447" (numero de telefone), pois o contato foi
criado automaticamente via envio de mensagem sem nome. Em producao com contatos nomeados o campo
`pushname` ou `name` deveria ter o nome real do WhatsApp.

### Ticket (nao acessivel via API externa)

O endpoint `/{apiId}/tickets/{id}` nao existe na API externa - retorna HTML `Cannot GET`.
O `ticketId` e retornado no `message.ticketId` apos `POST /{apiId}` (sendMessage),
mas nao ha endpoint GET para inspecionar o ticket por ID na API externa.

---

## Padroes de resposta

| Padrao | Endpoints que usam |
|---|---|
| `Array` direto | GET /tags, GET /template/{apiId} |
| `{success, data, message}` | GET /opportunities/{id}, GET /pipeline-steps, GET /chat-flows |
| `{success, data, count, hasMore, message}` | GET /opportunities?contactId=X, GET /opportunities?pipelineStepId=X |
| `{users, count}` | GET /users/{apiId} |
| `{message}` | POST /{apiId} (sendMessage) - retorna `{message: MessageObject}` |

---

## Padroes de erro

| Codigo | HTTP | Descricao | Quando ocorre |
|---|---|---|---|
| `ERR_CONTACT_PIPELINE_NOT_FOUND` | 404 | Listagem de opps sem filtro de contexto | GET /opportunities sem `contactId` ou `pipelineStepId` |
| `ERR_TAG_NOT_ARRAY` | 400 | Body de POST /tags nao e array | POST /tags com objeto em vez de array |
| `ERR_SESSION_NOT_AUTH_TOKEN` | 403 | JWT invalido/expirado | Qualquer endpoint com credencial invalida |
| `ERR_API_NOT_FOUND` | 404 | apiId nao reconhecido | Endpoints com apiId invalido |
| `Unexpected token 'o'...` | 500 | Bug de double-parse no backend | GET /pipeline-steps (Quirk 2, intermitente) |
| HTML `Cannot GET /path` | 404 | Rota inexistente no Express | Endpoints nao expostos na API externa |

---

## Quirks confirmados na sondagem

### Quirk 1: `/users` path invertido

**Status: CONFIRMADO.** O pattern `.../{apiId}/X` funciona para todos os endpoints documentados
EXCETO tres que tem apiId no final:

- `GET /v1/api/external/users/{apiId}` - CONFIRMADO 200
- `GET /v1/api/external/template/{apiId}` - nao re-testado neste turno, mas spec confirma
- `GET /v1/api/external/messages/{apiId}/{externalKey}` - nao re-testado neste turno

Os caminhos alternativos testados (`/contacts/{apiId}`, `/tickets/{apiId}`, etc.) todos retornaram
HTML 404, confirmando que o pattern "apiId no final" e EXCLUSIVO dos tres endpoints documentados.
Nao existe outro endpoint que use esse padrao.

### Quirk 2: `/pipeline-steps` 500 intermitente

**Status: MANIFESTOU COMPLETAMENTE nesta sondagem.** O endpoint retornou 500 na tentativa inicial
E no retry apos 2s. Payload: `{"error":"Unexpected token 'o', \"[object Obj\"... is not valid JSON"}`.

Este e o bug de `JSON.parse(objetoQueJaEObjeto)` no backend do ClickMassa, confirmado.
Nao e problema de credenciais. Recomendacao: implementar fallback no fluxo que depende de
pipeline-steps, ou cachear o resultado apos uma chamada bem-sucedida.

Nota: nos smokes G.1/G.2 o endpoint funcionou (retornou 200 nessas execucoes). O bug e
genuinamente intermitente - esta sondagem pegou a janela ruim.

### Quirk 3: Naming kebab-case em paths vs camelCase em campos

**Status: CONFIRMADO E EXPANDIDO.**

- Paths da API: kebab-case (`pipeline-steps`, `chat-flows`, `chat-flow-step`, `start-session`)
- Campos de body/response: camelCase (`pipelineStepId`, `contactId`, `gainOrLossReasonId`, etc.)
- Sondagem de endpoints especulativos: tanto kebab (`/closing-reasons`, `/gain-or-loss-reasons`)
  quanto camel (`/closingReasons`, `/gainOrLossReasons`) retornaram HTML 404 - ambas inexistentes.
  A convencao de naming nao foi o fator limitante; as rotas simplesmente nao existem.

---

## Estado dos objetos criados em smokes

### Opportunity 8935

- **Existe na API?** SIM - GET /opportunities/8935 retornou 200
- **Shape:** Ver secao "Schemas vagos - Opportunity" acima
- **Status:** `open`
- **Nome:** "Lead via Site - Alan Smoke Test"
- **ContactId:** 109710, **PipelineStepId:** 73
- **Value:** "0.00" (string, nao number)
- **Aparece em listagem?** SIM via `?contactId=109710` e via `?pipelineStepId=73`

### Contact 109710

- **Existe na API?** SIM - acessivel via embed em GET /opportunities/8935
- **Endpoint direto?** NAO - `/{apiId}/contacts/109710` retorna HTML 404 (rota inexistente)
- **Name no ClickMassa:** "5511983340447" (numero de telefone - sem nome cadastrado)
- **Channel:** "whatsapp"
- **Tags:** [] (vazio)
- **CreatedAt:** "2026-06-18T05:54:35.008Z"

### Ticket 206673

- **Existe na API?** INCERTO - `/{apiId}/tickets/206673` retorna HTML 404 (rota inexistente)
- O ticket PROVAVELMENTE existe no banco do ClickMassa (foi criado pelo sendMessage), mas
  a API externa nao expoe nenhum endpoint GET de ticket. O `ticketId` e dado no response
  do sendMessage e utilizado apenas para operacoes de ChatFlow.

---

## Achados da releitura do openapi.json

Nao havia params `in: "query"` nos endpoints documentados de Opportunities, Tags, ChatFlow
ou PipelineSteps. O unico query param documentado e `pageNumber` no endpoint
GET `/messages/{apiId}/{externalKey}`.

Os params `contactId` e `pipelineStepId` que desbloqueiam listOpportunities sao COMPLETAMENTE
AUSENTES da spec. E um contrato implicito, nao documentado.

**Schemas em `components` nao referenciados diretamente por operacoes:**

- `MessageStatus` - descreve um shape de mensagem simplificado. Pode ser retornado por
  um endpoint de polling nao documentado, mas nao confirmado.
- `ChatFlowCallbackAdvance` - referenciado internamente mas nao como schema de operacao.
  Provavelmente e o body do POST /chat-flow-step (a spec usa `ChatFlowStepRequest` que nao
  esta nos components - foi definido inline ou e alias).

**`description` com dependencias ocultas encontradas:**

- `queueId` em `SendMessageBase`: "Opcional: forca fila/departamento (depende da tua regra
  interna no FindOrCreateTicketService)" - dependencia de configuracao interna do tenant.
- `chatbotId` em send message: "Use GET .../chat-flows para listar bots disponíveis" -
  dependencia explicita do endpoint /chat-flows.
- `forceTicketToUser=true` + `userId`: o forceTicketToUser sozinho nao tem efeito; precisa
  do userId junto.

**`security` por endpoint vs default:**
- Nao ha `security` global. Cada operacao declara `security: [{ bearerAuth: [], queryToken: [] }]`
  individualmente. Na pratica: todas as operacoes exigem autenticacao.

---

## Gaps confirmados

A API externa do ClickMassa NAO expoe:

1. **Leitura direta de contatos** - `GET /contacts` e `GET /contacts/{id}` nao existem
2. **Leitura direta de tickets** - `GET /tickets` e `GET /tickets/{id}` nao existem
3. **Listagem de oportunidades sem filtro** - sempre requer `contactId` ou `pipelineStepId`
4. **Closing reasons / gain-or-loss reasons** - nao ha GET para listar esses cadastros
5. **Queues / departments** - nao ha GET para listar filas/departamentos
6. **Channels** - nao ha GET para listar canais (sessoes WhatsApp)
7. **Paginacao generica** - params `page`, `pageSize`, `limit`, `offset` NAO funcionam em /opportunities
8. **Filtros por `status`, `responsibleId`, `pipelineId`** - NAO desbloqueiam /opportunities

---

## Bandeiras para proximos lotes

1. **`value` retorna string em Opportunity, nao number.** O mapper `mapOpportunity` em `index.ts`
   faz `Number(r.value ?? 0)`, o que converte "0.00" corretamente, mas qualquer validacao de tipo
   que espere `number` vai passar erroneamente. Documentar no tipo TypeScript como `string | number`.

2. **Pipeline-steps com bug 100% nesta execucao.** Isso impacta diretamente o fluxo de
   `syncContactFlow` (Lote G.2), que chama `listPipelineSteps()` no meio do fluxo. Se o endpoint
   falhar, o sync falha. Considerar: (a) cachear os steps apos primeira chamada bem-sucedida,
   (b) hardcodar o `pipelineStepId` padrao via env var como fallback.

3. **`contact.name` no ClickMassa e o numero de telefone quando criado via sendMessage sem nome.**
   O `pushname` pode vir preenchido depois que o contato enviar alguma mensagem. Para exibir
   nome real no funil, a Spinhardi precisa atualizar o contato no ClickMassa com o nome do lead
   (via PUT ou endpoint de contato - que nao existe na API externa). GAP de dado.

4. **Endpoint GET /tickets/{id} nao existe.** O `ticketId` 206673 retornado pelo smoke G.2.b
   nao e acessivel para leitura. Operacoes de ChatFlow (POST /{apiId}/{ticketId}/chat-flow-step)
   requerem saber o ticketId, mas nao ha como verificar o estado do ticket antes.

5. **listOpportunities requer `contactId` ou `pipelineStepId` - nunca funciona como "listar tudo".**
   Para o dashboard de funil (Lote H?), a estrategia vai precisar ser: listar por pipelineStepId
   de cada step (N chamadas = N steps do funil) ou manter o estado localmente no Supabase.

6. **Typo `countSchendule` no campo `tasksCount.countSchendule`.** E um bug do backend deles.
   Se integrarmos tasks/tarefas da oportunidade no futuro, cuidar do typo no mapper.

7. **`firstConnection: 31` no contato** provavelmente e o ID do canal WhatsApp (whatsappId=31).
   Pode ser util para correlacionar qual numero de WA foi o primeiro contato.

---

## Apendice: tabela compacta de todas as sondagens

| # | Endpoint | HTTP | Resultado |
|---|---|---|---|
| 1 | GET /opportunities/8935 | 200 | Shape completo confirmado |
| 2 | GET /users/{apiId} | 200 | {users, count} |
| 3 | GET /pipeline-steps | 500+500 | Bug Quirk2 em ambas tentativas |
| 4 | GET /tags | 200 | Array[{id,tag,color,isActive,...}] |
| 5 | GET /opportunities | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 6 | GET /opportunities?contactId=109710 | 200 | {success,data[],count,hasMore,message} |
| 7 | GET /opportunities?pipelineStepId=73 | 200 | {success,data[],count,hasMore,message} |
| 8 | GET /opportunities?status=open | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 9 | GET /opportunities?responsibleId=164 | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 10 | GET /opportunities?contactPipelineId=1 | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 11 | GET /opportunities?pipelineId=1 | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 12 | GET /opportunities?page=1&pageSize=20 | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 13 | GET /opportunities?limit=20&offset=0 | 404 | ERR_CONTACT_PIPELINE_NOT_FOUND |
| 14 | GET /contacts | 404 | HTML Cannot GET (rota inexistente) |
| 15 | GET /contacts/109710 | 404 | HTML Cannot GET (rota inexistente) |
| 16 | GET /tickets | 404 | HTML Cannot GET (rota inexistente) |
| 17 | GET /tickets/206673 | 404 | HTML Cannot GET (rota inexistente) |
| 18 | GET /contact-pipelines (kebab) | 404 | HTML Cannot GET (rota inexistente) |
| 19 | GET /contactPipelines (camel) | 404 | HTML Cannot GET (rota inexistente) |
| 20 | GET /closing-reasons (kebab) | 404 | HTML Cannot GET (rota inexistente) |
| 21 | GET /closingReasons (camel) | 404 | HTML Cannot GET (rota inexistente) |
| 22 | GET /gain-or-loss-reasons (kebab) | 404 | HTML Cannot GET (rota inexistente) |
| 23 | GET /gainOrLossReasons (camel) | 404 | HTML Cannot GET (rota inexistente) |
| 24 | GET /queues | 404 | HTML Cannot GET (rota inexistente) |
| 25 | GET /departments | 404 | HTML Cannot GET (rota inexistente) |
| 26 | GET /channels | 404 | HTML Cannot GET (rota inexistente) |
| 27 | GET /contacts/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |
| 28 | GET /tickets/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |
| 29 | GET /closing-reasons/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |
| 30 | GET /gain-or-loss-reasons/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |
| 31 | GET /queues/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |
| 32 | GET /departments/{apiId} (Quirk1-alt) | 404 | HTML Cannot GET (rota inexistente) |

---

## Turno D — Shapes confirmados (Users, Products, achados novos)

### ExternalUser (response real — GET /users/{apiId})

Endpoint retorna `{ users: ExternalUser[], count: number }`. Confirmado Turno D: 4 users no tenant.

```json
{
  "id": 164,
  "name": "Amanda Gattiboni",
  "phone": "5548996850657",
  "email": "branding@amandagattiboni.com",
  "profile": "admin",
  "tenantId": 28,
  "uid": "6a8bb194-3921-4198-b6f3-6e5ce996a2f6",
  "isDisableAutodistribution": false,
  "canViewDepartmentTickets": true
}
```

**Campos vs spec (ExternalUsersResponse):** spec documenta `{id, name, phone, email, profile, tenantId, uid, isDisableAutodistribution, canViewDepartmentTickets}`. Shape real bate com a spec.

### Product (response real — GET /products)

Endpoint retorna `{ success, data: Product[] }`. Confirmado Turno D: 4 produtos no tenant.

```json
{
  "id": 64,
  "tenantId": 28,
  "userId": 60,
  "name": "Hospedagem",
  "description": null,
  "isActive": true,
  "value": 0.01,
  "duration": null,
  "createdAt": "2025-11-10T19:26:53.659Z",
  "updatedAt": "2025-11-10T19:26:53.659Z"
}
```

**Discrepancias vs spec:**

| Campo | Spec dizia | Realidade |
|---|---|---|
| `value` | `number` | `number` (0.01) — diferente de opp.value que retorna string! |
| `userId` | nao documentado | numero inteiro |
| `duration` | nao documentado | null ou valor numerico (duracao em dias?) |
| `createdAt`, `updatedAt` | nao documentados | presentes |

**Nota importante:** `product.value` retorna NUMBER (ex: 0.01), ao contrario de `opportunity.value`
que retorna STRING ("0.00"). Bronze preserva ambos como string para consistencia, mas o tipo
da API e diferente. Cuidado ao comparar ou converter.

### PipelineStep embed em Opportunity — campo novo

O embed `pipelineStep` dentro de Opportunity agora inclui `predefinedTasks: []` (nao documentado
no Turno A). Shape atual: `{ name, color, predefinedTasks }`.

### Quirk 2 atualizado — /pipeline-steps

No Turno D a chamada a `/pipeline-steps` retornou **200 OK** (sem o bug 500 desta vez).
O bug e genuinamente intermitente. O backfill script tem fallback para o cache Supabase caso
a chamada falhe.

### Contagens reais do tenant (confirmadas no dry-run do Turno D)

| Recurso | Count |
|---|---|
| Pipeline steps | 10 |
| Tags | 20 |
| Users | 4 |
| Products | 4 |
| Opportunities (total) | 1 (apenas opp 8935 em step 73) |
| Contacts (via embed) | 1 (contact 109710) |
