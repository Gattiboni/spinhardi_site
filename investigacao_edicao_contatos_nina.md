# Investigação: a edição de contatos aguenta a revisão manual da Nina?

**Data:** 2026-07-25 · **Escopo:** só leitura. Nenhum arquivo de código alterado, nada commitado, nenhum fix aplicado.
**Fontes:** `graphify-out/GRAPH_REPORT.md` (ponto de partida, grafo desatualizado pro admin — segui pros arquivos reais), código do repo, `docs/MOAS_spinhardi_return_20260623T0221.md` (snapshot do schema de **23/06/2026** — um mês atrás, ver ressalva abaixo), `docs/contrato_dados_backoffice_v1.md`, `investigacao_regua_promocao_cm.md`.

> **Ressalva de método.** A lógica de banco (RPCs, triggers, constraints) **não vive no repo** — foi aplicada via MCP e nunca versionada. Tudo que depende dela está marcado **`requer verificação no banco`** e listado consolidado na §F. O snapshot MOAS é de 23/06 e já se sabe desatualizado em pelo menos um ponto (ele diz `contacts.whatsapp is_nullable = NO`, e o código de hoje assume `null` — ver F4).

---

## 0. Resumo executivo

A edição inline **funciona para o que promete** (nome, whatsapp, e-mail, status) e persiste corretamente. Os problemas não são de persistência, são de **escopo e de mão única**:

1. **Arquivar é irreversível pela UI.** Não existe nenhuma tela, filtro ou controle que liste ou desarquive um contato. Se a Nina arquivar errado, só volta com SQL.
2. **Apagar um e-mail errado provavelmente é desfeito pelo sync em até 15 minutos** (fill-null + cron `*/15`). O vazio deixado por ela não é lido como decisão humana — é lido como buraco a preencher.
3. **Não existe nenhuma coluna que proteja edição humana do sync.** Existe uma coluna `field_provenance` no banco, mas ela tem **zero referências no código** — foi criada e nunca implementada.
4. **A edição inline é a única forma de editar um contato existente.** A ficha 360 (`/admin/contatos/[id]`) não edita dados pessoais; o `AdminContactForm` completo é **só de criação**. Cidade, estado, CEP, data de nascimento, CPF e tags **não são editáveis em lugar nenhum**.
5. **Não existe delete de contato** em nenhum ponto da UI ou da API.

---

## A. Fluxo de persistência da edição inline

### A1. Quem renderiza e quem processa o Salvar

| Peça | Onde |
|---|---|
| Botão "Editar" que expande a linha | `src/app/admin/(painel)/contatos/ContactsClient.tsx:516-523` |
| Linha expandida (`<tr>` extra com colSpan=6) | `ContactsClient.tsx:526-539` |
| Componente do editor inline | `QuickEditRow` — `ContactsClient.tsx:104-208` |
| Estado local dos 4 campos | `ContactsClient.tsx:113-116` |
| Handler do Salvar | `handleSave` — `ContactsClient.tsx:130-145` |
| Botão Salvar | `ContactsClient.tsx:194-196` |
| Pós-sucesso | fecha o editor + `router.refresh()` — `ContactsClient.tsx:532-535` |

O editor é **um por vez**: `editingId` é um único id no estado (`ContactsClient.tsx:229`), e clicar em "Editar" noutra linha troca. Não há aviso de alterações não salvas ao trocar de linha ou paginar — clicou fora, perdeu o que digitou (nada foi para o banco, então não é perda de dado gravado, mas é retrabalho).

### A2. Rota / server action e payload

Não é rota REST — é **Server Action** do Next.js.

- Action: `quickUpdateContact(id, input)` — `src/app/admin/(painel)/contatos/actions.ts:37`
- Tipo do payload: `QuickEditInput` — `actions.ts:14-19`
- Chamada do client: `ContactsClient.tsx:133-138`

Payload exato (4 campos + o `id` como primeiro argumento):

```ts
{ name: string, whatsapp: string, email: string | null, status: ContactStatus }
```

`email` já vai como `null` quando vazio (`ContactsClient.tsx:136`), e o servidor repete o trim/null (`actions.ts:59`). Auth exigida antes de tudo: `requireSession()` — `actions.ts:42`.

### A3. Como escreve no banco

**Update direto via Supabase client com service role — sem RPC, sem API route.**

- `actions.ts:68` → `updateContact(id, patch)`
- `src/lib/contacts/index.ts:213-227`: `supabaseAdmin().from("contacts").update(contactPatchToRow(patch)).eq("id", id).select("*").single()`
- `supabaseAdmin()` é service role e **bypassa RLS** (documentado em `src/lib/contacts/index.ts:14-20`)

Tabela: **`public.contacts`**. Colunas escritas — só as 4 presentes no patch, porque o mapper é `if ("campo" in patch)`:

| Campo TS | Coluna | Linha do mapper |
|---|---|---|
| `name` | `name` | `src/lib/contacts/mappers.ts:285` |
| `whatsapp` | `whatsapp` | `mappers.ts:286` |
| `email` | `email` | `mappers.ts:287` |
| `status` | `status` | `mappers.ts:341` |

`updated_at` **não** entra no patch — fica com o trigger `trg_contacts_updated_at` (BEFORE UPDATE → `set_updated_at()`, MOAS `11_triggers` linha 1240). `arquivado_em` e `motivo_arquivamento` existem no mapper (`mappers.ts:342-343`) mas **nunca são acionados por este fluxo** (as chaves não estão no patch) — ver B6.

Revalidação após salvar: `/admin/contatos`, `/admin/contatos/{id}`, `/admin` (`actions.ts:71-73`).

### A4. Normalização do WhatsApp — **NÃO existe neste caminho**

**Se a Nina digitar `(19) 99999-9999`, entra no banco literalmente `(19) 99999-9999`.**

O caminho é:

1. `actions.ts:45` — só `.trim()`.
2. `actions.ts:49-52` — se preenchido, chama `whatsappValidationError()` (`src/lib/contacts/phone.ts:126-133`). Isso **valida**, normalizando internamente, mas **descarta o canônico** e retorna só `null` (ok) ou a mensagem de erro.
3. `actions.ts:63` — `whatsapp: whatsapp || null`, a string crua.
4. `mappers.ts:286` — passa direto pra coluna.

Compare com o caminho de **criação**, que grava canônico de propósito: `src/lib/contacts/from-form.ts:65-70` (`normalizeBrPhone` → `phone.canonical`), com o comentário explícito em `from-form.ts:55-59` ("Persiste SEMPRE o WhatsApp no formato canônico"). **A edição rápida não segue essa regra.** Resultado: o banco passa a conviver com dois formatos — `11983340441` (criação) e `(19) 99999-9999` (edição da Nina).

Consequências rastreadas (nenhuma quebra funcional imediata, mas vale saber):

- **Dedup dos cards não quebra**: `gold_contatos_duplicados` faz `regexp_replace(whatsapp,'\D','','g')` (`sql/gold_contacts.sql:26`) — formatação é irrelevante. *(Registro do banco; `requer verificação no banco` — o arquivo declara "conferido contra o deployed", `sql/gold_contacts.sql:8`.)*
- **Dedup da captura do site não quebra**: `phoneKeys` normaliza os dois lados (`src/lib/contacts/index.ts:116-128`).
- **Envio de WhatsApp não quebra**: `normalizePhone` limpa e prefixa 55 na borda (`src/lib/integrations/clickmassa/index.ts:257-265`).
- **Busca da lista fica sensível a formato**: o filtro do client faz `includes` na string crua (`ContactsClient.tsx:275`). Buscar `11983340441` não acha um contato salvo como `(11) 98334-0441`.

Nota de validação: número de celular com 10 dígitos é **rejeitado**, não "consertado" (`phone.ts:82-94`) — a Nina recebe "Confira o número: celular tem 9 dígitos depois do DDD…". Correto e desejável.

### A5. Validação e duplicata no submit

O que **existe**:

- Nome vazio → bloqueado (`actions.ts:46`).
- WhatsApp preenchido com formato inválido → bloqueado, mensagem pt-BR (`actions.ts:49-52`).
- WhatsApp **vazio é permitido** de propósito (U1) — grava `null` (`actions.ts:47-48`, `:63`).

O que **não existe**:

- **Nenhuma validação de e-mail.** O regex `EMAIL_RE` existe (`src/lib/contacts/validation.ts:27`), mas `validateSiteContact` só é usado no caminho público do site. A edição inline nunca o chama. `joao@` ou `joao.com` gravam sem reclamar.
- **Nenhum limite de tamanho de nome** (o site tem `nameMax: 120`, `validation.ts:20`; a edição não).
- **Nenhuma checagem de duplicata.** `findExistingContact` (`src/lib/contacts/index.ts:135`) tem **um único call site em todo o repo**: `src/app/(public)/contato/actions.ts:95` (formulário público). Nem a edição inline nem o cadastro manual (`novo/actions.ts:21-42`) chamam.

**Se ela salvar um whatsapp que já existe em outro contato: salva normalmente, sem aviso.** No próximo carregamento da página, os dois contatos passam a aparecer no card "Possível duplicado" (a RPC agrupa por dígitos, `sql/gold_contacts.sql:30-39`). No nível de banco, o snapshot de 23/06 mostra em `contacts` apenas `contacts_pkey` (id) e um `UNIQUE` em `clickmassa_contact_id` — **nenhum unique em `whatsapp` ou `email`** (MOAS `04_constraints_basic` linhas 840-841; `07_indexes` linhas 1063-1072). **`requer verificação no banco`** (snapshot de um mês atrás; e `investigacao_regua_promocao_cm.md:89` afirma que hoje só existe a pkey, o que já diverge do snapshot).

---

## B. Status "Arquivado"

### B6. Valores aceitos e o que grava

O `<select>` oferece por padrão **dois**: `ativo` → "Ativo", `arquivado` → "Arquivado" (`ContactsClient.tsx:58`, rótulos em `:51-56`). Se o contato já estiver com um status não-operacional (`duplicado`, `anonimizado_lgpd`), esse valor é **prependado** à lista só pra não exibir opção errada (`ContactsClient.tsx:122-124`) — ou seja, ela consegue ver "Duplicado" e mudar pra Ativo/Arquivado, mas **não consegue marcar um contato como "Duplicado"**.

Grava a string literal na coluna `contacts.status` (`mappers.ts:341`). O CHECK do banco aceita `'ativo' | 'arquivado' | 'duplicado' | 'anonimizado_lgpd'` (`contacts_status_check`, MOAS `05_check_constraints` linha 906) — bate exato com o tipo TS (`src/lib/contacts/types.ts:59`). **`requer verificação no banco`** (snapshot 23/06).

**O que NÃO é gravado ao arquivar:** `arquivado_em` e `motivo_arquivamento` continuam `NULL`. As colunas existem (MOAS `03_columns` linhas 673-674), estão mapeadas (`mappers.ts:342-343`) e no tipo (`types.ts:137-138`), mas o patch da edição rápida só tem 4 chaves (`actions.ts:61-66`) — as condições `if ("arquivadoEm" in patch)` nunca disparam. **Consequência: um contato arquivado não registra quando nem por quê.** Se depois alguém perguntar "por que esse sumiu?", não há resposta no dado.

### B7. Some da listagem? Conta nos cards?

**Some.** A página carrega apenas ativos: `getContacts({ status: "ativo" })` — `src/app/admin/(painel)/contatos/page.tsx:23` → `.eq("status", opts?.status ?? "ativo")` em `src/lib/contacts/index.ts:40`. Não há filtro de status na UI (a barra de filtros tem origem, tag, sync, whatsapp — `ContactsClient.tsx:369-421` — e nenhum de status).

**Não conta em nenhum dos 3 cards** — os três excluem arquivados:

| Card | Fonte | Filtro |
|---|---|---|
| Sem email | `getSemEmailCount()` | `.eq("status","ativo")` — `src/lib/contacts/index.ts:390` |
| Possível duplicado | RPC `gold_contatos_duplicados` | `where status = 'ativo'` — `sql/gold_contacts.sql:28` |
| Sem cadastro no Iddas | RPC `gold_contatos_sem_iddas` | `where c.status = 'ativo'` — `sql/gold_contacts.sql:51` |

*(As duas RPCs: `requer verificação no banco` — `sql/gold_contacts.sql` é registro, não migration aplicável, ver cabeçalho `:4-8`.)*

Então **arquivar é hoje a ferramenta que efetivamente limpa os cards**. Isso é bom pro fluxo dela — e é justamente o que torna a irreversibilidade (B8) perigosa.

**Onde o arquivado NÃO some:**

- **Ficha 360 continua abrindo por URL**: `getContactById` não filtra status (`src/lib/contacts/index.ts:88-100`), e a página só dá 404 se o contato não existir (`src/app/admin/(painel)/contatos/[id]/page.tsx:26-27`).
- **Jornadas continuam no kanban**: `getKanbanJornadas` chama a RPC `gold_kanban_jornadas` (`src/lib/jornadas/index.ts:169-172`) e `getJornadasDoContato` filtra só por `contact_id` (`src/lib/jornadas/index.ts:234-236`). Arquivar o contato **não fecha nem esconde as jornadas dele**. Se a RPC do kanban filtra por `contacts.status` — **`requer verificação no banco`**; nada no repo sugere que filtre.
- **Dashboard**: `getContactStats` conta contatos com `.eq("status","ativo")` (`src/lib/contacts/index.ts:311`), mas os agregados de negociação/fechados vêm de `jornadas` sem olhar o contato (`index.ts:316-317`, `:324-325`).

### B8. Arquivado é reversível pela UI? **Não.**

Cadeia completa, sem saída:

1. A lista carrega só ativos e o único call site de `getContacts` no repo fixa `status: "ativo"` (`page.tsx:23`; grep confirma call site único).
2. Não há filtro de status na UI (`ContactsClient.tsx:369-421`).
3. A ficha 360 **não tem controle de status nenhum** — as ações dela são follow-up (`saveGestaoInterna`, `[id]/actions.ts:35`), notas, jornada manual, WhatsApp, financeiro. Nenhuma toca `status`.

Ou seja: depois de arquivar, o contato **desaparece da UI da Nina**. Mesmo que ela tenha guardado o link `/admin/contatos/{id}`, a ficha abre mas não oferece como voltar. **Desarquivar exige SQL (via Claudinho/MCP).**

---

## C. Interação com o sync (a parte crítica)

> **Toda esta seção depende da definição viva de `promote_contacts_from_bronze()`, que não existe no repo.** Isso está documentado e já foi investigado: `investigacao_regua_promocao_cm.md:10-14` ("A régua não está no repositório… O repo contém um mapper TypeScript que *parece* ser a régua — ele tem zero call sites e é código morto"). O que segue separa **o que o repo prova** de **o que exige verificação**.

**Cadência**: ClickMassa a cada **15 minutos**, Iddas a cada **30** (`vercel.json:3-4`). A promoção roda em toda run que não seja `ingestOnly` (`src/lib/sync/run-sync.ts:215-217`). **A janela entre a edição da Nina e o próximo sync é de no máximo 15 minutos.**

### C9. Apagar um e-mail: o sync repõe?

**Muito provavelmente sim.** Evidências:

- O contrato declara a semântica vigente como fill-null: *"a fonte só preenche campo VAZIO (`coalesce(c.campo, fonte.campo)`). Campo preenchido nunca é sobrescrito pelo sync"* — `docs/contrato_dados_backoffice_v1.md:102-105`. O trade-off aceito está explícito em `:106-108`.
- O `where` do bloco fill-null foi lido direto do banco na investigação anterior e **cita e-mail nominalmente**: `where (c.email is null and m.email is not null) or ...` — `investigacao_regua_promocao_cm.md:91`.
- `docs/DECISION_LOG.md:100` e `docs/contrato_dados_v1.md:229` repetem a mesma regra ("protege principalmente o que foi digitado no painel").

O ponto que o contrato **não previu**: fill-null protege *o que foi digitado*, mas **não protege o que foi apagado**. Um campo esvaziado deliberadamente é indistinguível de um campo que nunca foi preenchido. Se o e-mail errado veio da bronze, ele volta.

**Lista dos campos que a Nina pode editar e estão sujeitos a isso — a lista é curta porque a UI é curta:**

| Campo | Editável pela Nina? | Sujeito a fill-null? |
|---|---|---|
| `email` | **Sim** (`ContactsClient.tsx:169-175`) | **Sim** — citado no `where` lido do banco (`investigacao_regua_promocao_cm.md:91`) |
| `whatsapp` | **Sim** (`ContactsClient.tsx:160-166`) | `requer verificação no banco` |
| `name` | **Sim** (`ContactsClient.tsx:151-157`) | ver C10 |
| `status` | **Sim** (`ContactsClient.tsx:178-189`) | ver C11 |
| `cidade`, `estado`, `cep`, `data_nascimento`, `cpf`, `nacionalidade`, `tags`, `origem`, destino/orçamento/prazo/passageiros | **Não — não existe edição desses campos em lugar nenhum da UI** | irrelevante hoje |

> A ausência de edição desses campos é fato do repo, não suposição: `AdminContactForm` (o form completo) tem **um único uso**, em `src/app/admin/(painel)/contatos/novo/page.tsx:22`, e a action que ele chama é `createManualContact` (`novo/actions.ts:21`) — **criação apenas**. A ficha 360 não renderiza form de dados pessoais (`src/app/admin/(painel)/contatos/[id]/ContactDetailClient.tsx`, 978 linhas, sem edição de dados pessoais; suas actions estão em `[id]/actions.ts:35-292` e nenhuma toca nome/e-mail/whatsapp).

**A lista exata de colunas no bloco fill-null: `requer verificação no banco`** (`pg_get_functiondef('promote_contacts_from_bronze')`). O mapper TS `mapBronzeContactToSilverUpdate` (`src/lib/integrations/clickmassa/mappers/bronze-to-silver.ts:50`) **não serve de referência** — é código morto e já se sabe que **diverge** da RPC (`investigacao_regua_promocao_cm.md:239-244`).

### C10. O nome está sujeito a overwrite?

**`requer verificação no banco`.** O que dá pra afirmar do repo:

- `contacts.name` é **NOT NULL** (MOAS `03_columns` linha 624) e a edição bloqueia nome vazio (`actions.ts:46`). Logo, **um `coalesce(c.name, fonte.name)` puro seria inerte** — nunca haveria null pra preencher.
- O risco real seria a RPC ter uma condição de *nome-placeholder* (tipo "se o nome atual é o próprio telefone, substitui"). Existe lógica assim no repo — `isPlaceholderName` (`src/lib/contacts/from-form.ts:230-237`) — mas ela é do **caminho do formulário público**, não da RPC. A RPC usa `coalesce(name, pushname, '55'||nat)` **no insert** (`investigacao_regua_promocao_cm.md:242`), o que é outro momento (criação, não atualização).
- Nada no repo indica que o sync sobrescreva nome de contato existente.

**Pergunta pro Claudinho:** o bloco de update da RPC toca `name`? Sob qual condição?

### C11. Contato arquivado é tratado diferente pelo sync?

**`requer verificação no banco`** — e é a pergunta de maior valor desta seção, porque combina com B8 (irreversibilidade).

O que se sabe:

- A idempotência da promoção decide por `contact_external_links`, não por status: *"quem tem vínculo não é re-inserido, é atualizado"* (`docs/contrato_dados_backoffice_v1.md:99-101`).
- O branch CM **nunca consulta `whatsapp` nem faz fusão por telefone** — só o `external_id` (`investigacao_regua_promocao_cm.md:218-226`). Isso é bom: um contato arquivado **não** deve ser re-inserido como duplicata nova.
- Nada em nenhuma fonte lida sugere que a RPC filtre ou escreva `status`.

**Leitura mais provável (a confirmar):** o fill-null ignora `status` e escreve no arquivado do mesmo jeito, mas **não desarquiva** (não toca a coluna `status`). O contato fica arquivado com campos sendo repostos silenciosamente.

**Perguntas pro Claudinho:** (1) a RPC referencia `status` em algum lugar (filtro ou write)? (2) o `where` do fill-null exclui arquivados?

### C12. Existe coluna que proteja edição humana? **Não, na prática.**

Varredura completa:

- **`field_provenance`** (`jsonb`, NOT NULL, default `'{}'`) **existe no banco** — MOAS `03_columns` linha 676. Foi decidida em `docs/DECISION_LOG.md:998-999` ("proveniência por campo, etiqueta no detalhe") e listada como pendente em `docs/CHANGELOG.md:683`. **`grep -rn "field_provenance" src` retorna zero resultados.** Nenhum código lê, escreve ou consulta. É coluna morta: existe, está vazia, não protege nada. *(Se ela ainda existe hoje: `requer verificação no banco`.)*
- **`manually_edited`, `locked_fields`, `updated_by`, `edited_by`: não existem.** As 56 colunas de `contacts` no snapshot (MOAS `03_columns` linhas 621-676) não têm nada equivalente.
- **`updated_at`** existe e é mantido pelo trigger `trg_contacts_updated_at` (MOAS `11_triggers` linha 1240), mas é só timestamp — **não diz quem escreveu**. Uma edição da Nina e uma escrita do sync são indistinguíveis pelo dado.
- **Sem trilha na timeline**: a edição rápida **não grava interação** em `contact_interactions`. Compare com `addContactNote` (`[id]/actions.ts:109-135`) e `sendWhatsAppWelcome` (`[id]/actions.ts:217-226`), que registram. A edição de dados da pessoa não deixa rastro nenhum. Se um valor mudar sozinho, não há como provar o que a Nina digitou.

**Conclusão:** hoje **nada** distingue trabalho humano de escrita de máquina em `contacts`.

---

## D. Delete

### D13. Existe delete de contato? **Não — em lugar nenhum.**

Varri todos os `.delete()` e handlers do repo. O que existe:

| Delete | Onde | Alvo |
|---|---|---|
| Nota interna da timeline | `src/lib/contacts/index.ts:270-283` (trava `tipo='nota_interna'`) via `[id]/actions.ts:170` | `contact_interactions` |
| Origem de captura | `src/app/admin/(painel)/configuracoes/actions.ts:118` | `capture_origins` |
| Tag | `configuracoes/actions.ts:187` | `tags` |
| Anexo | `src/lib/anexos/index.ts:133` | `anexos` |

**Nenhum toca `contacts`.** Não há hard delete, não há botão escondido, não há rota. O soft delete é exatamente o `status = 'arquivado'` da §B — que é o comportamento desejado (a preferência declarada por você), com a ressalva de B8 (mão única).

### D14. FKs apontando pra `contacts.id`

Do snapshot de 23/06 (`06_foreign_keys`, linhas 955-960 + 916):

| Tabela de origem | Coluna | Constraint |
|---|---|---|
| `anexos` | `contact_id` | `anexos_contact_id_fkey` (linha 916) |
| `contact_divergencia_dispensas` | `contact_id` | `contact_divergencia_dispensas_contact_id_fkey` (955) |
| `contact_external_links` | `contact_id` | `contact_external_links_contact_id_fkey` (956) |
| `contact_interactions` | `contact_id` | `contact_interactions_contact_id_fkey` (957) |
| `jornadas` | `contact_id` | `jornadas_contact_id_fkey` (958) |
| `lancamentos` | `contact_id` | `lancamentos_contact_id_fkey` (959) |
| `negocios` | `contact_id` | `negocios_contact_id_fkey` (960) |

Indiretas de segundo nível: `tarefas_jornada.jornada_id → jornadas.id` (961) e `anexos.jornada_id → jornadas.id` (917) — deletar um contato que arraste jornadas arrastaria essas também, **se** houver cascade em cadeia.

**A regra `ON DELETE` de nenhuma delas está no dump** — o MOAS registra só `from_table/from_column/to_table/to_column/constraint_name`, sem `delete_rule`/`update_rule`. **`requer verificação no banco`**, e é a informação decisiva: com `RESTRICT`/`NO ACTION` (default do Postgres) o delete simplesmente falha em qualquer contato que tenha uma jornada, um link externo ou uma interação — ou seja, praticamente todos; com `CASCADE`, um delete apagaria em silêncio o histórico inteiro da pessoa. Além disso, o snapshot é de 23/06: **FKs criadas depois não aparecem aqui**.

Como não existe delete na UI, isso hoje é risco zero — vira risco no dia em que alguém pedir "botão de excluir".

---

## E. Veredicto

### (a) Funciona — pode confiar no fim de semana

1. **Editar nome** — persiste em `contacts.name`, valida vazio (`actions.ts:46`, `mappers.ts:285`).
2. **Preencher ou corrigir e-mail** — persiste; vazio vira `null` explícito (`actions.ts:59`, `mappers.ts:287`).
3. **Editar WhatsApp com número válido** — valida formato BR (DDD 11-99, nono dígito) e rejeita celular incompleto com mensagem clara (`actions.ts:49-52`, `phone.ts:82-133`).
4. **Arquivar** — grava `status='arquivado'`, o contato sai da lista e dos 3 cards imediatamente (`mappers.ts:341`, `page.tsx:23`, `sql/gold_contacts.sql:28,51`).
5. **Cards e lista são coerentes entre si** — fonte única (RPC), sem desync de contagem (`ContactsClient.tsx:101-103`, `gold-operacional.ts:12-19`).
6. **Só logado escreve** — `requireSession()` em toda action (`actions.ts:42`).
7. **A tela atualiza sozinha após salvar** — `revalidatePath` + `router.refresh()` (`actions.ts:71-73`, `ContactsClient.tsx:532-535`).
8. **Erro de validação não perde o que ela digitou** — o editor continua aberto com os valores (`ContactsClient.tsx:139-144`).

### (b) Funciona, mas com armadilha

1. **Arquivar é mão única** — não existe tela, filtro ou controle que liste ou desarquive; um clique errado só volta com SQL (`page.tsx:23`, `ContactsClient.tsx:369-421`, ficha sem controle de status).
2. **Apagar um e-mail errado provavelmente é desfeito em até 15 minutos** — o fill-null do sync trata campo vazio como buraco a preencher, não como decisão humana (`contrato_dados_backoffice_v1.md:102-105`, `investigacao_regua_promocao_cm.md:91`, `vercel.json:3`).
3. **E-mail não é validado** — `joao@` grava e ainda tira o contato do card "Sem email" (que só olha vazio), criando falso saneamento (`actions.ts` sem chamada a `validation.ts:27`, `gold-operacional.ts:33-35`).
4. **WhatsApp é gravado exatamente como digitado, sem canônico** — o banco passa a ter dois formatos e a busca da lista, que é `includes` de string crua, deixa de achar o contato por dígitos (`mappers.ts:286` vs `from-form.ts:65-70`; `ContactsClient.tsx:275`).
5. **Nenhuma checagem de duplicata ao salvar** — dois contatos com o mesmo telefone passam sem aviso; a única sinalização vem depois, no card (`findExistingContact` só é chamado em `(public)/contato/actions.ts:95`).
6. **Arquivar o contato não fecha as jornadas dele** — o kanban continua exibindo o atendimento de alguém que ela "removeu" (`src/lib/jornadas/index.ts:169-172`, `:234-236`).
7. **Arquivar não registra quando nem por quê** — `arquivado_em` e `motivo_arquivamento` ficam `NULL` porque o patch não os inclui (`actions.ts:61-66`, `mappers.ts:342-343`).
8. **A edição não deixa rastro na timeline** — diferente de nota e WhatsApp, nada é registrado em `contact_interactions`; só o `updated_at` do trigger, que não diz quem escreveu (`[id]/actions.ts:122-127` vs `actions.ts:68`).
9. **Todo erro de banco vira a mesma frase genérica** — "Não foi possível salvar. Tente novamente." (`actions.ts:77`). Se `contacts.whatsapp` ainda for `NOT NULL` (o snapshot de 23/06 diz que é, MOAS linha 625), limpar o WhatsApp falha **sem explicar o motivo**, e ela vai tentar de novo em looping. **Ver F4 — é a verificação mais urgente antes do fim de semana.**
10. **Last-write-wins silencioso** — a Nina edita sobre um snapshot carregado no request; se o sync escrever entre o carregamento e o Salvar, o patch dela sobrescreve sem aviso (e vice-versa). Não há checagem de versão (`index.ts:213-227`).

### (c) Não funciona — ela vai tentar e não vai conseguir

1. **Excluir um contato** — não existe em nenhum lugar (§D13). *(Por decisão sua, e o arquivar cobre — desde que b1 seja resolvido.)*
2. **Desarquivar** — nenhum caminho pela UI (§B8).
3. **Editar qualquer campo além dos 4** — cidade, estado, CEP, data de nascimento, CPF, tags, origem, destino, orçamento, prazo, passageiros, perfil: **não há edição de contato existente pra nenhum deles**. O form completo é só de criação (`novo/page.tsx:22`, `novo/actions.ts:21`). Se a revisão dela envolve corrigir cidade ou data de nascimento, **isso não é possível hoje**.
4. **Marcar um contato como "Duplicado"** — o status só aparece no select se o contato **já** estiver assim (`ContactsClient.tsx:122-124`). Ela não consegue classificar duplicatas que encontrar; só arquivar uma delas.
5. **Registrar o motivo do arquivamento** — a coluna existe, o campo não (§B6).
6. **Ver ou revisar contatos arquivados** — nenhuma tela lista (§B8).

---

## F. Consolidado do que exige verificação no banco (pro Claudinho, via MCP)

Em ordem de urgência para o fim de semana:

| # | Pergunta | Por que importa | Como checar |
|---|---|---|---|
| **F1** | `contacts.whatsapp` ainda é `NOT NULL`? | Se for, limpar o WhatsApp na edição **falha com erro genérico** (E-b9). O snapshot de 23/06 diz `NOT NULL` (MOAS linha 625); o contrato manda dropar (`contrato_dados_backoffice_v1.md:181`); o código já assume nullable (`types.ts:72`, `actions.ts:63`). **Contradição aberta.** | `information_schema.columns` para `contacts.whatsapp` |
| **F2** | `promote_contacts_from_bronze()` — quais colunas exatamente estão no bloco de fill-null? | Define se apagar e-mail/whatsapp/nome é desfeito pelo sync (C9/C10) | `pg_get_functiondef('public.promote_contacts_from_bronze'::regproc)` |
| **F3** | A mesma RPC referencia `contacts.status` em algum ponto (filtro ou write)? | Define se arquivado recebe fill-null e se pode ser desarquivado por acidente (C11) | mesma definição, procurar por `status` |
| **F4** | Regras `ON DELETE` das 7 FKs que apontam pra `contacts.id` + FKs criadas depois de 23/06 | Decide se um futuro botão de excluir apagaria histórico em cascata ou simplesmente falharia (D14) | `pg_constraint` com `confdeltype`, `contype='f'`, `confrelid='contacts'::regclass` |
| **F5** | `gold_kanban_jornadas` filtra por `contacts.status`? | Define se contato arquivado some do kanban ou continua lá (B7) | `pg_get_functiondef` |
| **F6** | A coluna `field_provenance` ainda existe? Tem algum trigger que a mantenha? | É a única candidata a proteção de edição humana; o repo não a usa (C12) | `information_schema.columns` + `pg_trigger` em `contacts` |
| **F7** | Existe unique/exclusion em `contacts.whatsapp` ou `contacts.email` hoje? | Define se salvar telefone duplicado erra ou passa (A5). Snapshot e `investigacao_regua_promocao_cm.md:89` já divergem entre si | `pg_indexes` / `pg_constraint` em `contacts` |
| **F8** | `contacts_status_check` ainda aceita os 4 valores? | Confirma que `arquivado` grava sem erro (B6) | `pg_constraint`, `contype='c'` |
| **F9** | As RPCs `gold_contatos_duplicados` / `gold_contatos_sem_iddas` batem com `sql/gold_contacts.sql`? | O arquivo é registro ("conferido contra o deployed", `:8`), não migration | `pg_get_functiondef` das duas |
