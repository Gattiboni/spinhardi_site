# ClickMassa API - Mapa de Endpoints

Gerado a partir de: `https://enterprise-352n.clickmassa.com.br/openapi.json`
Versão da spec: `1.0.0` (info.title: "CHAT API", OpenAPI 3.0.0)
Data: 2026-06-18

> **Nota sobre o `server` da spec**: o campo `servers[0].url` aponta para `https://apiwender.ngrok.app` (ambiente de dev do fornecedor). O host real de produção, derivado do `CLICKMASSA_API_URL`, é `https://enterprise-352napi.clickmassa.com.br`. Todos os paths abaixo são relativos a esse host e começam com `/v1/api/external`.
>
> **Nota sobre `{apiId}`**: na nossa credencial o `apiId` já vem embutido no `CLICKMASSA_API_URL` (`.../v1/api/external/b14c6651-0f00-4e64-973e-392f82691951`). Na spec ele aparece como path param `{apiId}` em quase todos os endpoints.

## Sumário por categoria

- [General](#general) (5 endpoints)
- [ChatFlow](#chatflow) (2 endpoints)
- [Tags](#tags) (3 endpoints)
- [Opportunities](#opportunities) (5 endpoints)
- [Products](#products) (1 endpoint)
- [PipelineSteps](#pipelinesteps) (1 endpoint)

**Total: 17 operações em 14 paths.**

## Autenticação

A spec declara dois `securitySchemes` em `components`:

- **`bearerAuth`** — HTTP Bearer, `bearerFormat: JWT`. É o esquema que usamos: header `Authorization: Bearer {CLICKMASSA_API_KEY}`. O JWT carrega `tenantId: 28`, `profile: admin`, `channelType: whatsapp`, `exp` em 2028.
- **`queryToken`** — apiKey via query string `?token=...` (alternativa ao header).

Não há bloco `security` global no documento; cada operação que falha sem credencial responde `403`. Na prática, todas as chamadas devem ir autenticadas com o Bearer.

---

## Endpoints

### General

#### `GET /v1/api/external/messages/{apiId}/{externalKey}`

**Resumo**: Consultar status/mensagens por externalKey. Retorna todas as mensagens correlacionadas a uma `externalKey` (a chave que o sistema cliente define ao enviar).

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `externalKey` (path, string, required): chave externa usada para correlacionar mensagens enviadas pelo cliente.
- `pageNumber` (query, integer, optional): número da página para paginação.

**Response 200**:
- Schema resumido: `{ messages: Message[], count: integer, hasMore: boolean }`. O schema `Message` é extenso (~45 campos: `id`, `body`, `ack`, `status`, `fromMe`, `mediaType`, `mediaUrl`, `ticketId`, `contactId`, `userId`, `externalKey`, `createdAt`, etc.) — *(schema complexo, ver openapi.json → components.schemas.Message)*.

**Outros status**: `400`, `403`.

---

#### `GET /v1/api/external/template/{apiId}`

**Resumo**: Listar Templates (WABA). Retorna templates com status `APPROVED`, incluindo medias.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido: `Template[]`. Cada `Template`: `id`, `hsmId`, `name`, `category`, `language`, `preview`, `templateType`, `status`, `whatsappId`, `components`, `medias[]`, `tenantId`, timestamps.

**Outros status**: `403`.

---

#### `GET /v1/api/external/users/{apiId}`

**Resumo**: Listar Usuários. Retorna `{ users, count }`, ordenado por `name` ASC.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido (`ExternalUsersResponse`): `{ users: ExternalUser[], count: number }`. Cada `ExternalUser`: `id`, `name`, `phone`, `email`, `profile`, `tenantId`, `uid`, `isDisableAutodistribution`, `canViewDepartmentTickets`.

**Outros status**: `403`.

---

#### `POST /v1/api/external/{apiId}`

**Resumo**: Enviar mensagem / criar nota interna. Suporta WhatsApp e WABA. Aceita upload de arquivo via `multipart/form-data` (campo `media`).

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Request body** (required):
- Content-type `application/json` → `ExternalSendMessageJson` (`oneOf`): dois modos.
  - **Envio de mensagem** (`onlyNote != true`): `{ number, externalKey, body, mediaUrl?, note?, forceTicketToUser?, userId?, queueId?, closingReasonId?, forceTicketToDepartment? }`.
  - **Somente nota interna** (`onlyNote = true`): cria nota no ticket sem enviar ao cliente.
- Content-type `multipart/form-data` → `ExternalSendMessageMultipart` (mesmos campos como string + `media` binário).
- *(schema complexo com `oneOf`, ver openapi.json)*

**Response 200**:
- Schema resumido (`ExternalSendMessageResponse`): `{ message: object }` (objeto da mensagem criada).

**Outros status**: `400`, `403`, `404`.

---

#### `POST /v1/api/external/{apiId}/start-session`

**Resumo**: Iniciar sessão do canal. Inicia a sessão do canal vinculado à API e retorna os dados da sessão.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração da API.

**Response 200**:
- Schema resumido (`WhatsappSession`): `id`, `qrcode`, `name`, `status`, `plugged`, `type`, `number`, `phone`, `tenantId`, `provider`, `businessHours`, `uid`, timestamps, etc. — *(schema extenso, ver openapi.json)*.

**Outros status**: `403`, `404`.

---

### ChatFlow

#### `POST /v1/api/external/{apiId}/{ticketId}/chat-flow-step`

**Resumo**: Avançar etapa do ChatFlow via callback. Avança o ticket para a próxima etapa do fluxo quando ele está aguardando callback. Opcionalmente envia mensagem e/ou nota.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `ticketId` (path, integer, required): ID do ticket.

**Request body** (optional):
- Content-type `application/json` → `ChatFlowStepRequest`: `{ body?: string, mediaUrl?: string, note?: { body?, mediaUrl? } }`.
- Content-type `multipart/form-data`: idem + `media` (arquivo opcional, binário).

**Response 200**:
- Schema resumido (`ChatFlowStepResponse`): `{ ticket: object, message?: Message, messageNote?: Message }`.

**Outros status**: `404`.

---

#### `GET /v1/api/external/{apiId}/chat-flows`

**Resumo**: Listar ChatFlows de atendimento (`isServiceBot`) ativos do tenant. Retorna apenas flows de atendimento ativos; usar o `id` retornado como `chatbotId` em outros contextos.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido: `{ success: boolean, data: [{ id, name, isActive, isServiceBot, createdAt, ... }] }`.

**Outros status**: `403`, `404`.

---

### Tags

#### `GET /v1/api/external/{apiId}/tags`

**Resumo**: Listar tags.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido: `Tag[]`. `Tag`: `{ tag: string, color: string, userId?: number }`.

**Outros status**: `403`.

---

#### `POST /v1/api/external/{apiId}/tags`

**Resumo**: Criar tags em lote. O controller **exige um ARRAY** no body; se não for array → erro `ERR_TAG_NOT_ARRAY`.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Request body** (required):
- Content-type `application/json` → `Tag[]` (array de `{ tag, color, userId? }`).

**Response 200**:
- Schema resumido: `Tag[]` (as tags criadas).

**Outros status**: `400`, `403`, `500`.

---

#### `DELETE /v1/api/external/{apiId}/tags/{tagId}`

**Resumo**: Remover tag.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `tagId` (path, string, required): ID da tag a ser removida.

**Response 200**:
- Sem schema de corpo definido (resposta vazia / confirmação).

**Outros status**: `403`, `404`.

---

### Opportunities

> Observação: para os endpoints de Opportunities (exceto criação), a spec **não define schema de request body nem de response 200** (`schema: {}`). Os campos abaixo de update/status derivam dos schemas auxiliares `OpportunityUpdateStatus` presentes em `components`, mas não estão linkados às operações na spec. Tratar como **contrato incompleto** e validar empiricamente.

#### `POST /v1/api/external/{apiId}/opportunities`

**Resumo**: Criar oportunidade.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Request body** (required):
- Content-type `application/json` → `OpportunityCreate`:
  - `name` (string, **required**)
  - `description` (string)
  - `value` (number)
  - `expectedCloseDate` (string)
  - `contactId` (number, **required**)
  - `responsibleId` (string, **required**)
  - `pipelineStepId` (number, **required**)
  - `userId` (string, **required**)
  - `productsOpportunity` (array)

**Response 201**:
- Schema não definido na spec (`{}`).

**Outros status**: `400`, `403`, `404`, `500`.

---

#### `GET /v1/api/external/{apiId}/opportunities`

**Resumo**: Listar oportunidades.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema não definido na spec (`{}`). *(ver openapi.json — sem detalhamento)*

**Outros status**: `403`, `404`, `500`.

---

#### `GET /v1/api/external/{apiId}/opportunities/{opportunityId}`

**Resumo**: Detalhar oportunidade.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `opportunityId` (path, string, required): ID da oportunidade.

**Response 200**:
- Schema não definido na spec (`{}`).

**Outros status**: `403`, `404`.

---

#### `PUT /v1/api/external/{apiId}/opportunities/{opportunityId}`

**Resumo**: Atualizar oportunidade.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `opportunityId` (path, string, required): ID da oportunidade.

**Request body** (required):
- Content-type `application/json`, schema não definido na spec (`{}`). Presumivelmente subset de `OpportunityCreate`.

**Response 200**:
- Schema não definido na spec (`{}`).

**Outros status**: `400`, `403`, `404`, `409`.

---

#### `PUT /v1/api/external/{apiId}/opportunities/{opportunityId}/status`

**Resumo**: Atualizar status da oportunidade.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.
- `opportunityId` (path, string, required): ID da oportunidade.

**Request body** (required):
- Content-type `application/json`, schema não linkado (`{}`). O schema auxiliar `OpportunityUpdateStatus` em `components` descreve o formato esperado:
  - `status` (string, enum: `open` | `won` | `lost`, **required**)
  - `pipelineStepId` (number, nullable)
  - `gainOrLossReasonId` (string, nullable) — motivo de ganho/perda
  - `note` (string, nullable)
  - `userId` (string, **required**)

**Response 200**:
- Schema não definido na spec (`{}`).

**Outros status**: `400`, `403`, `404`, `409`.

---

### Products

#### `GET /v1/api/external/{apiId}/products`

**Resumo**: Listar produtos.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido: `{ success: boolean, data: [{ id, name, description?, isActive, value, ... }] }`.

**Outros status**: `403`.

---

### PipelineSteps

#### `GET /v1/api/external/{apiId}/pipeline-steps`

**Resumo**: Listar etapas do funil.

**Parâmetros**:
- `apiId` (path, string, required): ID da configuração de API.

**Response 200**:
- Schema resumido: `{ success: boolean, data: [{ id: integer, name: string, color: string, order: integer }], message: string }`.

**Outros status**: `403`.

---

## Schemas auxiliares presentes na spec (não expandidos aqui)

`components.schemas` tem 25 schemas. Os principais já referenciados acima; os demais relevantes para implementação futura:

- `Message` — objeto de mensagem (extenso, ~45 campos).
- `Template`, `TemplateMedia` — templates WABA.
- `Whatsapp`, `WhatsappSession` — sessão/canal.
- `ExternalUser`, `ExternalUsersResponse` — usuários (agentes) do tenant.
- `Tag` — etiqueta.
- `OpportunityCreate`, `OpportunityUpdateStatus` — oportunidades.
- `ChatFlowCallbackAdvance`, `ChatFlowStepRequest`, `ChatFlowStepResponse`, `TicketDetails` — fluxo de atendimento.
- `SendMessageBase`, `MessageText`, `MessageNote`, `MessageStatus`, `CustomMedia`, `WabaTemplateMessage` — composição do envio de mensagem.
- `ErrorResponse`, `SuccessResponse` — envelopes genéricos.

Detalhamento completo: `docs/clickmassa-openapi.json`.
