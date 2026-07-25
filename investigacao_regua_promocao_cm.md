# Investigação: régua de promoção ClickMassa → silver (`contacts`)

**Data:** 2026-07-14 · **Escopo:** só leitura. Nada editado, nada commitado, nenhum fix aplicado.
**Fonte:** código do repo + definições vivas do banco (`pg_get_functiondef`, `pg_constraint`, `pg_trigger`) lidas via MCP read-only.

---

## 0. Resumo executivo

**A régua não está no repositório.** Ela é uma função plpgsql que existe apenas no banco:
`public.promote_contacts_from_bronze()`. Foi aplicada via MCP (D087) e nunca teve migration
versionada. O repo contém um mapper TypeScript que *parece* ser a régua
(`mapBronzeContactToSilverUpdate`) — **ele tem zero call sites e é código morto**. Quem ler só o
repo conclui coisa errada sobre o sistema.

Os 1113 barrados **não estão numa fila de aprovação**. Não existe fila de aprovação de contatos.
Eles são descartados dentro de um `create temp table ... on commit drop` e nunca mais existem —
sem log, sem contagem, sem exceção. A run fecha **verde** (`completed`).

**Os números fecham exatamente, e a régua tem três porteiras — não uma.** A sua segmentação não
tinha a segunda (`is_user`), que sozinha responde por 217 barrados.

---

## 1. Fluxo completo bronze → silver do CM

| # | Passo | Arquivo / objeto | Função |
|---|---|---|---|
| 1 | Cron dispara | `src/app/api/cron/sync/[source]/route.ts:64` | rota por source |
| 2 | Orquestra o run | `src/lib/sync/run-sync.ts:166` | `runSync()` |
| 3 | Abre `ingestion_log` **antes** do bronze | `src/lib/sync/run-sync.ts:120` | `openIngestionLog()` — obrigatório: bronze tem FK `ingestion_run_id → ingestion_log.id` |
| 4 | Ingestão API → bronze | `src/lib/ingestion/clickmassa/index.ts:45` | `ingestClickMassa()` |
| 5 | Fetch paginado + upsert | `src/lib/ingestion/clickmassa/resources.ts:747` | `runContacts()` → upsert em `bronze_clickmassa_contacts` (:836) |
| 6 | **Promoção (a régua)** | **`public.promote_contacts_from_bronze()` — só no banco** | chamada em `src/lib/sync/run-sync.ts:217` via `supabaseAdmin().rpc()` |
| 7 | Projeta link → coluna | trigger `trg_project_external_link` → `public.project_external_link()` | escreve `contacts.clickmassa_contact_id` |
| 8 | Fecha `ingestion_log` **depois** da promoção | `src/lib/sync/run-sync.ts:143` | `closeIngestionLog()` — ordem corrigida no D087 |

**Ponto 5 não filtra nada.** Zero condições sobre conteúdo: grupo entra, LID entra, número vazio
entraria. O bronze é intencionalmente cru — toda a régua está no passo 6.

---

## 2. Lista exaustiva de condições

### 2.1 As porteiras da promoção (todas dentro do `_cm`)

Todas silenciosas: a linha é filtrada de uma temp table. **Não vira log, não vira contagem, não vira
fila, não vira erro.** A RPC retorna só `(fonte, inseridos, preenchidos)` — o denominador nunca é
emitido, então uma linha barrada é indistinguível de uma linha que não existe.

| # | Condição (`promote_contacts_from_bronze`, branch CM) | O que testa | Se falha | Barrados hoje |
|---|---|---|---|---|
| G1 | `coalesce(is_group,false)=false` | grupo do WhatsApp | descarte silencioso | **30** |
| G2 | `coalesce(is_user,false)=false` | ver §5 — premissa suspeita | descarte silencioso | **217** |
| G3 | `deleted_at is null` | deletado na fonte | descarte silencioso | **0** |
| G4 | `number is not null` | número presente | descarte silencioso | **0** |
| G5 | `where length(nat) in (10,11)` | **a "regex de telefone"** | descarte silencioso | **869** |
| — | passa | | insere + cria link | **519** |

30 + 217 + 869 + 519 = 1635 = total do bronze. **As porteiras são mutuamente exclusivas** (query de
prioridade confirmou), então os números somam sem sobreposição.

### 2.2 G5 em detalhe — a régua que o D086 mandou matar

```sql
regexp_replace(number,'\D','','g') as g          -- tira tudo que não é dígito
case when length(g) >= 12 and left(g,2)='55'
     then substring(g from 3) else g end as nat  -- tira o DDI 55
...
where length(nat) in (10,11);                    -- <<< A PORTEIRA
```

É **só um teste de comprimento**. Não valida DDD, não valida nono dígito, não é E.164.
Consequências:

- Número com 14–15 dígitos (LID no campo `number`) → `nat` fica com 12–15 → **barrado**.
- Número BR com 12–13 dígitos começando em `55` → vira 10–11 → **passa**.
- Número estrangeiro com 12–13 dígitos (não começa em `55`) → **barrado**.

**A RPC não usa `src/lib/contacts/phone.ts`.** Aquele módulo TS (validação de DDD 11–99, nono
dígito, `normalizeBrPhoneLegacy`) serve só o formulário do site. **Existem dois regimes de telefone
independentes no sistema**, e o de importação é o mais burro dos dois.

### 2.3 Guardas que não são porteiras

| Guarda | Onde | Efeito real |
|---|---|---|
| `pg_advisory_xact_lock(871501)` | topo da RPC | serializa CM×Iddas (coincidem a cada 30min). Bloqueia, não descarta. |
| `on conflict do nothing` no `insert into contacts` | ambos os branches | **código morto.** `contacts` só tem `contacts_pkey` em `id` (uuid gerado). Não há árbitro — nunca dispara. Blindagem do D087 que não blinda. |
| `on conflict (provider, external_kind, external_id) ... do nothing` | insert em `contact_external_links` | **real.** É o árbitro de idempotência (`uq_cel_provider_kind_external_id`). |
| `where (c.email is null and m.email is not null) or ...` | fill-null (2b) | linha sem nada a preencher não é tocada nem contada. |

---

## 3. Fila de aprovação: **não existe para contatos**

Varri o schema vivo por coluna e por tabela. O que existe:

- `jornadas.aprovacao_status` (`pendente|aprovada`) — fila de aprovação **de jornadas** (D076/D086
  Unidade 3). Não olha contato. **E está morta — ver 3.1.**
- `user_profiles.approved_at` / `approved_by` — aprovação de **login no admin**. Nada a ver.

### 3.1 Nota lateral: a fila de jornadas é um consumidor sem produtor

Fora do escopo da sua pergunta, mas achado no mesmo caminho e relevante porque o contrato apoia
decisão nela. A fila está **inteira construída e permanentemente vazia**:

| Camada | Onde | Estado |
|---|---|---|
| Coluna + CHECK | `jornadas.aprovacao_status` | existe |
| Leitor | `src/lib/jornadas/index.ts:207` `getJornadasPendentes()` → `.eq("aprovacao_status","pendente")` | existe |
| Tela | `src/app/admin/(painel)/jornadas/aprovacao/page.tsx` | existe, linkada |
| Ação de aprovar | `src/lib/jornadas/index.ts:357` `aprovarJornada()` | existe |
| **Quem escreve `'pendente'`** | **ninguém** | **não existe** |

Todo write de `aprovacao_status` em `src/` grava `"aprovada"` (`index.ts:295` no lead do site,
`index.ts:364` na própria aprovação). O produtor pretendido é `promote_jornadas_from_bronze`, que o
contrato marca "(a criar)" e o `DECISION_LOG.md:81-82` confirma que **"nunca existiu"**. A tela
renderiza 0 para sempre. O contrato (`:127`) chama de "a fila de aprovação **existente**" — verdade
sobre a UI, enganoso sobre a função.

**Nenhuma tabela, coluna, rota ou tela de aprovação de contatos.** O `docs/contrato_dados_backoffice_v1.md`
menciona fila de aprovação só no contexto de jornadas. Portanto:

> **Os 1113 barrados não estão parados em lugar nenhum. São descarte hard, dentro de uma temp table
> `on commit drop`.** Reversível só re-rodando a promoção com régua nova — o bronze está intacto.

---

## 4. Descarte é silencioso ou logado? — **Silencioso, e a run fica verde**

- A RPC retorna só `('clickmassa', v_ins_cm, v_fill_cm)`. `PromoteResultRow`
  (`src/lib/sync/run-sync.ts:43-47`) é `{fonte, inseridos, preenchidos}` — **não existe campo de
  rejeição no tipo**.
- `ingestion_log.counts` guarda contagem de **ingestão** (bronze), pré-promoção.
- `ingestion_log.error_message` só é populado se a RPC **estourar** (`run-sync.ts:222`). Filtro
  silencioso não é exceção.
- **Logo: uma run que descarta 1116 linhas fecha `completed`.**

O D087 consertou a observabilidade de *falha* (log fecha depois da promoção). Não criou
observabilidade de *descarte*. São problemas diferentes, e só o primeiro foi resolvido — o
`contrato_dados_backoffice_v1.md:109-115` justifica isso dizendo que as exclusões são
"definicionais, não perda de dado". **Esse argumento depende de as exclusões serem realmente
definicionais.** §5 mostra que pelo menos 217 delas não são.

---

## 5. O achado que contraria a expectativa: `is_user`

O contrato (`contrato_dados_backoffice_v1.md:111`) trata `is_user = true` como exclusão
definicional, glosando o campo como **"(agentes da agência)"** — e por isso decide que não precisa
de visibilidade. As evidências não sustentam essa leitura:

| Evidência | Valor |
|---|---|
| Contatos com `is_user=true` | **217** |
| Agentes reais no CM (`bronze_clickmassa_users`) | **4** |
| Dos 217, quantos batem com telefone de agente | **2** |
| Dos 217, quantos têm telefone BR aparentemente válido | **210** |
| Correlação `is_user=true` ⟺ `is_wa_contact=true` | **217/217 — perfeita** |

Não há partição do bronze onde `is_user` e `is_wa_contact` divirjam: 217 linhas com ambos `true`,
1388 com ambos `false`. **As duas leituras possíveis, sem escolher uma:**

- **(a) Leitura do contrato:** `isUser` = agente da agência. Contradita por: a agência tem 4
  agentes, não 217; só 2 dos 217 batem com telefone de agente.
- **(b) Leitura alternativa:** `isUser` é flag de roster do WhatsApp que co-move exatamente com
  `isWAContact` (semântica típica de lib WhatsApp: "é contato de usuário", em oposição a
  grupo/broadcast). Suportada pela correlação 217/217 perfeita.

Se (b) estiver certa, **a porteira G2 está descartando justamente os contatos que o WhatsApp
confirmou existirem** — e o mesmo contrato, em 1.2, diz que `isWAContact` deve ser *indicador de
qualidade, nunca filtro*. A régua faz o oposto do que o contrato manda, usando o campo irmão.

**Não fecho a semântica de `isUser` só com o que li.** A doc da API do CM lista o campo mas não o
define (`docs/misc_etls/clickmassa-internal-endpoints.md:31`). Resolver isso exige olhar amostra
nominal dos 217 ou perguntar ao fornecedor — ver §7.

---

## 6. Hipótese explicativa dos números — **fecha 100%**

Cada classe da sua tabela é explicada por uma **combinação** de porteiras, não por uma régua só:

| Classe sua | Bronze | Barrados | Decomposição por porteira |
|---|---|---|---|
| `number` 14–15 díg. (LID), `is_group=false` | 829 | 829 | **829 G5** (LID vira `nat` de 12–15) |
| `is_group=true` | 30 | 30 | **30 G1** (única barra intencional e respaldada pelo contrato) |
| `number` 10–13 díg. + LID real | 645 | 140 | **133 G2** + **7 G5** |
| `number` 12–13 díg. + `lid='false'` | 131 | 117 | **84 G2** + **33 G5** |

Confere nos dois eixos: G5 = 829+7+33 = **869** ✓ · G2 = 133+84 = **217** ✓ · total barrado =
869+217+30 = **1116** ✓ (você contou 1113; o bronze subiu de 1632 → 1635 desde a sua medição, o cron
está rodando).

**Resposta direta à sua pergunta 5:** não é a mesma régua com efeitos diferentes, **são duas réguas
distintas empilhadas**. G5 mata 100% dos "sujos" (LID) e G2 — que não estava na sua segmentação —
é quem explica os 140 e a maior parte dos 117. Sem G2 na conta, a classe 3 e a classe 4 ficam
inexplicáveis.

**Os 339 de diferença** (858 silver − 519 CM): são contatos com link Iddas ou criados manualmente.
A RPC roda Iddas primeiro "por precedência" e insere independentemente — não há fusão por telefone
entre as fontes (§7).

---

## 7. Divergências que aponto e **não** resolvo

1. **O contrato D086 está fechado e não implementado.** `contrato_dados_backoffice_v1.md:81-82` manda
   "critério de entrada = identificador de origem presente e `is_group = false`. **Fim da regex de
   telefone como porteira**". G5 continua viva no banco. O contrato é de 13/07; hoje é 14/07.
   Pode ser simplesmente lote ainda não executado — não achei evidência de que tenha sido tentado.

2. **O contrato se contradiz internamente.** Unidade 1.3 define entrada como "identificador de
   origem presente e `is_group=false`" (o que **admitiria** `is_user`). Unidade 2.3 lista
   `is_user=true` como exclusão definicional. As duas não podem valer juntas.

3. **A fusão por telefone que o contrato afirma existir não existe.**
   `contrato_dados_backoffice_v1.md:89-91` diz "a fusão por telefone continua valendo — LID não cria
   duplicata de quem já existe". Na RPC viva, o branch CM só consulta
   `contact_external_links` pelo próprio `external_id`; **nunca** consulta `whatsapp`,
   `iddas_pessoa_id` ou `nat` contra contatos existentes. Não há trigger de merge. Os contatos que
   hoje carregam os dois providers são resíduo de um merge manual antigo (o "Lote 1 silver executado",
   `docs/DECISION_LOG.md:637`, aplicado por SQL guiado e nunca versionado) — **não são reproduzíveis
   pelo pipeline atual**. Consequência: derrubar G5 sem antes construir fusão por telefone tende a
   duplicar os ~869 LID contra o que já veio do Iddas. Não proponho o fix; registro o risco.

4. **`on conflict do nothing` em `contacts` é inerte** (§2.3). Hoje não causa dano. Mas se alguém
   adicionar unique em `whatsapp` — plausível ao atacar duplicatas — ele começa a descartar linhas
   em silêncio no mesmo dia, sem nenhum aviso.

5. **Bug de sobrescrita bronze**, colateral: `index.ts:107-124` roda `runOpportunities` **antes** de
   `runContacts`, e ambos escrevem `bronze_clickmassa_contacts` com upsert de linha inteira. O embed
   (:677) preenche `company`, `gender`, `birth_date`, endereço, `deleted_at`, `lead_status_id`;
   `runContacts` (:795-815) manda `null` fixo nesses mesmos campos e **apaga o que o embed trouxe**.
   Os comentários (:671, :733) afirmam o contrário ("passo 13 vai sobrescrever com dados mais ricos").
   Efeito na régua: **G3 (`deleted_at is null`) é praticamente inerte** — daí os 0 barrados.

6. **Código morto que engana o leitor:** `mapBronzeContactToSilverUpdate`
   (`src/lib/integrations/clickmassa/mappers/bronze-to-silver.ts:50`) e todo
   `bronze-types.ts` não são chamados por ninguém. A RPC reimplementa a lógica inline
   (`coalesce(name, pushname, '55'||nat)`) e **diverge**: a versão TS rejeita `pushname` só-dígitos
   (:97), o `coalesce` do SQL não. `bronze-types.ts` também declara `source_id`, campo que o writer
   real nunca escreve.

7. **A única migration de CHECK no repo é ficção.**
   `docs/misc_etls/migrations/2026-06-18-clickmassa-sync-status-check.sql:3-5` declara
   `contacts_clickmassa_sync_status_check` como
   `('pending','message_sent','opportunity_created','failed','blocked')`. A constraint viva **com
   esse nome exato** aceita `('synced','pending','failed')` — conjunto disjunto. O código concorda
   com o banco, não com o arquivo (`src/app/(public)/contato/actions.ts:232-235` só grava
   `synced`/`failed`). O arquivo não descreve realidade nenhuma; é o mesmo padrão do §0 — o repo
   conta uma história que o banco não confirma.

8. **Contradição de comentário:** `src/lib/contacts/external-links.ts:10-12` afirma que
   `clickmassa_contact_id` é projeção mantida por trigger e que "nenhum código de aplicação escreve
   nelas". A própria RPC escreve a coluna direto no `insert into contacts` — e *depois* o trigger
   reprojeta o mesmo valor. Não é bug (o valor é idêntico), mas a invariante declarada é falsa.

---

## 8. O que falta para fechar (não fiz — sua régua era "sem SQL de amostra ainda")

Consegui explicar **todos** os 1116 barrados só com as porteiras. O que **não** consigo resolver
lendo código:

1. **A semântica real de `isUser` no ClickMassa** (§5). É o que decide se os 217 são exclusão
   legítima ou perda de 217 contatos WhatsApp-confirmados. Precisa de amostra nominal dos 217 ou da
   doc do fornecedor. **É a pergunta de maior valor em aberto.**
2. **Quantos dos 869 do G5 já existem via Iddas** — dimensiona o risco de duplicata do item 7.3
   antes de qualquer mudança em G5.
3. **Se a `contacts.whatsapp` é NOT NULL hoje** — o contrato manda dropar; determina se LID sem
   telefone consegue entrar sem migration.
