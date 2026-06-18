# ClickMassa Internal API — Endpoints Explorados

Gerado em: 2026-06-18T15:03:35.327Z
Host: https://enterprise-352napi.clickmassa.com.br
Auth: Bearer JWT (preview: eyJhbGci...)

---

## Resumo

| | Count |
|---|---|
| Total testados | 73 |
| 200 OK | 23 |
| 401/403 | 1 |
| 404 | 44 |
| 5xx | 5 |
| Timeout/erro rede | 0 |

---

## Endpoints com 200 OK

### `GET /contacts?pageNumber=1`

- **Status**: 200
- **Latência**: 272ms
- **Body size**: 18304 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 85205,
      "name": "🤩",
      "number": "223518721634414",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-03-16T18:34:11.043Z",
      "updatedAt": "2026-03-16T18:34:11.076Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
      "le
... [truncado]
```

### `GET /users`

- **Status**: 200
- **Latência**: 66ms
- **Body size**: 5395 bytes
- **Volume/count**: 4
- **Paginação**: pageNumber. hasMore=false, count=4
- **Campos top-level**: `expiredPassword`, `profilePic`, `name`, `id`, `email`, `profile`, `mensagemAusencia`, `lastLogout`, `lastLogin`, `isOnline`, `phone`, `isDisableAutodistribution`
- **Preview**:
```json
{
  "users": [
    {
      "expiredPassword": false,
      "profilePic": "",
      "name": "Amanda Gattiboni",
      "id": 164,
      "email": "branding@amandagattiboni.com",
      "profile": "admin",
      "mensagemAusencia": "",
      "lastLogout": null,
      "lastLogin": "2026-06-18T03:20:10.780Z",
      "isOnline": true,
      "phone": "5548996850657",
      "isDisableAutodistribution": false,
      "profileId": null,
      "lastPasswordChange": "2026-06-15T18:06:19.574Z",
      "passwordMu
... [truncado]
```

### `GET /whatsapp`

- **Status**: 200
- **Latência**: 51ms
- **Body size**: 2195 bytes
- **Volume/count**: 1
- **Paginação**: não testada
- **Campos top-level**: `UrlWabaWebHook`, `UrlMessengerWebHook`, `id`, `name`, `session`, `qrcode`, `status`, `battery`, `plugged`, `isActive`, `enableSentimentAnalysis`, `disableBotAfterAbsence`
- **Preview**:
```json
[
  {
    "UrlWabaWebHook": "https://enterprise-352api.clickmassa.com.br/wabahooks/null/null",
    "UrlMessengerWebHook": "https://enterprise-352api.clickmassa.com.br/fb-messenger-hooks/null",
    "id": 31,
    "name": "Spinhardi Turismo",
    "session": "",
    "qrcode": "",
    "status": "CONNECTED",
    "battery": null,
    "plugged": null,
    "isActive": true,
    "enableSentimentAnalysis": true,
    "disableBotAfterAbsence": false,
    "refuseComments": false,
    "isRejectCall": false,
  
... [truncado]
```

### `GET /queue`

- **Status**: 200
- **Latência**: 27ms
- **Body size**: 541 bytes
- **Volume/count**: 3
- **Paginação**: não testada
- **Campos top-level**: `id`, `queue`, `isActive`, `userId`, `tenantId`, `messageDefaultContact`, `createdAt`, `updatedAt`
- **Preview**:
```json
[
  {
    "id": 30,
    "queue": "Atendimento",
    "isActive": true,
    "userId": 60,
    "tenantId": 28,
    "messageDefaultContact": null,
    "createdAt": "2025-11-10T19:26:56.854Z",
    "updatedAt": "2025-11-10T19:26:56.854Z"
  },
  {
    "id": 31,
    "queue": "Financeiro",
    "isActive": true,
    "userId": 60,
    "tenantId": 28,
    "messageDefaultContact": null,
    "createdAt": "2025-11-10T19:26:56.852Z",
    "updatedAt": "2025-11-10T19:26:56.852Z"
  },
  {
    "id": 32,
    "queue"
... [truncado]
```

### `GET /tags`

- **Status**: 200
- **Latência**: 28ms
- **Body size**: 3481 bytes
- **Volume/count**: 20
- **Paginação**: não testada
- **Campos top-level**: `id`, `tag`, `color`, `isActive`, `userId`, `tenantId`, `createdAt`, `updatedAt`
- **Preview**:
```json
[
  {
    "id": 320,
    "tag": "Africa/Asia",
    "color": "#0000a3",
    "isActive": true,
    "userId": 60,
    "tenantId": 28,
    "createdAt": "2025-12-10T22:54:52.875Z",
    "updatedAt": "2025-12-10T22:55:38.366Z"
  },
  {
    "id": 319,
    "tag": "América do Sul",
    "color": "#ff6666",
    "isActive": true,
    "userId": 60,
    "tenantId": 28,
    "createdAt": "2025-12-10T22:54:28.155Z",
    "updatedAt": "2025-12-10T22:54:28.155Z"
  },
  {
    "id": 323,
    "tag": "Caribe",
    "colo
... [truncado]
```

### `GET /settings`

- **Status**: 200
- **Latência**: 24ms
- **Body size**: 1646 bytes
- **Volume/count**: 11
- **Paginação**: não testada
- **Campos top-level**: `id`, `key`, `value`, `tenantId`, `createdAt`, `updatedAt`
- **Preview**:
```json
[
  {
    "id": 206,
    "key": "botTicketActive",
    "value": "",
    "tenantId": 28,
    "createdAt": "2020-12-12T19:08:45.354Z",
    "updatedAt": "2023-05-22T18:35:08.474Z"
  },
  {
    "id": 207,
    "key": "userCreation",
    "value": "disabled",
    "tenantId": 28,
    "createdAt": "2020-12-12T19:08:45.354Z",
    "updatedAt": "2020-12-12T19:08:45.354Z"
  },
  {
    "id": 208,
    "key": "NotViewTicketsQueueUndefined",
    "value": "disabled",
    "tenantId": 28,
    "createdAt": "2020-12-
... [truncado]
```

### `GET /contacts/85205`

- **Status**: 200
- **Latência**: 34ms
- **Body size**: 839 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `profilePicUrl`, `address`, `id`, `name`, `number`, `lid`, `isNumber`, `email`, `pushname`, `observations`, `channel`, `isUser`
- **Preview**:
```json
{
  "profilePicUrl": "",
  "address": {
    "cep": null,
    "pais": null,
    "estado": null,
    "cidade": null,
    "bairro": null,
    "logradouro": null,
    "numero": null,
    "complemento": null
  },
  "id": 85205,
  "name": "🤩",
  "number": "223518721634414",
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
  "negotiatedValue": n
... [truncado]
```

### `GET /users/164`

- **Status**: 200
- **Latência**: 30ms
- **Body size**: 3575 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `expiredPassword`, `profilePic`, `name`, `phone`, `username`, `status`, `configs`, `isOnline`, `lastLogin`, `id`, `email`, `profile`
- **Preview**:
```json
{
  "expiredPassword": false,
  "profilePic": "",
  "name": "Amanda Gattiboni",
  "phone": "5548996850657",
  "username": "Amanda Gattiboni",
  "status": "online",
  "configs": {},
  "isOnline": true,
  "lastLogin": "2026-06-18T03:20:10.780Z",
  "id": 164,
  "email": "branding@amandagattiboni.com",
  "profile": "admin",
  "tokenVersion": 0,
  "tenantId": 28,
  "mensagemAusencia": "",
  "uid": "6a8bb194-3921-4198-b6f3-6e5ce996a2f6",
  "lastPasswordChange": "2026-06-15T18:06:19.574Z",
  "passwordM
... [truncado]
```

### `GET /whatsapp/31`

- **Status**: 200
- **Latência**: 32ms
- **Body size**: 1375 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `id`, `qrcode`, `name`, `status`, `plugged`, `isDefault`, `tokenTelegram`, `instagramUser`, `type`, `createdAt`, `updatedAt`, `number`
- **Preview**:
```json
{
  "id": 31,
  "qrcode": "",
  "name": "Spinhardi Turismo",
  "status": "CONNECTED",
  "plugged": null,
  "isDefault": true,
  "tokenTelegram": "",
  "instagramUser": "",
  "type": "whatsapp",
  "createdAt": "2025-11-11T18:10:56.668Z",
  "updatedAt": "2026-06-01T11:51:52.847Z",
  "number": "5519997761226",
  "phone": null,
  "tenantId": 28,
  "wabaBSP": null,
  "tokenAPI": "",
  "fbPageId": null,
  "isRejectCall": false,
  "callRejectedMessage": null,
  "minutesInactivity": 0,
  "inactivityClos
... [truncado]
```

### `GET /lead-status`

- **Status**: 200
- **Latência**: 20ms
- **Body size**: 2075 bytes
- **Volume/count**: 11
- **Paginação**: não testada
- **Campos top-level**: `id`, `status`, `color`, `active`, `createdAt`, `updatedAt`, `userId`, `tenantId`, `funnelId`
- **Preview**:
```json
[
  {
    "id": 63,
    "status": "Aguardando resposta",
    "color": "#1c97da",
    "active": true,
    "createdAt": "2025-11-10T19:26:50.719Z",
    "updatedAt": "2025-11-10T19:26:50.719Z",
    "userId": 60,
    "tenantId": 28,
    "funnelId": null
  },
  {
    "id": 62,
    "status": "Cotação enviada",
    "color": "#1c94ce",
    "active": true,
    "createdAt": "2025-11-10T19:26:50.713Z",
    "updatedAt": "2025-11-10T19:26:50.713Z",
    "userId": 60,
    "tenantId": 28,
    "funnelId": null
 
... [truncado]
```

### `GET /funnel`

- **Status**: 200
- **Latência**: 44ms
- **Body size**: 4127 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `funnels`, `limit`
- **Preview**:
```json
{
  "funnels": [
    {
      "id": 24,
      "name": "Recuperação",
      "action": "R",
      "sessionId": 31,
      "userId": 60,
      "deletedBy": null,
      "queueId": 30,
      "tenantId": 28,
      "deletedAt": null,
      "scheduleEnabled": false,
      "scheduleStartHour": null,
      "scheduleEndHour": null,
      "scheduleDays": null,
      "scheduleTimezone": "America/Sao_Paulo",
      "createdAt": "2025-12-10T20:22:34.013Z",
      "updatedAt": "2025-12-10T20:22:34.013Z",
      "tot
... [truncado]
```

### `GET /contacts-dashboard`

- **Status**: 200
- **Latência**: 103ms
- **Body size**: 3114 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `total`, `weeklyNew`, `recency`, `gender`, `ageGroups`, `zodiac`, `states`, `tags`, `origins`, `channels`, `agents`, `topClients`
- **Preview**:
```json
{
  "total": 1483,
  "weeklyNew": 26,
  "recency": {
    "d30": 101,
    "d90": 224,
    "d180": 681,
    "d360": 477,
    "d360plus": 0
  },
  "gender": [
    {
      "gender": "N",
      "count": 1483
    }
  ],
  "ageGroups": [
    {
      "range": "18-24",
      "m": 0,
      "f": 0,
      "o": 0
    },
    {
      "range": "25-34",
      "m": 0,
      "f": 0,
      "o": 0
    },
    {
      "range": "35-44",
      "m": 0,
      "f": 0,
      "o": 0
    },
    {
      "range": "45-54",
     
... [truncado]
```

### `GET /api-config`

- **Status**: 200
- **Latência**: 46ms
- **Body size**: 965 bytes
- **Volume/count**: ?
- **Paginação**: não testada
- **Campos top-level**: `apis`
- **Preview**:
```json
{
  "apis": [
    {
      "id": "b14c6651-0f00-4e64-973e-392f82691951",
      "sessionId": 31,
      "name": "Spinhardi Site - Back Office",
      "isActive": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MjgsInByb2ZpbGUiOiJhZG1pbiIsInNlc3Npb25JZCI6MzEsImNoYW5uZWxUeXBlIjoid2hhdHNhcHAiLCJpYXQiOjE3ODE3NTQyOTMsImV4cCI6MTg0NDgyNjI5M30.SOuEvVqZ6Jnj6q63tRGlyVHjSWx2gi9KnWiiS7U2jwE",
      "authToken": null,
      "urlServiceStatus": null,
      "urlMessageStatus": null,
   
... [truncado]
```

### `GET /contacts?pageNumber=2`

- **Status**: 200
- **Latência**: 106ms
- **Body size**: 19131 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 103618,
      "name": "553197554217",
      "number": "553197554217",
      "email": null,
      "profilePicUrl": "https://pps.whatsapp.net/v/t61.24694-24/537545043_924124553612729_8647379255017192631_n.jpg?ccb=11-4&oh=01_Q5Aa4gGhePEPNYB-MtTSSiKdcJ8iW8fA_kN31_b2Jwdu67Mfjw&oe=6A1C0681&_nc_sid=5e03e0&_nc_cat=110",
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGr
... [truncado]
```

### `GET /contacts?pageNumber=38`

- **Status**: 200
- **Latência**: 57ms
- **Body size**: 1348 bytes
- **Volume/count**: 3+
- **Paginação**: pageNumber. hasMore=false, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 80345,
      "name": "Zilanda Astine",
      "number": "5524992538725",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-02-28T18:41:22.891Z",
      "updatedAt": "2026-03-02T17:39:46.555Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
... [truncado]
```

### `GET /contacts?pageNumber=999`

- **Status**: 200
- **Latência**: 59ms
- **Body size**: 46 bytes
- **Volume/count**: ?
- **Paginação**: pageNumber. hasMore=false, count=1483
- **Campos top-level**: `contacts`, `count`, `hasMore`
- **Preview**:
```json
{
  "contacts": [],
  "count": "1483",
  "hasMore": false
}
```

### `GET /contacts?searchParam=alan`

- **Status**: 200
- **Latência**: 38ms
- **Body size**: 1409 bytes
- **Volume/count**: 3+
- **Paginação**: pageNumber. hasMore=false, count=3
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 42761,
      "name": "Paula Galante",
      "number": "5511983655600",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-01-08T23:18:36.865Z",
      "updatedAt": "2026-01-15T19:09:01.940Z",
      "walletId": null,
      "wallet": null,
      "tags": [
  
... [truncado]
```

### `GET /contacts?searchParam=5511`

- **Status**: 200
- **Latência**: 42ms
- **Body size**: 19935 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=139
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 37172,
      "name": ".",
      "number": "5511967625177",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2025-12-20T16:43:36.877Z",
      "updatedAt": "2025-12-29T13:17:04.086Z",
      "walletId": null,
      "wallet": null,
      "tags": [
        "Trafe
... [truncado]
```

### `GET /contacts?pageNumber=1&extraSize=80`

- **Status**: 200
- **Latência**: 68ms
- **Body size**: 18304 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 85205,
      "name": "🤩",
      "number": "223518721634414",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-03-16T18:34:11.043Z",
      "updatedAt": "2026-03-16T18:34:11.076Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
      "le
... [truncado]
```

### `GET /contacts?pageNumber=1&pageSize=80`

- **Status**: 200
- **Latência**: 46ms
- **Body size**: 18304 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 85205,
      "name": "🤩",
      "number": "223518721634414",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-03-16T18:34:11.043Z",
      "updatedAt": "2026-03-16T18:34:11.076Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
      "le
... [truncado]
```

### `GET /contacts?pageNumber=1&limit=80`

- **Status**: 200
- **Latência**: 51ms
- **Body size**: 18304 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 85205,
      "name": "🤩",
      "number": "223518721634414",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-03-16T18:34:11.043Z",
      "updatedAt": "2026-03-16T18:34:11.076Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
      "le
... [truncado]
```

### `GET /contacts?pageNumber=1&size=80`

- **Status**: 200
- **Latência**: 74ms
- **Body size**: 18304 bytes
- **Volume/count**: 40+
- **Paginação**: pageNumber. hasMore=true, count=1483
- **Campos top-level**: `id`, `name`, `number`, `email`, `profilePicUrl`, `picIsObjectStorage`, `channel`, `pushname`, `isUser`, `isWAContact`, `isGroup`, `tenantId`
- **Preview**:
```json
{
  "contacts": [
    {
      "id": 85205,
      "name": "🤩",
      "number": "223518721634414",
      "email": null,
      "profilePicUrl": null,
      "picIsObjectStorage": false,
      "channel": "whatsapp",
      "pushname": null,
      "isUser": false,
      "isWAContact": false,
      "isGroup": false,
      "tenantId": 28,
      "createdAt": "2026-03-16T18:34:11.043Z",
      "updatedAt": "2026-03-16T18:34:11.076Z",
      "walletId": null,
      "wallet": null,
      "tags": [],
      "le
... [truncado]
```

### `GET /tasks`

- **Status**: 200
- **Latência**: 27ms
- **Body size**: 2 bytes
- **Volume/count**: 0
- **Paginação**: não testada
- **Campos top-level**: ``
- **Preview**:
```json
[]
```

---

## Endpoints 404 (JSON — rota existe, erro de negócio)


---

## Endpoints 404 (HTML — rota inexistente no Express)

- `GET /queues`
- `GET /quickAnswers`
- `GET /contactLists`
- `GET /contact-lists`
- `GET /schedules`
- `GET /wallets`
- `GET /leadStatus`
- `GET /funnels`
- `GET /companies`
- `GET /plans`
- `GET /announcements`
- `GET /chat-flows`
- `GET /chatFlow`
- `GET /helps`
- `GET /opportunities`
- `GET /opportunities?pageNumber=1`
- `GET /pipeline-steps`
- `GET /pipelineSteps`
- `GET /products`
- `GET /dashboard`
- `GET /dashboard/contacts`
- `GET /dashboard/tickets`
- `GET /dashboard/messages`
- `GET /dashboard/overview`
- `GET /report`
- `GET /reports`
- `GET /api-configs`
- `GET /webhooks`
- `GET /webhook`
- `GET /webhook-configs`
- `GET /integrations`
- `GET /contact-tags`
- `GET /ticket-tags`
- `GET /subscriptions`
- `GET /tenant`
- `GET /billing`
- `GET /invoices`
- `GET /notifications`
- `GET /logs`
- `GET /audit-logs`
- `GET /contact-notes`
- `GET /notes`
- `GET /reminders`
- `GET /ratings`

---

## Endpoints 401/403

- `GET /tenants` → 403: `{
  "error": "Not admin permission"
}`

---

## Endpoints 5xx

- `GET /tickets?pageNumber=1` → 500: `{
  "error": "Internal server error: Error: WHERE parameter \"userId\" has invalid \"undefined\" value"
}`
- `GET /tickets?status=open&pageNumber=1` → 500: `{
  "error": "Internal server error: Error: WHERE parameter \"userId\" has invalid \"undefined\" value"
}`
- `GET /tickets?status=closed&pageNumber=1` → 500: `{
  "error": "Internal server error: Error: WHERE parameter \"userId\" has invalid \"undefined\" value"
}`
- `GET /tickets?status=pending&pageNumber=1` → 500: `{
  "error": "Internal server error: Error: WHERE parameter \"userId\" has invalid \"undefined\" value"
}`
- `GET /campaigns` → 500: `{
  "error": "Internal server error: SequelizeDatabaseError: invalid input syntax for type timestamp: \"null\""
}`

---

## Endpoints timeout/erro rede
