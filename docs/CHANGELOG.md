# CHANGELOG — Spinhardi Turismo Site

Registro cronológico de marcos, eventos e entregas do projeto de Presença
Digital Spinhardi.

Formato: `[DATA] Categoria — Descrição`

Categorias: `DECISÃO` | `SITE` | `DOC` | `DESIGN` | `INFRA` | `CONTRATO`

Ordem: mais recente no topo.

---

## 2026

---

**SITE — Tela de contatos preparada pra revisão manual da Nina (D088):**
ordenação alfabética por nome como default (A→Z, locale pt-BR, acentos não jogam
pro fim) e nova coluna "Última edição" (`updated_at` via trigger já existente no
banco, exibição dd/mm hh:mm, fuso America/Sao_Paulo fixo pra não divergir
SSR/browser), ambas ordenáveis pelo cabeçalho com indicador de direção. Ordenar
reseta pra página 1 e respeita filtros e busca. Client-side, 2 arquivos, zero
mudança de banco ou RPC. Cron de sync pausada pelo toggle da Vercel durante o
fim de semana da revisão (fill-null reporia email apagado em ≤15min); religa
segunda.

**Pendências do lote:** religar o toggle da cron na segunda; conferir se email
apagado pela Nina volta no primeiro sync (se voltar, tratamento entra na revisão
do contrato); edição de cidade/estado/CPF/nascimento/tags fica pro pós-revisão.

---

**CONTRATO — Contrato de Dados do Back-office v1 (D086):** fechado e congelado
em `docs/contrato_dados_backoffice_v1.md` após auditoria completa do `/admin`.
Seis unidades decididas uma a uma, em perguntas binárias com evidência de
produção: identidade (telefone vira atributo; LID entra, grupo não),
re-importação (fill-null confirmado: trabalho de usuário nunca é sobrescrito),
jornadas (fila de aprovação fica na entrada; Iddas move estágio sem fila),
financeiro (só venda fechada conta; valor cheio até a resposta da RAV),
conversas (1 interação por conversa encerrada; spike antes de DDL) e tags (sync
aditivo; remoção do usuário lembrada). Anexo A lista as pendências das sócias
(RAV, follow-up, ponto de equilíbrio); Anexo B, a ordem de execução.

**INFRA — Sync destravado após 3 dias morto (D087):** a promoção bronze→silver
quebrou em 10/07 (colisão de UNIQUE causada por vínculo externo com duas
representações) e ninguém viu porque o log fechava antes da promoção rodar.
Consertado nas duas pontas: banco (trigger de projeção, escritor único em
`contact_external_links`, UNIQUE da coluna removido, constraint total no lugar
do índice parcial — o upsert do PostgREST dava 42P10 no parcial, provado por
EXPLAIN — e RPC com ON CONFLICT DO NOTHING) e código (formulário grava o vínculo
na tabela; serializador não emite colunas-projeção; `ingestion_log` só fecha
DEPOIS da promoção, com erro real em `error_message`). Backlog digerido (Iddas
3+1, CM 1) e cron validado em regime. Fim dos 3033 runs verdes cegos.

**Pendências do lote:** 3 zumbis históricos `running` no `ingestion_log` (18/06
×2, 22/06) — faxina; primeiro run pós-deploy confirma a Tarefa 2 em produção.

---

## 2026-07-13

**SEO global do site (D085):** o site ganha `sitemap.xml` (6 rotas
institucionais + `/blog` + todos os posts publicados, com `lastmod`),
`robots.txt` corrigido (agora bloqueia `/api/`, que estava aberto ao crawler) e
JSON-LD de `TravelAgency` na home, com telefone, logo, fundação em 1987,
Instagram e endereço a nível de cidade. Sem inventar endereço, email nem
horário: dado institucional errado no schema.org é pior que dado ausente.
Canonical em todas as páginas públicas.

**Fonte única de URL (D085):** `src/lib/site.ts` centraliza `SITE_URL` e
`SITE_DESCRIPTION`. O `robots.ts` apontava o sitemap para o domínio SEM www
enquanto os canonicals saíam COM www (o sem-www responde 308 pro com-www).
Acabou o domínio hardcoded em dois lugares divergentes.

**BUG: sitemap congelava no deploy (D085):** o `sitemap.ts` saía como rota
estática. Em produção, post publicado depois do build nunca entraria no sitemap.
Invisível em dev, que é sempre dinâmico. Corrigido com `revalidate = 60` mais
`revalidatePath("/sitemap.xml")` nos dois caminhos de escrita (admin e webhook
do Studio). Provado em build de produção com sonda de cache: sitemap vira MISS,
o robots (controle) segue HIT — invalidação cirúrgica, não flush global.

**Limite de upload 4 MB → 3 MB (D085):** a Vercel corta requisição em ~4,5 MB no
serverless; a margem era fina demais. A string "4 MB" vivia em quatro lugares da
tela.

**UX (D085):** "Remover imagem" fica desabilitado em post publicado, com
explicação. Antes salvava o rascunho e depois travava no publish, o que era
coerente mas confuso.

**INFRA:** Isaura Bianca (`isaura.teixeira@spinharditurismo.com.br`) estava
`pending` desde 29/06 sem ninguém aprovar. Aprovada como `editor`.

**Pendências:** email institucional não configurado no Resend nem publicado;
Google Business Profile nunca criado; copy de horário divergente entre código e
mapa aprovado.

---

**Blog: SEO ponta a ponta (D084):** post compartilhado passa a ter preview de
verdade. `generateMetadata` emite Open Graph completo (type article, title,
description, url canônica, siteName, locale, published_time em UTC, author) e
Twitter card (summary_large_image), com imagem 1200x630 cropada do Sanity
respeitando o hotspot, derivada da capa. JSON-LD de BlogPosting na página do
post. Canonical em todas as páginas do blog. A listagem `/blog` também ganhou
Open Graph (descoberto por curl que o Next SUBSTITUI o objeto `openGraph`, não
mescla: sem declarar `images`, a página ficaria sem imagem nenhuma). Post sem
capa não emite og:image vazia. `ogImage` não vira campo do form: a imagem de
compartilhamento é sempre derivada da capa, que já é obrigatória.

**Domínio canônico corrigido (D084):** `metadataBase` estava hardcoded sem
`www`, mas o domínio sem www responde 308 para o com www. Passa a ler
`NEXT_PUBLIC_SITE_URL` com fallback para o domínio correto.

**BUG: data com um dia de diferença (D084):** o mapper truncava a string UTC do
`publishedAt` em vez de converter fuso. Todo post publicado depois das 21h (BRT)
exibia a data do dia seguinte, no admin e no site. Display passa a formatar em
`America/Sao_Paulo` com `timeZone` fixo. Metadados de SEO seguem em UTC ISO, que
é o correto.

**UX do editor (D084):** publicar e salvar rascunho não jogam mais a pessoa pra
outra tela. Feedback local ("Post publicado." / "Rascunho salvo."), badge de
status que vira PUBLICADO na hora, "Ver no site" ativo sem F5, URL corrigida por
`history.replaceState`. As actions passam a devolver o `id` do post, o que
impede que um segundo "Salvar rascunho" num post novo crie um duplicado. Botão
"Publicar" desabilitado quando não há alteração pendente.

**Pendências:** arte og default dedicada (a listagem usa a hero provisória);
sitemap.xml e JSON-LD de organização; preview de rascunho; asset órfão `2.png`.

---

## 2026-07-12

**Blog: capa, alt e coleta de órfãos (D083):** o `/admin/blog` ganha upload de
imagem de capa (image asset real no Sanity, não URL), com preview, troca e
remoção. Capa e texto alternativo são obrigatórios para publicar, livres no
rascunho, com erro inline por campo. Limite de 4 MB, jpeg/png/webp, validado no
client e revalidado no servidor; upload roda só depois da validação passar.
Schema ganhou `alt` aninhado no `mainImage` (deployado da fonte em `studio/`).
Coleta de assets órfãos best effort em três momentos (rascunho, publish,
delete), cobrindo `mainImage` e `ogImage`: valida com `count(*[references()])` e
engole qualquer erro, porque nunca pode derrubar a ação da usuária. Público
passa a renderizar a capa em `/blog` e `/blog/[slug]` com `alt` real e sem CLS,
preservando o placeholder como fallback.

**Auth server-side do blog (D083):** `savePostAction` e `deletePostAction` agora
checam sessão e role antes de qualquer escrita. Fecha a dívida do B1, em que a
role do blog só era validada no client.

**"Ver no site" e rótulos em pt-BR (D083):** botão de link direto para o post
publicado na lista e no form do admin, desabilitado quando o post nunca foi
publicado, com helper quando existe rascunho por cima da versão publicada.
Publish passa a navegar para a página de edição. Rótulos do form traduzidos
(Resumo, Conteúdo, SEO — Título, SEO — Descrição).

**INFRA:** `studio/dist/**` ignorado no ESLint. O `npm run lint` completo
estourava OOM varrendo bundle minificado (gitignored, nunca versionado).

**Validação:** GC provado com evidência de dataset em três ciclos (múltiplos
uploads, trocas e exclusões): o dataset volta ao estado inicial e o asset de
controle sobrevive intacto. **Pendências:** preview de rascunho (draft mode) em
lote próprio; asset órfão legado `2.png` (18/06) a remover; role do blog
validada por código, não por execução.

---

**Blog no back-office (D082):** admin /blog sai do mock e grava de verdade no
Sanity: rascunho/publicar/excluir via write client server-only, slug automático,
categorias por reference, title/excerpt/body obrigatórios com erro inline, corpo
em md-leve convertido pra Portable Text (round-trip na edição). Schema ganhou
fonte versionada no repo (studio/) com excerpt + campos de SEO, deployado via
CLI; Studio hospedado re-deployado da nossa fonte. Leitura pública corrigida pra
live (useCdn false + perspective published): a CDN da Sanity segurava post
publicado invisível. seoTitle/seoDescription fluem até o metadata público.
**Pendências:** B2 (upload de thumbnail), B3 (Open Graph completo), trial do
Sanity expira ~16/07.

---

## 2026-07-10

**Site → Funil (D081):** formulário de /contato agora cria jornada direto no
kanban ("primeiro contato", título "Site: {destino}"). Dedup por telefone/email
com normalização BR canônica, validação server-side com erro por campo, máscara
de telefone, honeypot validado E2E. Re-submit não duplica jornada; payload do
form preservado e visível na ficha; contatos placeholder renomeados com
auditoria. Título obrigatório na criação manual de atendimento. **ClickMassa
consertado (D081):** causa raiz do sync fantasma era promise flutuante morta
pela lambda da Vercel; substituída por after(). Write-back honesto
(synced/failed, nunca pending eterno). Perna de oportunidade removida. Env
CLICKMASSA_DEFAULT_AGENT_ID descontinuada (remover da Vercel pós-deploy).
**Pendências:** smoke test de prod pós-deploy (número controlado); limpeza dos
testes da Amanda; máscara/validação de telefone no cadastro manual do admin.

---

### [2026-07-08] SITE — Hero da home: parallax de revelação em 3 camadas (D080)

Rework do comportamento da imagem do hero, aprovado via mockup HTML standalone.

- **Camadas:** altura adaptativa `clamp(520px,86vh,1100px)` de `md` pra cima
  (mobile intocado) · parallax de revelação (wrapper 132%/-32%, fator 0.45,
  translate3d + rAF, `prefers-reduced-motion` respeitado) · fade de 34% na base
  para `#1A2B4A`, fim do corte seco pro navy.
- **Arquivos:** novo `src/components/ui/HomeHeroBackdrop.tsx` (client component
  mínimo); `src/app/(public)/page.tsx` ajustado. Copy do hero segue
  server-rendered; só a foto se move.
- **Ajustes decorrentes:** `priority` → `preload` na imagem do hero (deprecation
  Next 16; preload de LCP verificado no SSR). `object-position` de `center 65%`
  para `center`. `overflow-hidden` removido da Section do hero (clip agora é do
  backdrop; copy flui pro navy em viewports baixas em vez de ser cortado).
- **Pendência menor:** varrer usos remanescentes de `priority` no
  `SpinhardiImage` (fora do escopo desta entrega).
- Validação local por Alan: ultrawide, reduced-motion e perf ok.

---

### [2026-07-08] SITE — /sobre: fotos do time removidas a pedido das sócias

Seção "Nosso time hoje" mantém eyebrow, título e parágrafo; removidos os dois
cards de foto (Angelina e Julia) e o import morto de `SpinhardiImage` no
arquivo. `mb-12` do parágrafo removido para ritmo vertical consistente com a
seção seguinte.

- `equipe-spinhardi-01-nina.jpg` segue em uso na home (decisão: mantém).
- `equipe-spinhardi-02-julia.jpg` ficou sem referência no source; mantido em
  `/public` deliberadamente (provável reversão de opinião das sócias).

---

### [2026-07-06] SITE — Esqueci minha senha (back-office): recovery cross-device via token_hash

Fluxo de recuperação de senha no /admin (D079), sobre Supabase Auth
(@supabase/ssr).

- **Fluxo:** /admin/login ganha link "Esqueci minha senha" →
  /admin/esqueci-senha (input de email, mensagem neutra anti-enumeração) → email
  → /admin/auth/callback (`verifyOtp`) → /admin/redefinir-senha (nova senha,
  mín. 8 chars, confirma sessão de recovery) → /admin logado.
- **Mecanismo:** token_hash + `verifyOtp` em vez de PKCE code-based (ver D079).
  Callback lê `?token_hash&type=recovery` e compara `type` com literal
  `"recovery"` (sem cast). Cross-device: link funciona aberto em
  navegador/aparelho diferente, validado local.
- **Config dashboard:** Site URL cravado em
  `https://www.spinharditurismo.com.br`; Redirect URLs com callback de localhost
  (dev) + prod; template "Reset Password" com href `{{ .RedirectTo }}` (mantém
  Site URL em prod, link adapta ao origin), identidade Spinhardi (navy/ouro).
  SMTP custom via Resend ativo (D010): sender `contato@spinharditurismo.com.br`,
  `smtp.resend.com:465`, intervalo mínimo 60s, então o reset chega a qualquer
  destinatário, não só a membros do projeto.
- **Arquivos:** admin/esqueci-senha (page + actions) ·
  admin/auth/callback/route.ts · admin/redefinir-senha (page + form + actions) ·
  admin/login (link) · proxy.ts (allowlist pública das 3 rotas).

**Pendências rastreadas (não esquecer):**

- **Validar reset em produção:** validado local, incluindo navegador diferente
  (prova do cross-device). O e2e em produção com um destinatário não-membro
  ainda não foi confirmado. Conferir de passagem que o callback de prod
  (`https://www.spinharditurismo.com.br/admin/auth/callback`) está nas Redirect
  URLs e que o email chega a um endereço não-membro.
- **Prefetch de link único:** scanner de email (Safe Links etc) pode consumir o
  link de uso único antes do clique, gerando "link inválido". Comum a qualquer
  link de auth, baixo para o stack da Nina; já tratado com o estado de erro +
  botão de novo link. Se aparecer na prática, mitigar com landing intermediária.

---

### [2026-06-29] SITE — Lote de fixes do site público (feedback do grupo de marketing)

Ciclo de ajustes recolhidos no grupo SPINHARDI MARKETING (17–18/06) + débitos
encontrados de passagem. Lote único, sem migração de stack.

- **Serviços 3→2** (ver D078): home, /viagens, /viagens/pacotes e footer passam
  a expor "Pacotes e Serviços Avulsos" (→ /viagens/pacotes) e "Viagem Sob
  Medida" (→ /viagens/sob-medida). "Roteiros" eliminado; "Passagens Avulsas"
  absorvida. /viagens/pacotes: H1 voltou ao padrão tagline ("Do item avulso ao
  pacote completo."), com o nome do produto em breadcrumb + title; nova linha em
  "O que está incluído" explicitando contratação avulsa ou em pacote.
- **Sobre:** fotos das sócias movidas para depois da linha do tempo. Nova seção
  "Nosso time hoje" (eyebrow "Quem cuida da sua viagem" + parágrafo de time
  Itália/Portugal/África/Disney + as 2 fotos no mesmo box 3/4). Nova ordem:
  cabeçalho → linha do tempo → nosso time → valores → CTA.
- **Voz dos CTAs** padronizada para "Conta..." (encerra a inconsistência
  Conta/Conte): /viagens, /sobre, /contato, home e a etapa 01 de /sob-medida.
- **Localização** (/contato): "Atendimento online em todo o Brasil" (ver D077,
  provisório, diverge do Branding v3).
- **Hero (home):** `objectPosition="center 65%"` para mostrar a villa/vale no
  desktop em vez do céu. É recorte reposicionado, não a foto inteira — fix
  mínimo e local, sem tocar no SpinhardiImage compartilhado.
- **Favicon:** pássaro novo. `favicon.ico` regenerado multi-resolução (16/32/48)
  a partir do `icon.png`, + `icon.png` e `apple-icon.png` adicionados.
- **Footer:** links de serviço por produto (era 3 furados → /viagens); removido
  o link para /politica-de-privacidade (página inexistente).
- **alt** da foto na home corrigido para "Angelina Saragiotto" (era "Nina
  Spinhardi").

Arquivos: home · sobre · viagens · viagens/pacotes · viagens/sob-medida ·
contato · navigation.ts · Footer.tsx + 3 ícones (favicon.ico, icon.png,
apple-icon.png).

**Pendências rastreadas (não esquecer):**

- **Validação visual da Nina** (não bloqueou o commit, por decisão do Alan): o
  hero é recorte reposicionado, não a foto inteira — se ela quiser a foto
  inteira, é ajuste estrutural da altura do hero (próximo lote). Tamanho final
  das fotos do Sobre (box 3/4) também depende do olho dela.
- **LGPD — implementar EM BREVE:** criar a página real /politica-de-privacidade
  (link removido por ora). Conteúdo jurídico precisa de revisão.
- **Copy institucional 100% hardcoded** nos `.tsx`; só o blog é Sanity. Toda
  correção de texto institucional é deploy de código. Avaliar migrar para o
  Sanity no futuro, para a Nina editar sem deploy.

---

### [2026-06-23] SITE — Funil de jornadas: UI completa, valor editável, anexos, to-do interno

Ciclo de implementação da UI do funil (D073-D076) sobre o modelo de jornada
(D072):

- **Kanban:** 5 colunas sempre visíveis com contador + somatório, recolhíveis.
  Card click-abre/hold-arrasta, menu ⋯ pra ganhar/perder, "X dias parado", valor
  quando > 0. RPC `gold_kanban_jornadas` (JOIN no Postgres, resolve
  HeadersOverflowError de 586 ids na URL). Paginação client-side nas fechadas.
- **Detalhe da jornada:** valor com label por estágio (cotação/ganho/perda),
  inserir quando vazio + editar quando vivo + congelado quando fechado; tarefas
  unificadas (Iddas read-only + internas); histórico do cliente; anexos.
- **Ficha do contato:** três zonas, sistemas externos recolhidos, WhatsApp
  condicional (só com clickmassa_contact_id), removidos blocos do modelo velho.
- **Schema:** `jornadas.valor` (campo único, significado pelo estágio);
  `tarefas_jornada` (to-do interno); `anexos` + bucket Storage privado.
- **Removido:** funil ClickMassa da nav e rota (D066 dormente → removido).

**Pendências rastreadas (não esquecer):**

- Botão "Abrir no Iddas" inativo: trava de permissão no perfil. Pedir acesso,
  confirmar URL real do registro de pessoa, preencher
  NEXT_PUBLIC_IDDAS_PANEL_URL.
- Ás guardado: API do CM exporta histórico de conversas de WhatsApp. Fonte pra
  lógica de tagging automático a partir do histórico (registrar endpoint e
  formato quando for implementar).
- `promote_jornadas_from_bronze`: sync futuro lê bronze_iddas_orcamento.valor →
  jornadas.valor (nomes alinhados, mapeamento trivial).
- Dashboard gerencial (FunilChart com valor_total): próximo ciclo, com mock e
  método.

---

### [2026-06-23] D072 — Funil por jornada: nova entidade silver, 5 estágios canônicos, follow-up ortogonal

**Contexto:** D066 deixou pendente o vocabulário de estágios (placeholder de 9
valores degenerados no CHECK de contacts.estagio, "novo" em 100% das 828
linhas). A reunião 19/06 (resumo + áudio Amanda) cumpriu o pré-requisito do
D066: as sócias definiram o vocabulário real. Investigação (Frentes 1-2) revelou
que estágio no Iddas é por orçamento, não por pessoa, e que cliente recorrente
(recompra é a regra na agência) quebra o modelo "estágio é campo do contato".

**Decisão:** A unidade do funil é a JORNADA, não o contato. Nova tabela silver
`jornadas`, 1 contato → N jornadas. Contato é a pessoa (existe 1x, guarda
histórico). Jornada é 1 ciclo de venda (nasce em "primeiro contato", morre em
"aprovado"/"reprovado"). N jornadas abertas simultâneas permitidas (cliente
negocia múltiplos destinos). O card do kanban é da jornada.

**Vocabulário canônico (5 estágios), fonte = demanda reunião 19/06:** primeiro
contato | cotação enviada | aprovado | reprovado | pediu pra esperar. Aprovado +
financeiro unificados a pedido da Nina. Abertas (kanban): primeiro contato,
cotação enviada, pediu pra esperar. Fechadas (histórico read-only): aprovado,
reprovado.

**Follow-up é eixo ortogonal, não estágio** (fonte: áudio Amanda). Acontece
dentro de "cotação enviada", vira badge no card, derivado de
`bronze_iddas_tarefa` (459 tarefas com orçamento vinculado, 25 futuras). Não é
coluna do kanban, não é campo guardado na jornada (deriva, não duplica dado
vivo).

**Classificação revisável, não cega** (cumpre D066): jornada tem
`aprovacao_status` (pendente|aprovada). Histórico (623 orçamentos) entrou como
`aprovada` em bloco — mapper bateu 100% com a contagem real. Orçamento novo do
sync entra `pendente` e cai numa tela de aprovação onde a sócia confirma/corrige
o estágio sugerido. Tag do Iddas seria enriquecimento da sugestão, mas não está
normalizada (null no payload) — fora do MVP, "sem tag = sem sugestão, ainda cai
na tela".

**Mapper situacao Iddas → canônico (cravado):** R→reprovado; A,X→aprovado;
W→pediu pra esperar; C,N,B→cotação enviada; E→primeiro contato. Estados
operacionais do Iddas (Contrato, Emissão, Pré/Pós viagem, Financeiro): 0
registros em orçamento, ficam fora do funil comercial.

**Fonte da verdade é o back-office** (reafirma D066). Iddas e CM são espelhos a
conciliar em P2. MVP read-only pros sistemas externos; write-back é pós-MVP.
`contacts.estagio` (e seu CHECK de 9, índice, e os 15 arquivos que o
leem/escrevem) é deprecado e migrado pra `jornadas` no mesmo movimento de
refactor.

**Jornada ≠ Negócio** (alinha E3/E4 do contrato_dados_v1): jornada é processo
comercial (estágio, funil); `negocios` é resultado financeiro
(venda/custo/lucro). Jornada aprovada gera negócio. Tabelas distintas,
relacionadas via contact_id + bronze_ref.

**Backfill executado (2026-06-23):** 586 jornadas dos 623 orçamentos Iddas (37
órfãos de 25 pessoas sem contato resolvido ficaram de fora; reconciliação via
UI/sync, não SQL manual). Contagem confere: reprovado 284, aprovado 212, pediu
pra esperar 66, cotação enviada 20, primeiro contato 4.

**Padrão silver seguido** (contra repo real, D024): PK uuid, contact_id FK
nullable, par origem_dado+bronze_ref, trigger set_updated_at, enum via CHECK,
RLS authenticated. Espelha negocios/lancamentos.

**Responsável:** Alan Gattiboni **Status:** Ativa (DDL + backfill aplicados;
refactor do front pendente)

**Ver também:** D066 (pré-requisito cumprido), D063/D064 (empilhamento silver),
D041 (camadas), contrato_dados_v1.md E3/E4.

---

## 2026-06-22 — Peça 3: Sync recorrente automático (Vercel Cron)

### INFRA

ClickMassa e Iddas passam a rodar sozinhos via Vercel Cron. Rota dinâmica
autenticada por Bearer CRON_SECRET, runSync orquestra ingestão (bronze) +
promoção (silver via RPC), e o contrato HTTP sinaliza falha pro painel. Código
pronto e testado (smoke CM: 200, `completed`); ativa em produção após deploy +
CRON_SECRET nas env vars da Vercel.

### Adicionado

- **Rota** `/api/cron/sync/[source]` (GET/POST): valida
  `Authorization: Bearer CRON_SECRET`, aceita `?ingestOnly=1`, `maxDuration=800`
  (cobre os ~8min do Iddas; teto GA do Pro com fluid compute).
- **runSync** (src/lib/sync/run-sync.ts): grava `ingestion_log` (`running` antes
  da ingestão pela FK do bronze, terminal depois), ingere via lib, promove via
  `promote_contacts_from_bronze()` quando não é `ingestOnly`. Em falha de
  ingestão a linha fecha como `failed`, nunca órfã.
- **vercel.json** com crons: ClickMassa `*/15`, Iddas `*/30`.
- **IDDAS_OPERATIONAL_RESOURCES** (12 recursos de operação) passada como `only`
  no Iddas (ver D069).
- **Retry de 429** no transport do Iddas: honra `Retry-After` (cap 30s) +
  backoff exponencial. Provado ao vivo (centenas de 429 recuperando, zero
  esgotamento).

### Mudado

- Checagem de `expected` gateada pro modo backfill (ver D070):
  iddas/resources.ts:143 e clickmassa/resources.ts:776. O recorrente não dispara
  mais `partial` por crescimento de dado.
- Retorno do RPC `promote_contacts_from_bronze()` tipado (`PromoteResultRow[]`).

### Pendente

- **Ativar em produção:** deploy + `CRON_SECRET` nas env vars da Vercel (sem ele
  o cron é rejeitado), e validar no painel após o primeiro disparo.
- Débito herdado (D070): completude da paginação não validada no recorrente.
  Hardening futuro.
- Pacing adaptativo do Iddas (run ~8min por rate limit cumulativo; cabe nos
  800s). Otimização.
- Promoção não auditada no `ingestion_log` (falha de promoção sinaliza por 500 +
  runtime, não pelo log).

---

## 2026-06-19 — Lote C: Contato 360 (timeline, resumo comercial, edição rápida inline)

### SITE

Detalhe e lista de contato viram um 360 operacional. Review fechado: a fronteira
server->client do resumo comercial confere, o dado chega via prop de server
component (`[id]/page.tsx` chama `getContactComercial` no servidor e passa
adiante), `comercial.ts` é `server-only` e o client só importa o `type`. Pronto
pra commit.

### Adicionado

- **Timeline de interações** no detalhe (substitui o textarea de notas livres):
  contact_interactions cronológico, nota nova grava `tipo='nota_interna'`, menu
  Editar/Excluir só em nota_interna (evento de sistema é read-only). Trava
  dupla: updateNotaInterna/deleteNotaInterna filtram `tipo='nota_interna'` no
  próprio SQL. `criado_por='back-office'` (coluna NOT NULL sem default; valor já
  em uso no sendWhatsAppWelcome).
- **Resumo comercial e financeiro do contato** (módulo server-only
  `src/lib/contacts/comercial.ts`): orçamentos e vendas do Iddas via cadeia D058
  (orcamento.cliente = iddas_pessoa_id; venda via venda.id_orcamento, nunca
  venda.cliente como FK) + negócios manuais (negocios por contact_id). Soma
  separando Iddas / manual com proveniência rotulada. Lê bronze pelo padrão
  server-only do gold.ts.
- **Edição rápida inline** na lista (expansão de linha): nome, whatsapp, email,
  estágio, status, via quickUpdateContact. Membresia de duplicado vem da RPC
  gold_contatos_duplicados (fonte única), não recalculada no client.
  Seleção/bulk/paginação intactos.

### Resolvido

- "Registrar negócio some no nada": o negócio manual agora aparece no resumo do
  contato.
- **Data do negócio manual exibia um dia a menos** (X-1): `formatDate` parseava
  data-só (`YYYY-MM-DD`) como UTC meia-noite e formatava em UTC-3, recuando pro
  dia anterior. Parse agora é local (split + `new Date(y, m-1, d)`), corrige o
  shift em qualquer data-só que passe pelo formatter. A coluna `date` e a
  gravação (string crua) sempre estiveram corretas, era só exibição. Junto, o
  formato unificou pra **DD/MM/AAAA global** (ver D068): atinge o quadro
  Comercial & financeiro e também o blog público (de "15 jun 2026" pra
  "15/06/2026"), escolha consciente por consistência.

### Pendente

- Tags: o bulk "Adicionar tag" é stub (só alert). Botão individual desabilitado
  com label honesto. Rodada própria: contacts.tags (string[]) existe e
  updateContact suporta; falta UI/bulk real + registrar tag_adicionada/removida
  na timeline.
- Limpar textos "virá no Lote C" remanescentes (alert do bulk, "Forçar sync"),
  cosmético.
- Identificado no teste do Lote C, vai pro batch funil (fora do escopo deste
  lote): máscara BRL nos inputs de valor (tela editar oportunidade), drilldown
  dos cards "Financeiro (Iddas + manual)" do dashboard, e o erro 400 do módulo
  Opportunities do ClickMassa ao salvar.

---

## 2026-06-19 — Lote C: Contato 360 (timeline, resumo comercial, edição rápida inline)

### SITE

Detalhe e lista de contato viram um 360 operacional. Entregue pelo Codinho, em
review (a fronteira server->client do resumo comercial ainda não foi conferida),
não commitado.

### Adicionado

- **Timeline de interações** no detalhe (substitui o textarea de notas livres):
  contact_interactions cronológico, nota nova grava `tipo='nota_interna'`, menu
  Editar/Excluir só em nota_interna (evento de sistema é read-only). Trava
  dupla: updateNotaInterna/deleteNotaInterna filtram `tipo='nota_interna'` no
  próprio SQL. `criado_por='back-office'` (coluna NOT NULL sem default; valor já
  em uso no sendWhatsAppWelcome).
- **Resumo comercial e financeiro do contato** (módulo server-only
  `src/lib/contacts/comercial.ts`): orçamentos e vendas do Iddas via cadeia D058
  (orcamento.cliente = iddas_pessoa_id; venda via venda.id_orcamento, nunca
  venda.cliente como FK) + negócios manuais (negocios por contact_id). Soma
  separando Iddas / manual com proveniência rotulada. Lê bronze pelo padrão
  server-only do gold.ts.
- **Edição rápida inline** na lista (expansão de linha): nome, whatsapp, email,
  estágio, status, via quickUpdateContact. Membresia de duplicado vem da RPC
  gold_contatos_duplicados (fonte única), não recalculada no client.
  Seleção/bulk/paginação intactos.

### Resolvido

- "Registrar negócio some no nada": o negócio manual agora aparece no resumo do
  contato.

### Pendente

- Review da fronteira server->client do resumo comercial antes do commit
  (comercial.ts é server-only; conferir como o card chega no
  ContactDetailClient).
- Tags: o bulk "Adicionar tag" é stub (só alert). Botão individual desabilitado
  com label honesto. Rodada própria: contacts.tags (string[]) existe e
  updateContact suporta; falta UI/bulk real + registrar tag_adicionada/removida
  na timeline.
- Limpar textos "virá no Lote C" remanescentes (alert do bulk, "Forçar sync"),
  cosmético.

---

## 2026-06-19 — Funil: módulo CM desmascarado + pivot pro funil interno (D066)

### SITE

### Resolvido

- Premissa antiga derrubada por probe read-only: o módulo Opportunities do
  ClickMassa FUNCIONA (pipeline-steps 200; opportunities?pipelineStepId=73 ->
  200 com opp real). O board /admin/funil está vazio porque as sócias não usam o
  CRM do CM, não por bloqueio. O 404 ERR_CONTACT_PIPELINE_NOT_FOUND era chamada
  sem escopo de pipeline, não permissão. Drag-drop não existe porque nunca foi
  construído no front, não porque a API barra (os PUT respondem).

### Decisão

- D066: funil canônico passa a ser contacts.estagio (back-office), não importado
  das integrações subutilizadas. Pausado até conversa com Nina/Julia. Ver
  DECISION_LOG.

### Pendente

- `origem='importado'` nos 826 é degenerada: o canal real de captura não foi
  preservado como origem (a proveniência Iddas-vs-CM sobrevive em
  iddas_pessoa_id/clickmassa_contact_id/sync_status, mas o campo origem não
  distingue canal). Recuperar/expor canal real é trabalho futuro (refino de
  origem + captured_at + semeadura do funil).

---

## 2026-06-19 — Lote 3 + rodada de fixes: dashboard gerencial real (mock Iddas morto) e ajustes de UI

### SITE

O dashboard parou de mostrar número seedado e passou a ler dado real:
faturamento e vendas agregados em SQL unindo `bronze_iddas_venda` + negócios
manuais, gráficos de distribuição lendo o snapshot do ClickMassa, e funil por
estágio com drilldown pra lista. Junto, uma rodada de ajustes finos na lista de
Contatos e no detalhe. Tudo conferido contra o diff (23 arquivos) antes do
commit. Resolve os itens "Lote 2" (já no main, sem entrada própria) e "Lote 3"
da pendência do Lote 1.

### Adicionado

- **4 funções gold no Postgres**, aplicadas e validadas no banco:
  `gold_iddas_financeiro_resumo` (faturamento + vendas por período, une Iddas e
  manual), `gold_funil_por_estagio`, `gold_contatos_duplicados` (48) e
  `gold_contatos_sem_iddas` (170). Soma e contagem nascem no SQL, o front nunca
  puxa linha pra agregar. Registradas em `sql/gold_dashboard.sql` e
  `sql/gold_contacts.sql`.
- **3 cards financeiros reais** (faturamento, vendas, ticket médio) com toggle
  mês/ano/tudo pré-agregado pros 3 períodos, o clique troca o que já está em
  mãos sem ir ao banco.
- **Gráficos de distribuição** da base lendo o snapshot do ClickMassa: por tag,
  por estado, por última interação (recharts, paleta navy/gold/verde).
- **Funil por estágio** montado com todos os estágios em ordem (nasce
  degenerado, popula sozinho), clique na barra leva pra lista filtrada por
  aquele estágio.
- **Sidebar recolhível** (toggle, default expandido, persiste entre navegações)
  e **seletor de itens por página** (10/25/50) na lista de Contatos.
- **Máscara BRL** no form financeiro (centavos formatados, round-trip) e
  **situação como select** (Pago/Pendente/Cancelado).

### Resolvido

- **Mock do Iddas deletado** (`src/lib/integrations/iddas.ts`): o dashboard não
  inventa mais número, mostra o que existe ou degrada pra zero.
- **Desync das contagens de gap:** duplicados e sem-Iddas agora têm fonte única,
  a contagem do card é o tamanho do conjunto que o Postgres devolve e a lista
  são esses mesmos ids. Editar campo que não é o critério não move a membresia.
- **Teto de 1000 do PostgREST:** stats do "Hoje" viraram count queries nativas
  (`head: true`), imunes à truncagem que tinha inflado um card de gap no Lote 2.
- **Sidebar empurrada pra fora** em páginas largas (kanban do funil): `min-w-0`
  no `<main>` deixa o overflow rolar dentro do conteúdo.
- Card "Pendentes de sync" removido (sem sync real ainda), botão de adicionar
  tag desabilitado (tags são Lote C), card de tickets do ClickMassa virou link
  pro funil.

### Pendente

- Kanban do funil arrastável segue travado pelo módulo Opportunities do
  ClickMassa (404 `ERR_CONTACT_PIPELINE_NOT_FOUND`), a investigar.
- Bloco "Contato 360" (quick-edit inline na lista, notas em timeline, resumo por
  cliente) fica pro Lote C.

---

## 2026-06-19 — Lote 1: promoção bronze -> silver, `contacts` populada (826 contatos)

### INFRA

Promoção executada via SQL guiado direto no Supabase (Claudinho guia, Alan
aplica; Codinho não toca banco). A `contacts` silver saiu de 3 linhas de teste
pra 826 contatos reais, mesclados e deduplicados, sem tocar uma linha de UI. A
lista do admin já lê a base de verdade.

### Adicionado

- **Normalização de telefone cravada:** tira o `55` do DDI quando o número tem
  12-13 dígitos, valida 10-11 dígitos nacionais (descarta os ~747 LIDs do
  WhatsApp de 14+ dígitos do ClickMassa), chave de match são os últimos 10
  dígitos, armazena `'55'` + nacional no formato wa.me.
- **Merge por FULL OUTER JOIN nos 3 conjuntos:** ambos 328, só-CM 170, só-Iddas
  328. Precedência de nome Iddas > CM > pushname. `origem='importado'`, enums
  com default seguro (`destino_tipo='indefinido'`, etc), `sync_status` setado na
  fonte que tem id.
- **19 telefones ambíguos** (família/casal dividindo número + duplicatas da
  mesma pessoa) importados sem colapsar, 48 contatos flagados, formando a fila
  de possível-duplicado por detecção estrutural (whatsapp repetido), não por
  lista hardcoded.

### Resolvido

- Bug do CTE `with idd_amb` só visível ao 1o INSERT no bloco dos ambíguos:
  subquery inlinada em cada WHERE + travas `not in` pra re-rodabilidade.
- Staging tables (`stg_cm` / `stg_idd`) derrubadas após validação.

### Validação

- total 826 = 778 não-ambíguos + 48 flagados. Zero `clickmassa_contact_id`
  duplicado. 19 telefones na fila (10 com 3 cadastros + 9 com 2 = 48). origem
  826 `importado`. Tudo reconcilia.
- Resultados em `docs/fase_3.md`. Schema, enums e constraints reais extraídos em
  `docs/tipagem_pre_fase_3.md`.

### Pendente

- Lote 2 (gold operacional: cards-de-gap, ação WhatsApp via CM, "abrir na
  origem" com URL real).
- Lote 3 (gold gerencial: matar mock Iddas lendo `bronze_iddas_*`, gráficos,
  drilldown).
- Lote 4 (funil operacional, bloqueador do módulo Opportunities do CM).
- Adições estruturais ao silver (`contact_external_links`, tabela de negócios do
  E4, `pessoa_contato`, `field_provenance`) a aplicar no bundle de refator de
  front. Ver D064.

---

## 2026-06-19 — Contrato de dados do back-office CRM aprovado (Fases 0 a 2)

### DOC

Fechado o diagnóstico (Fase 0), a pesquisa externa (Fase 1) e o contrato de
dados do front refatorado (Fase 2). Define a arquitetura de consumo gold
gerencial + operacional sobre silver canônico fonte-agnóstico. Vira a fonte de
verdade dos lotes de execução.

### Adicionado

- `docs/diff_fase0_contrato_dados.md` — planilha de diff por campo de consumo
  (UI da fonte · raw_payload · coluna bronze · gap). Conclusão: gap real de ETL
  ≈ zero, bronze completo pro consumo conhecido.
- `docs/fase1_decisoes_pesquisa.md` — 6 decisões destiladas da pesquisa (SCV
  nomeia a fonte-da-verdade, progressive profiling nomeia os cards-de-gap, 3-6
  indicadores na primeira dobra, linguagem da dona, overview -> drill ->
  records, etiqueta de proveniência).
- `docs/contrato_dados_v1.md` — contrato completo, 9 seções + emendas E1 a E4.
- `docs/memorial_descritivo_front_v1.md` — wireframe descritivo tela a tela,
  cada elemento marcado como INTOCADO / MUDA-FONTE / RODA / +MELHORA /
  +ADICIONA, com a fonte nomeada e de onde vem pra onde vai.
- `docs/plano_backoffice_crm_v1.md` — plano em fases com checkpoints e 6
  princípios não-negociáveis (incrementalidade, modularidade, zero dívida,
  fonte-agnóstico, backoffice = fonte da verdade, merge não-destrutivo).

### Decisões

- D061 a D064 registradas no DECISION_LOG (arquitetura de consumo, identidade,
  merge não-destrutivo, adições estruturais ao silver).

### Pendente

- Execução dos lotes 1 a 4 da Fase 3, cada um referenciando uma seção do
  contrato.

---

## 2026-06-18 — Bronze Iddas completo: 23 tabelas, 9.076 rows (Lote Iddas A/B)

### INFRA

Camada bronze da API do Iddas Agência (ERP da agência) construída e populada via
backfill ETL. API oficial documentada (Swagger), auth Bearer de 12h sem refresh.

### Adicionado

- **Exploração (Turno A):** 27 recursos mapeados, auth resolvida
  (`POST
  /auth/login` com `{ chave }`), 23 com dados, 4 vazios. Relatório em
  `docs/iddas-endpoints.md`, samples em `docs/samples/iddas/`.
- **DDL bronze (23 tabelas `bronze_iddas_*`):** núcleo (pessoa 838, orcamento
  614, venda 208, solicitacao 9), sub-recursos de orçamento (cruzeiro,
  hospedagem 109, seguro, transporte, voo 387), financeiro (receita 441, despesa
  327, conta, cartao, categoria), apoio (canal, situacao, motivoreprovacao,
  etiqueta, usuario, tarefa 629), referência (aeroporto 4564, companhia 1018), e
  infosolicitacao (snapshot).
- IDs TEXT, `raw_payload` JSONB, audit columns, RLS padrão bronze (authenticated
  SELECT + service_role ALL) aplicada em massa via DO block. 39 indexes nas FKs
  e campos de filtro.
- **Backfill (`scripts/backfill-iddas.ts`):** dry-run + `--apply`, flags
  `--only`/`--skip`, re-auth automático (D060), paginação `?page=N`,
  normalizações (datas 0000-00-00, dd/MM/yyyy, monetário, IATA via regex). 9.076
  rows gravados.

### Resolvido

- Queda de rede no meio do apply (página 115/457 do aeroporto): run completado
  com `--only` nos 10 recursos faltantes. UPSERT idempotente, zero duplicata
  (D053).

### Pendente

- `ingestion_log` parcial órfão do 1o run (cosmético).
- Iddas: campo `despesa.pessoa` às vezes nome vs ID (tratar na silver).

---

## 2026-06-18 — Bronze ClickMassa completo: 1.484 contatos (Lote H/H.1/H.2)

### INFRA

Camada bronze do ClickMassa (CRM WhatsApp, fork de Whaticket) construída e
populada. Descoberta-chave: JWT externo autentica rotas internas do painel
(D056), destravando o backfill dos 1.483+ contatos antes inacessíveis.

### Adicionado

- **DDL bronze:** `ingestion_log` + tabelas `bronze_clickmassa_*`
  (opportunities, contacts, tags, users, products, queues, lead_statuses,
  settings, whatsapp_sessions, api_configs, funnels, funnel_steps,
  contacts_dashboard) + rename de `pipeline_steps`.
- **Exploração interna (Turno H.1):** 23 endpoints internos mapeados,
  documentados em `docs/clickmassa-internal-endpoints.md`.
- **Backfill V2 (`scripts/backfill-clickmassa.ts`):** 1.484 contatos (38
  páginas), 20 tags, 4 users, 11 settings/lead_statuses, 10 pipeline_steps, 1
  opportunity, dashboard snapshot. UPSERT idempotente.
- `api_configs` com `id` TEXT + CHECK anti-token + `delete token` no mapper
  (D052).

### Resolvido

- Cascata de PGRST204 (mapper inseria colunas fora do DDL): alinhamento
  schema/mapper via ALTER + recreate (D054).
- PATCH do `ingestion_log` quebrando por `duration_ms` inexistente: duração
  movida pra dentro de `counts` (D055).

### Pendente

- Promoção bronze -> silver (painel ainda lê silver legada, 3 contatos).
- Webhook OURO `FinishedTicketHistoricMessages` (Lote I).
- Trocar senha Amanda no ClickMassa (invalida JWT de sessão capturado no
  DevTools).

---

## 2026-06-18 — Arquitetura de camadas bronze/silver/gold formalizada (D041)

### DECISÃO

Adotado padrão de camadas lógicas pra todo dado externo no projeto. Inspirado na
arquitetura medalion da Central de Dados RH J&T Express Brasil, adaptado pra
escala Spinhardi.

### Adicionado

**Princípios cravados (não-negociáveis):**

- Toda fonte externa entra primeiro em **bronze** (replica raw)
- Bronze NÃO transforma, NÃO calcula, NÃO normaliza, NÃO faz JOIN
- Bronze é JSONB + colunas-índice mínimas (`id`, `ingested_at`)
- Bronze idempotente por id da source
- Silver processa bronze + dados próprios em formato canônico
- Gold gera a forma que o front precisa
- Front consome APENAS silver ou gold, nunca bronze, nunca chama API externa
  direto
- Naming: prefixos `bronze_`, `silver_` (opcional), `gold_`. Schema único
  `public`
- Cada ingestão logga em `ingestion_log` (futuro)

**Implementação inicial mapeada (a aplicar nos próximos lotes):**

- Bronze pra ClickMassa: `bronze_clickmassa_opportunities`,
  `bronze_clickmassa_contacts`, `bronze_clickmassa_pipeline_steps`,
  `bronze_clickmassa_tags`, `bronze_clickmassa_users`,
  `bronze_clickmassa_products`
- Silver: `contacts` (com legacy fields, ver D049), `contact_interactions`,
  `tags`, `capture_origins`, `user_profiles`
- Gold: views Postgres OU queries especializadas em server components Next.js,
  caso a caso

### Impacto

- Próximo lote (backfill ClickMassa → Supabase) implementa primeiro nível de
  bronze
- Refator de `contacts` pra silver puro fica como dívida documentada (D049)
- Job de sync incremental (após backfill) usa o mesmo pipeline (bronze → silver
  → gold)
- Quando integração Iddas voltar: `bronze_iddas_*` no mesmo padrão

### Ver também

- D041 (arquitetura), D049 (`contacts` como silver com legacy fields)

---

## 2026-06-18 — Lote G: ClickMassa MVP — Kanban Funil + Sync Automático + Cache Resiliente

### SITE

Lote consolidado com 5 sub-passos: G.1 (UI base), G.2.a (camada sync), G.2.b
(smoke + religação form), Turno A (descoberta API), Turno B (cache + bug fix +
JOIN).

### Adicionado

**Camada lib `src/lib/integrations/clickmassa/`:**

- `auth.ts` — getClickMassaAuthHeader() com JWT Bearer
- `http.ts` — clickMassaFetch wrapper com timeout 10s, retry 1x após 2s pra
  5xx/network errors, error tipado
  `ClickMassaError { status, code, message, payload? }`
- `types.ts` — interfaces TS pra Opportunity, PipelineStep, Tag, Product,
  ExternalUser, SendMessageInput, CreateOpportunityInput, SyncContactInput,
  SyncContactStatus, SyncContactResult
- `index.ts` — funções públicas:
  - `listPipelineSteps()` (delega pra resilient)
  - `listOpportunities({ pipelineStepId } | { contactId })` (filtro obrigatório,
    D047)
  - `getOpportunity(id)`, `updateOpportunity(id, patch)`,
    `updateOpportunityStatus(id, status, opts)`
  - `listTags()`, `listProducts()`, `listUsers()` (Quirk 1: `/users/{apiId}`)
  - `sendMessage(input)` — POST raiz (apiId já no URL base)
  - `createOpportunity(input)` — POST `/opportunities`
  - `syncContactFlow(input)` — orquestrador form → mensagem → opp
  - Helpers: `normalizePhone()`, `buildWelcomeMessageBody()`
- `pipeline-steps-cache.ts` — cache resiliente (D046):
  - `getCachedPipelineSteps({ maxAgeMs })` lê do Supabase
  - `refreshPipelineStepsCache()` chama API e UPSERT
  - `listPipelineStepsResilient()` orquestra: cache fresh → API → stale-cache →
    vazio

**Routes `/admin/funil/*`:**

- `/admin/funil/page.tsx` — Kanban: colunas horizontais por pipeline-step, cards
  por opportunity. Promise.allSettled em `listOpportunities({ pipelineStepId })`
  por stage. Aviso por coluna em falha. JOIN com `contacts` do Supabase pra
  mostrar nome real (vs telefone do ClickMassa). Banner de stale-cache + estado
  vazio com botão "Forçar sincronização"
- `/admin/funil/[id]/page.tsx` — Detalhe + EditOpportunityForm +
  StatusActionsBar (won/lost com motivo e nota)
- `/admin/funil/[id]/actions.ts` — Server Actions `updateOpportunityAction`,
  `updateOpportunityStatusAction`
- `/admin/funil/actions.ts` — Server Action `forceRefreshPipelineStepsAction`

**Sync automático no form `/contato/actions.ts`:**

- Após `createContact()` no Supabase, dispara `syncContactFlow()`
  fire-and-forget
- Resultado gravado nos campos `clickmassa_*` do `contacts` via mapper
- Registra `contact_interactions` tipo `sync_clickmassa` com `descricao`
  humano-legível por status
- UX do form não muda: usuário vê sucesso imediato, sync roda 1-3s em background
- Texto da mensagem inicial:

> Olá, {nome}! 🌎
>
> Aqui é da Spinhardi Turismo. Recebemos seu contato pelo site e já estamos com
> a sua mensagem em mãos. Em instantes uma das nossas consultoras vai te chamar
> pra entender sua viagem dos sonhos.
>
> Até já! ✨

**Mappers `src/lib/contacts/clickmassa-mapper.ts`:**

- `mapSyncStatusToDb(SyncContactStatus): 'synced' | 'pending' | 'failed'`
  (D048):
  - `opportunity_created` → `synced`
  - `message_sent` → `pending`
  - `blocked` → `failed`
  - `failed` → `failed`
- `syncResultToContactPatch(result)` — converte SyncContactResult em colunas
  snake_case do contacts. IDs convertidos pra `String()` (D042: schema tem TEXT
  em IDs). Preserva info detalhada do status em `clickmassa_sync_error` via
  prefixo `[<status>]:`

**Schema Supabase aplicado:**

- Table `clickmassa_pipeline_steps` (id BIGINT PK, name, color, ordem,
  is_active, synced_at) com RLS (`authenticated can read`,
  `service_role can write`)
- CHECK constraint `contacts_clickmassa_sync_status_check` confirmada
  preexistente (não criada nesse lote, descoberta via glossário retroativo,
  D042)

**Sidebar e roles:**

- Item "Funil 🎯" adicionado no `AdminSidebar`
- `editor` ganha acesso a `/admin/funil/*` em `lib/auth/roles.ts`

**Documentação operacional:**

- `docs/clickmassa-endpoints.md` — mapa completo de endpoints (gerado via
  openapi.json em `https://enterprise-352n.clickmassa.com.br/openapi.json`)
- `docs/clickmassa-openapi.json` — spec bruto da API ClickMassa
- `docs/glossario_clickmassa.md` — glossário operacional empírico (shapes
  confirmados, quirks, gaps)
- `docs/glossario_supabase.md` — glossário do schema Supabase (gerável via SQL
  único)
- Scripts em `scripts/`: `test-clickmassa-explore.ts`,
  `test-clickmassa-sync.ts`, `test-clickmassa-glossary.ts`,
  `test-pipeline-cache.ts`

**Env vars novas em `.env.local`:**

- `CLICKMASSA_API_URL` (URL base com apiId embutido)
- `CLICKMASSA_API_KEY` (JWT, válido até 2028)
- `CLICKMASSA_TEST_NUMBER` (smoke local)
- `CLICKMASSA_DEFAULT_AGENT_ID` (id do agente padrão pras opps criadas via sync)

### Alterado

- `clickmassa.ts` stub antigo removido; reimplementado como diretório
  `src/lib/integrations/clickmassa/` com `getStats()` mantido pra compat com
  dashboard
- `Opportunity.value` type ajustado pra `number | string | null` (API retorna
  `"0.00"` em string, type estava mentindo; mapper converte)
- `[id]/page.tsx` ganhou Number() na função brl() pra acompanhar type novo

### Estado conhecido pós-lote

- Kanban funcional. Atualmente mostra 1 opp (`8935` "Lead via Site - Alan Smoke
  Test", criada nos smokes G.2.b)
- Contato 109710 do smoke não tem match no Supabase (foi criado direto via API,
  fora do form), card mostra fallback de telefone como nome
- Quirk 2 do `/pipeline-steps` (HTTP 500 intermitente) mitigado por cache +
  fallback stale-while-error
- Módulo de Opportunities do ClickMassa funciona pra criação e listagem por
  filtro (`?pipelineStepId=X`); GET sem filtro retorna
  `ERR_CONTACT_PIPELINE_NOT_FOUND` por design (D047)

### Pendências documentadas

- Apagar opp 8935 do smoke (Alan testa manual depois)
- Backfill de opportunities/contacts existentes no ClickMassa pra Supabase
  (próximo lote, segue arquitetura D041)
- Sync incremental (cron job ou webhook) — próximo lote depois do backfill
- Tags, users, products do ClickMassa também devem ter cache local equivalente
  (próximos lotes)
- Drag-and-drop entre stages no kanban (micro-fix, Turno E futuro)
- `await import` no top-level de `scripts/test-pipeline-cache.ts` (trocar por
  import estático)

### Ver também

- D041 (arquitetura), D042 (schema retroativo), D043 (G.1 escopo), D044 (G.2
  sync), D045 (quirks API), D046 (cache resiliente), D047 (filtro obrigatório),
  D048 (mapper sync_status), D049 (`contacts` como silver)

---

## 2026-06-18 — Glossários auto-gerados como referência viva

### DOC

Convenção pra documentação de schemas (Supabase) e contratos externos (APIs)
regenerável on-demand. Substitui doc manual desatualizada.

### Adicionado

- **`docs/glossario_supabase.md`** — gerado via SELECT único no Supabase (CTEs +
  string_agg) que produz MD completo: tabelas, colunas, constraints, indexes,
  RLS, policies, triggers, FKs, functions. Reusável: roda quando quiser
  regenerar. Identifica `_nenhuma_` em ausências (sem NULL contaminado).
- **`docs/glossario_clickmassa.md`** — gerado via script de sondagem read-only
  que cataloga endpoints confirmados, shapes empíricos, quirks da API, gaps.
  Reusável: `npx tsx scripts/test-clickmassa-glossary.ts`.

### Impacto

- Glossário Supabase virou referência viva: bate `select` quando quiser
  regenerar, cola o MD output. Próximos prompts pro Codinho referenciam o
  glossário ao invés de presumir paths/tipos. Fim das surpresas de "coluna já
  existe".
- Glossário ClickMassa documenta os quirks (D045) num só lugar; próximos lotes
  consultam antes de bater na API.

### Padrão estabelecido

- Toda fonte de dado (interna ou externa) ganha glossário regenerável
- Convenção de nome: `docs/glossario_<nome>.md`
- Geração: SQL único (interno) ou script TypeScript de sondagem (externa)

### Ver também

- D041 (arquitetura), D042 (schema retroativo), D045 (quirks API)

---

## 2026-06-17 — Lote E + E.1: Auth real, fluxo aprovação manual, configurações reais

### Adicionado

**Schema Supabase (aplicado em produção via SQL editor):**

- `user_profiles` (id, name, email, status `pending|approved|rejected`, role
  `admin|editor`, created_at, updated_at, approved_at, approved_by com
  `ON DELETE SET NULL`) — RLS habilitada com policy "users can read own profile"
  (`auth.uid() = id`); trigger `touch_updated_at`
- `capture_origins` (id, name, slug único, descricao nullable, is_active default
  true, campanha_ativa default false, created_at, updated_at) — RLS habilitada
  com policy SELECT pra authenticated; trigger `touch_updated_at`; seed inicial
  de 4 origens (Site, WhatsApp, Indicação, Instagram)
- `tags` (id, name, slug único, cor NOT NULL sem default, grupo nullable,
  is_active default true; **sem timestamps**, decisão (a) do D028) — RLS com
  policy SELECT pra authenticated; sem trigger; nasce vazia
- Função compartilhada `public.touch_updated_at()`

**Código:**

- `@supabase/ssr` + `jose` instalados (registrados em `package.json`); `resend`
  já vinha do Lote D
- `src/proxy.ts` — proxy server-side cirúrgico em `/admin/*`, runtime Node (Next
  16 default; `middleware` foi renomeado pra `proxy` na versão; ver D034)
- `src/lib/supabase/client.ts` — client browser (`@supabase/ssr`)
- `src/lib/supabase/env.ts` — resolver da chave pública com fallback
  `NEXT_PUBLIC_SUPABASE_ANON_KEY ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `src/lib/auth/session.ts` — `getSession()`, `requireSession()`,
  `requireRole()`
- `src/lib/auth/approval-token.ts` — JWT HMAC-SHA256 (jose), validade 7 dias
- `src/lib/email/approval-request.ts` — render do email com 3 botões (Aprovar
  Admin / Aprovar Editor / Rejeitar), dispatch via Resend
- `src/lib/configuracoes/{types,mappers,index}.ts` — pattern D029 honrado;
  mapper identity explícito mesmo quando naming domínio = naming DB (ver D037)
- `src/app/admin/login/actions.ts` — Server Action de login com email/senha
- `src/app/admin/solicitar-acesso/{page,actions}.tsx|ts` — formulário público de
  solicitação + Server Action que usa
  `admin.createUser({ email_confirm: true })` (ver D035), insere `user_profiles`
  com `status='pending'`, dispara email
- `src/app/admin/aguardando/page.tsx` — landing pra usuários pending
- `src/app/admin/aprovar/[token]/page.tsx` — endpoint público que valida HMAC do
  token signed e aplica decisão (admin / editor / rejeitar)
- `src/app/admin/(painel)/...` — todas as rotas protegidas dentro do route group
  (painel/); layout server-component valida sessão antes de renderizar
- `src/app/admin/(painel)/configuracoes/{page,actions,ConfiguracoesClient}.tsx|ts`
  — UI com 2 editores especializados (ver D038): origens (descricao + 2 toggles)
  e tags (cor + grupo + 1 toggle); CRUD via Server Actions com
  `requireRole('admin')`

### Modificado

- `src/lib/supabase/server.ts` — `supabaseAdmin()` (função) + `supabaseServer()`
  (sessão-aware)
- `src/lib/contacts/index.ts` — `supabaseAdmin` (constante) → `supabaseAdmin()`
  (chamada)
- `src/lib/auth/index.ts` — barrel enxuto (só roles), sem mock provider
- `src/components/admin/AdminHeader.tsx` — `signOut()` real via
  `supabaseClient`, sem role-swap mock
- `src/components/admin/AdminContactForm.tsx` — import do novo caminho
  `(painel)/contatos/novo/actions`
- `src/app/admin/login/page.tsx` — formulário email + senha (sem magic link)
- `src/app/admin/(painel)/{DashboardClient,page}.tsx` — nome via sessão real
- `src/app/admin/(painel)/usuarios/page.tsx` — `requireRole('admin')` no topo
- `src/app/admin/(painel)/contatos/[id]/actions.ts` e
  `src/app/admin/(painel)/contatos/novo/actions.ts` — `requireSession()`
- `.env.example` — seção Lote E com `APPROVAL_HMAC_SECRET`,
  `APPROVAL_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_SITE_URL`

### Deletado (zero dívida)

- `middleware.ts` raiz — convenção deprecada no Next 16 + descoberta de que esse
  arquivo na raiz nunca rodou enquanto o app está em `src/app/` (ver D034). A
  proteção do back office era 100% client-side antes deste lote
- `src/lib/auth/mock.ts` — provider client-side
- `src/lib/auth/provider.ts` — barrel do mock
- `src/lib/auth/supabase.ts` — stub
- `src/app/admin/login/verificar/page.tsx` — rota do magic link experimental,
  descartada em favor do email + senha
- Versões antigas dos arquivos em `src/app/admin/` que viraram
  `src/app/admin/(painel)/` (renames detectados pelo git, exceto `layout.tsx` e
  `configuracoes/page.tsx` que mudaram de conteúdo o suficiente pra git tratar
  como new file + delete)

### Configuração externa aplicada

- Vercel (Production / All Environments): `APPROVAL_HMAC_SECRET`,
  `APPROVAL_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY` (ver
  "Incidentes resolvidos")
- Supabase → Authentication → Providers → Email: toggle "Confirm email"
  desligado (não obrigatório por D035, mas operacionalmente mais seguro)
- SQL bloco único aplicado no Supabase SQL editor; SELECT de verificação com 13
  checks retornou todos `true`

### Validação

- `npm run format` ✓ (escopado nos arquivos do lote; repo-wide foi descartado
  por causa do CRLF do Lote D, anotação operacional pendente)
- `npm run lint` ✓ exit 0
- `npx tsc --noEmit` ✓ exit 0
- `npm run build` ✓ 24 rotas (3 a mais que o build do Codinho no Codespaces:
  `/robots.txt`, `/blog` ISR 1m, `/blog/[slug]` SSG via Sanity, todos do Lote D)
- Smoke test end-to-end em produção (com email `alangattiboni@yahoo.com.br`):
  `/solicitar-acesso` → email Resend com 3 botões → Aprovar como Admin →
  `/admin/login` → `/admin` (dashboard) → `/admin/configuracoes` (criou, editou
  e desativou origem e tag)

### Decisões aplicadas

- D028 (schema TEXT+CHECK, tags sem timestamps decisão (a))
- D029 (mapper explícito Row/Insert/Update)
- **D030 — RESOLVIDA por este lote**
- D034, D035, D036, D037, D038 (novas, ver DECISION_LOG)

### Incidentes resolvidos

**Trabalho local em base desatualizada (incidente operacional).** Codinho rodou
Lote E e E.1 no VS Code local enquanto o repo local estava pré-Lote D (push do
Codespaces de ontem nunca foi puxado). Resultado: working tree consistente
internamente, mas o `git push` falharia ou apagaria Sanity + Resend + robots +
OG do remoto. Detectado durante a tentativa de commit quando `git pull --rebase`
revelou divergência. Recuperação: `git reset --hard
origin/main` +
`git clean -fd` + Codinho re-rodar Lote E + E.1 em cima da base Lote D (com
awareness do filesystem real, detectou `resend` já instalado, não tocou em
arquivos do Lote D). Registrado em D040.

**RESEND_API_KEY não estava na Vercel.** Lote D adicionou `RESEND_FROM_EMAIL` e
`RESEND_TO_EMAIL` mas omitiu a `RESEND_API_KEY`. Sintoma: tela de "Solicitação
enviada" aparece (Server Action try/catch grava `user_profiles` mas suprime erro
de envio do email), email nunca chega. Log de runtime confirmou
`Error: Missing API key`. Adicionada na Vercel + redeploy.

**Aspas multi-linha do PowerShell engoliram a primeira mensagem de commit.** O
título do commit `dca7515` (depois descartado) ficou literalmente
`git commit -m "feat:..."`. Pattern adotado: arquivo temporário `commit-msg.txt`
lido via `git commit -F`.

**APPROVAL_HMAC_SECRET exposto no chat durante o setup.** Rotacionado via
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e
substituído em `.env.local` + Vercel antes do push final.

### Pendências (fora do escopo deste lote)

- Treinamento Sanity da Amanda (Loom + sessão dedicada)
- Tag `v1.0.0` (Fase 3.6 do plano, quando go-live formal)
- `docs/MANUTENCAO.md` (operacional pós-go-live)
- `docs/SECURITY_GO_LIVE.md` (cravado em D030, agora pode ser escrito como
  retrospectiva)
- Adicionar `commit-msg.txt` ao `.gitignore`
- Normalização CRLF/LF dos arquivos do Lote D (lote dedicado, sem urgência)
- CHECK constraint de formato hex em `tags.cor` (cosmético, sem urgência)

---

## 2026-06-17 — Lote F: Webhook Sanity → Vercel pra revalidação on-publish

### Adicionado

- `src/app/api/revalidate/route.ts` — route handler POST, runtime Node,
  validador HMAC-SHA256 dual-format (oficial Sanity `t=`/`v1=` com fallback HMAC
  puro), chama `revalidatePath('/blog')` e
  `revalidatePath('/(public)/blog/[slug]', 'page')` em sucesso (ver D039 sobre o
  route group no path); usa `crypto.timingSafeEqual` contra timing attacks;
  crypto nativo do Node, sem dependência nova
- Env var nova: `SANITY_REVALIDATE_SECRET` (`.env.local` + Vercel All
  Environments, gerada com `openssl rand -hex 32` equivalente em Node)
- Webhook GROQ-powered configurado no manage do Sanity (project `wtc1swpj`): URL
  `https://www.spinharditurismo.com.br/api/revalidate`, trigger
  create/update/delete, filter `_type == "post"`, secret cravado no painel com o
  mesmo valor da env

### Modificado

- `.env.example` — seção LOTE F com `SANITY_REVALIDATE_SECRET=`

### Validação

- `prettier` escopado ✓, `npm run lint` ✓ exit 0, `npx tsc --noEmit` ✓ exit 0
- `npm run build` ✓ — `/api/revalidate` registra como ƒ (dynamic), blog intacto
- Smoke test produção:
  - Post "Teste webhook revalidação" criado e publicado no Studio
  - `/blog` (listagem) atualizou imediato com o post;
    `/blog/teste-webhook-revalidacao` renderizou completo
  - Attempt log Sanity: `resultCode: 200`,
    `resultBody:
    {"revalidated":true,"now":1781750313157}`,
    `duration: 1318ms`, `isFailure: false`
  - Unpublish do mesmo post: `/blog` removeu imediato; segundo attempt log com
    `resultCode: 200`, `duration: 389ms`

### Decisões aplicadas

- D039 (novo)

### Pendências (fora do escopo)

- Estender filter GROQ pra `author` e `category` quando o schema do Sanity
  ganhar tipos adicionais
- Avaliar `revalidateTag` em vez de `revalidatePath` se vier a usar fetch tags
  pra controle mais granular

```
---

## 2026-06-16 — Lote Fotos: imagens reais aplicadas + componente `<SpinhardiImage>`

### Adicionado

**Imagens em `public/`:**

- 17 arquivos entregues pela Amanda (3 hero, 2 equipe Nina/Julia, 4
  historia-1987, 2 destino-pacote, 2 destino-curadoria, 3 blog-thumb, 1
  serra-negra-agencia)
- 10 arquivos pesados (4× a 14× acima do limite de 500 KB do mapa) otimizados
  pelo Claudinho: 40 MB → 5.8 MB total (86% de redução), JPG progressivo,
  dimensão máxima 2400px pra heros e 1600-2000px pros demais, qualidade 78-82
  calibrada por grupo, aspect ratios originais preservados (sem crop)
- 7 arquivos leves preservados (já estavam bem otimizados pela Amanda)

**Componente:**

- `src/components/ui/SpinhardiImage.tsx` — wrapper único pra slots de imagem de
  conteúdo. Container com aspect-ratio fixo (style inline pra escapar do
  Tailwind v4 purge), `<Image fill>` dentro, `object-fit: cover` +
  `objectPosition` configurável, `w-full` por default. Lei do projeto registrada
  em JSDoc + D031.

**Slots aplicados (9 ativos):**

- **Home — Hero** (Cat C, construído): `hero-principal-01.jpg` com `priority`,
  overlay `bg-navy/60` pra legibilidade do texto branco. Altura controlada
  `lg:min-h-[70vh] lg:max-h-[80vh]`
- **Home — Bloco Posicionamento** (Cat C, construído): grid 2 colunas, foto da
  Nina (`equipe-spinhardi-01-nina`) à direita
- **Home — Bloco História/Legado** (Cat C, construído): foto da fachada da
  Spinhardi com logos de cias aéreas antigas (`historia-1987-02`) à esquerda +
  numeral "1987" gold abaixo como caption (Variante A)
- **`/sobre` — Sócias lado a lado** (Cat A, redesenhado): grid 2 colunas com
  `<figure>`/`<figcaption>` "Angelina Saragiotto" e "Julia Scappini", retratos
  `max-w-50` (~200px) centralizados
- **`/viagens` — Card 01** (Cat A, troca direta): `destino-pacote-01`, aspect
  3/2
- **`/viagens` — Card 02** (Cat A, troca direta): `destino-curadoria-01`, aspect
  3/2
- **`/viagens/pacotes` — Coluna direita** (Cat C, construído):
  `destino-pacote-02` acima do card sticky de CTA, aspect 3/2
- **`/viagens/sob-medida` — Coluna direita** (Cat C, construído):
  `destino-curadoria-02` acima do card sticky de CTA, aspect 4/5
- **`/blog` — 3 thumbs reais** (Cat B, dados): `blog-thumb-01/02/03` nos 3 posts
  publicáveis (preenchimento via `mock-posts.ts`)

### Modificado

- `src/app/(public)/page.tsx` — Hero ganhou altura controlada + foto de fundo
  via `<SpinhardiImage absolute inset-0>` com overlay navy. Bloco Posicionamento
  virou grid 2 colunas (texto à esquerda, foto da Nina à direita). Bloco
  História/Legado ganhou foto + numeral
- `src/app/(public)/sobre/page.tsx` — slot único da Julia virou grid 2 colunas
  com Nina + Julia lado a lado, fotos pequenas, com nomes completos em
  `<figcaption>` abaixo
- `src/app/(public)/viagens/page.tsx` — placeholders dos 2 cards substituídos
  por `<SpinhardiImage>`
- `src/app/(public)/viagens/pacotes/page.tsx` — coluna direita ganhou foto acima
  do card sticky
- `src/app/(public)/viagens/sob-medida/page.tsx` — idem
- `src/lib/blog/mock-posts.ts` — 3 posts ganharam `thumbnail` real; 2 posts
  (`florenca-fora-do-circuito` e `selecao-parceiros-locais`) comentados em bloco
  até a Amanda entregar `blog-thumb-04` e `-05`. Condição de reativação
  documentada inline. Conteúdo preservado, nada deletado
- `src/components/ui/SpinhardiImage.tsx` — wrapper ganhou `w-full` por default
  após descoberta do bug de colapso de altura em CSS Grid (ver "Riscos
  resolvidos" abaixo). JSDoc atualizado

### Não modificado (decisão de escopo)

- **Slots Categoria C "possíveis usos"**: `/sobre` linha do tempo e `/contato`
  elemento contextual. Eram "possível uso" no mapa da Amanda, não exigência.
  Descartados na decisão pré-aplicação. Arquivo `serra-negra-agencia-01.jpg`
  fica em `public/` como referência futura
- **`BlogCard.tsx`**: continua usando `<Image>` direto do `next/image`, não
  `<SpinhardiImage>`. Exceção documentada em D031 (componente especializado com
  `sizes` próprio, integração com `<Link>` parent, fallback de div quando
  `thumbnail` é null, `alt=""` por regra WAI-ARIA)
- **Logos, favicon, og-image**: fora deste lote. Lote separado quando a Amanda
  entregar versões finais
- **Sistema de drafts estrutural pra posts** (campo
  `status: 'draft' | 'published'`): entra junto com Sanity na Fase 3, não agora.
  Posts sem foto comentados no mock por enquanto

### Validação

- `npm run format` ✓, `npm run lint` ✓ (exit 0), `npx tsc --noEmit` ✓,
  `npm run build` ✓ (21 páginas; `/blog/[slug]` agora gera 3 rotas em vez de 5,
  refletindo os 2 posts comentados)
- Otimização das imagens validada: inspeção amostral em `hero-principal-02`
  (Portofino, foto mais agressivamente comprimida do lote) confirmou ausência de
  artefatos JPG perceptíveis
- Walkthrough visual end-to-end no `npm run dev` (após resolver lock do Windows
  com limpeza do `.next`): todas as 9 fotos renderizam visíveis na viewport.
  Hero com altura confortável, próximo bloco assomando no rodapé. Sócias lado a
  lado em `/sobre` com nomes corretos. 3 cards de blog visíveis, 2 cards de
  florença/parceiros ausentes
- Confirmação técnica do fix de altura: wrappers dos `<SpinhardiImage>` servem
  `class="relative w-full overflow-hidden ..."` em todos os 9 slots ativos

### Decisões aplicadas

- **D031** — `<SpinhardiImage>` é a forma única de exibir imagens de conteúdo
  (lei do projeto)

### Riscos resolvidos

**Bug de colapso de altura em CSS Grid (descoberto e corrigido neste lote):** 6
dos 9 slots renderizaram inicialmente com altura 0px (invisíveis na viewport
apesar do `<img>` presente no DOM) porque o wrapper do `<SpinhardiImage>` não
tinha `w-full` por default. Em contexto de grid item sem largura explícita do
consumidor, o `aspect-ratio` calculava altura a partir da largura intrínseca —
que colapsava pra 0 porque o único filho do wrapper era `<Image fill>` com
`position: absolute` (contribuição zero pro conteúdo). Resultado: caixa de 0px,
imagem renderizada num retângulo invisível. Smoke test HTTP inicial (Codinho)
confirmou "marca-up presente" mas não cobriu "imagem visível na viewport"; bug
pegou no walkthrough visual do Alan no browser. Investigação cirúrgica do
Codinho ratificou a hipótese, fix aplicado (`w-full` por default no wrapper), e
a especificação do componente agora inclui essa garantia. **Lição registrada em
D031:** smoke test HTTP de código presente não confirma renderização. Pra
trabalhos com layout novo, validação ponta-a-ponta visual no browser é
obrigatória.

### Pendências (fora do escopo deste lote)

- Logos, favicon, og-image: lote separado quando a Amanda entregar versões
  finais
- `blog-thumb-04` e `blog-thumb-05` da Amanda (descomenta os 2 posts no
  `mock-posts.ts` quando chegar)
- Calibragem visual fina, se desejada: opacidade do overlay do hero (atualmente
  `bg-navy/60`), altura precisa do hero (`lg:min-h-[70vh] lg:max-h-[80vh]`),
  `max-w-50` (200px) dos retratos em `/sobre`, `gap-8 md:gap-12` entre eles.
  Todos os valores atuais funcionam, ajuste só por preferência visual
- Sistema de drafts estrutural (`status` no tipo `Post`): entra com Sanity na
  Fase 3
- Refazer `historia-1987-02.jpg` sem borda de mármore na próxima reotimização
  (catch do Codinho na inspeção: a foto histórica foi fotografada sobre uma
  bancada de mármore, e a borda do mármore pode aparecer dependendo do crop do
  `object-cover` em telas grandes). Não bloqueia, é polimento futuro

## 2026-06-14 — Lote C: `contacts` ligado ao Supabase real

### Adicionado

**Supabase (banco):**

- Tabela `contacts` (53 colunas em 10 agrupamentos): identificação, dados
  pessoais, endereço, qualificação, estágio interno, tags, espelho Iddas,
  espelho ClickMassa, comportamento, metadados
- Tabela `contact_interactions` (7 colunas): FK
  `contact_id → contacts(id) ON DELETE CASCADE`, índice composto
  `(contact_id, criado_em)` pra timeline
- Função genérica `set_updated_at()` e trigger `trg_contacts_updated_at` em
  `contacts`
- Índices em `contacts`: `status`, `estagio`, `origem`, `created_at desc`,
  `proximo_follow_up`, `iddas_sync_status`, `clickmassa_sync_status`, GIN em
  `tags`
- 9 CHECK constraints validando enums (`origem`, `destino_tipo`,
  `orcamento_estimado`, `prazo_ideal`, `perfil_viajante`, `estagio`,
  `iddas_sync_status`, `clickmassa_sync_status`, `status`, mais `tipo` em
  `contact_interactions`)
- RLS ligada nas duas tabelas (`rowsecurity=true`); policies
  `authenticated_all_contacts` e `authenticated_all_interactions` (cmd `ALL`,
  role `authenticated`)

**Código:**

- `@supabase/supabase-js@2.108.1` instalado
- `src/lib/supabase/server.ts` — client `supabaseAdmin` server-only com service
  role; `import 'server-only'` no topo (build quebra de propósito se Client
  Component importar)
- `src/lib/contacts/mappers.ts` — mapper explícito snake↔camel pra `Contact` e
  `ContactInteraction`, type-safe nas duas direções via `ContactRow` /
  `ContactInsertRow` (compilador cobra os 53 campos)
- `src/lib/contacts/from-form.ts` — defaults compartilhados entre form do site e
  criação manual

### Modificado

- `src/lib/contacts/index.ts` — `getContacts` / `getContactById` /
  `getContactInteractions` / `getContactStats` agora consultam Supabase via
  `supabaseAdmin` (assinaturas mantidas, mock substituído). `getContactStats`
  puxa ativos uma vez e conta em memória (volume boutique)
- `src/app/(public)/contato/actions.ts` — form do site cria contato real
  (`origem=site_contato`) + interação `form_submission`; `sync_status` fica
  `pending`. Contato salvo antes de qualquer stub de sync, zero perda de lead
- `src/app/admin/contatos/novo/actions.ts` e
  `src/components/admin/AdminContactForm.tsx` — criação manual cria contato
  `origem=manual` e redireciona pra lista
- `src/app/admin/contatos/[id]/actions.ts` e
  `src/app/admin/contatos/[id]/ContactDetailClient.tsx` — "Salvar alterações" da
  Gestão Interna persiste estágio, follow-up e notas. `estagio_atualizado_em` é
  bumpado apenas quando o estágio muda
- `src/app/admin/page.tsx`, `src/app/admin/contatos/page.tsx`,
  `src/app/admin/contatos/[id]/page.tsx` — adicionado
  `export const dynamic = "force-dynamic"`. Sem isso, o Next prerenderiza
  snapshot estático no build (lista nunca refletiria dados reais, build tentaria
  bater no banco)

### Não modificado (decisão de escopo)

- Tabelas `capture_origins` e `tags` no Supabase — só entram quando a página de
  Configurações (hoje mock) for ligada, com seus types TS nascendo junto. Criar
  agora seria órfã sem consumidor (D028)
- Stubs de sync Iddas e ClickMassa — sincronização real é Fase 4. Lote C grava
  contatos com `iddas_sync_status='pending'` e
  `clickmassa_sync_status='pending'` (estado honesto)
- Auth mock client-side — Supabase Auth real entra como pré-requisito de go-live
  (D030 substitui D021 parcialmente)
- Mocks `mock-contacts.ts` e `mock-interactions.ts` — ficam no repo como
  referência, mas deixam de ser fonte de dados (banco começa limpo, não seedado)
- `.env.local` e `.env.example` — já existiam com as variáveis corretas; Alan
  cola a `service_role` key local, `.env.example` segue sem segredo

### Validação

**SQL (Supabase SQL editor):**

- `set_updated_at()` criada (retorno `proname='set_updated_at'`)
- `contacts`: 53 colunas conferidas via `information_schema.columns` (tipos,
  nulidade, defaults). Insert+rollback com só campos obrigatórios provou
  defaults: `nacionalidade='Brasileira'`, `pais='Brasil'`,
  `passageiros_adultos=1`, `status='ativo'`, `iddas_sync_status='pending'`,
  `tags='{}'`, `created_at` preenchido
- `contact_interactions`: 7 colunas conferidas. Teste de CASCADE inseriu
  contato + interação, deletou o contato, voltou `interacoes_orfas=0` (FK +
  CASCADE + defaults provados num único bloco com rollback)
- RLS: `pg_tables.rowsecurity=true` nas duas tabelas; `pg_policies` retornou as
  2 policies (`ALL`, role `authenticated`)

**Código:**

- `npm run format` ✓ · `npm run lint` ✓ (exit 0) · `npx tsc --noEmit` ✓ (zero
  erros) · `npm run build` ✓
- Build passou com `SUPABASE_SERVICE_ROLE_KEY` ainda como placeholder, o que
  prova que nenhuma página consulta banco em build time (efeito intencional do
  `force-dynamic` nas rotas admin)

**End-to-end manual** (com `service_role` key real em `.env.local`):

- Form `/contato`: 1 row em `contacts` (`origem=site_contato`, `status=ativo`,
  `iddas_sync_status=pending`) + 1 row em `contact_interactions`
  (`tipo=form_submission`)
- Empty state da lista admin funcionou antes da primeira captura
- Lista admin: contato do form aparece (Image 2). Após criação manual, lista tem
  2 contatos com origens distintas (Site / Manual, Image 3)
- Visão 360: dados reais renderizados; Gestão Interna persiste edições após
  reload (JSON confirmou `estagio_atualizado_em` > `created_at` no contato
  editado)
- Criação manual: cria contato com `origem=manual` e redireciona pra lista
- Dashboard: 6 cards refletem contagens reais

### Decisões aplicadas

- **D028** — Schema Supabase real e tradução TS→SQL (snake_case + TEXT+CHECK +
  `text[]`+GIN + CASCADE + service_role; escopo de 2 tabelas agora)
- **D029** — Camada de acesso server-side com service role, mapper explícito,
  leitura/escrita via Server Components/Actions, stubs de sync mantidos
- **D030** — Auth mock client-side expõe dados via SSR; Supabase Auth real vira
  pré-requisito de go-live (substitui parcialmente D021)

### Riscos conhecidos

- **Auth mock + `force-dynamic` + service role no SSR:** requests
  não-autenticados a `/admin/*` recebem HTML com dados dos contatos no payload
  (redirect pra login acontece tarde demais, no client). Inócuo em preview
  (banco vazio, sem cliente real), bloqueador pra produção. Resolução
  documentada em D030

### Pendências (fora do escopo deste lote)

- Reescrever Fase 1.11 do `docs/plano_de_desenvolvimento_site_v3.md` pra
  refletir o schema real (atualmente descreve schema antigo:
  `contact_submissions`/`user_profiles`/`admin_activity`)
- Criar `docs/SECURITY_GO_LIVE.md` com checklist de pré-produção (Supabase Auth
  real, proteção de rotas server-side, teste de payload SSR pra request anônimo)
- Tabelas `capture_origins` e `tags` no Supabase + types TS correspondentes
  (entram com a página de Configurações)
- Limpar resíduo de here-string PowerShell no `.gitignore` (linha 1 `@'` e
  última linha `'@ | Out-File ...`; não quebra ignore do `.env.local`,
  verificado)

---

## 2026-06-12 — Paleta: verde-pinheiro oficial (`#3F5B30`) aplicado em código

### Modificado

- **`src/app/globals.css`** — token `--color-green` atualizado de `#4DBF72`
  (provisório) para `#3F5B30` (verde-pinheiro oficial). Mudança propaga
  automaticamente para todos os usos via classes bare (`text-green`, `bg-green`,
  `border-green`, etc.).
- **`docs/identidade_visual.md`** — atualizado para versão 1.1: cabeçalho com
  nova fonte de verdade (`bb_lite_v3_spinhardi_complete.pdf`), tabela de paleta,
  restrição crítica reescrita (adjacência Navy / luminosidade próxima), variação
  verde da logo, aplicação por canal (Site, Instagram), seção de tokens
  completamente reescrita pra refletir o modelo Tailwind v4 CSS-first com
  `@theme` (substitui referências obsoletas a `tailwind.config.ts` que não
  existe), e nova regra de governança público/admin sobre uso do token vs escala
  numérica.
- **`docs/plano_de_desenvolvimento_site_v3.md`** e
  **`docs/plano_de_desenvolvimento_site_v2.md`** — referência do verde
  atualizada para `#3F5B30 (verde-pinheiro oficial — ver D027)`.
- **`docs/spinhardi_wireframe.html`** — token `--green` atualizado.

### Não modificado (decisão de governança)

- Classes `green-NNN` (escala numérica default do Tailwind) usadas no admin
  (`SyncBadge`, `StageBadge`, blog, login, configurações) — mantidas como estão.
  Convenção universal de UI ("verde = sucesso") preservada para interfaces
  internas.

### Validação

- `npx tsc --noEmit`, `npm run lint`, `npm run build` — zero erros / zero
  warnings
- Grep final: zero ocorrências do hex antigo em `src/` e nos docs (excluindo
  `CHANGELOG.md` e `DECISION_LOG.md`, que mantêm histórico)
- Validação visual confirmada: `/dev/components` renderiza verde-pinheiro
  escuro; admin mantém verdes vibrantes nos badges de
  sucesso/sincronizado/publicado

### Decisões aplicadas

- D027 — verde-pinheiro `#3F5B30` como cor oficial (aplicação em código
  registrada na própria D027)
- D006 — resolvida (verde provisório substituído pelo definitivo)

---

## 2026-06-11 — Paleta atualizada: Verde-pinheiro #3F5B30 substitui sage

### Adicionado

- **Branding Book Lite v3** (`bb_lite_v3_spinhardi_complete.pdf`) com
  Verde-pinheiro `#3F5B30` aplicado em todas as 38 ocorrências de cor visual e
  nos 4 trechos textuais que mencionavam o sage
- **Moodboard v1** montado no Canva, alinhado à nova paleta (escopo separado do
  BB)

### Modificado

- **Substituição global de cor no BB:** `#8CB89F` (sage) → `#3F5B30`
  (verde-pinheiro) em todas as 38 ocorrências do XML (bordas verticais
  decorativas e headings de subtítulos)
- **Seção "O Que Cada Cor Carrega":** restrição de uso reescrita (motivo mudou
  de baixo contraste para luminosidade próxima do Navy); regra de hierarquia
  atualizada com o novo nome, mantendo o status de coadjuvante
- **Seção "Aplicações por Canal":** linhas de Instagram e Site sobre uso do
  verde reescritas
- **Imagem da tabela de cores** (`image1.png`) refeita no Canva, agora exibe
  swatch Verde-pinheiro com hex `#3F5B30`
- **Imagem das variações da logo** (`image2.png`) refeita no Canva, variação que
  usava fundo sage agora usa Verde-pinheiro, ícone do arco italiano repintado

### Decisões registradas

- D027 — Verde-pinheiro `#3F5B30` substitui sage na paleta oficial (supera D006)

### Pendente

- Atualização dos tokens Tailwind no site (`spinhardi-preview.vercel.app`)
- Revisão de OG image e favicon se usarem o verde

---

## 2026-06-08 — Lote B v3: Módulo Contatos unificado + Dashboard híbrido + Configurações

### Adicionado

- **Camada de dados `src/lib/contacts/`** com interface `Contact` (~50 campos em
  10 agrupamentos), mocks com 8 contatos diversificados, 25+ interações,
  abstração `getContacts/getContactById/getContactInteractions/getContactStats`
  com filtros completos (estágio, origem, tags, sync, busca)
- **Camada de integração `src/lib/integrations/`** com stubs documentados do
  Iddas e ClickMassa retornando mock plausível seedado por data
- **Página `/admin/contatos`** — lista unificada com busca, 4 filtros, checkbox
  por linha, ações em massa (mock), paginação
- **Página `/admin/contatos/[id]`** — visão 360 com 3 colunas (Dados /
  Qualificação / Sistemas externos), gestão interna editável visualmente,
  timeline de interações
- **Página `/admin/contatos/novo`** — criação manual reutilizando form
  enriquecido
- **Dashboard `/admin/page.tsx`** completamente reescrito — 10 cards em 3 grupos
  (Hoje / Este mês / Métricas de integração), saudação dinâmica, 3 atalhos
- **Página `/admin/configuracoes`** — conteúdo real com 5 cards (Iddas,
  ClickMassa, Origens, Mensagem WhatsApp, Tags)
- **Componentes admin:** `DashboardCard`, `StageBadge` (9 cores por estágio),
  `SyncBadge` (2 ícones com tooltip)
- **Form do site enriquecido** em `src/components/ui/ContactForm.tsx` — 4 grupos
  visuais com 12 campos (6 obrigatórios), alinhado com qualificação de agência
  boutique e API do Iddas

### Modificado

- **Server Action `src/app/(public)/contato/actions.ts`** — recebe payload
  enriquecido (campos de qualificação completa), loga em mock por enquanto
- **AdminSidebar** — grupo "Admin" reduzido a 2 itens (Usuários, Configurações)

### Removido

- **Rota `/admin/integracoes`** — conteúdo absorvido por `/admin/configuracoes`

### Decisões registradas

- D024 — Spinhardi como source of truth de contatos
- D025 — Dashboard híbrido em 3 grupos
- D026 — Remoção da rota /admin/integracoes

---

[2026-06-07] SITE — Lote A: abstrações de auth/analytics + back office
estrutural + Route Groups Fundação técnica do back office. Após essa entrega, o
admin tem layout definitivo, login mock funcional, e a base pra plugar Supabase
Auth no Lote C está pronta. Camada de abstrações (src/lib/):

lib/auth/: interface AuthProvider, implementação mock via localStorage, stub
supabaseAuth com TODO pro Lote C, sistema de roles (admin/editor) com helper
hasPermission. Provider ativo exportado em index.ts — trocar mock por real é
mudança de 1 linha. lib/analytics/: interface AnalyticsProvider, implementação
mock com números plausíveis seedados por data/hora (parece "vivo"), stub
ga4Analytics com TODO pra Fase 4. 6 métricas mapeadas: visitas, cliques
WhatsApp, envios de form, conversas ativas, reservas, posts publicados.

Refactor estrutural (Route Groups):

Todas as 8 páginas públicas movidas pra src/app/(public)/ via git mv (preserva
histórico). URLs intactas — parênteses do Route Group não afetam o caminho. Novo
root src/app/layout.tsx minimal: só html, body, fontes (Fraunces + Montserrat),
metadata global. Sem chrome. Novo src/app/(public)/layout.tsx com chrome público
(Header, Footer, BackToTop) — substitui o que estava no root. Import absoluto em
ContactForm.tsx corrigido (@/app/contato/actions →
@/app/(public)/contato/actions) — único caso de import absoluto em todo o
código.

Back office estrutural (src/app/admin/):

middleware.ts na raiz: matcher /admin/:path*, libera /admin/login*, demais
validadas client-side via AdminLayout (limitação Edge runtime + localStorage).
Validação real server-side chega no Lote C com Supabase. AdminSidebar.tsx: 6
itens em 2 grupos (Navegação: Dashboard, Contatos, Blog · Admin: Usuários,
Integrações, Configurações). Filtragem por hasPermission(role, item.href).
Emojis como placeholders de ícones (substituídos por lucide-react em sessão de
polimento futura). AdminHeader.tsx: navy sólido, link "Spinhardi · Admin",
toggle de role apenas em dev (Admin/Editor), nome + role do usuário + botão
"Sair". admin/layout.tsx definitivo: Client Component, valida sessão via
auth.getUser() no useEffect, redireciona pra /admin/login se sem sessão, pra
/admin se sem permissão. Login renderiza sem chrome admin (detectado via
pathname). admin/login/page.tsx: formulário magic link + aviso amarelo "Modo
desenvolvimento" + link gold "Simular clique" (apenas em dev).
admin/login/verificar/page.tsx: callback do mock, chama verifySession() e
redireciona. admin/page.tsx: dashboard placeholder ("Dashboard híbrido virá no
próximo lote").

Decisões de execução do Codinho registradas no commit:

Metadata do root layout preservada do projeto original (não a genérica do
wireframe). setLoading(false) síncrono em early-return removido por violação de
react-hooks/set-state-in-effect (era código morto — early-return acontecia antes
de loading ser lido).

Validação: 21 rotas geradas, 12 testadas via HTTP (todas 200), separação de
chrome confirmada (público com Header/Footer, /admin/login sem chrome). Site
público funcionando após refactor de Route Groups. 2 bugs identificados em teste
visual e corrigidos em sessão dedicada:

Bug 1: toggle de Editor não filtrava sidebar. Causa: PERMISSIONS do editor tinha
"/admin" e match usava startsWith, então /admin/usuarios casava com /admin e
editor via tudo. Correção: nova convenção em PERMISSIONS — paths exatos (sem /_)
vs paths com filhos (/admin/blog/_). Editor passa de ["/admin", "/admin/blog",
"/admin/contatos"] para ["/admin", "/admin/blog/_", "/admin/contatos/_"].
hasPermission distingue match exato (path === perm) de match com filhos
(perm.endsWith("/*")). Bug 2: usuário preso no login após re-login. Causa: React
Strict Mode em dev invoca useEffect 2x, a primeira chamada de verifySession
consumia pending-email e criava sessão, a segunda achava pending-email vazio e
redirecionava pra /admin/login. Como ambas rodavam em paralelo, a segunda
vencia. Correção: verifySession virou idempotente — se já existe sessão no
localStorage, retorna ela direto sem mexer no pending-email. Strict Mode
permanece ligado (não esconder sintomas).

Diagnóstico autônomo do Codinho lendo o código identificou ambas as causas com
alta confiança antes da reprodução visual. Instrumentação temporária
(DebugPanel + console.logs estruturados com prefixos [auth-mock],
[admin-layout], [admin-header], [verificar]) foi adicionada mas removida
totalmente após confirmação. grep final em src/ confirma zero resíduo. Refs:
Fases 1.5 e 1.7 do plano v3. Wireframe em
docs/wireframe_lote_a_auth_e_back_office.md. Decisões D021, D022 e D023
registradas no DECISION_LOG.

[2026-06-06] SITE — Fase 1.4: Blog público + Admin do blog com 3 posts da Amanda
Fase 1.4 fechada. Após essa entrega, o blog está navegável publicamente com 5
posts (3 completos escritos pela Amanda + 2 esqueletos) e o admin tem UI
completa pronta pra receber CRUD funcional via Sanity na Fase 3. Camada de dados
(src/lib/blog/):

types.ts: interface Post + 4 categorias tipadas (Destinos, Bastidores, Dicas de
Viagem, História da Agência) mock-posts.ts: 5 posts com 3 corpos integrais
transcritos do mapa de copies (linhas 290-344, 346-406, 407-473 — "Como escolher
o destino certo", "10 coisas antes de montar um roteiro", "O que ninguém te
conta sobre Europa") + 2 esqueletos com corpo curto ("publicado em breve")
index.ts: abstração getPosts/getPostBySlug + stubs createPost, updatePost,
deletePost que lançam erro "vem com Sanity na Fase 3". Plug no Sanity é mudança
de implementação dessas funções — páginas que consomem não mudam.
src/lib/utils/date.ts: helper formatDate centralizado em PT-BR.

Telas públicas:

/blog: Server Component pro cabeçalho + Client Component (BlogClient.tsx) pra
filtros + grid. 5 pills clicáveis (Todos + 4 categorias). Filtragem
frontend-only sem query params (decisão deliberada — simplicidade).
/blog/[slug]: post individual com generateStaticParams (5 rotas SSG) +
generateMetadata dinâmico por post. Tipografia editorial em coluna estreita
(max-w-3xl). Renderização markdown-leve manual sem dependência externa: ## vira
h3 Fraunces 2xl navy, parágrafos por \n\n. CTAs finais dos posts da Amanda
([Entre em contato com a Spinhardi Turismo]) saem do body e viram Bloco 3
visual.

Telas admin (sem auth ainda — middleware vem no Lote A):

Layout admin temporário criado em src/app/admin/layout.tsx — substituído pelo
definitivo no Lote A. /admin/blog: tabela com 5 colunas (Título, Categoria,
Data, Status, Ações), badges de status verde/amarelo, link "+ Novo post".
/admin/blog/novo e /admin/blog/[id]: forms idênticos via componente reutilizável
PostForm.tsx (Client Component). Botões "Salvar como rascunho" e "Publicar"
lançam alert "Implementação completa virá com Sanity (Fase 3)".

Header: /blog adicionado a LIGHT_ROUTES (cobre /blog/[slug] via startsWith).
/admin/* NÃO entra — admin teria Header próprio no Lote A. Decisões de execução
do Codinho registradas no commit:

Excerpt do Post 1 da Amanda é literalmente a 1ª frase do texto; corpo começa na
2ª frase pra evitar duplicação visual com o lead em italic. Convenção de heading
no body: ## → h3 (Fraunces 2xl navy). Os 2 documentos (wireframe e renderBody)
concordavam no prefixo, divergiam no nível semântico. Codinho seguiu o resultado
visual. BlogCard NÃO foi envolvido em <Link> externo — já tem <Link> interno;
envolver geraria <a> dentro de <a> (HTML inválido + erro de hidratação).
Hover-lift movido pra dentro do componente. Ajuste em BlogCard.tsx: thumbnail
agora string | null (placeholder cinza já existia, render inalterado).
eslint.config.mjs: argsIgnorePattern: "^_" adicionado pra honrar convenção
idiomática de args intencionalmente não-usados nos stubs de CRUD.

Refs: Fase 1.4 do plano v3. Wireframe em docs/wireframe_blog_publico_e_admin.md.
2 melhorias pendentes pra Fase 3 com Sanity registradas: agendamento de post +
upload real de foto no admin.

[2026-06-05] SITE — Fase 1.3 refinamento de UI global: Breadcrumb padronizado +
BackToTop Após construção do /contato + 404 + error, ficou claro que só
/viagens/pacotes e /viagens/sob-medida tinham breadcrumb. Antes de partir pro
blog (que herda o padrão desde o nascimento), padronização global em sessão
curta. 2 componentes novos:

src/components/ui/Breadcrumb.tsx: Server Component puro, recebe array tipado
levels: BreadcrumbLevel[] (label + href opcional). Último item nunca é link
(proteção via isLast), mesmo se receber href. aria-label padrão WAI-ARIA.
Convenção: primeiro nível é sempre Home (href "/"), último é sempre página atual
(sem href). src/components/ui/BackToTop.tsx: Client Component, aparece após
600px de scroll, fixed bottom-6 right-6 no mobile / lg:bottom-8 lg:right-8 no
desktop, círculo navy 48x48 com seta gold, z-40 (1 abaixo do Header z-50),
shadow-lg shadow-dark/30 pra contraste mesmo quando cai sobre o Footer navy.
Sempre montado, transição via opacity + pointer-events. Scroll suave ao clicar.

Layout global: <BackToTop /> adicionado a src/app/layout.tsx após

<Footer /> — aparece em todas as rotas.
Breadcrumb adicionado em: /sobre, /viagens, /contato (não tinham).
Breadcrumb refatorado em: /viagens/pacotes e /viagens/sob-medida
(substituir JSX inline pelo componente + adicionar "Home" no início do array —
antes começavam em "Viagens").
Decisões de execução do Codinho registradas no commit:

Import morto de Link removido em /viagens/pacotes e /viagens/sob-medida após
refactor — era usado só no breadcrumb inline antigo. grep confirmou zero outros
usos. BackToTop com responsividade explícita bottom-6 right-6 mobile e
lg:bottom-8 lg:right-8 desktop, evitando colar na borda em telas pequenas.
Classes hover:bg-navy hover:text-gold redundantes removidas (eram no-ops — a
base já é bg-navy text-gold). Apenas hover:scale-105 mantido como hover real.

Decisão de UX confirmada com Alan: sem botão flutuante "Voltar pra Home" — logo
do Header já cumpre essa função. Breadcrumb + BackToTop bastam, sem UI
redundante. Refs: Fase 1.3 (refinamento) do plano v3.

[2026-06-05] SITE — Fase 1.3 fechamento: /contato + not-found + error global 3
entregas numa sessão. Contato é a página final do site público; 404 e error são
telas estruturais que fechavam a Fase 1.3. /contato (2 blocos, fundo branco):

Cabeçalho: breadcrumb (adicionado posteriormente em refinamento global) +
eyebrow "Contato" + título "Vamos conversar" + subtítulo "Sem compromisso. Sem
pressão. Me conte o que você tem em mente e a gente pensa juntos." Grid 2
colunas (5/12 + 7/12): lista de contatos à esquerda (WhatsApp, Instagram,
Localização, Horário — cada um com label gold uppercase + linha principal
Fraunces navy + linha secundária descritiva em Montserrat dark/70)

formulário à direita (4 campos: Nome, WhatsApp, Destino com select de 6 opções
do mapa, Mensagem).

Server Action mockada: src/app/contato/actions.ts simula latência (setTimeout
1s) + console.log estruturado. Sem persistência real — plug no Supabase na Fase
1.11 (decisão estratégica: Supabase em SQL lote único no final). E-mail também
mockado em console.log — Resend entra na Fase 3. Estado de sucesso inline: form
some, aparece card com ✓ gold, "Mensagem recebida.", botão "Abrir WhatsApp →".
Sem redirect pra rota separada. not-found.tsx global: Server Component, fundo
navy, "404" Fraunces 9xl gold, "Página não encontrada" branco, descrição + 2
CTAs (Voltar pra Home + Falar com a gente via WhatsApp). Tom sóbrio sem piadas
(Spinhardi não é marca brincalhona). error.tsx global: Client Component
obrigatório no Next 16 (error boundaries são sempre Client). Sem número "500"
(decisão UX), apenas "Algo deu errado." em Fraunces grande. 2 CTAs: "Tentar de
novo" chama reset(), "Voltar pra Home" linka pra /. useEffect loga o erro no
console (futuro Sentry). Header: /contato adicionado a LIGHT_ROUTES. 404 e error
NÃO entram — fundo navy, Header dinâmico já funciona neles. Decisões fixadas:

Sem campo de e-mail no formulário — mapa pede só Nome, WhatsApp, Destino,
Mensagem. WhatsApp é o canal preferencial da Spinhardi. Sem anti-spam nesta fase
— honeypot vem na Fase 3, sem reCAPTCHA (atrito demais). Mensagem de sucesso
inline, sem /contato/obrigado separada — UX mais limpa. Sem rascunho local no
localStorage — overkill pra essa etapa.

Confirmações de assinatura registradas pelo Codinho: Button estende
ButtonHTMLAttributes<HTMLButtonElement> via spread — aceita type="submit",
disabled, onClick nativamente. CTAWhatsApp aceita prop label custom. Tokens
(font-display, duration-short, navy/gold/dark, classes red-50/200/800) todos
disponíveis. Refs: Fase 1.3 do plano v3. Wireframe em
docs/wireframe_contato_404_error.md.

---

### [2026-05-31] SITE — Fase 1.3 navegação principal completa: Sobre, Viagens hub, Pacotes, Sob Medida

Quatro páginas construídas em sequência durante esta sessão. Todas em fundo
branco (D018 — `LIGHT_ROUTES` validado em produção real pela primeira vez na
Sobre), todas com Header navy sólido desde o pixel 0, todas com copies literais
do mapa de copies aprovado pela Amanda.

**`/sobre` — Página Sobre a Spinhardi (5 blocos):**

- Cabeçalho (branco): eyebrow "Nossa história", título "Uma agência construída à
  mão. Por quase quatro décadas.", subtítulo introdutório
- Foto da equipe (branco): placeholder inline aspect 16:9 — substituível por
  foto real quando Nina e Julia indicarem
- Linha do tempo (navy): 4 momentos históricos (1987 / 1987–2012 / 2024 /
  Atualmente), grid 12 colunas (período à esquerda em Fraunces gold, conteúdo à
  direita), divisores sutis
- Valores expandidos (branco): grid de 4 colunas (Presença Real, Cuidado com o
  Detalhe, Transparência, História e confiança) — versão expandida do que
  aparece na Home
- CTA Final (branco, centralizado): "Quer conversar com a gente?" + WhatsApp

Mudança no Header: `/sobre` adicionado a `LIGHT_ROUTES`. Primeira página real
com fundo claro do projeto — confirma que D018 funciona em produção.

**`/viagens` — Hub de Viagens (3 blocos):**

- Cabeçalho (branco): eyebrow "Viagens", título "Como podemos ajudar na sua
  próxima viagem", subtítulo
- 2 cards grandes (branco): Pacotes e Roteiros + Viagem Sob Medida. Cards
  inteiros clicáveis com placeholder de imagem aspect 4:3, número Fraunces gold,
  título navy, descrição cinza, "Ver mais →" em gold com animação no hover. Sem
  botão Button — link envolve o card todo.
- CTA Final (branco, centralizado): "Não sabe por onde começar?" + WhatsApp

Mudança no Header: `/viagens` adicionado a `LIGHT_ROUTES`. Via
`pathname.startsWith()`, cobre automaticamente as subpáginas (`/viagens/pacotes`
e `/viagens/sob-medida`) — uma linha cobre o braço inteiro.

Decisão pontual do Codinho: remoção de classes Tailwind no-op
(`transition-colors duration-short group-hover:text-gold` num elemento já
`text-gold`). Mantém consistência com Sobre e elimina código morto. Aprovado.

**`/viagens/pacotes` — Pacotes e Roteiros (2 blocos):**

- Cabeçalho com breadcrumb (branco): "Viagens / Pacotes e Roteiros" — "Viagens"
  clicável, título "Pacotes pensados para quem quer ir e voltar tranquilo.",
  subtítulo
- Grid 2 colunas (branco): lista numerada 01–05 ("O que está incluído" —
  passagem, hospedagem, transfers, seguro, suporte) à esquerda + card destacado
  **navy** sticky à direita ("Próximos destinos disponíveis", CTA "Quero saber
  mais")

**`/viagens/sob-medida` — Viagem Sob Medida (2 blocos):**

- Cabeçalho com breadcrumb (branco): "Viagens / Viagem Sob Medida", título "Cada
  detalhe de acordo com o que você quer viver.", subtítulo
- Grid 2 colunas (branco): lista numerada 01–05 ("Como funciona" — conversa,
  briefing, proposta, aprovação, suporte) à esquerda + card destacado **branco
  com border gold** sticky à direita ("Para quem é", CTA "Quero minha viagem sob
  medida")

Diferenciação visual intencional entre os 2 cards destacados: Pacotes em fundo
navy (sóbrio), Sob Medida com border gold (premium feel — mapa especifica "card
destacado em ouro").

**Padrões comuns às 4 páginas:**

- Sem componentes novos. Composição inline reaproveitando o Design System.
- Sem imagens reais — placeholders nos slots de foto, substituíveis quando Nina
  e Julia indicarem.
- Sem Bloco 3 CTA Final nas subpáginas de Viagens — card destacado já tem CTA
  forte, segundo CTA seria redundância.
- Metadata individual em cada página (`title` específico, descrição extraída do
  mapa).
- Lint, format, typecheck e build OK em todas. SSG estático prerenderizado nas 4
  rotas.

---

### [2026-05-31] DECISÃO — D020 registrada: Passagens Avulsas vira interface de booking operacional na Fase 4

Passagens Avulsas permanece listada na Home como um dos 3 serviços, mas **não
recebe página dedicada na Fase 1**. ServiceCard correspondente já aponta pra
/viagens (hub) — comportamento já implementado e consistente com a decisão. Será
endereçada na Fase 4 pós-launch como interface de booking operacional,
possivelmente em rota separada (`/passagens` ou `/reservas`), com integração
IDAS + ClickMassa. Ver DECISION_LOG para racional completo.

---

### [2026-05-31] SITE — Página Home (`/`) construída — primeira página real do site

`src/app/page.tsx` substituída: saiu a página de validação de tokens, entrou a
Home oficial seguindo o mapa de copies aprovado pela Amanda. Estrutura em 6
blocos verticais:

1. **Hero** (navy): eyebrow gold, título Fraunces grande, subtítulo Montserrat,
   CTAs "Vamos conversar" (primary gold) + "Nossa história" (secondary outline
   gold)
2. **Posicionamento + 4 valores** (navy): cabeçalho com título e parágrafo +
   grid responsivo (1/2/4 colunas) dos 4 valores em layout inline
3. **Serviços** (navy): 3 ServiceCards numerados (Passagens, Pacotes, Sob
   Medida)
4. **História/1987** (branco — contraste editorial intencional no meio da página
   navy): grid 40/60 com "1987" gigante em Fraunces à esquerda + texto, quote em
   TestimonialCard, CTA "Ver história completa" à direita
5. **Depoimentos** (navy): grid responsivo (1/2/3 colunas) de 3 TestimonialCards
   com depoimentos reais
6. **CTA Final** (navy, centralizado): "Vamos conversar" + "Nosso blog"

Copies literais do mapa aprovado. Sem imagens (placeholders descartados — fotos
reais virão por indicação de Nina e Julia).

Componentes adaptados no Design System:

- `ServiceCard`: adicionada prop `tone="light" | "dark"` (default `light`).
  Funciona em fundo claro (comportamento original) e fundo navy (texto branco,
  border-white/10).
- `TestimonialCard`: adicionada prop `tone="light" | "dark"` (default `light`).
  Funciona em fundo claro (bg-white) e fundo navy (bg-white/5). Prop `context`
  confirmada como opcional.
- `src/app/dev/components/page.tsx`: seções 5 (ServiceCard) e 6
  (TestimonialCard) atualizadas mostrando ambas as variações `light` e `dark`
  lado a lado.

`/` ainda usa Header dinâmico (hero navy permite). Validação visual aprovada em
desktop. Lint e format sem issues.

---

### [2026-05-31] BUGFIX — Regras CSS base movidas para @layer base (corrige links invisíveis em fundos escuros)

Detectado durante a validação visual da Home: links de navegação do Header e
CTAWhatsApp ficavam invisíveis sobre fundo navy mesmo com `text-white` aplicado
no JSX. Codinho diagnosticou causa raiz no `globals.css` — regras base (`body`,
`h1..h6`, `a`) escritas fora de qualquer `@layer` atropelavam utility classes do
Tailwind v4 na cascata do CSS.

Correção em `src/app/globals.css`: envolvidas as regras base num bloco
`@layer base { ... }`. `scroll-padding-top` também ficou dentro do bloco por
consistência. Sem mudança em outros arquivos. Sem novas dependências.

Resultado: utility classes voltam a vencer na cascata. Links agora renderizam
corretamente nas cores aplicadas (`text-white`, hover `text-gold`) em qualquer
fundo. Bug invisível em fases anteriores porque `/dev/components` tem fundo
branco — único contexto até então onde links eram testados em contraste real.

Ver DECISION_LOG D019 para racional completo e regra operacional a seguir.

---

### [2026-05-31] DECISÃO — D019 registrada: regras CSS base devem estar em @layer base no Tailwind v4

Decisão D019 registrada. Seletor de elemento HTML "puro" sem classe (`body`,
`h1..h6`, `a`, e futuros como `button`, `input`) no `globals.css` deve estar
dentro de `@layer base { ... }`. Regras fora de qualquer `@layer` no Tailwind v4
sempre vencem regras com layer na cascata do CSS — atropelam utility classes
silenciosamente. Segundo gap silencioso descoberto na fundação do Tailwind v4
(depois de D016 sobre namespaces customizados). Ver DECISION_LOG para racional
completo e regra operacional.

---

### [2026-05-31] SITE — Fase 1.2 (Design System) concluída

Fundação visual do projeto completa. Cinco blocos entregues e validados:

- **Bloco 1:** Tokens de design via `@theme inline` (Tailwind v4 CSS-first),
  fontes Fraunces + Montserrat via `next/font/google`, layout base
- **Bloco 2:** Componentes atômicos (Container, Section, Divider)
- **Bloco 3:** Button (3 variantes, 3 sizes, disabled, focus visível) e 3 Cards
  (ServiceCard numerado, TestimonialCard com border-l gold, BlogCard com imagem
  16:9 e line-clamp)
- **Bloco 4:** Logo (3 variantes: clara, escura, icone) e CTAWhatsApp
  parametrizado com helper `buildWhatsAppURL()`
- **Bloco 5:** Header dinâmico (Client Component com `usePathname` + scroll
  listener), MobileMenu full-screen (focus-trap, ESC, scroll-lock), Footer 4
  colunas, integração no `app/layout.tsx`

Página `/dev/components` em http://localhost:3000/dev/components serve como
referência viva do design system — 11 seções de validação (componentes 1-9
inline + Header e Footer documentados textualmente porque já vivem no layout
global).

Decisões registradas durante a fase: D013 (tooling), D014 (Fraunces +
Montserrat), D015 (Container minimalista), D016 (utility explícito pra tokens de
duração), D017 (SVGs raster como dívida técnica), D018 (Header detecta rota via
usePathname). `docs/DESIGN_SYSTEM.md` descartado — página `/dev/components`
cumpre função melhor.

Pendência registrada: refazer logo-icone.svg como vetor antes de virar favicon
(D017). Próxima fase: construção das páginas reais (Home, Sobre, Viagens, Blog,
Contato).

---

### [2026-05-31] SITE — Bloco 5 da Fase 1.2 concluído: Header, MobileMenu, Footer e layout global

Criados 3 componentes em `src/components/ui/`:

- `Header.tsx` (Client Component): sticky com `position: fixed`, altura `h-20`,
  `z-50`. Detecta rota via `usePathname` — em rotas claras (`LIGHT_ROUTES`)
  começa já sólido (navy + sombra); em rotas com hero navy mantém comportamento
  dinâmico (transparente → sólido após 80px de scroll). Logo `logo-clara` com
  `priority`, links em `text-white` com hover gold, CTA "Fale com a gente"
  reutilizando CTAWhatsApp variant secondary. Listener com `{ passive: true }`,
  early-return em rota clara pra evitar trabalho desnecessário.
- `MobileMenu.tsx` (Client Component): overlay full-screen montado sempre (com
  `opacity-0 pointer-events-none -translate-y-4 inert` quando fechado), permite
  transição fade+slide na entrada e na saída. Focus-trap circular com Tab, foco
  inicial no botão X, ESC fecha, scroll do body trava com cleanup que restaura
  valor anterior. ARIA completo (`role="dialog"`, `aria-modal`, `aria-label`,
  `aria-expanded`, `aria-controls`).
- `Footer.tsx` (Server Component): 4 colunas com layout responsivo (1 / 2 / 4
  colunas conforme breakpoint), seguindo conteúdo aprovado pela Amanda — Marca
  (logo + texto), Páginas, Serviços, Contato. Rodapé inferior com copyright e
  link pra Política de privacidade. WhatsApp via `buildWhatsAppURL()`, Instagram
  externo com `target="_blank"`.

Criado `src/lib/navigation.ts` — fonte única de verdade dos links de navegação
(`NAV_LINKS`, `FOOTER_PAGE_LINKS`, `FOOTER_SERVICE_LINKS`). Header, MobileMenu e
Footer consomem dessa única origem. Mudança futura em rota muda em um lugar só.

`src/app/layout.tsx` atualizado com `<Header />` + `<main>{children}</main>` +
`<Footer />` envolvendo o conteúdo de cada rota. `src/app/globals.css` ganha
`scroll-padding-top: 5rem` no `html` pra compensar Header fixed em navegação por
âncora (#id) — recomendação explícita da doc oficial do Next 16.
`src/app/page.tsx` e `src/app/dev/components/page.tsx` ajustadas (removido
`<main>` interno pra evitar HTML inválido com main aninhado).

`src/app/dev/components/page.tsx` ganha seções 10 (Header) e 11 (Footer) como
documentação textual — Header e Footer já são visíveis em toda rota via layout
global, renderizar uma segunda cópia inline seria HTML inválido e redundância
visual.

Validação visual aprovada em desktop e mobile (390px) por Alan. Lint, format e
typecheck sem issues. `next.config.ts` não modificado.

---

### [2026-05-31] DECISÃO — D018 registrada: Header detecta rota clara via usePathname

Decisão D018 registrada. Header global no `layout.tsx` adapta seu fundo conforme
rota atual: em rotas listadas em `LIGHT_ROUTES` começa já sólido (navy +
sombra), em demais rotas mantém comportamento dinâmico (transparente no topo,
sólido após scroll). Implementação via `usePathname()` do Next 16. Hoje
`LIGHT_ROUTES = ["/dev/components"]`. Lista cresce conforme páginas com fundo
claro forem criadas. Ver DECISION_LOG para racional completo.

---

### [2026-05-31] SITE — Bloco 4 da Fase 1.2 concluído: Logo e CTAWhatsApp

Criados 2 componentes específicos de marca em `src/components/ui/`:

- `Logo.tsx`: 3 variantes (clara, escura, icone), defaults de dimensão por
  variante (240×80 pra clara/escura, 40×40 pra icone), alt semântico adaptado
  por variante, prop `priority` pra above-the-fold, usa `next/image` com
  `unoptimized` automático em SVG (Next 16 default)
- `CTAWhatsApp.tsx`: link `<a>` estilizado reaproveitando `buttonStyles()`
  extraído do Button, abre `wa.me/5519997761226` em nova aba, com mensagem
  placeholder customizável

Refactor de suporte:

- `Button.tsx` agora exporta `buttonStyles(variant, size, className)` e tipos
  `ButtonVariant`/`ButtonSize` — fonte única de estilo compartilhada entre
  Button e CTAWhatsApp, evita duplicação

Nova constante operacional:

- `src/lib/whatsapp/constants.ts` com `WHATSAPP_NUMBER`,
  `WHATSAPP_DEFAULT_MESSAGE` e helper `buildWhatsAppURL()`

`src/app/dev/components/page.tsx` atualizada com seções 8 (Logo) e 9
(CTAWhatsApp). A demo do CTAWhatsApp usa `pointer-events-none` num wrapper com
aviso visual claro pra não disparar abertura acidental do WhatsApp durante
validação — solução server-side pura.

Validação visual aprovada por Alan. `npm run lint`, `npm run format:check` e
`npx tsc --noEmit` rodando sem erros. `next.config.ts` não modificado.

---

### [2026-05-31] DECISÃO — D017 registrada: SVGs com raster embutido aceitos como dívida técnica formal

Decisão D017 registrada. Os 3 arquivos de logo exportados do Canva
(`logo-clara.svg`, `logo-escura.svg`, `logo-icone.svg`) contêm PNG raster
embutido em vez de vetor real. `logo-icone.svg` pesa 288 KB (esperado <10 KB pra
vetor). Aceito como dívida técnica formal na v1; componente `Logo.tsx` já está
pronto pra troca dos arquivos sem alteração de código. Prioridade de refazer é o
`logo-icone` (vai virar favicon). Ver DECISION_LOG para racional completo.

---

### [2026-05-31] DOC — Nomenclatura das variações da logo esclarecida no identidade_visual.md

Seção "Variações e quando usar" do `docs/identidade_visual.md` reescrita. A
nomenclatura antiga ("Principal escura", "Clara") misturava cor da logo com
fundo de aplicação, gerando ambiguidade. Nova convenção: nome do arquivo
descreve a cor do conteúdo visual da logo (não do fundo onde vai). Tabela
ampliada com composição explícita de cada variação. Convenção documentada como
nota final pra alertar quem for usar.

---

### [2026-05-31] SITE — Bloco 3 da Fase 1.2 concluído: Button e Cards

Criados 4 componentes em `src/components/ui/`:

- `Button.tsx`: 3 variantes (primary, secondary, ghost), 3 sizes (sm, md, lg),
  estado disabled, focus visível com ring gold, ghost ignora padding das sizes
  mantendo só text-size
- `ServiceCard.tsx`: card numerado pra lista de serviços/viagens (estilo
  buchwalder-linder, ver `referencias_design.md` seção 4), com `<Link>` do Next,
  hover satura número e gradua título pra gold via group-hover
- `TestimonialCard.tsx`: `<blockquote>` com border-l gold, aspas decorativas em
  Fraunces opacas, quote italic, autor e contexto
- `BlogCard.tsx`: `<article>` com imagem 16:9 (next/image com fill ou
  placeholder), hover scale na imagem, tag de categoria em uppercase gold,
  título Fraunces, excerpt com line-clamp-2

Atualizada `src/app/dev/components/page.tsx` com 4 novas seções de validação
(Button, ServiceCard, TestimonialCard, BlogCard), mantendo padrão de bordas
dashed e exemplos de código.

`globals.css` ajustado com 3 `@utility` explícitos pra tokens de duração (ver
D016) — correção de gap detectado pelo Codinho durante implementação.

Validação visual aprovada por Alan. `npm run lint` e `npm run format:check`
rodando sem erros.

---

### [2026-05-31] DECISÃO — D016 registrada: tokens customizados exigem @utility explícito no Tailwind v4

Decisão D016 registrada. Tokens de duração (`--duration-short`,
`--duration-medium`, `--duration-long`) não geravam utility classes
automaticamente — apenas namespaces padrão do Tailwind v4 (color, font, spacing,
breakpoint, ease) têm geração automática. Adicionados `@utility` explícitos no
`globals.css`. Regra operacional registrada: validar geração de utility ao
definir token novo no `@theme`. Ver DECISION_LOG para racional completo.

---

### [2026-05-31] SITE — Bloco 2 da Fase 1.2 concluído: componentes atômicos

Criados 3 componentes atômicos do Design System em `src/components/ui/`:

- `Container.tsx`: max-w-7xl centralizado, padding horizontal responsivo, prop
  `as` (div/section/article/main) pra flexibilidade semântica
- `Section.tsx`: espaçamento vertical padronizado, prop `spacing` (sm = py-12,
  md = py-20, lg = py-32)
- `Divider.tsx`: linha divisória sutil, prop `tone` (light = sobre fundo escuro,
  dark = sobre fundo claro)

Criada página de validação visual em `src/app/dev/components/page.tsx` (rota
`/dev/components`) com demonstração interativa, bordas dashed marcando limites
dos componentes, e exemplos de código pra referência.

`src/app/page.tsx` refatorado: home base agora consome `<Section>` e
`<Container>` do Design System em vez de classes hardcoded. Mudança visual
aceita por princípio de modularidade (ver D015) — Container do DS define largura
e centralização; a página `/` é provisória.

Todos os componentes em TypeScript estrito, Server Components puros (sem
`"use client"`), sem dependências novas. `npm run lint` e `npm run format:check`
rodando sem erros.

---

### [2026-05-31] DECISÃO — D015 registrada: Container como esqueleto puro

Decisão D015 registrada. Container do Design System tem responsabilidade única
(largura máxima, centralização, padding horizontal). Decisões de alinhamento e
composição ficam nos componentes consumidores. Ver DECISION_LOG para racional
completo.

---

### [2026-05-31] SITE — Bloco 1 da Fase 1.2 concluído: tokens, fontes e layout base

`src/app/globals.css` reescrito com tokens de design via `@theme inline` (padrão
Tailwind v4 CSS-first, sem `tailwind.config.ts`). Cores (`navy`, `gold`,
`green`, `dark`, `white`), tipografia (`--font-display`, `--font-body`), easings
e durações registrados como CSS variables. `src/app/layout.tsx` reescrito
carregando Fraunces (display) e Montserrat (body) via `next/font/google`, com
metadata real da Spinhardi e `lang="pt-BR"`. `src/app/page.tsx` substituído por
página de validação visual dos tokens — não é a home final, só prova de
fundação. Validação visual aprovada por Alan: cores aplicadas, fontes
carregando, hierarquia tipográfica funcional. `npm run dev`, `npm run lint` e
`npm run format:check` rodando sem erro.

---

### [2026-05-31] DECISÃO — D014 registrada: Fraunces + Montserrat via Google Fonts

Decisão D014 registrada. Fraunces adotada como fonte de display em lugar de TT
Fors Display (fonte comercial do Branding Book). Montserrat mantida como fonte
de body. Ambas via `next/font/google` com pesos selecionados. Ver DECISION_LOG
para racional completo.

---

### [2026-05-29] SITE — Fase 1.1 (Fundação local) concluída

Projeto Next.js 16 inicializado e configurado. Versões: Next 16.2.6, React
19.2.4, Tailwind v4, TypeScript 5, ESLint 9, Turbopack como bundler default.
Estrutura de pastas criada conforme plano v2 (`src/` com `app/`,
`components/ui/`, `lib/{ai,blog,email,integrations,sanity,supabase}/`). Import
alias `@/*` apontando pra `./src/*`. Branch local renomeada de `master` pra
`main`. `.gitignore` final é merge entre o gerado pelo Next 16 e o nosso (cobre
Vercel, IDE, OS, Sanity, backups locais). README.md atualizado com estrutura
`src/`, Stack completa (Supabase + Sanity), variáveis de ambiente organizadas
por fase. Checkpoint validado: `npm run dev` roda sem erro, Prettier reporta
zero issues.

---

### [2026-05-29] DECISÃO — D013 registrada: tooling de desenvolvimento

Decisão D013 registrada. ESLint 9 + Prettier 3 configurados via
`eslint-config-prettier/flat` (padrão oficial do Next.js 16). Husky e
lint-staged descartados após reavaliação do tamanho real do time.
`eslint-plugin-prettier` instalado por engano e removido (padrão desencorajado
pela comunidade em 2026). Ver DECISION_LOG para racional completo.

---

### [2026-05-29] DOC — Plano de Desenvolvimento v2 substitui v1

Arquivo `docs/plano_de_desenvolvimento_site_v2.md` criado, substituindo a versão
anterior. Reflete todas as decisões fechadas em sessões de pesquisa e
revalidação (D007 a D012). Estrutura em 4 fases com checkpoints objetivos:
Fundação local, Revisão e iteração, Produção, Pós-launch. Princípios
não-negociáveis e filosofia de trabalho movidos pro topo do documento. Tabela de
fontes de verdade aprovadas criada como referência única.

---

### [2026-05-29] DECISÃO — D012 a D007 registradas

Seis decisões registradas após sessão de revalidação de stack: D007 (domínio
existente aproveitado), D008 (Vercel Pro obrigatório, supera D005), D009
(Supabase Pro no go-live), D010 (Resend pra transacional), D011 (GA4 + Search
Console + Vercel Analytics, Looker eliminado), D012 (Sanity como CMS, supera
D003). Decisões fundamentadas em pesquisa estruturada via Perplexity Pro + WHOIS
direto no Registro.br.

---

### [2026-05-29] INFRA — Supabase provisionado em ambiente de dev

Projeto Supabase criado (ID `grjkqljucszoaujmhgpi`). Conta administrada pela
Gattiboni (Alan), transferível via ferramenta nativa se contrato terminar.
Publishable key disponível pra cliente público. Schema mínimo a ser definido na
Fase 1.6 do plano de desenvolvimento.

---

### [2026-05-29] INFRA — Contato técnico do domínio atualizado

`spinharditurismo.com.br` agora tem Alan Gattiboni como contato técnico
habilitado no Registro.br. Substitui o registro anterior (e-mail antigo Hotmail
da Nina). Mudança garante que renovações e ajustes de DNS passem pela equipe
técnica sem depender de credenciais antigas.

---

### [2026-05-29] CONTRATO — Sócias aprovaram Plano de Infraestrutura

Nina e Julia aprovaram o Plano de Infraestrutura v1 com cenário de domínio
existente (`spinharditurismo.com.br` apenas, sem aquisição adicional). Cartão
virtual criado e dados repassados ao Alan. Pendência operacional única: criação
da conta Gmail dedicada da Spinhardi (tarefa do Alan, lá pra Fase 3).

---

### [2026-05-29] DOC — Mapa de Imagens v1 entregue

Arquivo `docs/mapa_de_imagens_spinhardi_v1.docx` finalizado. 8 grupos de imagens
organizados por papel na marca (não por slot individual), com specs técnicas e
de-para com slots do wireframe. Total: 25 imagens + 6 arquivos de marca. Vídeos
sugeridos como roadmap pós-v1.

---

### [2026-05-29] DOC — Mapa de Copies aprovado pela Amanda

Arquivo `docs/mapa_de_copies_spinhardi_v1_ready.docx` finalizado. Revisão da
Amanda incorporada. Documento serve como fonte única de verdade pro conteúdo
textual da v1 do site. Estrutura de status (Sólido/Refinar/Definir) ajudou a
focar revisão nos pontos certos.

---

### [2026-05-29] DOC — Plano de Infraestrutura v1 publicado

Arquivo `docs/plano_de_infraestrutura_spinhardi_v1.docx` criado e enviado pra
Nina e Julia. Documento informativo com linguagem direta, princípios das
decisões, justificativa de cada escolha técnica, custos consolidados em R$ e
quadro final com decisões pendentes de aprovação.

---

### [2026-04-28] DOC — Documentação de referências de design gerada

Arquivo `docs/refs/referencias_design.md` criado a partir de capturas reais de 4
sites de referência via script de extração de HTML/CSS. Mapeia 7 componentes
(navbar, hero, layout de rolagem, grade de serviços numerada, efeito de imagem,
blog grid, footer) com medidas extraídas do CSS computado e snippets de
implementação prontos para uso.

---

### [2026-04-28] DOC — Script de captura de referências de design criado

Script JavaScript para rodar no console do browser (F12) e exportar HTML, CSS
computado, fontes, cores e layout de qualquer página como JSON estruturado.
Exporta direto para `docs/refs/`. Usado para capturar as 4 referências do
projeto.

---

### [2026-04-28] DOC — Arquitetura de páginas v1 definida

Arquivo `docs/arquitetura_v1.md` criado com árvore de rotas, justificativa por
página e tabela de páginas deliberadamente excluídas do lançamento. Status:
proposta para aprovação por Nina e Julia via wireframe navegável.

Rotas definidas: `/` · `/sobre` · `/viagens` · `/viagens/pacotes` ·
`/viagens/sob-medida` · `/blog` · `/blog/[slug]` · `/contato`

---

### [2026-04-28] DESIGN — Identidade visual documentada para desenvolvimento

Arquivo `docs/identidade_visual.md` criado com paleta de 5 cores, tipografia,
variações de logo, regras de aplicação por canal e tokens prontos para
`tailwind.config.ts`. Verde provisório definido como `#4DBF72` (aguardando
aprovação das sócias ao ver aplicado).

---

### [2026-04-28] SITE — Plano de desenvolvimento v1 criado

Arquivo `docs/plano_de_desenvolvimento_site_v1.md` definido com 7 etapas
pré-launch e roadmap pós-launch. Stack confirmada: Next.js 14+ · Vercel ·
Tailwind · TypeScript. Princípios: incrementalidade, escalabilidade, zero dívida
técnica, documentação sempre atualizada.

---

### [2026-04-28] INFRA — Repositório GitHub criado

Repositório `Gattiboni/spinhardi_site` iniciado em
https://github.com/Gattiboni/spinhardi_site.git. Zerado — inauguração com a
primeira entrega funcional.

---

### [2026-04-28] DECISÃO — Stack definida: Next.js sem WordPress

Decisão D001 registrada. WordPress descartado em favor de Next.js + Vercel. Ver
DECISION_LOG para racional completo.

---

### [2026-04-28] CONTRATO — Proposta Presença Digital aprovada e assinada

Contrato anual fechado. Escopo: Branding Book Lite + site + ecossistema
integrado + gestão mensal de estratégia e ecossistema. Valor: R$ 1.300/mês (12
meses) ou R$ 12.000 à vista.

---

_Atualizar este arquivo a cada evento relevante, por menor que pareça. O log é
memória do projeto._
```
