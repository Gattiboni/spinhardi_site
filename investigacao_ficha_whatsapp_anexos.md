# Investigação — ficha do contato: link de WhatsApp e infraestrutura de anexos

**Data:** 2026-07-27 · **Commit:** `b926c2a` · **Escopo:** só leitura, nada modificado.
**Grafo:** `graphify-out/GRAPH_REPORT.md` foi construído em `5ffdaae5` (2 commits atrás) — a
consulta `graphify query` devolveu só o site público (comunidade errada), então a investigação
foi feita por leitura direta. Fica o registro: o grafo não indexa bem o admin nesse recorte.

---

## Resumo executivo (leia isto primeiro)

As duas features **já existem no repo**, em graus diferentes de acabamento. O trabalho não é
construir do zero — é corrigir um ponto e ligar uma env.

| Feature | Estado real |
|---|---|
| (a) WhatsApp → ClickMassa | **Feito no botão do cabeçalho**, `clickmassaContactUrl()` pronto. **Falta**: o campo "WhatsApp" do card Dados ainda aponta pra `wa.me` — é o destino antigo que sobrou. E a env `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` **não está setada** em lugar nenhum, então hoje o botão renderiza desabilitado. |
| (b) Anexos na ficha | **Já renderizado e funcional** — tabela `anexos` + bucket privado + upload/abrir/remover, tudo com call sites vivos na ficha do contato. **Falta só a ponte com o Iddas**: nada do sync escreve em `anexos` hoje. |

Duas coisas que mudam o desenho e valem destaque:

1. ~~O payload de `orcamento` do Iddas tem um campo `anexos` e o `raw_payload` da bronze
   guarda o item inteiro — os metadados dos documentos já estariam no banco desde o
   backfill.~~ **ERRADO — corrigido na seção C2.** O sample do repo é resposta do endpoint
   de **detalhe**; a bronze ingere o de **lista**, que não traz `anexos`. Nada de anexo
   está na bronze. Ver [C2](#c2--sonda-anexos-na-api-do-iddas-2026-07-27).
2. O sync **não baixa binário nenhum** — confirmado. O que existe é ingestão JSON pura.

---

## A. Link de WhatsApp hoje

### A1/A2. Onde renderiza e pra onde aponta

São **três** pontos no admin, com destinos diferentes:

| # | Local | Arquivo:linha | Destino hoje |
|---|---|---|---|
| 1 | Botão `💬 WhatsApp` no cabeçalho da ficha | [ContactDetailClient.tsx:190-209](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L190-L209) | **ClickMassa** via `clickmassaContactUrl()` |
| 2 | Campo "WhatsApp" no card **Dados** | [ContactDetailClient.tsx:283-309](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L283-L309) | **`wa.me`** — helper local `whatsappLink()` |
| 3 | Link "Abrir no ClickMassa →" em *Sistemas externos* | [ContactDetailClient.tsx:576-594](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L576-L594) | **ClickMassa** via `clickmassaContactUrl()` |

O helper que ainda gera `wa.me`:

```ts
// src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx:77-79
function whatsappLink(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
}
```

É a **única** definição de link `wa.me` no admin, usada **só** na linha 287. Esse é o
alvo da feature (a): o `[Abrir]` do card Dados é o que ainda cai no destino antigo.

**Na lista de contatos:** não há link de WhatsApp — só o `WhatsAppBadge` (indicador
visual `tem_whatsapp`, sem `href`) em
[ContactsClient.tsx:610](src/app/admin/(painel)/contatos/ContactsClient.tsx#L610).
E há um comentário explícito em
[ContactsClient.tsx:86-88](src/app/admin/(painel)/contatos/ContactsClient.tsx#L86-L88)
dizendo que "Enviar WhatsApp" foi removido de propósito da lista (disparo em massa →
ban da Meta). **A lista está fora do escopo da mudança** — nada a fazer lá.

Fora do admin (site público, não confundir): `buildWhatsAppURL()` em
[src/lib/whatsapp/constants.ts:19-22](src/lib/whatsapp/constants.ts#L19-L22) monta
`wa.me` com o número **da agência**, usado no [Footer.tsx:83](src/components/ui/Footer.tsx#L83)
e no [CTAWhatsApp.tsx:38](src/components/ui/CTAWhatsApp.tsx#L38). Isso é o CTA do
visitante — **não deve mudar**.

### A3. Constante/config de URL do ClickMassa

Existe, e está pronta:

```ts
// src/lib/integrations/panel-urls.ts:41-45
export function clickmassaContactUrl(clickmassaContactId: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_CLICKMASSA_PANEL_URL;
  if (!base || !clickmassaContactId) return null;
  return `${base.replace(/\/+$/, "")}/#/contact/${encodeURIComponent(clickmassaContactId)}/perfil`;
}
```

- Rota já confirmada no comentário do arquivo: hash routing `/#/contact/{id}/perfil`
  ([panel-urls.ts:34-40](src/lib/integrations/panel-urls.ts#L34-L40)).
- Degrada pra `null` sem env ou sem id — os três call sites já tratam o `null` com
  botão desabilitado + tooltip.

**Nomes de env relevantes** (só nomes, sem valores):

| Nome | Onde é lido | Está em `.env.local`? |
|---|---|---|
| `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` | [panel-urls.ts:42](src/lib/integrations/panel-urls.ts#L42) | **NÃO** |
| `NEXT_PUBLIC_IDDAS_PANEL_URL` | [panel-urls.ts:55](src/lib/integrations/panel-urls.ts#L55) — **comentado**, inativo | **NÃO** |
| `CLICKMASSA_API_URL` / `CLICKMASSA_API_KEY` | config do sync (API, não painel) | sim |

> ⚠️ **Achado que vale ação sua:** `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` não aparece nem em
> `.env.local` nem em `.env.example`. Como o projeto não tem tipagem de env (não existe
> `env.d.ts`/`env.ts` — só `next-env.d.ts`, gerado pelo Next), nada acusa a falta em build.
> Consequência hoje: **os dois botões de ClickMassa da ficha renderizam desabilitados**
> ("configurar NEXT_PUBLIC_CLICKMASSA_PANEL_URL"). Setar essa env — local e na Vercel — é
> pré-requisito da feature (a), e é tarefa manual sua.

Não existe nenhuma outra constante de URL de painel no código além de `PANEL_URLS`
([panel-urls.ts:16-19](src/lib/integrations/panel-urls.ts#L16-L19)), que tem `clickmassa: ""`
e `iddas: ""` — ambos vazios de propósito. Note a duplicação: o ClickMassa tem *dois*
caminhos (o `PANEL_URLS.clickmassa` vazio e a função dedicada por env). O vazio nunca é
usado pro ClickMassa; `buildPanelUrl("iddas", ...)` é o único consumidor do mapa, em
[ContactDetailClient.tsx:485](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L485).

### A4. A ficha tem acesso ao `clickmassa_contact_id` no ponto do WhatsApp?

**Tem, direto, sem precisar subir nada.**

- O campo existe no tipo: `clickmassaContactId: string | null` em
  [types.ts:120](src/lib/contacts/types.ts#L120).
- `getContactById()` faz `select("*")` da tabela `contacts`
  ([index.ts:88-100](src/lib/contacts/index.ts#L88-L100)), então o campo já vem carregado.
- O componente do card Dados recebe o `Contact` **inteiro**:
  `function DadosCard({ contact: c }: { contact: Contact })` em
  [ContactDetailClient.tsx:278](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L278).

Ou seja: dentro do `DadosCard`, `c.clickmassaContactId` já está no escopo, na mesma linha
onde hoje se chama `whatsappLink(c.whatsapp)`. **Nenhum prop drilling novo, nenhuma query
nova.** É a mesma leitura que o `ContatoHeader` já faz em
[ContactDetailClient.tsx:138](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L138).

O único ponto de desenho que sobra (decisão sua, não estou propondo): contato **com**
telefone mas **sem** `clickmassaContactId` — hoje o campo Dados linka pro `wa.me` e
funcionaria; com ClickMassa, cairia no `null`. O cabeçalho já resolve isso escondendo o
botão inteiro quando `temCmId` é falso
([ContactDetailClient.tsx:139](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L139),
usado na linha 190).

---

## B. Infraestrutura de anexos existente

### B5. Leitura/escrita da tabela `anexos`

**Não é zero — o módulo está completo e em uso.** Toda a manipulação está centralizada
em [src/lib/anexos/index.ts](src/lib/anexos/index.ts) (`server-only`, service role).

**Readers:**

| Função / call site | Arquivo:linha |
|---|---|
| `getAnexos()` — `select` filtrado por dono | [anexos/index.ts:62-75](src/lib/anexos/index.ts#L62-L75) |
| `signedUrlDoAnexo()` — lê `storage_path` | [anexos/index.ts:138-157](src/lib/anexos/index.ts#L138-L157) |
| `removeAnexo()` — lê `storage_path` antes de apagar | [anexos/index.ts:121-129](src/lib/anexos/index.ts#L121-L129) |
| **Call site — ficha do contato** | [contatos/[id]/page.tsx:33](src/app/admin/(painel)/contatos/[id]/page.tsx#L33) |
| **Call site — detalhe da jornada** | [jornadas/[id]/page.tsx:37](src/app/admin/(painel)/jornadas/[id]/page.tsx#L37) |

**Writers:**

| Função / call site | Arquivo:linha |
|---|---|
| `uploadAnexo()` — `insert` na tabela + upload no bucket | [anexos/index.ts:82-115](src/lib/anexos/index.ts#L82-L115) |
| `removeAnexo()` — `delete` na tabela + remove do bucket | [anexos/index.ts:118-135](src/lib/anexos/index.ts#L118-L135) |
| Server Action `uploadAnexoAction` | [anexos/actions.ts:26-47](src/lib/anexos/actions.ts#L26-L47) |
| Server Action `removeAnexoAction` | [anexos/actions.ts:49-62](src/lib/anexos/actions.ts#L49-L62) |
| Server Action `getAnexoUrlAction` | [anexos/actions.ts:64-73](src/lib/anexos/actions.ts#L64-L73) |
| **Call sites (UI)** | [AnexosBlock.tsx:45,60,76](src/components/admin/AnexosBlock.tsx#L45) |

Todas as Server Actions passam por `requireSession()` antes de tocar no service role
([actions.ts:31,53,66](src/lib/anexos/actions.ts#L31)).

**Nenhum writer vem de sync/ingestão.** Os únicos caminhos de escrita são as três Server
Actions, todas disparadas por clique humano no `AnexosBlock`. É exatamente aí que a
ingestão do Iddas precisaria se encaixar.

**Sobre o schema (FK, `ON DELETE CASCADE`, CHECK):** não está no repo. `sql/` só tem
`gold_contacts.sql` e `gold_dashboard.sql`. O que o repo registra é a decisão
**D075** ([docs/DECISION_LOG.md:685-698](docs/DECISION_LOG.md#L685-L698)): tabela `anexos`
com `contact_id` e `jornada_id` nullable + CHECK garantindo ao menos um dono, bucket
privado com RLS `authenticated`. As colunas reais que o código lê estão em
[anexos/index.ts:22-32](src/lib/anexos/index.ts#L22-L32): `id, contact_id, jornada_id,
nome_arquivo, storage_path, tipo, tamanho_bytes, uploaded_by, created_at`.
→ **verificação via banco** (FK/CASCADE/CHECK reais, e se `uploaded_by` tem FK pra auth).

### B6. Supabase Storage no projeto

**Sim, um bucket, num lugar só.** Bucket `anexos`, privado:

```ts
// src/lib/anexos/index.ts:19-20
const BUCKET = "anexos";
const SIGNED_URL_TTL = 60; // segundos — link de visualização efêmero
```

Todos os usos de `.storage.from(...)`:

| Operação | Arquivo:linha |
|---|---|
| `.upload()` | [anexos/index.ts:90](src/lib/anexos/index.ts#L90) |
| `.remove()` — rollback de upload órfão | [anexos/index.ts:110](src/lib/anexos/index.ts#L110) |
| `.remove()` — exclusão | [anexos/index.ts:130](src/lib/anexos/index.ts#L130) |
| `.createSignedUrl()` | [anexos/index.ts:150-152](src/lib/anexos/index.ts#L150-L152) |

Convenção de path já estabelecida ([anexos/index.ts:88](src/lib/anexos/index.ts#L88)):
`{jornada|contact}/{ownerId}/{uuid}-{nomeSeguro}`.

Fora do Storage do Supabase existe upload de asset pro **Sanity** em
[src/lib/sanity/assets.ts:31](src/lib/sanity/assets.ts#L31) — é imagem de blog,
sistema diferente, sem relação com anexos de contato.

### B7. A ficha 360 tem seção de anexos renderizada?

**Tem, e não está vazia de código — está montada e funcionando.**

```tsx
// src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx:973
<AnexosBlock owner={{ kind: "contact", id: contact.id }} anexos={anexos} />
```

O `AnexosBlock` ([src/components/admin/AnexosBlock.tsx](src/components/admin/AnexosBlock.tsx))
já entrega:

- **Upload** — `<input type="file">` com `accept` derivado de `ANEXO_EXTENSOES`
  (PDF, doc/docx, xls/xlsx, jpg/jpeg/png — [types.ts:64-76](src/lib/anexos/types.ts#L64-L76)).
- **"Abrir"** — gera URL assinada de 60s e abre em nova aba
  ([AnexosBlock.tsx:55-69](src/components/admin/AnexosBlock.tsx#L55-L69)). Detalhe fino já
  resolvido: a aba é aberta **antes** do `await` pra não ser bloqueada pelo navegador
  ([AnexosBlock.tsx:58-59](src/components/admin/AnexosBlock.tsx#L58-L59)).
- **"Remover"** — com `confirm()` ([AnexosBlock.tsx:72](src/components/admin/AnexosBlock.tsx#L72)).
- Ícone por tipo, tamanho formatado, estado vazio ("Nenhum anexo ainda").

> Nota de escopo pra feature (b): o requisito fala em **download**. O que existe hoje é
> **"Abrir"** — a URL assinada abre no navegador (PDF/imagem renderizam inline em vez de
> baixar). Não há atributo `download` nem `?download=` na signed URL. Se "download" for
> literal, é um ajuste pequeno e localizado; se "abrir pra ver" basta, já está pronto.
> Deixo marcado, não decidido.

### B8. Como a ficha carrega os dados

Server Component com **quatro** queries: uma sequencial (precisa do contato pra decidir
`notFound()`) e três em paralelo.

```
src/app/admin/(painel)/contatos/[id]/page.tsx
├─ export const dynamic = "force-dynamic"     (L10 — leitura ao vivo, sem prerender)
├─ getContactById(id)                          (L26 — sequencial; notFound() se null)
└─ Promise.all([                               (L29-34)
     getContactInteractions(id),               →  interactions
     getContactExternalLinks(id),              →  externalLinks
     getJornadasDoContato(id),                 →  jornadas
     getAnexos({ kind: "contact", id }),       →  anexos      ← já existe
   ])
        ↓ props
   <ContactDetailClient ... />                 (L36-44, "use client")
```

Estrutura de render em [ContactDetailClient.tsx:951-977](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L951-L977),
nesta ordem:

```
← Voltar pra lista
ContatoHeader          (botão WhatsApp → ClickMassa)
grid 2 colunas: DadosCard | QualificacaoCard      ← o wa.me vive aqui
JornadasZone
PreferenciasCard
SistemasExternosDetails  (<details> recolhido)
AnexosBlock                                        ← seção de anexos já ancorada
InteracoesTimeline
```

**Onde uma seção nova se ancoraria:** o padrão está estabelecido e é uniforme — cada bloco
é um componente que recebe props já carregadas pelo server, e o `page.tsx` acrescenta uma
entrada no `Promise.all`. Anexos já ocupa esse slot. Documentos-do-Iddas ou entram como
mais itens na lista que o `AnexosBlock` já renderiza (se virarem linhas em `anexos`), ou
como um bloco irmão com sua própria query no `Promise.all`. Só descrevendo a estrutura,
como pedido — a escolha é do desenho.

---

## C. Ingestão Iddas

### C9. Onde roda e o que o `orcamento` traz

**Rota da cron:** [src/app/api/cron/sync/[source]/route.ts](src/app/api/cron/sync/[source]/route.ts) —
`/api/cron/sync/iddas`, GET e POST, auth por `Bearer ${CRON_SECRET}` com comparação
time-constant ([route.ts:32-40](src/app/api/cron/sync/[source]/route.ts#L32-L40)).
Runtime Node, `maxDuration = 800` porque "o Iddas leva ~8min"
([route.ts:27-28](src/app/api/cron/sync/[source]/route.ts#L27-L28)). A rota é só borda; a
lógica está em `@/lib/sync/run-sync` ([route.ts:64](src/app/api/cron/sync/[source]/route.ts#L64)).

**Módulos:** [src/lib/ingestion/iddas/](src/lib/ingestion/iddas/) — `transport.ts` (auth +
paginação), `resources.ts` (tabela declarativa + processor), `mappers.ts` (um mapper por
recurso), `index.ts`.

**O `raw_payload` traz o payload COMPLETO.** O mapper extrai colunas tipadas *e* guarda o
item inteiro:

```ts
// src/lib/ingestion/iddas/mappers.ts:235  (dentro de mapOrcamento, L214-240)
raw_payload: item,
```

`item` é o objeto cru da API, sem pick nem filtro — o processor entrega
`mapper(item as Record<string, unknown>, audit)` direto do que veio do fetch
([resources.ts:155](src/lib/ingestion/iddas/resources.ts#L155)). O padrão `raw_payload: item`
se repete em **todos** os mappers do Iddas (canal, situacao, pessoa, venda, etc.).

Destino: `bronze_iddas_orcamento`, upsert por `id`
([resources.ts:88](src/lib/ingestion/iddas/resources.ts#L88),
[resources.ts:186-188](src/lib/ingestion/iddas/resources.ts#L186-L188)).

> ⚠️ **CORREÇÃO (ver C2).** A versão original desta seção afirmava que o campo `anexos`
> do orçamento já estaria em `bronze_iddas_orcamento.raw_payload` desde o backfill. **Isso
> está errado.** O sample do repo
> ([orcamento-sample.json](docs/misc_etls/samples/iddas/orcamento-sample.json)) é resposta
> do endpoint de **DETALHE** (`data` é objeto, sem `meta`) — 42 campos, incluindo `anexos`.
> Mas `fetchAllPages` consome o endpoint de **LISTA**
> ([transport.ts:184-186](src/lib/ingestion/iddas/transport.ts#L184-L186)), cujo item tem
> **17 campos e não inclui `anexos`** (verificado ao vivo, C2). Portanto o `raw_payload`
> da bronze **não contém** anexos, e nunca conteve. Detalhes e a sonda completa em
> [C2](#c2--sonda-anexos-na-api-do-iddas-2026-07-27).

Complemento: a documentação da API do Iddas no repo
([docs/misc_etls/iddas-endpoints.md](docs/misc_etls/iddas-endpoints.md) e
[api_iddas_full.json](docs/misc_etls/api_iddas_full.json)) **não menciona anexo/documento
em lugar nenhum** (grep vazio nos dois). Não existe recurso `anexo` na tabela de recursos
([resources.ts:38-61](src/lib/ingestion/iddas/resources.ts#L38-L61) — 23 recursos, nenhum
de documento). Então o campo `anexos` do orçamento é, hoje, a **única** pista de documentos
do Iddas que o repo tem.

### C10. O sync baixa binário hoje?

**Não. Confirmado — sua aposta está certa.**

- O transport só faz `res.json()` e manda `Accept: application/json`
  ([transport.ts:126-161](src/lib/ingestion/iddas/transport.ts#L126-L161)).
- `fetchAllPages` acumula itens JSON paginados
  ([transport.ts:174-210](src/lib/ingestion/iddas/transport.ts#L174-L210)).
- Busca por `arrayBuffer()`, `.blob()`, `Buffer.from(await`, `responseType`,
  `octet-stream`, `application/pdf` em `src/` e `scripts/`: **um único hit**, em
  [src/lib/sanity/assets.ts:31](src/lib/sanity/assets.ts#L31) — upload de imagem de blog
  pro Sanity, nada a ver com o sync.

Ou seja: **baixar binário do Iddas seria capacidade nova**, não extensão de algo existente.
Vale ter em conta o orçamento de tempo da rota (já em 800s pra ~8min de sync) se o download
for pro mesmo processo.

---

## C2 — Sonda anexos na API do Iddas (2026-07-27)

Sonda **read-only** contra a API de produção do Iddas, com as env locais
(`IDDAS_API_URL` / `IDDAS_API_KEY`), login em `POST /api/v1/auth/login` com `{"chave": ...}`.
Script descartável no scratchpad, **não commitado**. Só GETs — nenhuma escrita.

### C2.1 — Correção da premissa (importante)

A conclusão de C9 estava errada, e o erro tem uma causa específica:

| | Endpoint de **LISTA** (`GET /orcamento?page=N`) | Endpoint de **DETALHE** (`GET /orcamento/{id}`) |
|---|---|---|
| Campos por item | **17** | **42** |
| Traz `anexos`? | **Não** (`undefined`) | **Sim** (array) |
| Traz `imagemcapa`? | Não | Sim |
| É o que a bronze ingere? | **Sim** ([transport.ts:184-186](src/lib/ingestion/iddas/transport.ts#L184-L186)) | Não — o código nunca chama detalhe |

O `orcamento-sample.json` do repo é resposta de **detalhe** (`data` é objeto, sem `meta`) —
foi o que me induziu ao erro. Como `fetchAllPages` monta `${apiUrl}/api/v1/${resourcePath}?page=${page}`
e lê `body.data` como array, **a bronze só vê os 17 campos da lista**. Logo:
`bronze_iddas_orcamento.raw_payload` **não contém `anexos`** e nunca conteve. Qualquer
ingestão de documentos exigiria uma chamada de detalhe por orçamento — que hoje não existe
em lugar nenhum do código.

### C2.2 — Resultado da sonda

Duas passadas. A segunda foi varredura **completa** — a amostra inicial não era conclusiva:

| | Amostra | Varredura completa |
|---|---|---|
| Escopo | 51 ids (páginas 1-2, 33-34, 65-66) | **651 de 651** (todas as 66 páginas) |
| Sondados | 51 | **651** |
| Erros | 0 | **0** |
| Com `anexos` não-vazio | **0** | **0** |
| Com `imagemcapa` | 0 | **0** |
| Valor observado | `[]` em 100% | `[]` em 100% |

`total` declarado pela API: **651**, `per_page`: 10, 66 páginas. Todos os 651 ids foram
buscados individualmente em `GET /orcamento/{id}`. **Cobertura total, zero erro, zero anexo.**

Rate: ~320ms entre chamadas, com retry/backoff em 429. A API devolveu **241 respostas 429**
ao longo da varredura, todas recuperadas no primeiro retry (daí `erros: 0`). Confirma o
comentário de [transport.ts:4-6](src/lib/ingestion/iddas/transport.ts#L4-L6): 300ms é
agressivo demais pro Iddas; 500ms é o valor certo. **Não repetir a sonda a 320ms.**

### C2.3 — Itens 3 e 4 da tarefa: sem o que reportar

Os itens pediam o JSON integral de até 3 casos com anexo, análise das URLs, e um `GET` de
teste numa delas. **Não há nenhum caso.** Nada a mascarar, nenhuma URL pra classificar como
absoluta/relativa/com-token, nenhum `GET` a fazer. O campo existe no contrato do detalhe e
vem consistentemente `[]` — **o formato de cada item permanece desconhecido**, agora por
ausência de dado real, não por falta de acesso.

### C2.4 — Como se envia anexo pela API: não se envia

Busca nas três fontes de documentação do repo:

| Fonte | `anexo` | `imagemcapa` | `base64` | `multipart` | `binary` | `file` / `upload` / `arquivo` |
|---|---|---|---|---|---|---|
| [api_iddas_full.json](docs/misc_etls/api_iddas_full.json) (OpenAPI 3.0) | 0 | 0 | 0 | 0 | 0 | 0 |
| [Iddas Agência - Documentação API.pdf](docs/misc_etls/Iddas%20Ag%C3%AAncia%20-%20Documenta%C3%A7%C3%A3o%20API.pdf) (10 pág.) | 0 | 0 | 0 | 0 | 0 | 0 |
| [iddas-endpoints.md](docs/misc_etls/iddas-endpoints.md) | 0 | 0 | 0 | 0 | 0 | 0 |

- **Não existe recurso de anexo.** Os 59 paths da spec não têm `/anexo`, `/arquivo`,
  `/documento` nem `/upload`. Têm CRUD completo: canal, cartao, conta, cruzeiro, despesa,
  pessoa, etiqueta, forma, hospedagem, orcamento, passeio, produtoservico, receita, roteiro,
  seguro, solicitacao, tarefa, transporte, voo, valor.
- **`POST /orcamento` não aceita anexo.** Corpo `application/json` com 13 propriedades
  (`cliente`, `situacao`, `titulo` obrigatórias) — nenhuma é `anexos`/`imagemcapa`.
  **Nenhum endpoint da API aceita `multipart/form-data`.**
- O PDF é só o índice do Swagger; não acrescenta nada ao JSON.

Ou seja: `anexos` e `imagemcapa` **só saem** no detalhe, e a doc oficial sequer os menciona —
a spec está incompleta frente à API real (42 campos no detalhe vs. bem menos documentados).

**Dois caminhos restantes, ambos fora da doc e NÃO testados:**

1. **`PUT /orcamento/{id}` aceitando `anexos`** — hipótese plausível (o GET já devolve campos
   não documentados, então o backend pode aceitar outros). Testar é **escrita em produção**;
   não foi feito e não será sem autorização explícita. Roteiro de risco baixo, se autorizado:
   `POST` de um orçamento descartável → `PUT` com `anexos` → `DELETE /orcamento/{id}`.
2. **Endpoints internos do painel** — mesmo caminho já trilhado pro ClickMassa
   ([clickmassa-internal-endpoints.md](docs/misc_etls/clickmassa-internal-endpoints.md)).
   Exige inspecionar o tráfego do painel logado; [panel-urls.ts:47-58](src/lib/integrations/panel-urls.ts#L47-L58)
   registra trava de permissão no perfil.

### C2.5 — Achado lateral: host do painel do Iddas

O PDF revela os endereços que [panel-urls.ts:47-58](src/lib/integrations/panel-urls.ts#L47-L58)
dá como não confirmados:

- Painel humano: **`https://agencia.iddas.com.br`**
- Doc da API: `https://agencia.iddas.com.br/documentacaoapi` · Swagger: `/swagger`
- API (máquina): `https://apiagencia.iddas.com.br` — como o comentário já dizia

Falta só o **path do registro da pessoa** pra ligar `iddasPessoaUrl()` e a env
`NEXT_PUBLIC_IDDAS_PANEL_URL`.

### C2.6 — O que isso significa pra feature (b)

Com 651 orçamentos e **zero** anexos, "documentos do cliente vindos do Iddas" não tem lastro
em dado real: ou a agência nunca usou o recurso de anexo do Iddas, ou os documentos vivem em
outro canal (e-mail, WhatsApp, drive). Some-se a isso que a API não oferece **nem escrita nem
recurso de anexo**, e que ingerir exigiria +651 chamadas de detalhe (a ~500ms, ~5,5min só
pra orçamentos) numa rota que já usa 800s de teto.

O `AnexosBlock` que **já está na ficha** aceita upload manual hoje. Decidir se o caminho é
ingestão ou upload manual é seu — mas a ingestão, do jeito que a API está, não tem de onde
puxar. **Nada foi decidido nem alterado aqui.**

---

## Pendências marcadas "verificação via banco" (Claudinho)

1. **Schema real de `anexos`** — FK pra `contacts`, `ON DELETE CASCADE`, o CHECK de dono,
   e se `uploaded_by` tem FK. O repo só tem a decisão D075, não o DDL.
2. ~~**Formato de `raw_payload->'anexos'`**~~ — **RESOLVIDO em C2, sem precisar do banco.**
   A bronze não tem esse campo (vem da lista). Sondagem direta na API: 0/651 orçamentos
   com anexo, então o formato do item continua desconhecido — mas por não existir dado
   real, não por falta de acesso.
3. ~~**Quantos orçamentos têm anexos não-vazios**~~ — **RESOLVIDO em C2: zero, de 651.**
4. **Bucket `anexos` e suas policies** — D075 diz "RLS authenticated"; confirmar o estado
   real, já que hoje só o service role escreve.
5. **Quantos contatos têm `clickmassa_contact_id` não-nulo** — mede quantas fichas de fato
   ganham o link do ClickMassa, e quantas ficariam sem link se o `wa.me` sair do card Dados.

## Pendência de ambiente (manual, Alan)

- Setar `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` em `.env.local` e na Vercel. Sem ela os botões
  de ClickMassa da ficha ficam desabilitados — inclusive o que já está implementado.
