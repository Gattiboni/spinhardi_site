# Análise de Janelas e Volume — Backfill ClickMassa

Gerado em: 2026-06-18 10:30 (UTC)
Base URL: https://enterprise-352napi.clickmassa.com.br/v1/api/external/b14c6651-0f00-4e64-973e-392f82691951
Pipeline steps source: supabase-cache

## Volume por Pipeline-Step

| ID | Nome | Count | Latência (ms) | Envelope keys |
|---|---|---|---|---|
| 73 | Primeiro contato | 1 | 126 | `[success, data, count, hasMore, message]` |
| 74 | Cotação | 0 | 41 | `[success, data, count, hasMore, message]` |
| 75 | Envio da proposta | 0 | 91 | `[success, data, count, hasMore, message]` |
| 76 | Follow-up | 0 | 61 | `[success, data, count, hasMore, message]` |
| 77 | Emissão | 0 | 34 | `[success, data, count, hasMore, message]` |
| 78 | Contrato | 0 | 32 | `[success, data, count, hasMore, message]` |
| 79 | Pós venda | 0 | 33 | `[success, data, count, hasMore, message]` |
| 80 | Financeiro | 0 | 34 | `[success, data, count, hasMore, message]` |
| 81 | Pre viagem | 0 | 30 | `[success, data, count, hasMore, message]` |
| 82 | Pós viagem | 0 | 36 | `[success, data, count, hasMore, message]` |

**Total estimado de opps no funil**: 1
**Stage com mais opps**: id=73 "Primeiro contato" (1 opps)

### Shape do envelope de listagem

```json
{
  "count": 1,
  "hasMore": false,
  "message": "Oportunidades listadas com sucesso",
  "success": true
}
```

## Paginação

Stage de teste: id=73 "Primeiro contato" (baseline: 1 opps)

| Param testado | Status | Count retornado | Efeito |
|---|---|---|---|
| `page=1&pageSize=10` | 200 | 1 | sem efeito |
| `limit=10&offset=0` | 200 | 1 | sem efeito |
| `pageNumber=1` | 200 | 1 | sem efeito |
| `size=10` | 200 | 1 | sem efeito |
| `take=10&skip=0` | 200 | 1 | sem efeito |

**Resultado**: Nenhum parâmetro de paginação reduziu o count. API provavelmente retorna tudo de uma vez por stage.

## Filtros Temporais

Stage de teste: id=73 (baseline: 1 opps)

| Filtro testado | Status | Count retornado | Efeito |
|---|---|---|---|
| `createdAfter=2026-01-01` | 200 | 1 | sem efeito |
| `createdAt[gte]=2026-01-01` | 200 | 1 | sem efeito |
| `updatedAfter=2026-06-01` | 200 | 1 | sem efeito |
| `from=2026-01-01&to=2026-12-31` | 200 | 1 | sem efeito |
| `startDate=2026-01-01` | 200 | 1 | sem efeito |

**Resultado**: Nenhum filtro temporal funcionou. A API retorna todas as opps independente da data.

## Rate Limit / Throttling

15 chamadas seguidas sem pausa — stage id=73 "Primeiro contato":

| Chamada | Status | Latência (ms) | Rate limit? |
|---|---|---|---|
| 1 | 200 | 42 | — |
| 2 | 200 | 35 | — |
| 3 | 200 | 30 | — |
| 4 | 200 | 37 | — |
| 5 | 200 | 32 | — |
| 6 | 200 | 34 | — |
| 7 | 200 | 82 | — |
| 8 | 200 | 34 | — |
| 9 | 200 | 35 | — |
| 10 | 200 | 40 | — |
| 11 | 200 | 103 | — |
| 12 | 200 | 38 | — |
| 13 | 200 | 36 | — |
| 14 | 200 | 71 | — |
| 15 | 200 | 63 | — |

**Media de latência**: 47ms
**Rate limit atingido**: NAO
**Throttling soft**: Nao evidente (primeiras 7: 42ms, últimas 7: 55ms)

## Shape de Opportunity (completo)

Campos top-level (opp 8935, stage "Primeiro contato"):

- `tasksCount`: object
- `id`: number
- `tenantId`: number
- `contactId`: number
- `userId`: number
- `responsibleId`: number
- `pipelineStepId`: number
- `gainOrLossReasonId`: null
- `name`: string
- `description`: null
- `note`: null
- `expectedCloseDate`: string
- `closeDate`: null
- `pipelineUpdatedAt`: string
- `value`: string
- `status`: string
- `createdAt`: string
- `updatedAt`: string
- `contact`: object
- `user`: object
- `responsible`: object
- `pipelineStep`: object
- `gainOrLossReason`: null
- `productsOpportunity`: array[0]

### Contact embedado em Opportunity

Campos do contact embed (opp 8935):

- `profilePicUrl`: string — ex: ""
- `address`: object
- `id`: number — ex: 109710
- `name`: string — ex: "5511983340447"
- `number`: string — ex: "5511983340447"
- `lid`: string — ex: "false"
- `isNumber`: boolean — ex: true
- `email`: null
- `pushname`: null
- `observations`: null
- `channel`: string — ex: "whatsapp"
- `isUser`: boolean — ex: false
- `isWAContact`: boolean — ex: false
- `isGroup`: boolean — ex: false
- `deletedAt`: null
- `negotiatedValue`: null
- `leadStatusId`: null
- `leadOriginId`: null
- `queueId`: null
- `tenantId`: number — ex: 28
- `birthDate`: null
- `gender`: null
- `company`: null
- `cep`: null
- `pais`: null
- `estado`: null
- `cidade`: null
- `bairro`: null
- `logradouro`: null
- `numero`: null
- `complemento`: null
- `customFields`: object
- `agentMemory`: object
- `tags`: array[0]
- `firstConnection`: number — ex: 31
- `profilePicId`: null
- `picIsObjectStorage`: boolean — ex: false
- `createdAt`: string — ex: "2026-06-18T05:54:35.008Z"
- `updatedAt`: string — ex: "2026-06-18T05:54:35.075Z"

**Nota**: Todas as opps amostradas têm `contact.name` = número de telefone (sem nome cadastrado no CRM).

## Tags

`GET /tags`: HTTP 200, 45ms, 20 tags

Campos de uma tag: `id, tag, color, isActive, userId, tenantId, createdAt, updatedAt`
Exemplo: `{"id":320,"tag":"Africa/Asia","color":"#0000a3","isActive":true,"userId":60,"tenantId":28,"createdAt":"2025-12-10T22:54:52.875Z","updatedAt":"2025-12-10T22:55:38.366Z"}`
Tem `usageCount` ou similar: NAO

Tags observadas nas opps amostradas:
- opp 8935: contact.tags = []

## Histórico de Mensagens

`externalKey` testada (contact.number): `5511983340447`
HTTP 200, 23ms, 0 mensagens
Envelope keys: `[messages, count, hasMore]`
Meta: `{"count":0,"hasMore":false}`

## Dumps Gerados

- `docs/samples/opp-8935.json` — stage "Primeiro contato"

## Recomendação de Estratégia ETL

Baseado nos achados desta sondagem:

- **Estratégia de listagem**: 10 GETs (1 por pipeline step). Sem endpoint "listar tudo" — `pipelineStepId` é obrigatório.
- **Paginação**: Não funcional para `/opportunities`. API retorna todas as opps do stage de uma vez. Monitorar tamanho de response se volume crescer.
- **Filtro temporal**: Indisponível. Backfill incremental requer comparação com `clickmassa_ultimo_sync` local (Supabase). A cada sync, comparar `opp.updatedAt` com o timestamp do último sync.
- **Latência média**: 47ms por chamada.
- **Rate limit**: Não observado em 15 chamadas seguidas. Pausa de 200ms entre chamadas deve ser segura.
- **Estimativa tempo (listagem por stage)**: 10 stages × ~47ms ≈ 0.5s
- **Estimativa tempo (opps individuais)**: 1 opps × (~47ms + 200ms pausa) ≈ 0.0 minutos

## Bandeiras

1. Pipeline steps obtidos via: **supabase-cache**
2. Paginação em /opportunities: **nao funciona (retorna tudo de uma vez)**
3. Filtro temporal: **nao funciona — sem filtro incremental nativo**
4. Rate limit: **nao observado em 15 chamadas**
5. Opps com contact.name real (nao numero): **0/1** amostradas
6. Tags nas opps: **visto em 1 campo(s)**

> **Impacto no ETL**: Sem filtro temporal nativo, o backfill inicial precisará percorrer todas as opps de todos os stages. Backfill incremental será baseado em comparação local (`clickmassa_opp.updatedAt > contacts.clickmassa_ultimo_sync`). Recomendado: salvar timestamp de cada sync completo por stage.
