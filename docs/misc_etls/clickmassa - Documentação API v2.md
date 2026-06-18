 PDF To Markdown Converter
Debug View
Result View
chat
CHAT API
Servers

Authorize
General
GETGET
/v1/api/external/messages/{apiId}/{externalKey}
Consultar status/mensagens por externalKey
Retorna todas as mensagens por externalKey.
Try it out
1.0.0 OAS 3.
Parameters
Name Description

apiId *
string

(path)

ID da configuração de API
externalKey *
string

(path)

Chave externa usada para correlacionar mensagens enviadas via
API
pageNumber
integer

(query)

Número da página para paginação dos resultados
Default value : 1
Responses
Code Description Links
(^200) Lista paginada de mensagens
Media type

application/json
Controls Accept header.
Schema
No links
required
apiId
required
externalKey
1
Example Value
{
"messages": [
{
"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
"messageId": "string",
"ack": 0 ,
"status": "pending",
"wabaMediaId": "string",
"read": true,
"isDownload": true,
"fromMe": true,
"body": "string",
"caption": "string",
"originalName": "string",
"size": 0 ,
"previousBody": "string",
"mediaType": "string",
"broadcast": {},
Code Description Links
(^400) externalKey não informada
Media type

application/json
Examples
missingExternalKey
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
GETGET /v1/api/external/template/{apiId} Listar Templates (WABA)
Retorna templates com status APPROVED, incluindo medias.
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
"code": "string",
"isDeleted": true,
"createdAt": "2026-06-18T03:35:04.628Z",
"updatedAt": "2026-06-18T03:35:04.628Z",
Example Value
{
"error": "externalKey não informada."
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
apiId
Responses
Code Description Links
(^200) Lista de templates aprovados
Media type

application/json
Controls Accept header.
Examples
Exemplo
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
GETGET /v1/api/external/users/{apiId} Listar Usuários
Example Value
[
{
"id": 1 ,
"hsmId": "uuid-hsm",
"name": "boas_vindas",
"category": "MARKETING",
"language": "pt_BR",
"preview": "Olá {{1}}, tudo bem?",
"templateType": "TEXT",
"templateMediaId": null,
"status": "APPROVED",
"whatsappId": 10 ,
"components": {},
"tenantId": 1 ,
"deletedAt": null,
"createdAt": "2026-03-05T12:00:00.000Z",
"updatedAt": "2026-03-05T12:00:00.000Z",
"medias": []
}
]
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Retorna { users, count }. Ordenado por name ASC.
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
Responses
Code Description Links
(^200) Usuários listados
Media type

application/json
Controls Accept header.
Examples
example
Schema
No links
(^403) Token invalido
Media type Examples

No links
Parameters
required
apiId
Example Value
{
"count": 1 ,
"users": [
{
"id": 1 ,
"name": "Admin",
"phone": "5584999999999",
"email": "admin@empresa.com",
"profile": "admin",
"tenantId": 1 ,
"uid": "uuid-user-1",
"isDisableAutodistribution": false,
"canViewDepartmentTickets": true
}
]
}
Code Description Links
application/json sessionInvalid
Schema
POSTPOST /v1/api/external/{apiId} Enviar mensagem / criar nota interna
Suporta WhatsApp e WABA. Suporta upload (multer) via multipart/form-data com campo 'media'.
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
Request body application/json
Examples:
Enviar texto simples
Schema
Responses
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
apiId
required
Example Value

{
"number": "559999999999",
"body": "Olá! Seu atendimento foi iniciado com sucesso.",
"externalKey": "CLIENTE-001"
}
Code Description Links
(^200) OK (retorna {message}. Quando onlyNote=true, message pode vir

null)
Media type
application/json
Controls Accept header.
Schema
No links
(^400) Conflitos de parâmetros (chatbotId com onlyNote /

forceTicketToClosed / forceTicketToUser) ou ChatFlow sem step
inicial
Media type
application/json
Examples
chatbotWithOnlyNote
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
No links
Example Value
{
"message": {
"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
"messageId": "string",
"ack": 0 ,
"status": "pending",
"wabaMediaId": "string",
"read": true,
"isDownload": true,
"fromMe": true,
"body": "string",
"caption": "string",
"originalName": "string",
"size": 0 ,
"previousBody": "string",
"mediaType": "string",
"broadcast": {},
"code": "string",
"isDeleted": true,
"createdAt": "2026-06-18T03:35:04.650Z",
"updatedAt": "2026-06-18T03:35:04.650Z",
"msgCreatedAt": "2026-06-18T03:35:04.650Z",
Example Value
{
"error": "ERR_CHATBOT_ID_CONFLICTS_WITH_ONLY_NOTE"
}
Code Description Links
sessionInvalid
Schema
(^404) Erros de validações
Media type

application/json
Examples
apiNotFound
Schema
No links
POSTPOST /v1/api/external/{apiId}/start-session Iniciar sessão do canal
Inicia a sessão do canal vinculado à API e retorna os dados da sessão.
Try it out
Name Description

apiId *
string

(path)

ID da configuração da API
Responses
Code Description Links
(^200) Sessão iniciada com sucesso No links
Example Value

{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Example Value
{
"error": "ERR_API_NOT_FOUND"
}
Parameters
required
apiId
Code Description Links
Media type
application/json
Controls Accept header.
Schema
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Canal não encontrado ou erro ao iniciar sessão
Media type

application/json
Examples
noWhatsapp
Schema
No links
Example Value
{
"id": 0 ,
"qrcode": "string",
"name": "string",
"status": "string",
"plugged": true,
"isDefault": true,
"tokenTelegram": "string",
"instagramUser": "string",
"instagramKey": "string",
"type": "string",
"createdAt": "2026-06-18T03:35:04.657Z",
"updatedAt": "2026-06-18T03:35:04.657Z",
"number": "string",
"phone": "string",
"tenantId": 0 ,
"wabaBSP": "string",
"tokenAPI": "string",
"fbPageId": "string",
"isRejectCall": true,
"callRejectedMessage": "string",
"minutesInactivity": 0 ,
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Example Value
{
"error": "ERR_NO_WAPP_FOUND"
}
Code Description Links
ChatFlow
POSTPOST /v1/api/external/{apiId}/{ticketId}/chat-flow-step Avançar etapa do ChatFlow via callback
Avança o ticket para a próxima etapa do fluxo quando ele estiver aguardando callback.
Opcionalmente envia mensagem e/ou cria nota interna.
Try it out
Name Description
apiId *
string
(path)
ID da configuração de API
ticketId *
integer
(path)
ID do ticket
Request body application/json
Examples:
Avançar fluxo enviando mensagem
Schema
Responses
Parameters
required
apiId
required
ticketId
Example Value
{
"body": "Seu pagamento foi confirmado. Vamos prosseguir com o atendimento."
}
Code Description Links
(^200) Fluxo avançado com sucesso
Media type

application/json
Controls Accept header.
Schema
No links
(^404) Erro de validação/regra de negócio
Media type

application/json
Examples
apiNotFound
Schema
No links
GETGET
/v1/api/external/{apiId}/chat-flows
Listar ChatFlows de atendimento (isServiceBot) ativos do tenant
Retorna apenas flows de atendimento ( isServiceBot=true ) que estejam ativos. Use o id
Example Value
{
"ticket": {
"id": 0 ,
"status": "string",
"contactId": 0 ,
"userId": 0 ,
"whatsappId": 0 ,
"queueId": 0 ,
"tenantId": 0 ,
"chatFlowId": 0 ,
"awaitCallback": true,
"isGroup": true,
"channel": "string",
"lastMessage": "string",
"firstMessage": "string",
"answered": true,
"createdAt": "2026-06-18T03:35:04.664Z",
"updatedAt": "2026-06-18T03:35:04.664Z",
"contact": {},
"user": {
"id": 0 ,
"name": "string",
Example Value
{
"error": "ERR_API_NOT_FOUND"
}
retornado no campo chatbotId do endpoint de envio de mensagem para armar o bot no ticket.
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
Parameters
required
apiId
Example Value
{
"success": true,
"data": [
{
"id": 42 ,
"name": "Atendimento - Boas-vindas",
"isActive": true,
"isServiceBot": true,
"createdAt": "2026-06-18T03:35:04.674Z",
"updatedAt": "2026-06-18T03:35:04.674Z"
}
],
"message": "Chat flows listados com sucesso"
}
Example Value
Code Description Links
(^404) API não encontrada
Media type

application/json
Examples
apiNotFound
Schema
No links
Tags
GETGET /v1/api/external/{apiId}/tags Listar tags
Try it out
Name Description
apiId *
string
(path)
ID da configuração de API
Responses
Code Description Links
(^200) Lista de tags retornada com sucesso
Media type

application/json
Controls Accept header.
No links
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Example Value
{
"error": "ERR_API_NOT_FOUND"
}
Parameters
required
apiId
Code Description Links
Schema
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
POSTPOST /v1/api/external/{apiId}/tags Criar tags em lote
O controller exige um ARRAY no body. Se não for array: ERR_TAG_NOT_ARRAY.
Try it out
Name Description

apiId * ID da configuração de API
Example Value
[
{
"id": 1 ,
"tag": "Exemplo Tag 1",
"color": "#FF5733",
"isActive": true,
"userId": 123 ,
"tenantId": 456 ,
"createdAt": "2025-01-01T12:00:00.000Z",
"updatedAt": "2025-01-02T15:30:00.000Z"
},
{
"id": 2 ,
"tag": "Exemplo Tag 2",
"color": "#33C1FF",
"isActive": false,
"userId": 789 ,
"tenantId": 456 ,
"createdAt": "2025-02-10T08:20:00.000Z",
"updatedAt": "2025-02-11T10:45:00.000Z"
}
]
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
Name Description

string

(path)

Request body application/json
Examples:
Criar tags
Schema
Responses
Code Description Links
(^200) Tags criadas com sucesso
Media type

application/json
Controls Accept header.
Schema
No links
(^400) Erro de validação ou requisição inválida
Media type Examples

No links
apiId
required
Example Value

[
{
"tag": "Exemplo Tag 1",
"color": "#FF5733"
},
{
"tag": "Exemplo Tag 2",
"color": "#33C1FF"
}
]
Example Value
[
{
"tag": "string",
"color": "#FF0000",
"userId": 0
}
]
Code Description Links
application/json Body não é array
Schema
(^403) Sessão inválida ou não autorizada
Media type

application/json
Schema
No links
(^500) Erro interno do servidor
Media type

application/json
Schema
No links
DELETEDELETE /v1/api/external/{apiId}/tags/{tagId} Remover tag
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
Example Value
{
"error": "ERR_TAG_NOT_ARRAY",
"message": "O corpo da requisição deve ser um array"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Example Value
{
"error": "INTERNAL_SERVER_ERROR",
"message": "Erro inesperado ao criar tags"
}
Parameters
required
apiId
Name Description

tagId *
string

(path)

ID da tag a ser removida
Responses
Code Description Links
(^200) Tag removida com sucesso
Media type

application/json
Controls Accept header.
No links
(^403) Sessão inválida ou não autorizada
Media type

application/json
Schema
No links
(^404) Tag não encontrada ou não pode ser removida
Media type

application/json
Examples
Tag não encontrada
Schema
No links
required
tagId
Example Value
{
"message": "Tag removida com sucesso."
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Example Value
{
"error": "ERR_NO_TAG_FOUND",
"message": "Tag não encontrada"
}
Opportunities
POSTPOST /v1/api/external/{apiId}/opportunities Criar oportunidade
Try it out
Name Description
apiId *
string
(path)
ID da configuração de API
Request body application/json
Schema
Responses
Code Description Links
(^201) Criado
Media type

No links
Parameters
required
apiId
required
Example Value
{
"name": "Nova oportunidade",
"description": "Descrição da oportunidade",
"value": 1000 ,
"expectedCloseDate": "2025-12-31",
"contactId": 1 ,
"responsibleId": "10",
"pipelineStepId": 2 ,
"userId": "1",
"productsOpportunity": [
{
"productId": 1 ,
"amount": 2 ,
"value": 100
}
]
}
Code Description Links
application/json
Controls Accept header.
(^400) Erro validação
Media type

application/json
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Usuário não encontrado No links
(^500) Erro interno No links

GETGET /v1/api/external/{apiId}/opportunities Listar oportunidades
Try it out
Example Value
{
"success": true,
"data": {
"id": 1 ,
"name": "Nova oportunidade",
"status": "open",
"value": 1000
},
"message": "Oportunidade criada com sucesso"
}
Example Value
{
"error": "string"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
Name Description

apiId *
string

(path)

ID da configuração de API
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Filtro inválido No links
required

apiId
Example Value
{
"success": true,
"data": [
{
"id": 1 ,
"name": "Oportunidade exemplo",
"status": "open",
"value": 500
}
],
"count": 1 ,
"hasMore": false,
"message": "Oportunidades listadas com sucesso"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Code Description Links
(^500) Erro interno No links

GETGET /v1/api/external/{apiId}/opportunities/{opportunityId} Detalhar oportunidade
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
opportunityId *
string

(path)

ID da oportunidade
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
No links
Parameters
required
apiId
required
opportunityId
Example Value
{
"success": true,
"data": {
"id": 1 ,
"name": "Oportunidade exemplo",
"status": "open",
"value": 500
},
"message": "Oportunidade encontrada"
}
Code Description Links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Oportunidade não encontrada No links

PUTPUT /v1/api/external/{apiId}/opportunities/{opportunityId} Atualizar oportunidade
Try it out
Name Description

apiId *
string

(path)

ID da configuração de API
opportunityId *
string

(path)

ID da oportunidade
Request body application/json
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
apiId
required
opportunityId
required
Example Value

{
"name": "Atualizada",
"value": 1500 ,
"userId": "1"
}
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
No links
(^400) Erro validação No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Oportunidade não encontrada No links
(^409) Tarefas pendentes No links

PUTPUT /v1/api/external/{apiId}/opportunities/{opportunityId}/status Atualizar status
Try it out
Name Description

apiId * ID da configuração de API
Example Value
{
"success": true,
"data": {
"id": 1 ,
"name": "Atualizada"
},
"message": "Oportunidade atualizada com sucesso"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
Name Description

string

(path)

opportunityId *
string

(path)

ID da oportunidade
Request body application/json
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
No links
(^400) Erro validação No links

apiId
required
opportunityId
required
Example Value

{
"status": "lost",
"pipelineStepId": 3 ,
"gainOrLossReasonId": 1 ,
"note": "Cliente recusou",
"userId": "1"
}
Example Value
{
"success": true,
"data": {
"id": 1 ,
"status": "lost"
},
"message": "Status da oportunidade atualizado com sucesso"
}
Code Description Links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
(^404) Oportunidade não encontrada No links
(^409) Tarefas pendentes No links

Products
GETGET /v1/api/external/{apiId}/products Listar produtos
Try it out
Name Description
apiId *
string
(path)
ID da configuração de API
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
No links
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
apiId
Code Description Links
Schema
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
PipelineSteps
GETGET /v1/api/external/{apiId}/pipeline-steps Listar etapas do funil
Try it out
Name Description
apiId *
string
(path)
ID da configuração de API
Example Value
{
"success": true,
"data": [
{
"id": 1 ,
"name": "Produto A",
"description": "Descrição do produto",
"isActive": true,
"value": 100 ,
"duration": 30 ,
"tenantId": 1 ,
"userId": 1 ,
"createdAt": "2024-01-01T00:00:00.000Z",
"updatedAt": "2024-01-01T00:00:00.000Z"
}
],
"message": "Produtos ativos listados com sucesso"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
Parameters
required
apiId
Responses
Code Description Links
(^200) OK
Media type

application/json
Controls Accept header.
Schema
No links
(^403) Token invalido
Media type

application/json
Examples
sessionInvalid
Schema
No links
Schemas
Example Value
{
"success": true,
"data": [
{
"id": 1 ,
"name": "Contato inicial",
"color": "#FF5733",
"order": 1
}
],
"message": "Pipeline steps listados com sucesso"
}
Example Value
{
"error": "ERR_SESSION_NOT_AUTH_TOKEN"
}
ErrorResponse
SuccessResponse
MessageNote
SendMessageBase
MessageText
CustomMedia
WabaTemplateMessage
MessageStatus
Tag
OpportunityCreate
OpportunityUpdateStatus
ChatFlowCallbackAdvance
Whatsapp
Message
TemplateMedia
Template
ExternalUser
ExternalUsersResponse
ExternalSendMessageJson
ExternalSendMessageMultipart
ExternalSendMessageResponse
WhatsappSession
ChatFlowStepResponse
TicketDetails
ChatFlowStepRequest
This is a offline tool, your data stays locally and is not send to any server!
Feedback & Bug Reports