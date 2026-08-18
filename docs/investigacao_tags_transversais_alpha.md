# Investigação — Tags transversais no back-office (fase α, só leitura)

**Data:** 18/08/2026 · **Escopo:** leitura de repo + leitura de produção via MCP Supabase (projeto `grjkqljucszoaujmhgpi`). Zero escrita, zero migration, zero dado de teste.
**Objetivo:** insumo para congelar o contrato v1 de tags transversais sem segunda ida ao repo.

Toda contagem citada tem a query ao lado e é reproduzível. Todo caminho de código tem path + símbolo. Onde há bifurcação estrutural, as opções estão na mesa **sem escolha** — a escolha é do contrato.

---

## 0. Divergências entre a instrução e o repo (o repo manda)

| # | A instrução diz | O repo diz | Evidência |
|---|---|---|---|
| **DIV-1** | "Ficha do contato já tem: (…) criação inline reusando a action de Configurações (lote CAMP)" | A criação inline existe **só na barra de ações em massa da LISTA**. A ficha não tem. `TagsCard.tsx` não importa `createTag` e, com catálogo vazio, manda a operadora pra Configurações. | [AcoesEmMassa.tsx:10](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L10) importa `createTag`; [TagsCard.tsx](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx) não importa nada de Configurações; [TagsCard.tsx:147](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx#L147): `"O catálogo de tags está vazio. Crie tags em Configurações."` |
| **DIV-2** | Receita das etiquetas Iddas = "lote próprio, D093" | `D093` no DECISION_LOG é **"Three-way v1 executado"**. A receita das etiquetas está registrada *dentro* do bloco do D093 no CHANGELOG, como decisão de escopo — não é uma decisão numerada própria. | [DECISION_LOG.md:167](docs/DECISION_LOG.md#L167); [CHANGELOG.md:137-140](docs/CHANGELOG.md#L137) |
| **DIV-3** | (não mencionado) | `docs/contrato_dados_backoffice_v1.md` **ainda propõe uma tabela `contact_tags (A CRIAR)`** com origem e soft-remove. D091 escolheu duas colunas e nenhuma tabela nova; `contact_tags` não existe em produção. O documento antigo nunca foi emendado. | [contrato_dados_backoffice_v1.md:250-256](docs/contrato_dados_backoffice_v1.md#L250); [DECISION_LOG.md:231](docs/DECISION_LOG.md#L231) (D091); query §7.1 |
| **DIV-4** | (não mencionado) | `docs/contrato_calendario_v1.md` C5.4 registra "5 admin + 2 editor". Produção hoje: **4 admin + 4 editor**, todos `approved`. | [contrato_calendario_v1.md](docs/contrato_calendario_v1.md) C5.4; query §7.1 |

---

## A. Inventário do sistema de tags interno (fundação)

### A.1 — O que existe hoje

**Tabela `tags` (produção, `information_schema.columns`):**

| # | coluna | tipo | null | default |
|---|---|---|---|---|
| 1 | `id` | uuid | NO | `gen_random_uuid()` |
| 2 | `name` | text | NO | — |
| 3 | `slug` | text | NO | — |
| 4 | `cor` | text | NO | — |
| 5 | `grupo` | text | YES | — |
| 6 | `is_active` | boolean | NO | `true` |
| 7 | `clickmassa_tag_id` | integer | YES | — |

Constraints: `tags_pkey (id)`, **`tags_slug_key UNIQUE (slug)`**, `tags_clickmassa_tag_id_key UNIQUE (clickmassa_tag_id)`. **Não há UNIQUE em `name`.** Não há FK alguma ligando `contacts.tags` a `tags` (impossível: a coluna é `text[]`).

**CRUD do catálogo — vive só em Configurações.**

- Página: [configuracoes/page.tsx:14](src/app/admin/(painel)/configuracoes/page.tsx#L14) — `await requireRole("admin")`.
- Leitura: [lib/configuracoes/index.ts:19](src/lib/configuracoes/index.ts#L19) `getTags()` → `.from("tags").select("*").order("name")`.
- Actions (todas com `await requireRole("admin")` na primeira linha):
  - `createTag(input: TagInput): Promise<ActionResult>` — [configuracoes/actions.ts:130](src/app/admin/(painel)/configuracoes/actions.ts#L130)
  - `updateTag(id: string, fields: Partial<TagInput>): Promise<ActionResult>` — [actions.ts:158](src/app/admin/(painel)/configuracoes/actions.ts#L158)
  - `deleteTag(id: string): Promise<ActionResult>` — [actions.ts:184](src/app/admin/(painel)/configuracoes/actions.ts#L184)
  - `type TagInput = { name: string; cor: string; grupo: string | null; is_active: boolean }` — [actions.ts:22](src/app/admin/(painel)/configuracoes/actions.ts#L22)
  - `type ActionResult = { success: boolean; error?: string }` — [actions.ts:13](src/app/admin/(painel)/configuracoes/actions.ts#L13)

**Geração de slug.** Uma função só, privada do módulo de Configurações:

```ts
// configuracoes/actions.ts:30
function slugify(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
```

Aplicada **só no create** (`actions.ts:139`). No `updateTag` o slug **fica estável de propósito** — `// Slug fica estável no rename.` ([actions.ts:169](src/app/admin/(painel)/configuracoes/actions.ts#L169)). Existe uma cópia pura pro cliente PREVER o slug enquanto digita: `preverSlug()` em [lib/tags/shared.ts:137](src/lib/tags/shared.ts#L137) — mesma normalização, sem escrita.

**Cor.** Obrigatória no schema, validada por regex hex nas duas actions: `const HEX_RE = /^#[0-9a-fA-F]{6}$/` ([actions.ts:40](src/app/admin/(painel)/configuracoes/actions.ts#L40), usado em `:135` e `:165`). **Não existe paleta** — quem escolhe é a operadora, com o `<input type="color">` nativo do browser ([ConfiguracoesClient.tsx:344](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L344) na edição e `:471` na criação). Há **dois defaults divergentes** no repo:

- `const DEFAULT_TAG_COLOR = "#B89D5A"` — [ConfiguracoesClient.tsx:19](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L19) (ouro)
- `cor: "#1A2B4A"` hardcoded na criação inline — [AcoesEmMassa.tsx:73](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L73) (navy), com o comentário `// Cor default do catálogo interno — a operadora ajusta em Configurações.`

**Todos os pontos de ESCRITA em `contacts.tags`** (grep completo por `tags:` e por `.update(` sobre `contacts`):

| # | Caminho | Assinatura | Semântica | Valida? |
|---|---|---|---|---|
| 1 | ficha → `definirTagsDoContato` | `salvarTagsInternas(contactId: string, slugs: string[]): Promise<ActionResult>` — [contatos/[id]/actions.ts:405](src/app/admin/(painel)/contatos/[id]/actions.ts#L405) → [lib/tags/index.ts:80](src/lib/tags/index.ts#L80) | **substituição integral** do array | sim (`validarTagsInternas`) |
| 2 | lista, ação em massa → `tagEmMassa` | `aplicarTagEmMassa(contactIds: string[], slug: string, operacao: "adicionar"\|"remover"): Promise<ActionResult & {afetados?: number}>` — [contatos/actions.ts:101](src/app/admin/(painel)/contatos/actions.ts#L101) → [lib/tags/index.ts:108](src/lib/tags/index.ts#L108) | **delta de 1 tag**, read+update por id, teto = a PÁGINA (10/25/50) | sim no `adicionar`; o `remover` aceita tag desativada de propósito ([index.ts:115-121](src/lib/tags/index.ts#L115)) |
| 3 | criação de contato | `createContact(draft)` → `contactToInsertRow` grava `tags: contact.tags` ([mappers.ts:259](src/lib/contacts/mappers.ts#L259)); o draft sempre traz `tags: []` ([from-form.ts:114](src/lib/contacts/from-form.ts#L114)) | nasce vazio | n/a |
| 4 | **LATENTE** | `contactPatchToRow`: `if ("tags" in patch) row.tags = patch.tags;` — [mappers.ts:340](src/lib/contacts/mappers.ts#L340) | qualquer caller de `updateContact` que passe `tags` grava **sem validação nenhuma** | **não** |

Sobre o #4: hoje **nenhum caller passa `tags`** no patch (grep em `src/`: os únicos escritores reais são o #1 e o #2). É um furo aberto, não um bug ativo.

**O sync nunca toca `contacts.tags`** — confirmado no banco, não só no comentário:

```sql
-- todas as funções do schema public cujo corpo menciona "tags"
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prolang <> 12
  and pg_get_functiondef(p.oid) ilike '%tags%';
--  → sync_clickmassa_tags   (uma linha só)
```

E `sync_clickmassa_tags()` escreve exclusivamente `clickmassa_tags_id` (dois `update contacts set clickmassa_tags_id = …` no corpo; `pg_get_functiondef` lido em 18/08/2026). D091 se sustenta no dado, não só na intenção.

**Todos os pontos de LEITURA/exibição** — todos resolvem slug→nome/cor pelo **mesmo par de funções puras**:

- `resolverTagsInternas(slugs, catalogo)` — [lib/tags/shared.ts:66](src/lib/tags/shared.ts#L66); devolve `{slug, name, cor, orfao}[]`.
- `resolverTagsClickMassa(ids, catalogo)` — [shared.ts:50](src/lib/tags/shared.ts#L50); devolve `{tags, orfaos: number}`.

| Tela | Componente | Fonte do catálogo | Teto de badges |
|---|---|---|---|
| Ficha | [TagsCard.tsx:54-55](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx#L54) | `getCatalogos()` em [contatos/[id]/page.tsx:40](src/app/admin/(painel)/contatos/[id]/page.tsx#L40) | sem teto |
| Lista | `TagsDaLinha` — [ContactsClient.tsx:760-796](src/app/admin/(painel)/contatos/ContactsClient.tsx#L760) | `getCatalogos()` em [contatos/page.tsx:32](src/app/admin/(painel)/contatos/page.tsx#L32) | `TETO_BADGES = 3` por origem ([:758](src/app/admin/(painel)/contatos/ContactsClient.tsx#L758)) |
| Card do funil | `JornadaCardView` — [KanbanClient.tsx:100](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L100) | `getCatalogoInterno()` em [jornadas/page.tsx:20](src/app/admin/(painel)/jornadas/page.tsx#L20), com `.catch(() => [])` | `TETO_TAGS_CARD = 2` + `+N` ([:43](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L43)) |

Badge único pra tudo: `TagInternaBadge` / `TagClickMassaBadge` / `TagsOrfasCm` em [components/admin/TagBadge.tsx](src/components/admin/TagBadge.tsx). Interna = pastilha **vazada**; CM = pastilha **preenchida** (T8). `TagInternaBadge` já aceita `onRemover?: () => void` e renderiza o ✕ ([TagBadge.tsx:55-64](src/components/admin/TagBadge.tsx#L55)) — o affordance de "tirar tag" já existe no primitivo.

**A action de criação inline (CAMP) — assinatura exata e aptidão pra reuso.**

```ts
// AcoesEmMassa.tsx:10 e :65-86
import { createTag } from "../configuracoes/actions";
…
const r = await createTag({ name: nome, cor: "#1A2B4A", grupo: null, is_active: true });
if (!r.success) { toast.erro(r.error ?? "Não foi possível criar a tag."); return; }
setSlug(preverSlug(nome));   // PREVÊ o slug — a action não devolve
router.refresh();            // e só o refresh traz a tag nova pro catálogo
```

Serve pra reuso no kanban **sem alterar a action**, com dois custos conhecidos:

1. **Permissão.** `createTag` faz `await requireRole("admin")` ([actions.ts:131](src/app/admin/(painel)/configuracoes/actions.ts#L131)), e `requireRole` **redireciona**, não devolve erro: `if (!allowed.includes(session.role)) redirect("/admin")` ([lib/auth/session.ts:58](src/lib/auth/session.ts#L58)). Chamada de um Client Component, isso vira navegação pro `/admin`, não um toast. O próprio `AcoesEmMassa` já documenta a consequência: *"aquela action exige role `admin`, então editor não cria tag daqui"* ([AcoesEmMassa.tsx:24-28](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L24)). Produção tem **4 editores aprovados** (§7.1) — metade do elenco.
2. **Retorno mudo.** `ActionResult = {success, error?}`: sem `id`, sem `slug`, sem a `TagInterna` criada. Todo chamador precisa prever o slug + `router.refresh()`.

### A.2 — Comportamento REAL de tag deletada / desativada (isto vira regra de contrato)

**Excluir do catálogo não limpa nada.** `deleteTag` é um `DELETE FROM tags WHERE id = …` seco ([actions.ts:184-193](src/app/admin/(painel)/configuracoes/actions.ts#L184)). Não há FK, não há trigger, não há rotina de limpeza (a query de `pg_proc` acima mostra que nenhuma função do schema toca `contacts.tags`). Os slugs ficam no array dos contatos e viram **órfãos**.

Comportamento observado, caso a caso:

| Situação | Exibição | Filtro da lista | Escrita (salvar a ficha) |
|---|---|---|---|
| **Tag órfã** (slug gravado, tag apagada do catálogo) | **Aparece normalmente**, em cinza `#7F889A`, com `title="… esta tag não está mais no catálogo"` — [TagBadge.tsx:46,51](src/components/admin/TagBadge.tsx#L46). Nunca some (T6). | **Não filtrável**: o `<select>` só lista o catálogo ([ContactsClient.tsx:519](src/app/admin/(painel)/contatos/ContactsClient.tsx#L519)). Mas a **busca textual acha**, porque o haystack inclui o slug cru ([:381](src/app/admin/(painel)/contatos/ContactsClient.tsx#L381)). | Recusada: `validarTagsInternas` só aceita slug do catálogo E ativo ([shared.ts:109](src/lib/tags/shared.ts#L109)). A ficha resolve isso com um bloco **"Fora do catálogo"** que oferece o ✕ pra tirar antes de salvar ([TagsCard.tsx:176-191](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx#L176)). Ou seja: pra salvar qualquer coisa nessa ficha, a operadora **precisa** tirar a órfã. |
| **Tag desativada** (`is_active=false`, ainda no catálogo) | Aparece **normal, colorida** — `resolverTagsInternas` acha pelo slug e marca `orfao: false` ([shared.ts:73](src/lib/tags/shared.ts#L73)). | **Aparece no select** — o filtro não checa `isActive` ([:519](src/app/admin/(painel)/contatos/ContactsClient.tsx#L519)). O select de "remover em massa" mostra `" (desativada)"` de propósito ([AcoesEmMassa.tsx:238](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L238)). | **Impasse.** Ver abaixo. |

> **ACHADO — impasse da tag desativada na ficha.** No editor da ficha, as opções clicáveis são `disponiveis = catalogoInterno.filter(t => t.isActive)` ([TagsCard.tsx:56](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx#L56)) e o bloco "Fora do catálogo" só lista `t.orfao === true` ([:176](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx#L176)). Uma tag **desativada mas ainda no catálogo** não cai em nenhum dos dois: não tem botão pra desmarcar, e permanece em `escolhidas` (que nasce de `tagsInternas`, `:50`). Aí `validarTagsInternas` a recusa (só aceita `ativos`, [shared.ts:102](src/lib/tags/shared.ts#L102)) → **qualquer save daquela ficha falha com "A tag X não existe ou está desativada.", sem caminho de saída pela UI.** A saída existente é a ação em massa "Remover tag" da lista, que aceita desativada. Hoje é latente: produção tem 0 tags inativas (§7.1). Vira regra de contrato: **desativar precisa do mesmo tratamento que apagar, ou o editor precisa oferecer o ✕ também pra inativa.**

### A.3 — O que falta pro objetivo

- Criação inline **na ficha** e **no card do kanban** (hoje só na barra de ações em massa da lista).
- Editar (rename/cor) e excluir catálogo **fora de Configurações** — hoje só na página admin-only.
- Uma action de criação que **devolva a tag criada** (`{id, name, slug, cor}`), pra o ponto de uso já aplicar sem prever slug nem depender de `router.refresh()`.
- Uma regra de permissão para criação inline compatível com editor (hoje `requireRole("admin")` + `redirect`).
- Regra escrita para tag desativada (impasse acima) e para exclusão em cascata (hoje: nenhuma).

### A.4 — Flags de decisão (opções, sem escolha)

| Flag | Opções | Custo |
|---|---|---|
| **A-F1 · Permissão da criação inline** | (a) manter `requireRole("admin")` → editor não cria tag em lugar nenhum; (b) trocar para `requireSession()` **só no create** → qualquer aprovado cria, mas mexe numa action compartilhada com Configurações; (c) criar `criarTagInline()` própria em `lib/tags` com `requireSession()`, deixando as três de Configurações intactas | (a) 0 linhas, mantém metade do elenco travada · (b) 1 linha, muda a semântica de uma action já usada por 2 telas · (c) ~30 linhas + uma terceira cópia da normalização de slug (hoje já existem duas: `slugify` privada e `preverSlug` pura) |
| **A-F2 · Retorno da action de criação** | (a) manter `ActionResult` e continuar prevendo o slug; (b) devolver `ActionResult & {tag?: TagInterna}` | (a) 0 · (b) toca `createTag` e os 2 chamadores atuais; elimina a corrida "criou mas o catálogo ainda não chegou" |
| **A-F3 · Cor no ponto de uso** | (a) hardcode por tela (estado atual, com 2 valores divergentes); (b) uma constante única compartilhada; (c) paleta fixa de N cores em `shared.ts`, com o `input type=color` só em Configurações | (a) 0, incoerência visível · (b) trivial · (c) muda o CRUD de Configurações também |
| **A-F4 · Tag desativada** | (a) tratar como órfã no editor (mostra no bloco "Fora do catálogo" com ✕); (b) permitir salvar mantendo desativada já gravada (relaxar `validarTagsInternas` para "existe no catálogo", exigindo ativo só na ADIÇÃO); (c) proibir desativar tag em uso | (a) ~10 linhas no `TagsCard`, não muda regra de escrita · (b) muda a regra pura, usada por cliente e servidor · (c) exige contagem de uso no delete/toggle |
| **A-F5 · Exclusão do catálogo** | (a) manter órfão para sempre (estado atual, T6); (b) soft-delete only (nunca DELETE, só `is_active=false`); (c) DELETE + limpeza dos arrays numa RPC transacional | (a) 0, histórico preservado e filtro cego pro slug morto · (b) 1 linha na UI, mas colide de frente com A-F4 · (c) 1 migration + regra de "quem pode apagar história" |
| **A-F6 · Escritor #4 latente** | (a) deixar como está; (b) remover `if ("tags" in patch)` do `contactPatchToRow` e forçar todo caminho por `lib/tags` | (a) 0, porta aberta sem tranca · (b) 1 linha; nenhum caller atual quebra (grep) |

---

## B. Jornadas (kanban) — aplicar e criar tag no card

### B.1 — O que existe hoje

**Não existe tag de jornada.** As 13 colunas de `jornadas` em produção: `id, contact_id, estagio, estagio_atualizado_em, aberta, aprovacao_status, titulo_jornada, valor, origem_dado, bronze_ref, closed_at, created_at, updated_at`. **Nenhuma coluna de tag** (query em §7.1). A tag do card é sempre do contato, e o tipo diz isso:

```ts
// lib/jornadas/types.ts:111-118
export type JornadaCard = JornadaComContato & {
  proximaTarefa: FollowUpTarefa | null;
  /** SLUGS das tags internas do contato vinculado (`contacts.tags`) (…)
   *  Read-only por definição: a jornada não tem tag própria (…) */
  tagsInternas: string[];
};
```

**A query que projeta as tags** — [lib/jornadas/index.ts:177](src/lib/jornadas/index.ts#L177):

```ts
async function getTagsPorContato(): Promise<Map<string, string[]>> {
  const { data, error } = await supabaseAdmin()
    .from("contacts").select("id, tags").not("tags", "is", null);
  …  // degrada pra mapa vazio em erro
}
```

Chamada em `Promise.all` com a RPC dentro de `getKanbanJornadas()` ([index.ts:195](src/lib/jornadas/index.ts#L195)). **Sem `.in()` de propósito** — o docblock registra que a lista de ids na URL foi o que estourou o header antes.

**O que a projeção entrega:** só **slugs**. Nome e cor são resolvidos **no cliente**, contra `catalogoInterno`, que já desce inteiro (`TagInterna[]` = `{id, name, slug, cor, grupo, isActive}`) de [jornadas/page.tsx:20-24](src/app/admin/(painel)/jornadas/page.tsx#L20) → `<KanbanClient jornadas={…} catalogoInterno={…} />` ([:59](src/app/admin/(painel)/jornadas/page.tsx#L59)). **Conclusão: nenhum dado falta pra UI interativa** — o card já tem os slugs aplicados e o catálogo completo, inclusive o `id` que `updateTag`/`deleteTag` exigiriam.

**Onde o ícone entraria.** [KanbanClient.tsx:1](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L1) é `"use client"`; o card é `function JornadaCardView({...})` ([:60](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L60)), Client Component, com estado local próprio (`menuOpen`, `menuRef`, `useEffect` de click-fora) e o padrão de affordance já resolvido: kebab `⋯` em `absolute top-2 right-2` com `e.stopPropagation()` pra não abrir o detalhe nem iniciar o drag ([:120-160](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L120)). O bloco de tags já renderiza em `:180-196`.

**Qual action de escrita serviria:**

| Action | Encaixe no card | Nota |
|---|---|---|
| `salvarTagsInternas(contactId, slugs)` (a da ficha) | exige o card montar o **conjunto final** de slugs — ele já tem (`jornada.tagsInternas`), então é viável | substituição integral; revalida `/admin/contatos` e `/admin/contatos/{id}`, **não** `/admin/jornadas` ([contatos/[id]/actions.ts:415-416](src/app/admin/(painel)/contatos/[id]/actions.ts#L415)) |
| `aplicarTagEmMassa([contactId], slug, "adicionar"\|"remover")` (a da lista) | encaixe **mais limpo** pro gesto "põe/tira esta tag": delta de 1, e o teto de página é irrelevante com 1 id | `requireSession()`, não admin ([contatos/actions.ts:107](src/app/admin/(painel)/contatos/actions.ts#L107)); revalida `/admin/contatos` e `/admin/contatos/{id}`, **não** `/admin/jornadas` ([:119-120](src/app/admin/(painel)/contatos/actions.ts#L119)) |

**Reuso é limpo, com uma adaptação nomeada:** nenhuma das duas revalida `/admin/jornadas`. Ou o card chama `router.refresh()` no cliente (padrão já usado no helper `run()` de [KanbanClient.tsx:246](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L246)), ou uma linha de `revalidatePath("/admin/jornadas")` entra na action.

**Efeito colateral estrutural:** um contato com N jornadas aparece em N cards. Aplicar tag num card muda os N. Não é bug — é o modelo (tag é do contato, D091) — mas é comportamento que a operadora vai encontrar.

**Filtro por tag no kanban: não existe filtro nenhum hoje.** `KanbanClient` tem só `limites` (paginação por coluna, `PAGE_SIZE`) e `recolhidas`; `porEstagio = (estagio) => jornadas.filter(j => j.estagio === estagio)` ([:239](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L239)) é o único recorte. A busca vem inteira do servidor: `gold_kanban_jornadas()` é `select … from jornadas j left join contacts c … left join lateral (…) where j.aprovacao_status = 'aprovada' order by j.estagio_atualizado_em desc` — **sem paginação, sem parâmetro** (`pg_get_functiondef`, §7.2).

**Volumes reais** (queries em §7.1): 614 jornadas totais = 614 aprovadas, **14 abertas**, 614 com contato (0 órfãs). 1.032 contatos (982 ativos), **418 com tag interna**, 270 com tag CM. Catálogo: **10 tags, 10 ativas**, 0 com `grupo`, 0 com `clickmassa_tag_id`.

### B.2 — O que falta

- Um affordance de aplicar/criar tag no card (o encaixe técnico está pronto; não há bloqueio de dado nem de arquitetura).
- Um filtro (qualquer filtro) no kanban — não há barra de filtro para estender.
- Revalidação de `/admin/jornadas` no caminho de escrita de tag.

### B.3 — Flags de decisão

| Flag | Opções | Custo |
|---|---|---|
| **B-F1 · Onde roda o predicado do filtro** | (a) **client-side**: `jornadas.filter(j => j.tagsInternas.includes(slug))` — os slugs já estão no payload; (b) **no SQL**: `gold_kanban_jornadas(p_tags text[])` | (a) ~5 linhas, zero query nova, zero migration; com 614 cards o filtro em memória é instantâneo · (b) **muda assinatura → `DROP FUNCTION public.gold_kanban_jornadas()` antes do `CREATE`**, mais join com `contacts` no `where`; ganho nulo no volume atual, só faz sentido se o kanban ganhar paginação server-side depois |
| **B-F2 · Qual action de escrita** | (a) `aplicarTagEmMassa` com 1 id (delta); (b) `salvarTagsInternas` (conjunto integral); (c) action nova em `jornadas/actions.ts` chamando `lib/tags` | (a) 0 linhas novas de servidor, semântica exata do gesto · (b) 0 linhas novas, mas o card passa a mandar o conjunto todo (mais superfície pra corrida entre dois cards do mesmo contato) · (c) ~25 linhas, ganha a revalidação certa de graça |
| **B-F3 · Multi-card do mesmo contato** | (a) silêncio (a tag muda nos N cards); (b) microtexto no popover ("vale pro contato, não só pra esta jornada"); (c) nada no kanban, tag só na ficha | (a) 0 · (b) 1 linha de copy · (c) mata a frente B |
| **B-F4 · Cardinalidade e combinação** | (a) filtro único por tag; (b) combinável com estágio/aberta; (c) multi-tag (E/OU) | todos client-side, custo equivalente em servidor; muda só a UI e o predicado |

---

## C. Calendário — filtro por tag do contato associado

### C.1 — A RPC, ramo a ramo (fonte: `pg_get_functiondef`, lida em 18/08/2026)

Assinatura atual: **`calendar_events_between(p_inicio date, p_fim date)`**, `LANGUAGE sql STABLE`, `RETURNS TABLE(event_type, source_type, source_id, titulo, data_inicio, hora_inicio, data_fim, multi_dia, editavel, concluida, responsavel_user_id, contact_id, cliente_nome, meta jsonb, source_updated_at)`.

Dois CTEs no topo definem a cadeia de contato:

```sql
with lk as (select external_id, contact_id from contact_external_links where provider = 'iddas'),
orc_link as (
  select o.id, l.contact_id, nullif(trim(o.raw_payload->>'nome_cliente'), '') as nome_cliente
  from bronze_iddas_orcamento o
  left join lk l on l.external_id = o.cliente
)
```

**Como cada `event_type` resolve `contact_id`:**

| `event_type` | Fonte | Como sai o `contact_id` | Resolve sempre? |
|---|---|---|---|
| `tarefa` | `tarefas` | `t.contact_id` — **FK direta**, nullable, preenchida (opcionalmente) pelo formulário | não |
| `tarefa_iddas` | `bronze_iddas_tarefa` | `ol.contact_id` via `left join orc_link ol on ol.id = bt.id_orcamento` | não |
| `checkin` | `bronze_iddas_voo` + `calendar_checkins` | `ol.contact_id` via `v.id_orcamento` | não |
| `voo` | `bronze_iddas_voo` | `ol.contact_id` via `v.id_orcamento` | não |
| `hospedagem` | `bronze_iddas_hospedagem` | `ol.contact_id` via `h.id_orcamento` | não |
| `transporte` | `bronze_iddas_transporte` | `ol.contact_id` via `tr.id_orcamento` | não |
| `cruzeiro` | `bronze_iddas_cruzeiro` | `ol.contact_id` via `cz.id_orcamento`; **`cliente_nome` tem fallback** `coalesce(ol.nome_cliente, nullif(cz.cliente,''))`, o `contact_id` **não** | não |
| `seguro` | `bronze_iddas_seguro` | idem cruzeiro (fallback só no nome) | não |
| `aniversario` | `contacts` | `c.id` — a fonte **é** o contato | **sim, 100%** |

Ou seja: **o campo `contact_id` sai em todos os 9 ramos** (a coluna é única no `union all`); o que varia é a taxa de resolução. `CalendarEvent.contactId: string | null` já existe no tipo do front ([lib/calendario/types.ts:51](src/lib/calendario/types.ts#L51)) e é mapeado em [lib/calendario/index.ts:58](src/lib/calendario/index.ts#L58).

### C.2 — Contagem no período corrente (números reais)

Janela do **Mês** para hoje (18/08/2026): `gradeDoMes` ancora no domingo anterior ao dia 1 e pega 42 dias ([lib/calendario/datas.ts:119-123](src/lib/calendario/datas.ts#L119)) → **`2026-07-26` a `2026-09-05`**.

```sql
select event_type, count(*) total, count(contact_id) com_contato,
       count(*) - count(contact_id) sem_contato
from calendar_events_between('2026-07-26','2026-09-05') group by rollup(event_type);
```

| `event_type` | total | com contato | sem contato | % sem |
|---|---:|---:|---:|---:|
| `voo` | 50 | 46 | 4 | 8,0% |
| `checkin` | 28 | 24 | 4 | 14,3% |
| `aniversario` | 23 | 23 | 0 | 0% |
| `hospedagem` | 20 | 14 | 6 | 30,0% |
| `tarefa_iddas` | 10 | 7 | 3 | 30,0% |
| `tarefa` | 1 | 0 | 1 | 100% |
| `transporte` / `cruzeiro` / `seguro` | 0 | 0 | 0 | — |
| **TOTAL** | **132** | **114** | **18** | **13,6%** |

Janela da **Agenda** (`hoje−60`/`hoje+30` = `2026-06-19`..`2026-09-17`): 277 eventos, 255 com contato, 22 sem (7,9%). Ano inteiro (`2026-01-01`..`2026-12-31`): 1.188 eventos, 1.088 com contato, **100 sem (8,4%)** — o pior ramo é `tarefa_iddas` (459 eventos, 64 sem contato) e o de maior volume é `voo` (355, 23 sem). `seguro` devolve **0 eventos no ano inteiro** (a bronze tem 3 linhas, todas fora de 2026 — pendência já registrada no [CHANGELOG.md:117-118](docs/CHANGELOG.md#L117): *"`bronze_iddas_seguro` zerada em 2020-2030 — chip Seguros nasce vazio"*).

Interseção com o objetivo: dos 114 eventos com contato na janela corrente, **96 têm contato que possui ao menos uma tag interna** (query em §7.1). O filtro tem material real.

### C.3 — Os dois caminhos (mapeados, sem escolha)

**Caminho (a) — parâmetro na RPC.**

Assinatura viraria `calendar_events_between(p_inicio date, p_fim date, p_tags text[] default null)`. **Mudança de assinatura exige `DROP FUNCTION public.calendar_events_between(date, date);` antes do `CREATE FUNCTION`** — `CREATE OR REPLACE` não serve quando a lista de argumentos muda, e mesmo com `default null` a função antiga sobrevive como sobrecarga ambígua se não for derrubada.

- Chamador a ajustar: [lib/calendario/index.ts:73](src/lib/calendario/index.ts#L73) — `supabaseAdmin().rpc("calendar_events_between", { p_inicio, p_fim })`, **único ponto de chamada em todo o repo** (grep).
- Duas formas de escrever o predicado: (i) repetir `and (p_tags is null or exists (select 1 from contacts c where c.id = <o contact_id daquele ramo> and c.tags && p_tags))` nos **9 ramos** — verboso e propenso a divergência; (ii) envelopar o `union all` inteiro (que já está num subselect fechado por `) eventos`) com um `where p_tags is null or exists (select 1 from contacts c where c.id = eventos.contact_id and c.tags && p_tags)` — **uma linha só**, aproveitando que o `contact_id` já sai normalizado.
- Trade-off honesto: mexe na definição ÚNICA do C4 ([contrato_calendario_v1.md](docs/contrato_calendario_v1.md) §C4). O contrato diz que a RPC é a definição do que aparece — o que é argumento **a favor** (o filtro é parte da definição) e **contra** (é o objeto mais frágil do sistema, sem migration versionada no repo — ver §7.3).
- Indexação: `idx_contacts_tags` (GIN em `contacts.tags`) já existe e serviria o `&&`.

**Caminho (b) — filtro client-side sobre o payload que a RPC já entrega.**

A RPC **já retorna `contact_id` em todos os ramos** (confirmado campo a campo, §C.1). O que **não** vem é o vocabulário: nenhum ramo devolve `contacts.tags`. Duas sub-opções:

- **(b1) sem tocar na RPC.** A page carrega um mapa `contactId → slugs[]` em paralelo — exatamente o que `getTagsPorContato()` já faz pro kanban ([lib/jornadas/index.ts:177](src/lib/jornadas/index.ts#L177)): `select id, tags from contacts where tags is not null`, 1.032 linhas varridas, ~418 entradas no mapa — e passa como prop; o predicado entra no `useMemo` de `eventosVisiveis` ([CalendarioClient.tsx:229-246](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L229)), ao lado dos filtros de categoria e escopo que já rodam ali. Custo: 1 query extra por carga de página, ~10 linhas de front, **zero migration, C4 intacto**.
- **(b2) enriquecer o retorno.** Acrescentar `contact_tags text[]` ao `RETURNS TABLE`. Isso **também muda a assinatura → DROP + CREATE**, e ainda quebra o `CalendarEventRow` do mapper ([lib/calendario/index.ts:25-41](src/lib/calendario/index.ts#L25)). Ganha um payload autocontido; paga o mesmo pedágio de migration do caminho (a) **sem** ganhar o filtro no servidor.

### C.4 — UI atual dos filtros (estado, sem proposta visual)

Três faixas empilhadas, todas `flex flex-wrap`, acima da grade — [CalendarioClient.tsx:421-628](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L421):

1. **Navegação** (`:422-489`): `Hoje` · `◀ ▶` · rótulo do período · (à direita, via `ml-auto`) alternador Mês/Semana/Agenda · `＋ Nova tarefa`.
2. **Chips de categoria** (`:494-543`): botão `Todos` + **8 chips**, um por `Categoria`, cor de `CATEGORIAS[c].cor` ([lib/calendario/types.ts:113-125](src/lib/calendario/types.ts#L113)). Rótulos: Tarefas · Check-in · Voos · Hospedagens · Transportes · Cruzeiros · Seguros · Aniversários.
3. **Escopo** (`:549-628`): par `Meu calendário` / `Calendário do time` + fila de avatares das pessoas aprovadas (**8 hoje**, com badge de pendências) + microtexto. Não-admin vê só um parágrafo explicativo.

**Persistência.** Preferência de UI por usuário em `localStorage`, chave `chavePrefs(usuarioId)`, payload `type Prefs = { cats: string[]; escopo: Escopo; visao: Visao }` ([:81-84](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L81)). Lida por `useSyncExternalStore` ([:151](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L151)) e gravada **só nos handlers**, nunca em efeito, via `persistir()` ([:205-217](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L205)). `decodificarPrefs` valida chave a chave e **ignora o que não reconhece** ([:118-129](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L118)) — logo **acrescentar uma chave nova é retrocompatível**: preferência antiga simplesmente não tem o filtro.
`pessoasSel` e `verConcluidas` **não** são persistidos (`useState` puro, `:161-164`).

**URL.** Só `?v=` (visão) e `?d=` (data-âncora) — [calendario/page.tsx:63](src/app/admin/(painel)/calendario/page.tsx#L63). **Filtro nenhum vive na URL hoje**, nem os chips. Deep-link com filtro de tag exigiria estender esse contrato de query string e decidir a precedência URL × `localStorage`, que hoje já existe pra `visao`: `visaoExplicita` faz a URL vencer ([:220-228](src/app/admin/(painel)/calendario/CalendarioClient.tsx#L220)).

**Espaço horizontal.** As três faixas são `flex-wrap` e já quebram sozinhas; a faixa 3 cresce com o número de pessoas aprovadas. Não há overflow horizontal nem scroll: um quarto grupo cabe **estruturalmente** (mais uma faixa, ou dentro da faixa 2). Quanto isso pesa visualmente é decisão de contrato com aprovação do Alan — este relatório não propõe agrupamento.

### C.5 — O que falta

- Vocabulário de tag no calendário (nenhum caminho carrega `contacts.tags` hoje).
- Regra para o evento **sem contato** sob filtro ativo (18 de 132 na janela corrente).
- Decisão sobre persistência (localStorage e/ou URL) do novo filtro.

### C.6 — Flags de decisão

| Flag | Opções | Custo |
|---|---|---|
| **C-F1 · Onde filtra** | (a) parâmetro na RPC; (b1) client-side com mapa auxiliar; (b2) RPC devolvendo `contact_tags[]` | (a) DROP+CREATE da RPC + 1 linha de `where` no envelope + 1 arg no único chamador; mexe no C4 · (b1) 1 query + ~10 linhas de front, C4 intacto · (b2) DROP+CREATE + mapper alterado, sem filtro no servidor |
| **C-F2 · Evento sem contato sob filtro** | (a) some (filtro estrito); (b) fica sempre — coerente com a regra C5.2 que `eventoVisivel` já aplica a `responsavelUserId === null` ([types.ts:289](src/lib/calendario/types.ts#L289)); (c) chip "sem contato" separado | (a) esconde 13,6% da janela, incluindo a única `tarefa` local · (b) 0 surpresa, mas o filtro "mente" um pouco · (c) mais um chip na faixa |
| **C-F3 · Persistência do filtro** | (a) só `useState` (some ao recarregar, como `pessoasSel`); (b) entra em `Prefs`/localStorage; (c) entra na URL (`?tag=`) e vira linkável | (a) 0 · (b) 1 chave em `Prefs` + 1 ramo em `decodificarPrefs`; retrocompatível · (c) toca `page.tsx` (searchParams) + regra de precedência URL × prefs |
| **C-F4 · Cardinalidade** | (a) uma tag por vez (como os dois filtros da lista de contatos); (b) multi-seleção (como os chips de categoria) | (a) `<select>`, consistente com Contatos · (b) `Set<string>`, consistente com os chips do próprio calendário — os dois padrões já convivem no app |
| **C-F5 · Agrupamento visual dos filtros** | fora do escopo deste relatório — decisão de contrato com aprovação do Alan | — |

---

## D. Contatos — lista e ficha

### D.1 — Os "dois filtros" da lista: quais são e como são feitos

São **tag interna** e **tag do ClickMassa** (T8: um por origem, nunca misturados).

```ts
// ContactsClient.tsx:298-302
// DOIS filtros separados, um por origem (T8). O vocabulário de cada um vem do
// CATÁLOGO, não dos contatos carregados (…)
const [tagInterna, setTagInterna] = useState<string>("todas");
const [tagCm, setTagCm] = useState<string>("todas");
```

- **Componentes:** `<select data-testid="filtro-tag-interna">` ([:512-526](src/app/admin/(painel)/contatos/ContactsClient.tsx#L512)) e `<select data-testid="filtro-tag-clickmassa">` ([:528-542](src/app/admin/(painel)/contatos/ContactsClient.tsx#L528)). Single-select, valor sentinela `"todas"`.
- **Estado:** `useState` local. **Não está na URL, não está no localStorage.** Recarregou, perdeu. Troca de filtro passa por `withPageReset()` ([:345-352](src/app/admin/(painel)/contatos/ContactsClient.tsx#L345)), que volta pra página 1.
- **Vocabulário:** dos catálogos, via props de [contatos/page.tsx:44-45](src/app/admin/(painel)/contatos/page.tsx#L44) (`getCatalogos()`), não dos contatos carregados. **Os dois selects listam tags inativas também** — nenhum filtra por `isActive` (`:519` e `:535`).
- **Predicado — em memória, no cliente:**
  ```ts
  // ContactsClient.tsx:369-370
  if (tagInterna !== "todas" && !c.tags.includes(tagInterna)) return false;
  if (tagCm !== "todas" && !c.clickmassaTagsId.includes(Number(tagCm))) return false;
  ```
- **De onde vêm as linhas:** `getContacts({status:"ativo"})` ([lib/contacts/index.ts:37-41](src/lib/contacts/index.ts#L37)) — `.select("*").eq("status", …).order("created_at")`, **sem limite**: 982 linhas por request. Os `opts.tags`/`opts.origem`/`opts.search` da assinatura filtram **em memória depois** (`:49-75`), e a lista **não usa nenhum deles** — passa só `status`. O índice `idx_contacts_tags` (GIN) existe e **não é usado por nenhum caminho do app**.
- **Busca textual** (campo único, `:490`) cobre nome, whatsapp, e-mail, **slug cru**, nome da tag interna e nome da tag CM ([:376-388](src/app/admin/(painel)/contatos/ContactsClient.tsx#L376)) — é o único lugar onde uma tag órfã é alcançável.

Outros filtros na mesma barra, para contexto de espaço: origem, sync, `tem_whatsapp`, mais os cards de gap clicáveis ([:458](src/app/admin/(painel)/contatos/ContactsClient.tsx#L458)).

### D.2 — Ficha: o que existe, o que falta

**Existe** ([TagsCard.tsx](src/app/admin/(painel)/contatos/[id]/TagsCard.tsx), montado em [ContactDetailClient.tsx:1504-1510](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L1504)):

- Bloco read-only "Tags do ClickMassa" (`:108-126`), com contagem de órfãos.
- Bloco editável "Tags internas" no padrão Editar → Salvar/Cancelar (`:128-215`): aplicar/remover por toggle sobre `disponiveis` (só ativas), bloco "Fora do catálogo" com ✕ pras órfãs, validação cliente idêntica à do servidor, `toast.sucesso` + `router.refresh()`.

**Não existe na ficha:** criar tag inline (**DIV-1**), renomear, trocar cor, excluir do catálogo.

**O que seria reusado pra editar/excluir a partir da ficha:**

| Precisa | Já existe | Onde | Obstáculo |
|---|---|---|---|
| id da tag | sim | `TagInterna.id` ([shared.ts:16](src/lib/tags/shared.ts#L16)) já desce em `catalogoInterno` | nenhum |
| rename / cor / grupo / ativa | sim | `updateTag(id, fields)` ([configuracoes/actions.ts:158](src/app/admin/(painel)/configuracoes/actions.ts#L158)) | `requireRole("admin")`; slug estável no rename (o que é justamente por que `contacts.tags` guarda slug — rename não toca dado de contato) |
| excluir | sim | `deleteTag(id)` ([:184](src/app/admin/(painel)/configuracoes/actions.ts#L184)) | `requireRole("admin")`; **sem cascata** |
| UI de linha editável | sim, mas acoplada | `function TagRow({tag, onChanged})` ([ConfiguracoesClient.tsx:302-427](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L302)) — **não exportada**, e usa `confirm()` nativo do browser (`:335`) em vez do `Modal` primitivo | extrair custa mover o componente pra `components/admin/` e trocar `confirm()` pelo `Modal variant="destrutiva"` já usado em [AcoesEmMassa.tsx:214](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L214) |
| revalidação | parcial | as três actions revalidam **só** `/admin/configuracoes` (`:85, :111, :154, :180, :191`) | rename/exclusão a partir da ficha não atualizariam ficha, lista nem kanban |

### D.3 — Excluir tag do catálogo: cascata real

**Nenhuma.** `deleteTag` é `DELETE FROM tags WHERE id = …` e ponto. Provas:

- Não há FK de `contacts.tags` pra `tags` (impossível com `text[]`; a lista de constraints de `contacts` em §7.1 confirma que não existe nada do tipo).
- Não há trigger nem função que toque `contacts.tags` (a varredura de `pg_proc` em §A.1 devolve só `sync_clickmassa_tags`, que escreve outra coluna).
- Não há rotina de limpeza no repo (grep nas actions e em `lib/`).

**Estado hoje: zero órfãos em produção.** Os 10 slugs em uso batem 1:1 com o catálogo, todos ativos:

```sql
with usados as (select unnest(tags) as slug from contacts where coalesce(array_length(tags,1),0) > 0)
select u.slug, count(*) contatos, (t.id is not null) no_catalogo, t.is_active
from usados u left join tags t on t.slug = u.slug
group by u.slug, t.id, t.is_active order by no_catalogo, contatos desc;
```

| slug | contatos | no catálogo | ativa |
|---|---:|---|---|
| `nunca-comprou` | 241 | sim | sim |
| `amigo-conhecido` | 129 | sim | sim |
| `trafego` | 118 | sim | sim |
| `alto-potencial-alto-ticket` | 88 | sim | sim |
| `cliente-unico` | 84 | sim | sim |
| `recorrente` | 33 | sim | sim |
| `indicacao` | 33 | sim | sim |
| `origem-desconhecida` | 19 | sim | sim |
| `fornecedor` | 16 | sim | sim |
| `inativo-12-meses` | 7 | sim | sim |

Soma: 768 aplicações em 418 contatos — **média 1,8 tag/contato**, empilhamento já real na base.

### D.4 — Flags de decisão

| Flag | Opções | Custo |
|---|---|---|
| **D-F1 · Gestão do catálogo fora de Configurações** | (a) só Configurações (estado atual); (b) editar/excluir num submenu do próprio badge, em toda tela; (c) um "gerenciar tags" em modal, invocável de qualquer ponto de uso, reusando `TagRow` extraído | (a) 0 · (b) affordance em 3 telas + permissão em cada uma · (c) 1 componente extraído + 1 modal; separa gestão de aplicação, como no ClickUp |
| **D-F2 · Permissão de editar/excluir** | (a) manter `requireRole("admin")` (4 pessoas); (b) `requireSession()` (8 pessoas) | mesma mecânica de A-F1, com peso maior: **excluir não tem desfazer nem cascata** |
| **D-F3 · Revalidação de rename/exclusão** | (a) manter só `/admin/configuracoes`; (b) acrescentar `/admin/contatos`, `/admin/contatos/[id]` e `/admin/jornadas` | (a) tag renomeada segue com o nome velho nas outras telas até um refresh · (b) 3 linhas por action |
| **D-F4 · Filtros da lista** | (a) manter os dois selects como estão (state local, single-select, incluindo inativas); (b) esconder inativas; (c) multi-seleção; (d) levar pra URL | (a) 0 · (b) 1 `.filter()`, mas tag desativada em uso deixa de ser filtrável · (c) muda predicado e UI · (d) linkável, mas hoje **nenhum** filtro da lista está na URL — abriria precedente pra todos |
| **D-F5 · Empurrar o filtro pro Postgres** | (a) manter em memória (982 linhas por request); (b) `.contains("tags", [slug])` no PostgREST, ativando o GIN | (a) 0, e o teto da paginação já é a página · (b) muda `getContacts` e a arquitetura de "carrega tudo e filtra no cliente" que a lista inteira assume (busca, gap, sort) — não é mudança isolada |

---

## E. Etiquetas Iddas — verificação de não-bloqueio

**Receita lida** (nada implementado):

- [`scripts/sonda-iddas-etiquetas.ts`](scripts/sonda-iddas-etiquetas.ts), docblock linhas 1-40: a bronze tem o **catálogo** (`bronze_iddas_etiqueta`, 20 linhas, coluna `tipo` P/C); o **vínculo** não existe em lugar nenhum da bronze (varredura por `%etiq%`/`%tag%`/`%label%` nos payloads de pessoa/orcamento/solicitacao/venda/tarefa não achou chave).
- [`docs/misc_etls/iddas-endpoints.md:70`](docs/misc_etls/iddas-endpoints.md#L70): *"**`etiquetas[]` NÃO vem na lista**, só no detalhe `GET /orcamento/{id}` (medido pela sonda …, 13/08/2026: etiquetas tipo C, 470 aplicações)"*; e `:98` desenha `orcamento.etiquetas[] ──embed──→ etiqueta.id`.
- [`docs/CHANGELOG.md:137-140`](docs/CHANGELOG.md#L137): *"vínculo orçamento-etiqueta em tabela própria, refresh incremental de 12 chamadas filtradas em vez de 675 detalhes … vira lote próprio."*
- Produção: `bronze_iddas_etiqueta` = **20 linhas**; **não existe nenhuma tabela de vínculo** (`information_schema`, §7.1).

**Resposta à pergunta única: não conflita.**

O motivo é de granularidade, e é limpo: a etiqueta do Iddas se aplica a **orçamento** (≈ jornada), enquanto tudo em A–D opera sobre `contacts.tags` (slugs, escritora única = operadora) e sobre o catálogo `tags`. São eixos diferentes, em tabelas diferentes; a receita já prevê **tabela própria** pro vínculo, o que não toca nenhuma coluna que A–D escreve ou lê. O padrão de ponte para unificação futura de vocabulário já existe e está dormente (`tags.clickmassa_tag_id`, UNIQUE, **0 linhas preenchidas**) — uma futura `tags.iddas_etiqueta_id` seguiria o mesmo molde sem colidir com nada decidido aqui.

Ressalva de espaço, não de contrato: se a etiqueta Iddas virar um **terceiro** bloco de badge no card do funil, o card já está no teto de 2 badges (`TETO_TAGS_CARD`, [KanbanClient.tsx:41-43](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L41), justificado por "o card tem 288px"). É aperto visual a resolver naquele lote, não decisão a antecipar neste.

---

## F. Jornadas ↔ Calendário (mapa para contrato futuro)

### F.1 — Campos temporais reais de `jornadas`

Da lista completa de 13 colunas (§B.1), os temporais são **quatro**, todos `timestamptz`:

| coluna | null | default | quem escreve |
|---|---|---|---|
| `estagio_atualizado_em` | NO | `now()` | movimentação no kanban |
| `closed_at` | YES | — | `fecharJornada` (ganho/perda) |
| `created_at` | NO | `now()` | criação |
| `updated_at` | NO | `now()` | trigger |

**Não existe** data de previsão, data de viagem nem follow-up **na jornada**. Duas coisas que parecem contrariar isso, e não contrariam:

- O badge 📌 do card **não é campo da jornada**: é `left join lateral (select assunto, data from bronze_iddas_tarefa where id_orcamento = j.bronze_ref and data >= current_date order by data asc limit 1)` dentro de `gold_kanban_jornadas()` (`pg_get_functiondef`, §7.2).
- O `proximo_follow_up` que existe é **do contato** (`contacts.proximo_follow_up`, com índice próprio `idx_contacts_proximo_follow_up`), escrito por `saveGestaoInterna` ([contatos/[id]/actions.ts:42](src/app/admin/(painel)/contatos/[id]/actions.ts#L42)).

### F.2 — Os "eventos" de uma jornada já chegam ao calendário?

**Parcialmente — e há uma classe inteira que não chega.**

A RPC lê exatamente 8 fontes: `tarefas`, `bronze_iddas_tarefa`, `bronze_iddas_voo` (2×: check-in e voo), `bronze_iddas_hospedagem`, `bronze_iddas_transporte`, `bronze_iddas_cruzeiro`, `bronze_iddas_seguro`, `contacts`. **A palavra `jornadas` não aparece na definição da RPC.**

- Os derivados de viagem chegam pela cadeia do **orçamento** (`id_orcamento` → `bronze_iddas_orcamento` → link → contato). Esse mesmo `id_orcamento` é o `jornadas.bronze_ref` — mas a RPC nunca faz o salto: quem liga evento a jornada seria o front, e ele não liga.
- **Classe que não chega: `tarefas_jornada`.** Tabela de to-do interno da jornada, com data e hora próprias:
  `id, jornada_id (NOT NULL), assunto (NOT NULL), descricao, data (date), hora (text), concluida, concluida_em, created_at, updated_at`. Tipada em [lib/jornadas/types.ts:83-94](src/lib/jornadas/types.ts#L83) como `TarefaInterna`. Produção: **6 linhas, 4 com data, 2 abertas com data.** A RPC não a lê → essas tarefas existem no detalhe da jornada e **não aparecem no calendário**.
- **Metade do vínculo já existe e é invisível:** `tarefas.jornada_id uuid` é FK pra `jornadas` (`tarefas_jornada_id_fkey`), gravado por `criarTarefa` ([lib/calendario/index.ts:216](src/lib/calendario/index.ts#L216)) e por `atualizarTarefa` (`:248`), e a RPC **devolve** `jornada_id` dentro do `meta` do ramo `tarefa`: `jsonb_build_object('tipo', t.tipo, 'descricao', t.descricao, 'jornada_id', t.jornada_id)`. O front não lê essa chave — `META_POR_TIPO.tarefa` só declara `descricao` ([lib/calendario/types.ts:182](src/lib/calendario/types.ts#L182)). Dado presente, não exibido, não navegável.

### F.3 — Navegação cruzada: o que existe

| De → Para | Existe? | Evidência |
|---|---|---|
| Calendário → **contato** | **sim** | `"Abrir contato →"`, condicionado a `ev.contactId` — [DrawerEvento.tsx:257-263](src/app/admin/(painel)/calendario/DrawerEvento.tsx#L257). O docblock (`:33`) registra que essa é *a única* navegação oferecida, por decisão (C6: drawer nunca é navegação). |
| Calendário → **jornada** | **não** | apesar de `meta.jornada_id` estar no payload (§F.2) |
| Kanban → jornada | sim | [KanbanClient.tsx:397](src/app/admin/(painel)/jornadas/KanbanClient.tsx#L397) `router.push('/admin/jornadas/{id}')` |
| Jornada → contato | sim | [JornadaDetailClient.tsx:442](src/app/admin/(painel)/jornadas/[id]/JornadaDetailClient.tsx#L442) |
| Contato → jornada | sim | [ContactDetailClient.tsx:929, 961](src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx#L929) |
| Aprovação → contato | sim | [AprovacaoClient.tsx:50](src/app/admin/(painel)/jornadas/aprovacao/AprovacaoClient.tsx#L50) |
| **Jornada/contato → calendário filtrado** | **não** | grep por `/admin/calendario` em `jornadas/` e `contatos/`: **zero ocorrências**. E a URL do calendário só aceita `?v=` e `?d=` ([calendario/page.tsx:63](src/app/admin/(painel)/calendario/page.tsx#L63)) — não há parâmetro de contato nem de jornada. Qualquer deep-link exige estender esse contrato de query string. |

### F.4 — Nota para o contrato futuro (sem proposta)

Três fatos verificados que o contrato "Jornadas ↔ Calendário" vai precisar resolver: (1) `tarefas_jornada` é uma classe temporal fora da RPC; (2) `tarefas.jornada_id` já existe e já viaja no `meta`, sem consumidor; (3) o calendário não tem query string de filtro por entidade. Nada disso é decisão deste lote.

---

## 7. Apêndice de reprodutibilidade

### 7.1 — Queries de contagem (todas `select`, executadas via MCP em 18/08/2026)

```sql
-- volumes
select 'contacts_total' m, count(*)::text v from contacts
union all select 'contacts_ativos', count(*)::text from contacts where status='ativo'
union all select 'contacts_com_tag_interna', count(*)::text from contacts where coalesce(array_length(tags,1),0) > 0
union all select 'contacts_com_tag_cm', count(*)::text from contacts where coalesce(array_length(clickmassa_tags_id,1),0) > 0
union all select 'tags_catalogo_total', count(*)::text from tags
union all select 'tags_catalogo_ativas', count(*)::text from tags where is_active
union all select 'tags_com_grupo', count(*)::text from tags where grupo is not null
union all select 'tags_com_clickmassa_tag_id', count(*)::text from tags where clickmassa_tag_id is not null
union all select 'jornadas_total', count(*)::text from jornadas
union all select 'jornadas_abertas', count(*)::text from jornadas where aberta
union all select 'jornadas_com_contato', count(*)::text from jornadas where contact_id is not null
union all select 'clickmassa_tags_catalogo', count(*)::text from clickmassa_tags_catalogo
union all select 'tarefas_total', count(*)::text from tarefas;
```

Resultado: contacts 1.032 (982 ativos) · com tag interna **418** · com tag CM 270 · tags 10 (10 ativas, 0 com grupo, 0 com `clickmassa_tag_id`) · jornadas 614 (614 aprovadas, **14 abertas**, 614 com contato) · catálogo CM 20 · `tarefas` **1**.

```sql
-- tarefas de jornada, links e bronze
select 'tarefas_jornada_total' m, count(*)::text v from tarefas_jornada
union all select 'tarefas_jornada_com_data', count(*)::text from tarefas_jornada where data is not null
union all select 'tarefas_jornada_abertas_com_data', count(*)::text from tarefas_jornada where data is not null and not concluida
union all select 'contact_external_links_iddas', count(*)::text from contact_external_links where provider='iddas'
union all select 'bronze_iddas_orcamento', count(*)::text from bronze_iddas_orcamento
union all select 'bronze_iddas_etiqueta', count(*)::text from bronze_iddas_etiqueta;
```

Resultado: `tarefas_jornada` 6 / 4 com data / 2 abertas com data · links Iddas 706 · orçamentos 682 · etiquetas Iddas 20.

```sql
-- papéis
select role, status, count(*) from user_profiles group by 1,2;
--  admin/approved 4 · editor/approved 4
```

```sql
-- não existe tabela de vínculo de tag
select table_name, table_type from information_schema.tables
where table_schema='public' and (table_name ilike '%tag%' or table_name ilike '%etiq%');
--  bronze_clickmassa_tags (T) · bronze_iddas_etiqueta (T) · clickmassa_tags_catalogo (V) · tags (T)
--  → NÃO existe contact_tags
```

```sql
-- calendário: eventos × contato × contato-com-tag, janela do Mês corrente
select event_type, count(*) total, count(contact_id) com_contato,
       count(*) - count(contact_id) sem_contato,
       count(*) filter (where contact_id is not null and exists (
         select 1 from contacts c where c.id = e.contact_id
           and coalesce(array_length(c.tags,1),0) > 0)) as com_contato_com_tag
from calendar_events_between('2026-07-26','2026-09-05') e
group by rollup(event_type) order by event_type nulls last;
--  TOTAL: 132 · 114 com contato · 18 sem · 96 com contato que tem tag
```

Colunas, constraints e índices: `information_schema.columns`, `pg_constraint` e `pg_indexes` filtrados por `table_name in ('tags','contacts','jornadas','tarefas','tarefas_jornada','calendar_checkins')`.

### 7.2 — Definições lidas em produção (não versionadas no repo)

- `calendar_events_between(date, date)` — `pg_get_functiondef`, 18/08/2026. 9 ramos em `union all`, CTEs `lk` e `orc_link`, fecha com `order by data_inicio, hora_inicio nulls last, event_type`.
- `gold_kanban_jornadas()` — `pg_get_functiondef`. `left join contacts` + `left join lateral bronze_iddas_tarefa`, `where j.aprovacao_status='aprovada'`, **sem parâmetro e sem limite**.
- `sync_clickmassa_tags()` — `pg_get_functiondef`. Escreve **só** `clickmassa_tags_id` (aplicação + limpeza); devolve `jsonb` com `tags_aplicadas`, `tags_limpas`, `nomes_sem_catalogo`.
- `clickmassa_tags_catalogo` (view) — `select id::integer as id, name as nome, color as cor, is_active as ativa from bronze_clickmassa_tags`.

### 7.3 — Aviso de método

A lógica de banco **não está no repo**: RPCs, triggers e funções só vivem em produção (aplicados via MCP). Toda afirmação sobre SQL neste relatório vem de `pg_get_functiondef`/`information_schema` lidos hoje, não de arquivo. Quem for implementar deve reler as definições antes de tocá-las — e lembrar que **mudança de assinatura (argumentos OU `RETURNS TABLE`) exige `DROP FUNCTION` antes do `CREATE`**.

---

## 8. Achados não solicitados (sem ação)

1. **Impasse da tag desativada na ficha** — §A.2. Latente hoje (0 tags inativas), mas o primeiro `is_active=false` numa tag em uso trava o save daquela ficha sem saída pela UI. É o achado de maior risco deste relatório.
2. **Duas cores default divergentes** para a mesma coisa: `#B89D5A` em Configurações ([ConfiguracoesClient.tsx:19](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L19)) e `#1A2B4A` na criação inline ([AcoesEmMassa.tsx:73](src/app/admin/(painel)/contatos/AcoesEmMassa.tsx#L73)). A tag nasce de uma cor ou de outra conforme a porta de entrada.
3. **Quarto escritor latente de `contacts.tags`**, sem validação: `contactPatchToRow` ([mappers.ts:340](src/lib/contacts/mappers.ts#L340)). Nenhum caller hoje; nada impede o próximo.
4. **Mensagem de erro imprecisa:** `createTag` responde *"Já existe uma tag com esse nome"* ([actions.ts:150](src/app/admin/(painel)/configuracoes/actions.ts#L150)) para uma violação de UNIQUE que é de **slug** — `tags` não tem UNIQUE em `name`. "Ação" e "Ações" colidem no slug, e a operadora lê que o nome está repetido.
5. **`docs/contrato_dados_backoffice_v1.md` desatualizado** (DIV-3): ainda desenha `contact_tags (A CRIAR)` com origem e soft-remove, substituído por D091. Quem consultar esse contrato primeiro projeta a arquitetura errada.
6. **`contrato_calendario_v1.md` C5.4 desatualizado** (DIV-4): 5 admin + 2 editor no papel; 4 + 4 no banco.
7. **`idx_contacts_tags` (GIN) sem consumidor** — nenhum caminho do app filtra tag no Postgres; tudo é `.includes()` em memória sobre as 982 linhas carregadas.
8. **`tags.grupo` existe e nunca foi usado** — 0 linhas preenchidas, escrito só por Configurações, lido só como `<Badge>` na própria página ([ConfiguracoesClient.tsx:405](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L405)). Se agrupamento de tags entrar no contrato, a coluna já está lá — oportunidade barata, não dívida.
9. **`seguro` devolve 0 eventos no ano inteiro** (bronze tem 3 linhas, todas fora de 2026). Pendência já registrada em [CHANGELOG.md:117](docs/CHANGELOG.md#L117) — repetida aqui só porque apareceu na contagem da frente C.
10. **`getTagsPorContato()` varre `contacts` inteira** (1.032 linhas × 2 colunas) a cada carga do kanban ([lib/jornadas/index.ts:177](src/lib/jornadas/index.ts#L177)). É decisão consciente e documentada (evitar o `.in()` que estourou header antes), e o custo cresce linearmente com a base — vale reavaliar quando `contacts` passar da ordem de 10k.
11. **`TagRow` de Configurações usa `confirm()` nativo** ([ConfiguracoesClient.tsx:335](src/app/admin/(painel)/configuracoes/ConfiguracoesClient.tsx#L335)) para uma exclusão irreversível, enquanto o resto do admin usa `Modal variant="destrutiva"`. Se esse componente for extraído para reuso (D-F1c), é a hora de alinhar.
