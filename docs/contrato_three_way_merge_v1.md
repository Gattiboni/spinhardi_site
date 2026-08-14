# Contrato — Sincronização Three-Way Merge v1 (rascunho pra revisão)

Projeto Presença Digital Spinhardi · 13/08/2026 · autor: Claudinho · status: **AGUARDANDO REVISÃO DO ALAN**

Escopo: reescrever a promoção bronze→contacts pra (1) parar de fabricar duplicatas, (2) reparar as que já existem, (3) propagar mudança de fonte sem atropelar edição humana, (4) destravar a religada da cron. Substitui o comportamento da `promote_contacts_from_bronze` atual (corpo lido via `pg_get_functiondef` em 13/08).

---

## 0. Estado auditado (13/08/2026, via MCP — fatos, não estimativas)

- Dedup atual é **só por link externo** (`contact_external_links` unique em provider+kind+external_id). Telefone não participa. `contacts.whatsapp` **não tem unicidade** (só pkey na tabela).
- **36 grupos de telefone duplicado** dentro de `contacts` hoje: **24 pares cm+idd** (mesma pessoa, um contato por fonte — sistêmico, a incremental não casa por telefone), **8 idd+idd** (pessoas DISTINTAS dividindo número: família — prova que fusão automática por telefone é proibida), **2 idd+manual + 1 cm+manual** (Isabelle, Raissa, Mirella: Nina recriou gente que o sync já tinha, ex.: buscou "Isabelle Cristina Dos Santos", sync tinha "Isabelle Gabiatti"), **1 manual+manual** (Ana Caroline `5515997653479` × Ana Beatriz `15997653479` — mesmo número, formatos diferentes).
- **27 contatos `origem='manual'`** (não 26; +1 desde a auditoria de retorno), todos com `links_existentes=0`. Entre eles: 6 com telefone visivelmente inventado (`5511987654321`, `19999999857`...) e 1 "Teste" (30/07, `48996850657`).
- **Normalização 55 não roda no formulário de criação manual**: banco com formato misto (`19998006096` sem prefixo ao lado de `5519983415206` com). A do lote CAMP cobriu outros caminhos; este escapou.
- Filtro CM atual `coalesce(is_user,false)=false` **barra 216 telefones BR válidos**; desses, **144 já têm o telefone na base** (removê-lo sem merge = 144 duplicatas no primeiro sync) e 72 são novos de verdade.
- **Correlação perfeita `is_user` = `is_wa_contact`** em todas as 1.643 linhas do CM (zero exceções). As flags são redundantes entre si e não significam o que parecem — **nenhuma serve de critério de elegibilidade**. Corolário: a pendência antiga "blacklist LID via `is_wa_contact=false` na ingestão" está **REVOGADA** — `is_wa=false` inclui 530 telefones BR válidos (a maioria da base promovida) e 44 internacionais plausíveis; a blacklist teria nucleado a base. LID se identifica por comprimento.
- Descartados por comprimento hoje no CM: **846 LIDs** (14-15 dígitos, identificador interno do WhatsApp, não é telefone) + **51 internacionais plausíveis** (12-13 dígitos). Iddas: **7 internacionais**. Escopo real do flex: ~58 pessoas.
- **Deletes na origem existem**: `GET /pessoa/968930` → 404 no Iddas, id vivo na bronze (sonda do Codinho, 13/08).
- Drift de volume vs `resources.ts` (espera 838/614; API tem 882/675) → backfill levantaria FLAG à toa.
- **10 FKs apontam pra `contacts`**: anexos (CASCADE), campanha_destinatarios (SET NULL), campanha_eventos (SET NULL), contact_divergencia_dispensas (CASCADE), contact_external_links (CASCADE), contact_interactions (CASCADE), grupo_contatos (CASCADE), jornadas (**NO ACTION**), lancamentos (SET NULL), negocios (SET NULL). Deletar perdedor sem reapontar = perder anexo/interação/grupo em silêncio.

---

## 1. Decisões (unidades binárias — aprovar/vetar uma a uma)

### M1 — Identidade e papel do telefone
Link externo **continua sendo a única chave de vínculo**. Telefone normalizado (`nat`) vira critério de **matching de entrada**: linha da bronze SEM link procura contato existente pelo telefone ANTES de inserir. Telefone **nunca** funde dois contatos existentes automaticamente (os 8 grupos-família proíbem) e **não ganha unicidade**.

Regra de match (linha bronze sem link, `nat` casa com N contatos):
- N=0 → insere contato novo + link (como hoje).
- N=1 → **cria link pro contato existente** (zero insert) e entra no fluxo three-way (M4).
- N≥2 → determinístico e auditado: prefere quem já tem link de **outro** provider (é a mesma pessoa vista pela outra fonte); persistindo empate, o de `created_at` mais antigo. Grava no `metadata` do link: `{"matched_by":"phone","candidates":N}`. Sem fila humana — volume não justifica; o metadata deixa auditável.

### M2 — Reparo retroativo (one-time, migration própria, com dry-run aprovado antes)
- **24 pares cm+idd**: funde. Sobrevivente = o com link **iddas** (campos mais ricos: cpf, nascimento). O link clickmassa migra pro sobrevivente; campos: coalesce (vazio do sobrevivente recebe do perdedor); tags: união; timestamps humanos: maior; **reaponta as 10 FKs antes do delete** (colisão de unique em `grupo_contatos`/dispensas → linha redundante do perdedor é deletada, não movida); deleta perdedor.
- **3 manuais duplicados de sync** (Isabelle, Raissa, Mirella): funde. Sobrevivente = o **linkado** (estabilidade dos links). Do manual copia: `name` (nome formal da Nina vence pushname), `email` se sobrevivente sem, tags em união, timestamps humanos preservados no maior. Mesmo reapontamento. Deleta o manual.
- **Ana Caroline × Ana Beatriz**: **FORA do reparo automático** — nenhuma é do sync; é higiene operacional da Nina (decidir na ficha). Entra na lista de avisos (M8).
- **8 grupos idd+idd**: **NÃO fundir.** Pessoas distintas.
- Dry-run obrigatório: SELECT listando cada fusão (sobrevivente, perdedor, campos que mudam, FKs reapontadas) pro Alan aprovar antes do UPDATE/DELETE.

### M3 — Elegibilidade CM nova
Remove o filtro `is_user` (e não introduz `is_wa_contact` no lugar — nenhuma das duas significa nada útil, correlação 1:1 provada). Elegível = não-grupo, não-deletado, `number` presente, comprimento plausível (M5). Efeito no primeiro run: +216 candidatos → ~144 viram **links** em contatos existentes (M1), ~72 viram contatos novos. LID continua fora — por comprimento, não por flag.

### M4 — Three-way por campo (o coração)
Nova coluna `contact_external_links.last_synced_values jsonb not null default '{}'` — o último valor **visto da fonte** por campo. Coluna própria, não dentro de `metadata` (contrato explícito > saco genérico). Campos sync-owned por fonte: iddas `{name,email,cidade,estado,data_nascimento,cpf}`, clickmassa `{name,email,cidade,estado,cep,data_nascimento}`. Regra por campo, a cada run, pra contato JÁ linkado:

| fonte mudou? (incoming ≠ last_synced) | operador mexeu? (current ≠ last_synced) | ação |
|---|---|---|
| não | — | nada |
| sim | não | **aplica** incoming; last_synced := incoming |
| sim | sim | **mantém** current (operador vence); last_synced := incoming (não re-briga a cada run) |

Substitui o fill-null atual (que só preenchia vazio e nunca propagava correção de fonte). Campos humanos (tags, qualificação, `dados_editado_em`, `qualificacao_editado_em`...) **seguem fora** do alcance do sync — inalterado. A superfície de divergência existente (`contact_divergencia_dispensas`) continua como está; integração fina é ponto de extensão nomeado, não implementado agora.

### M5 — Telefone flex (internacional entra, LID não)
Normalização: dígitos crus; strip do `55` só quando `length≥12` e prefixo `55` (regra atual, preservada). Aceite: `nat` com **10-11** (BR, armazenado `55`+nat como hoje) ou **12-13** (internacional, armazenado como veio). **14-15 = LID, fora.** Impacto: +51 CM, +7 Iddas. Ambiguidades irresolvíveis por dígitos (número US de 11 dígitos parece DDD paulista; `51` é Porto Alegre e é Peru; `55` é Brasil e é DDD Santa Maria) ficam registradas como incerteza Z2 — postura: na dúvida, trata como BR (regra vigente), sem adivinhação de país.

### M6 — Seed mudo
Na mesma migration da coluna (M4): inicializa `last_synced_values` de cada link com os **valores atuais dos campos sync-owned na bronze congelada, normalizados como na promoção**. Sem isso, o primeiro run do three-way leria todo o histórico como "mudança da fonte" e atropelaria as edições da Nina (91 contatos com email posto à mão). O seed declara "o que está aí é o que a fonte já viu" — primeiro run vira no-op nos intocados.

### M7 — Deletes na origem: postura histórico
Registro sumido do Iddas/CM **permanece** no back-office. O CRM é histórico; nenhuma deleção se propaga. Detecção/sinalização de sumidos = ponto de extensão nomeado, não implementado. O merge só precisa não quebrar com fantasma na bronze (e não quebra: fantasma simplesmente não aparece mais no incremento).

### M8 — Higiene e acabamentos (dentro do lote, fora da RPC)
- **Normalização retroativa** dos `whatsapp` em formato misto (manuais sem 55): migration minha via MCP, prefixando `55` em quem tem 10-11 dígitos. Pré-requisito do matching M1 funcionar de forma uniforme.
- **Formulário de criação manual** passa a normalizar como a ficha (Codinho).
- **Bug do transporte** `transport.ts:133-139` (body não-JSON consumido duas vezes → 500 vira "Body is unusable" + 4 requests) — conserto (Codinho; diagnóstico já feito pela sonda).
- **`resources.ts` expected** 838/614 → 882/675 (Codinho), senão o backfill grita à toa.
- **`docs/misc_etls/iddas-endpoints.md:70`** corrigida (etiquetas[] é do detalhe, não da lista) (Codinho).
- Avisos operacionais pra Nina (via ti): par das Anas, 6 telefones inventados, contato "Teste" (expurgo? Alan decide).

### M9 — O que NÃO muda / NÃO entra
- Precedência Iddas-primeiro, advisory lock `871501`, colunas legadas (`iddas_pessoa_id`, `clickmassa_*`) preenchidas como espelho — aposentadoria delas é lote futuro, não agora (incrementalidade).
- **Etiquetas Iddas: lote próprio, depois.** Receita da sonda arquivada por referência (detalhe de orçamento OU 12 chamadas filtradas; tabela de vínculo própria; snapshot por run; pessoa fora — zero uso).
- Nenhuma unicidade nova, nenhuma fila humana, nenhuma deleção em cascata nova.

---

## 2. Ordem de execução (gates — nada avança sem o anterior)

1. **Alan aprova este contrato** (por decisão; veto pontual vira ajuste, não relitígio do resto).
2. Claudinho via MCP, cada passo com SQL mostrado antes e dry-run quando muta dado: (a) migration coluna `last_synced_values` + seed mudo; (b) migration normalização retroativa dos whatsapp; (c) **dry-run do reparo M2** → Alan aprova a lista → migration do reparo; (d) `DROP FUNCTION` + `CREATE` da `promote_contacts_from_bronze` nova (manha conhecida: DROP antes, senão vira overload).
3. Instrução Codinho (itens de código do M8) → β do Codinho.
4. **Religa cron** (Alan, Vercel → Settings → Cron Jobs) → observação do primeiro run real.
5. Papelada (CHANGELOG/DECISION_LOG) + WhatsApp pra Nina com os avisos do M8.

## 3. Critério de aceite (β do primeiro run com cron ligada)

- ~144 links novos **sem** contato novo correspondente; ~72 contatos CM novos; ~58 internacionais entram; **zero** duplicata nova por telefone já conhecido.
- Spot-check: Isabelle, Raissa e Mirella são UM contato cada, com tags/emails da Nina intactos e dois/três links.
- Nenhum dos 91 emails postos à mão sobrescrito (comparação antes/depois via snapshot de auditoria que eu tiro antes de religar).
- Contagem de `contacts` e de elegíveis coerente com a aritmética acima (desvio → investigação antes de qualquer novo run).

## 4. Incertezas registradas (Z)

- **Z1**: significado real de `is_user`/`is_wa_contact` no ClickMassa segue desconhecido; irrelevante pós-M3, registrado por honestidade.
- **Z2**: ambiguidade DDI×DDD por dígitos (11/51/55) é irresolvível sem metadado de país; postura BR-na-dúvida documentada.
- **Z3**: parte dos 530 telefones `is_wa=false` pode não ter WhatsApp ativo; irrelevante pra email, relevante se um dia dispararmos WhatsApp — verificação de existência é ponto de extensão, não requisito.
