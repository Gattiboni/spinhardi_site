# Plano de Desenvolvimento — Site Spinhardi v3.1

**Versão:** 3.1 (substitui v3.0 de abril 2026) **Stack:** Next.js 16 ·
TypeScript · Tailwind v4 · Vercel · Supabase · Sanity **Preparado por:** Alan
Gattiboni · Gattiboni Enterprises **Última atualização:** Junho 2026 (pós-Lote
C)

---

## O que mudou da v3.0

- **Fase 1.11 reescrita por completo.** A versão anterior descrevia tabelas
  fictícias (`contact_submissions`, `user_profiles`, `admin_activity`) que
  nunca refletiram a arquitetura real. A 1.11 agora descreve o que de fato foi
  construído no Lote C (tabelas `contacts` e `contact_interactions`, RLS,
  service role na Server Action), com referência às decisões D028, D029, D030
- **Fase 1.7 ganhou nota explícita** sobre D021 (auth mock client-side é o
  estado atual; Supabase Auth real foi adiado pra Fase 3)
- **Fase 3 ganhou item bloqueador** `3.1.0 Supabase Auth real` referenciando
  D030: pré-requisito de go-live, não mais "melhoria futura"
- **Fase 4 ajustada:** o dashboard de contatos já é real pós-Lote C; o que
  resta na Fase 4 são as integrações operacionais (Iddas, ClickMassa, Make)
  e os cards reais que dependem delas
- **Pendências técnicas atualizadas:** capture_origins/tags quando ligar
  Configurações, `SECURITY_GO_LIVE.md` a criar, limpeza do `.gitignore`

---

## Princípios não-negociáveis

1. **Incrementalidade.** Nenhuma decisão pode ser um impedimento óbvio para a
   próxima.
2. **Modularidade.** Preservar a liberdade da arquitetura pra plugar e desplugar
   qualquer coisa que seja pertinente.
3. **Zero dívida técnica.** Sem workaround, sem gambiarra, sem "depois a gente
   resolve".

## Filosofia de trabalho

- **Nunca presumir, nunca inferir.** Trabalhamos com certezas. Não sabermos algo
  é o primeiro estágio de sabermos algo melhor.
- **Sejamos sempre curiosos.** Combinação de skills humano + IA é onde a mágica
  acontece. Helluva team.
- **Quando faltar criatividade ou for inventar a roda, otimizar:** Perplexity
  Pro com prompt bem contextualizado, retorno trazido pra mesa, decisão tomada
  com dados.
- **Investigar realidade antes de modelar** (D024). Schema sai do código real,
  não de boas práticas genéricas.

---

## Como este plano funciona

Quatro fases. Cada fase tem **tarefas executáveis** com checkbox. Cada tarefa
tem dono implícito (Alan, salvo quando indicado).

- **Fase 1 — Fundação local:** construir tudo localhost. Sem custo. Sem cliente
  vendo.
- **Fase 2 — Revisão e iteração:** deploy temporário em Vercel free, revisão e
  ajustes finais.
- **Fase 3 — Produção:** contratar tudo que precisa pagar, ligar serviços,
  apontar DNS, go-live.
- **Fase 4 — Pós-launch:** integrações Iddas/ClickMassa/Make, camada de IA,
  melhorias contínuas.

**Cada fase termina com checkpoint claro.** Não passa pra próxima sem fechar a
anterior.

---

## Fontes de verdade aprovadas

| Documento                        | Localização                                        | O que define                            |
| -------------------------------- | -------------------------------------------------- | --------------------------------------- |
| Branding Book Lite v3            | `docs/bb_lite_v3_spinhardi_complete.pdf`           | Identidade de marca, tom, valores       |
| Identidade Visual                | `docs/identidade_visual.md`                        | Tokens CSS, paleta, tipografia          |
| Arquitetura de Páginas           | `docs/arquitetura_v1.md`                           | Rotas e justificativa                   |
| Mapa de Copies (aprovado Amanda) | `docs/mapa_de_copies_spinhardi_v1_ready.docx`      | Conteúdo textual da v1                  |
| Mapa de Imagens                  | `docs/mapa_de_imagens_spinhardi_v1.docx`           | Specs técnicas e papel das imagens      |
| Plano de Infraestrutura          | `docs/plano_de_infraestrutura_spinhardi_v1.docx`   | Decisões de stack e custo               |
| Wireframe HTML                   | `docs/spinhardi_wireframe.html`                    | Estrutura visual aprovada               |
| Wireframe Lote B v3              | `docs/wireframe_lote_b_v3.md`                      | Estrutura do back office (Contatos)     |
| Tipos do CRM                     | `src/lib/contacts/types.ts`                        | Shape de Contact, ContactInteraction    |
| Iddas API                        | `docs/Iddas_Agência_-_Documentação_API.pdf`        | Endpoints REST do ERP (Fase 4)          |
| ClickMassa API                   | `docs/ClickMassa_API.md`                           | Endpoints REST do WhatsApp CRM (Fase 4) |
| Referências de design            | `docs/refs/`                                       | CSS extraído dos sites de referência    |
| Decision Log                     | `docs/DECISION_LOG.md`                             | Histórico de decisões com racional      |
| Changelog                        | `docs/CHANGELOG.md`                                | Eventos e entregas em ordem cronológica |

---

# FASE 1 — Fundação local

**Estado de saída:** projeto Next.js rodando em localhost, com design system
aplicado, estrutura de pastas completa, todas as páginas públicas e do back
office implementadas, blog funcional com posts mockados, dashboard híbrido
operando com dados reais (Supabase para contatos) e mocks plausíveis (cards de
integração Iddas/ClickMassa).

**Sem contratações pagas nesta fase.** Tudo local ou em tier gratuito de dev.

---

## 1.1 Setup do repositório e fundação

- [x] Atualizar README.md (refletir Sanity em vez de MDX como CMS do blog)
- [x] Criar `.gitignore` cobrindo: `node_modules/`, `.env.local`, `.next/`,
      `.vercel/`, `*.log`, `.DS_Store` (merge com `.gitignore` gerado pelo
      Next 16)
- [x] Criar `.env.example` com chaves vazias documentadas (organizadas por fase)
- [x] Criar `.env.local` (fora do Git) com credenciais reais (Supabase já
      provisionado)
- [x] Inicializar projeto Next.js 16 com App Router, TypeScript e Tailwind v4:
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
  ```
  Versões instaladas: Next 16.2.6, React 19.2.4, Tailwind v4, TypeScript 5,
  ESLint 9, Turbopack (default sem flag).
- [x] Configurar estrutura de pastas:
  ```
  src/                  # código-fonte da aplicação
    app/                # rotas (públicas e admin)
      (public)/         # route group das páginas públicas (D022)
      admin/            # route group do back office
    components/         # componentes reutilizáveis
      ui/               # componentes base (Button, Card, Section, etc)
      admin/            # componentes específicos do back office
    lib/                # utilitários, integrações, abstrações
      ai/               # camada de IA (preparada, não implementada)
      auth/             # autenticação (mock client-side na Fase 1, Supabase real na Fase 3 — D021, D030)
      analytics/        # provider de analytics (mock e GA4)
      blog/             # acesso a posts (mock na Fase 1, Sanity na Fase 3)
      contacts/         # acesso a contatos (Lote C: real via Supabase)
      email/            # e-mail transacional (mock na Fase 1, Resend na Fase 3)
      integrations/     # Iddas, ClickMassa, Make (stubs, real na Fase 4)
      sanity/           # cliente Sanity (preparado, real na Fase 3)
      supabase/         # cliente Supabase (server-only, service role — Lote C)
  public/               # assets estáticos
  ```
- [x] Configurar branch strategy: branch local renomeada de `master` pra `main`.
- [x] Configurar ESLint 9 + Prettier 3 (ver D013).
- [x] Configurar import alias `@/` no `tsconfig.json`
- [x] Documentar setup local no README (npm install, npm run dev, scripts de
      lint/format)

**Checkpoint 1.1 ✅:** `npm run dev` roda sem erro em http://localhost:3000 com
Turbopack. `npm run format:check` retorna "All matched files use Prettier code
style!".

---

## 1.2 Design System

Refletir `docs/identidade_visual.md` no código.

- [x] Configurar tokens de design em `src/app/globals.css` (Tailwind v4
      CSS-first):
  - Cores: `navy #1A2B4A`, `gold #AD8330`, `green #3F5B30` (verde-pinheiro
    oficial — ver D027), `dark #1E1E2E`, `white #FFFFFF`
  - Tipografia: Fraunces (display) + Montserrat (body) — ver D014
  - Easings e durações das referências
- [x] Carregar fontes com `next/font/google`
- [x] Criar componentes base em `src/components/ui/` (Button, Container,
      Section, ServiceCard, TestimonialCard, BlogCard, Divider)
- [x] Criar componente `Logo` com variações (clara, escura, ícone) — ver D017
- [x] Criar componente `CTAWhatsApp` reutilizável
- [x] Criar `Header` (Client) com sticky dinâmico via `usePathname` (D018) e
      `Footer` (Server)
- [x] Criar `MobileMenu.tsx` com focus-trap, ESC, scroll-lock, ARIA
- [x] Criar `src/lib/navigation.ts`
- [x] Atualizar layout global em `src/app/layout.tsx`
- [~] ~~Documentar design system em `docs/DESIGN_SYSTEM.md`~~ — descartado.
      Página `/dev/components` cumpre essa função.

**Checkpoint 1.2 ✅:** página `/dev/components` lista todos os componentes do
design system. Header e Footer renderizam globalmente em toda rota.

---

## 1.3 Páginas públicas

Implementar conforme arquitetura aprovada + wireframe HTML + copies aprovados.

- [x] `/` (Home)
- [x] `/sobre`
- [x] `/viagens` (hub) — 2 cards grandes (Pacotes + Sob Medida), sem Passagens
      Avulsas (ver D020)
- [x] `/viagens/pacotes`
- [x] `/viagens/sob-medida`
- [x] `/contato` — formulário enriquecido (Fase 1.8); Server Action ligada no
      Supabase no Lote C
- [x] `not-found.tsx` (404) global
- [x] `error.tsx` global

**Checkpoint 1.3 ✅:** todas as rotas públicas navegáveis em localhost. Copy
idêntico ao mapa aprovado.

---

## 1.4 Blog público + Admin do blog (estrutura completa, sem Sanity ainda)

Estrutura completa do blog com mocks. Sanity entra na Fase 3 e só substitui a
implementação, sem refactor.

- [x] Interface `Post` em `src/lib/blog/types.ts`
- [x] Mock de 3-4 posts em `lib/blog/mock-posts.ts`
- [x] Abstração `lib/blog/index.ts` com CRUD mockado
- [x] `/blog` (listagem com filtro de categoria)
- [x] `/blog/[slug]` (post individual com tipografia editorial)
- [x] `/admin/blog` (lista administrativa)
- [x] `/admin/blog/novo` (form de criação, salva mostra alert "Sanity Fase 3")
- [x] `/admin/blog/[id]` (form de edição, idem)

**Checkpoint 1.4 ✅:** blog público navegável com mocks. Admin do blog com UI
completa. Sanity (Fase 3) só pluga implementação real.

---

## 1.5 Abstrações para integrações futuras

Criar as fronteiras de código pra que integrações pós-launch não exijam
refatoração.

- [x] `lib/integrations/index.ts` (entry point)
- [x] `lib/integrations/iddas.ts` (stubs documentados de `createSolicitacao` e
      `getStats`, retornando mock plausível)
- [x] `lib/integrations/clickmassa.ts` (stubs de `createTicket` e `getStats`)
- [x] `lib/integrations/make.ts` (stub)
- [x] `lib/ai/` com abstração genérica (`AIProvider`)
- [x] `lib/analytics/` com `AnalyticsProvider` (mock e ga4)
- [x] `lib/auth/` com `AuthProvider` (mock client-side — D021, real na Fase 3
      pela D030)

**Checkpoint 1.5 ✅:** páginas e admin nunca importam direto de SDKs externos.
Trocar provider de IA, auth, analytics ou adicionar integração não toca código
de produto.

---

## 1.6 Formulário de contato (mockado)

Esta fase entregou o form básico. O enriquecimento completo (12 campos em 4
grupos) veio na 1.8.

- [x] Form em `/contato` conforme wireframe
- [x] Validação client-side
- [x] Server Action `submitContact()` (versão inicial, mock)
- [x] E-mail mockado em `lib/email/index.ts`
- [x] Página de sucesso ou estado UI de confirmação

**Checkpoint 1.6 ✅:** formulário envia, mostra sucesso. Real entra com Lote C.

---

## 1.7 Back office estrutural

**Estado de saída:** rota `/admin` existe, layout do back office implementado,
fluxo de login funcional.

**Nota sobre auth (D021):** o que de fato foi entregue neste lote é auth mock
client-side via `localStorage`, com arquitetura idêntica a Supabase Auth (mesmo
contrato de `AuthProvider`). Foi opção deliberada pra desbloquear o resto da
Fase 1 sem depender de Supabase Pro (SMTP, magic link) e convites formais a
Nina/Julia/Amanda (que só rolam na Fase 3). **Supabase Auth real virou item
bloqueador da Fase 3** (ver 3.1.0 e D030).

- [x] `lib/auth/provider.ts` (interface) e `lib/auth/mock.ts` (implementação
      mock client-side)
- [x] `lib/auth/roles.ts` com tipos `Role = "admin" | "editor"` e helper
      `hasPermission`
- [x] `verifySession()` idempotente (D023, sobrevive a Strict Mode)
- [x] Route Groups separando público de admin (D022): `src/app/(public)/` e
      `src/app/admin/` com layouts independentes
- [x] `src/app/admin/login/page.tsx`
- [x] `src/app/admin/login/verificar/page.tsx`
- [x] `src/app/admin/layout.tsx` com chrome próprio
- [x] `AdminSidebar.tsx` (com role-aware: editor não vê Usuários nem
      Configurações)
- [x] `AdminHeader.tsx`
- [x] Logout

**Checkpoint 1.7 ✅:** acessar `/admin` sem login redireciona pra login. Layout
aparece após login. Sidebar respeita role.

---

## 1.8 Back office — Módulo Contatos unificado (Lote B)

**Estado de saída:** time consegue ver lista unificada de contatos, filtrar,
ver detalhe 360 com gestão interna e timeline. Tudo em mock TypeScript, pronto
pra plugar Supabase no Lote C.

**REESCOPO registrado em D024:** após descoberta das APIs do Iddas
(`apiagencia.iddas.com.br`) e ClickMassa, decidiu-se tornar o Supabase nosso
source of truth de contatos, com Iddas e ClickMassa como canais operacionais
especializados.

- [x] `src/lib/contacts/types.ts` — interface `Contact` (53 campos em 10
      agrupamentos), `ContactInteraction`, 8 enums
- [x] `src/lib/contacts/mock-contacts.ts` — 8 contatos diversos
- [x] `src/lib/contacts/mock-interactions.ts` — timeline com 25+ interações
- [x] `src/lib/contacts/index.ts` — `getContacts()`, `getContactById()`,
      `getContactInteractions()`, `getContactStats()` (substituídos no Lote C),
      stubs de mutação
- [x] `src/lib/integrations/iddas.ts` e `clickmassa.ts` com stubs
- [x] `/admin/contatos` (lista com busca, 4 filtros, ações em massa, paginação)
- [x] `/admin/contatos/[id]` (visão 360 em 2 áreas, timeline)
- [x] `/admin/contatos/novo` (criação manual usando mesmo form do site)
- [x] `StageBadge.tsx` (9 cores por estágio)
- [x] `SyncBadge.tsx` (Iddas + ClickMassa com tooltip)
- [x] Enriquecer `ContactForm.tsx` (4 grupos, 12 campos, 6 obrigatórios)
- [x] Atualizar Server Action `/contato/actions.ts` (versão Lote B, mock)

**Checkpoint 1.8 ✅:** lista navegável com 8 mocks, visão 360 completa, form
enriquecido. Pronto pra plugar Supabase no Lote C.

---

## 1.9 Back office — Dashboard híbrido

**REESCOPO D025:** todos os cards são reais (não há "Em breve"). Divisão entre
métricas internas (nossa base) e métricas de integração (Iddas/ClickMassa).

- [x] `src/app/admin/page.tsx` (Server) com `Promise.all` de stats
- [x] `DashboardClient.tsx` (Client) com saudação dinâmica + data PT-BR
- [x] `DashboardCard.tsx` reutilizável
- [x] 3 grupos:
  - **Hoje (3 cards):** Novos contatos, A fazer follow-up, Pendentes de sync
    (tone "warning" se >0)
  - **Este mês (3 cards):** Capturas totais, Em negociação, Fechados
  - **Métricas de integração (4 cards):** Orçamentos Iddas, Vendas Iddas,
    Tickets ClickMassa, Posts publicados
- [x] 3 atalhos: Ver contatos, Novo post, Configurações

**Checkpoint 1.9 ✅:** dashboard carrega em <1s. 10 cards distribuídos em 3
grupos. **Pós-Lote C:** os 6 cards do bloco "Hoje" + "Este mês" agora consomem
Supabase real; os 4 cards de "Métricas de integração" seguem mock plausível
até a Fase 4.

---

## 1.10 Páginas administrativas auxiliares

**REESCOPO D026:** `/admin/integracoes` removida, conteúdo absorvido por
`/admin/configuracoes`.

- [x] Remover `src/app/admin/integracoes/page.tsx`
- [x] `AdminSidebar.tsx` com 2 itens no grupo Admin (Usuários, Configurações)
- [x] `/admin/usuarios` placeholder ("Em breve · Fase 3")
- [x] `/admin/configuracoes` com cards visuais (Iddas, ClickMassa, Origens,
      Mensagem WhatsApp, Tags) — mutações via alert por enquanto

**Checkpoint 1.10 ✅:** rotas existem, `/admin/integracoes` retorna 404,
configurações com conteúdo visual real.

---

## 1.11 Lote C — `contacts` ligado ao Supabase real

**Pré-requisito:** Lote B fechado (1.8 + 1.9 + 1.10) com mocks validados. O
schema sai do `src/lib/contacts/types.ts` real, zero invenção. Decisões cravadas
em D028 (schema/SQL), D029 (camada de acesso), D030 (risco de segurança no SSR).

**Estado de saída:** form do site grava contato real no Supabase; admin lê,
edita e cria contatos reais; dashboard de contatos reflete dados reais. Tudo
ainda em preview local + Vercel preview, banco começa limpo.

### SQL (executado no Supabase SQL editor antes do código)

- [x] Função genérica `set_updated_at()`
- [x] Tabela `contacts`: 53 colunas em 10 agrupamentos (identificação, dados
      pessoais, endereço, qualificação, estágio interno, tags, espelho Iddas,
      espelho ClickMassa, comportamento, metadados)
  - Tradução TS→SQL: `snake_case` no banco / `camelCase` no TS, mapper isolado
  - 9 CHECK constraints validando os enums (origem, destino_tipo,
    orcamento_estimado, prazo_ideal, perfil_viajante, estagio, iddas_sync_status,
    clickmassa_sync_status, status)
  - Arrays nativos: `tags text[]`, `clickmassa_ticket_ids text[]`,
    `clickmassa_tags_id integer[]`, `posts_lidos text[]`,
    `campanhas_ativas text[]` (todos `not null default '{}'`)
  - Defaults além do TS (decisões registradas em D028):
    `status='ativo'`, `iddas_sync_status='pending'`,
    `clickmassa_sync_status='pending'`, `estagio_atualizado_em=now()`,
    `notas_internas=''`, `emails_abertos=0`
  - 8 índices: status, estagio, origem, created_at desc, proximo_follow_up,
    iddas_sync_status, clickmassa_sync_status, GIN em tags
  - Trigger `trg_contacts_updated_at` (chama `set_updated_at()`)
- [x] Tabela `contact_interactions`: 7 colunas
  - FK `contact_id → contacts(id) ON DELETE CASCADE`
  - CHECK constraint validando 13 valores de `tipo`
  - `metadata jsonb not null default '{}'`
  - Índice composto `(contact_id, criado_em)` pra timeline
- [x] RLS ligada nas duas tabelas (`rowsecurity=true`)
- [x] Policies `authenticated_all_contacts` e `authenticated_all_interactions`
      (`for all to authenticated`). Anon sem policy (trancado). Service role
      bypassa RLS por padrão
- [~] **Não criadas neste lote (decisão de escopo D028):** `capture_origins` e
  `tags`. Criar tabela sem código consumindo é dívida silenciosa. Entram no
  passo de ligar a página de Configurações (que hoje é mock), com seus types TS
  nascendo junto

### Código (executado pelo Codinho após o SQL validado)

- [x] Instalar `@supabase/supabase-js@2.108.1`
- [x] `src/lib/supabase/server.ts` — client `supabaseAdmin` server-side com
      service role, `import 'server-only'` no topo (build quebra de propósito se
      Client Component importar). **Sem client anon do browser:** auth ainda é
      mock client-side, browser não tem sessão `authenticated`, então `anon`
      cairia na RLS. Client anon entra junto com Supabase Auth real (3.1.0)
- [x] `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL` +
      `SUPABASE_SERVICE_ROLE_KEY`. `.env.example` sem segredo
- [x] `src/lib/contacts/mappers.ts` — mapper explícito snake↔camel pra `Contact`
      e `ContactInteraction`, type-safe nas duas direções via `ContactRow` /
      `ContactInsertRow`. **Por que explícito e não genérico:** um conversor
      automático de chaves converteria também as chaves dentro do `metadata`
      jsonb das interações, corrompendo o payload
- [x] `src/lib/contacts/from-form.ts` — defaults compartilhados site/admin
      (mesmo shape)
- [x] `src/lib/contacts/index.ts` — `getContacts` / `getContactById` /
      `getContactInteractions` / `getContactStats` agora consultam Supabase via
      `supabaseAdmin` (mesmas assinaturas, código mock substituído).
      `getContactStats` puxa ativos uma vez e conta em memória (volume boutique)
- [x] Server Action `src/app/(public)/contato/actions.ts` — form do site grava
      contato `origem=site_contato` + interação `form_submission`. Stubs Iddas e
      ClickMassa não chamados; `sync_status` fica `pending` (sync real é Fase 4)
- [x] Server Action `src/app/admin/contatos/novo/actions.ts` + ajuste em
      `AdminContactForm.tsx` — criação manual grava `origem=manual`, redireciona
      pra lista
- [x] Server Action `src/app/admin/contatos/[id]/actions.ts` + ajuste em
      `ContactDetailClient.tsx` — "Salvar alterações" da Gestão Interna persiste
      estágio, follow-up e notas. `estagio_atualizado_em` bumpado apenas quando
      o estágio muda
- [x] `export const dynamic = "force-dynamic"` em `/admin`, `/admin/contatos`,
      `/admin/contatos/[id]` — sem isso o Next prerenderia snapshot estático no
      build e tentaria bater no banco em build time

### Validação

- [x] **SQL:** insert+rollback provou os defaults (Brasileira/Brasil/1/ativo/
      pending/{}/created_at). Teste de CASCADE retornou `interacoes_orfas=0`.
      RLS confirmada via `pg_tables.rowsecurity=true` e `pg_policies` retornando
      as 2 policies
- [x] **Código:** `npm run format`, `npm run lint`, `npx tsc --noEmit`,
      `npm run build` — todos zero erros/warnings. Build passou com a
      `service_role` key como placeholder, provando que nenhuma página consulta
      banco em build time
- [x] **End-to-end manual** (com service_role real em `.env.local`):
  - Form `/contato` → 1 row em `contacts` (`origem=site_contato`,
    `status=ativo`, `iddas_sync_status=pending`) + 1 row em
    `contact_interactions` (`tipo=form_submission`) ✓
  - Empty state da lista admin funcionou antes da primeira captura ✓
  - Lista admin reflete contato criado ✓
  - Visão 360 abre dados reais; Gestão Interna persiste edições após reload ✓
  - Criação manual cria `origem=manual` e redireciona ✓
  - Dashboard reflete contagens reais ✓

### Risco conhecido (D030, resolução obrigatória na Fase 3)

`force-dynamic` + auth mock client-side + service role no SSR fazem com que
requests não-autenticados a `/admin/*` recebam HTML com dados dos contatos no
payload (o redirect pra login acontece tarde demais, no client). Inócuo em
preview com banco vazio. **Bloqueador pra produção.** Resolução em 3.1.0
(Supabase Auth real com sessão em cookie HTTP-only).

### Fora de escopo deste lote

- Tabelas `capture_origins` e `tags` (entram com a página de Configurações)
- Sincronização real com Iddas e ClickMassa (Fase 4)
- Supabase Auth real (3.1.0, D030)

**Checkpoint 1.11 ✅:** schema real de pé, código plugado, captura ponta a ponta
funcionando, banco começa limpo. Lote C fechado.

---

## 1.12 SEO técnico

- [ ] Configurar `Metadata` dinâmico por página (`app/layout.tsx` e por rota)
- [ ] Configurar Open Graph e Twitter Card por página
- [ ] Gerar `sitemap.xml` automático (`app/sitemap.ts`) — apenas páginas
      públicas
- [ ] Configurar `robots.txt` (`app/robots.ts`) — bloquear `/admin/*`
- [ ] Estrutura de URLs amigável e consistente (slugs em PT, sem stop-words)
- [ ] Configurar structured data JSON-LD para:
  - Organization (Spinhardi Turismo)
  - TravelAgency (schema.org)
  - Posts de blog (Article)
- [ ] Validar com Google Rich Results Test (localmente via ngrok ou pós-deploy)

**Checkpoint 1.12:** Lighthouse score 90+ em SEO em todas as páginas públicas.

---

## 1.13 Performance e qualidade

- [ ] `next/image` em todas as imagens com `alt` obrigatório
- [ ] Fontes otimizadas com `next/font`
- [ ] Lazy loading onde fizer sentido
- [ ] Testar em mobile (380px) antes de qualquer merge para main
- [ ] Rodar Lighthouse manualmente. Target:
  - Performance: 90+
  - Accessibility: 90+
  - Best Practices: 95+
  - SEO: 95+
- [ ] Documentar padrão de commits em `docs/CONTRIBUTING.md`

**Checkpoint Fase 1 COMPLETO:** site público funcional, back office estrutural
completo, blog público + admin com UI pronta, **Supabase ligado pra contatos
(Lote C)**, formulário grava real, métricas Lighthouse no target. **Pronto pra
Fase 2.**

---

# FASE 2 — Revisão e iteração

**Estado de saída:** site aprovado em ambiente público de preview, com imagens
reais aplicadas e comentários de Nina endereçados, pronto pra ir pra produção.

**Custo:** zero (Vercel free temporário).

---

## 2.1 Deploy preview na Vercel

- [x] Criar projeto na Vercel conectado ao repo `Gattiboni/spinhardi`
- [x] **Plano Hobby (free) temporariamente**
- [x] Configurar deploy automático: push em `main` → URL pública
- [ ] Configurar variáveis de ambiente na Vercel (mesmas do `.env.local`,
      incluindo `SUPABASE_SERVICE_ROLE_KEY`)
- [x] URL ativa: `https://spinhardi-preview.vercel.app/`

**Checkpoint 2.1:** site acessível em URL pública. Nina, Julia e Amanda
conseguem abrir no celular.

---

## 2.2 Endereçar comentários de revisão da Nina

- [ ] Ler e categorizar comentários de Nina (texto, layout, navegação,
      conteúdo, outros)
- [ ] Filtrar bloqueantes vs. melhorias incrementais
- [ ] Implementar bloqueantes antes de continuar
- [ ] Documentar decisões no DECISION_LOG ou documento de iteração
- [ ] Re-enviar preview pra Nina validar correções

**Checkpoint 2.2:** todos os comentários endereçados (implementados ou
explicitamente justificados como rejeitados).

---

## 2.3 Mapeamento e aplicação em batch das imagens reais

Amanda já entregou as imagens. Aplicação em sessão dedicada no final, em batch
único.

- [ ] Consolidar mapa de imagens (slots + entrega da Amanda)
- [ ] Sessão dedicada: análise de cada imagem + placement nos slots corretos
- [ ] Otimizar (próximo de 500KB cada, sRGB, formato WebP/AVIF)
- [ ] Substituir placeholders por imagens reais com `next/image`
- [ ] Validar visualmente em mobile e desktop
- [ ] Validar alt text contextual
- [ ] Deploy

**Checkpoint 2.3:** site visualmente idêntico ao que vai pra produção.

---

## 2.4 Aprovação final

- [ ] Sessão de revisão final com Amanda (validação institucional)
- [ ] Sessão de revisão final com Nina e Julia (validação operacional)
- [ ] Aprovação explícita pra ir pra produção

**Checkpoint 2.4:** aprovação registrada. Pronto pra contratar serviços pagos.

---

# FASE 3 — Produção

**Estado de saída:** site no ar em `spinharditurismo.com.br`, todos os serviços
pagos contratados, blog editável pela Amanda via Sanity, formulário enviando
e-mail real, analytics rodando, back office com Nina, Julia e Amanda convidadas,
**Supabase Auth real protegendo rotas admin server-side**.

**Custo recorrente:** ~R$ 250/mês.

---

## 3.1 Contratações e hardening (na ordem)

### 3.1.0 Supabase Auth real (BLOQUEADOR de go-live, registrado em D030)

O Lote C deixou o admin com auth mock client-side + SSR via service role. Em
preview com banco vazio o risco é inócuo, mas em produção isso vaza dados de
contatos em payload SSR pra qualquer request anônimo. Resolver é pré-requisito
de go-live.

- [ ] Habilitar Supabase Auth no projeto (email magic link como método inicial)
- [ ] Configurar SMTP no Supabase Pro (depende de 3.1.2 abaixo)
- [ ] Criar `src/lib/supabase/client.ts` (publishable key, anon, browser-side)
      e `src/lib/auth/supabase.ts` (implementação real do `AuthProvider`)
- [ ] Substituir `lib/auth/mock.ts` por `lib/auth/supabase.ts` no entry point
      (`lib/auth/index.ts`)
- [ ] **Proteção server-side** em `middleware.ts` ou em `src/app/admin/layout.tsx`
      (Server Component): ler sessão de cookie HTTP-only, redirecionar 302 pra
      `/admin/login` antes de renderizar dados sensíveis
- [ ] Criar `src/lib/contacts/server-actions.ts` (ou refatorar as actions
      existentes) pra checar sessão `authenticated` antes de usar
      `supabaseAdmin`. Service role nunca executa pra request anônimo
- [ ] Validar comportamento: `curl /admin/contatos` sem cookie de sessão
      retorna 302 pra login, **sem dados no payload**
- [ ] Criar `user_profiles` no Supabase (linka `auth.users` com role
      `admin | editor`) — schema sai aqui, não antes
- [ ] Criar `docs/SECURITY_GO_LIVE.md` com checklist de segurança pré-produção

### 3.1.1 Vercel Pro

- [ ] Upgrade do projeto na Vercel pra plano Pro ($20/mês)
- [ ] Cadastrar cartão virtual da Spinhardi
- [ ] Habilitar Vercel Analytics no projeto (incluído no Pro)
- [ ] Configurar spending limit como segurança contra surpresas

### 3.1.2 Supabase Pro

- [ ] Upgrade do projeto Supabase pra plano Pro ($25/mês)
- [ ] Timing: uma semana antes do go-live (margem pra testes em Pro)
- [ ] Validar que tudo funciona em Pro (auth real, RLS, conexões, SMTP)
- [ ] Configurar backups automáticos
- [ ] Configurar SMTP (Resend ou alternativa) pra magic link funcionar

### 3.1.3 Sanity

- [ ] Criar projeto Sanity (free tier, suficiente pra Fase 1)
- [ ] Configurar Sanity Studio
- [ ] Definir schemas (Post, Author, Category, SEO fields)
- [ ] Deploy do Studio em `studio.spinharditurismo.com.br` ou subdomínio
- [ ] Criar conta de editor para Amanda
- [ ] Treinar Amanda no Studio (sessão dedicada, ~1h)
- [ ] Documentar fluxo de publicação em `docs/COMO_PUBLICAR_POST.md`

### 3.1.4 Resend

- [ ] Criar conta Resend (free tier)
- [ ] Adicionar domínio `spinharditurismo.com.br` no Resend
- [ ] Configurar DNS (SPF, DKIM) no Registro.br
- [ ] Validar entrega de e-mail teste
- [ ] Implementar de verdade em `lib/email/resend.ts` (substituindo o mock)

### 3.1.5 Conta Google da Spinhardi

- [ ] Criar conta Gmail dedicada
- [ ] Configurar 2FA com método de recuperação seguro
- [ ] Adicionar Nina e Julia como administradoras
- [ ] Documentar credenciais no local seguro

### 3.1.6 GA4 + Search Console

- [ ] Criar propriedade GA4 com a conta Google da Spinhardi
- [ ] Configurar GA4 via Google Tag Manager
- [ ] Configurar eventos de conversão (WhatsApp, formulário, CTA principal)
- [ ] Adicionar Search Console à mesma conta Google
- [ ] Verificar propriedade via DNS ou meta tag
- [ ] Submeter sitemap.xml

---

## 3.2 Ligar Sanity ao site público e ao admin

- [ ] Trocar mock de blog por integração real com Sanity
- [ ] Implementar `lib/sanity/client.ts` e `lib/sanity/queries.ts`
- [ ] Atualizar `lib/blog/index.ts` pra consumir Sanity (`getPosts()`,
      `getPostBySlug()`)
- [ ] Decisão sobre `/admin/blog` (Sanity Studio direto ou interface dentro do
      nosso admin) — decidida com Amanda nesta etapa
- [ ] Configurar webhook Sanity → Vercel para revalidar páginas no publish
- [ ] Validar que páginas de blog renderizam conteúdo real do Sanity
- [ ] Amanda publica 1 post teste

**Checkpoint 3.2:** blog rodando 100% via Sanity. Mock removido.

---

## 3.3 Convidar Nina, Julia e Amanda pro back office

- [ ] Criar `user_profiles` pra Alan (admin), Amanda (admin), Nina (editor),
      Julia (editor)
- [ ] Convidar via Supabase Auth (magic link enviado por e-mail)
- [ ] Validar que cada uma consegue logar
- [ ] Validar permissões: editor não vê Usuários/Configurações

**Checkpoint 3.3:** 4 contas ativas no back office.

---

## 3.4 Ligar `capture_origins` e `tags` no Supabase

Tarefa segurada deliberadamente do Lote C (D028): criar tabela sem código
consumindo é dívida silenciosa. Quando a página de Configurações sair do mock,
as tabelas nascem junto.

- [ ] Criar `capture_origins` no Supabase (id uuid, slug único, nome, descricao,
      ativo bool, campanha_ativa bool, criado_em)
- [ ] Criar `tags` no Supabase (id uuid, slug único, nome, cor hex, grupo,
      ativo bool — sem timestamp, decisão (a) em D028)
- [ ] Criar types TS correspondentes em `src/lib/configuracoes/types.ts` (ou
      similar)
- [ ] Migrar a página `/admin/configuracoes` de mock pra Supabase real
- [ ] Validar criação/edição/desativação de origens e tags

**Checkpoint 3.4:** página de Configurações funcional, sem alerts.

---

## 3.5 Configurar DNS e domínio

- [ ] Apontar DNS de `spinharditurismo.com.br` pra Vercel (registros A e CNAME)
- [ ] Adicionar domínio customizado na Vercel
- [ ] Validar HTTPS automático (Let's Encrypt via Vercel)
- [ ] Configurar redirect `www` → `apex` (ou vice-versa)
- [ ] Atualizar e-mail de contato do domínio no Registro.br
- [ ] Aguardar propagação DNS (até 24h, geralmente 1h)

**Checkpoint 3.5:** site acessível em `https://spinharditurismo.com.br`.

---

## 3.6 Checklist final de go-live

- [ ] Revisão final de todos os textos (comparar com mapa de copies aprovado)
- [ ] Todos os links funcionando (interno e externo)
- [ ] Formulário envia e e-mail chega na caixa correta
- [ ] WhatsApp abre conversa com número correto + mensagem padrão validada
- [ ] Mobile (380px) e desktop validados
- [ ] Lighthouse rodado em produção, scores no target
- [ ] structured data validado no Google Rich Results Test
- [ ] sitemap.xml acessível e submetido no Search Console
- [ ] robots.txt acessível e correto (bloqueando `/admin/*`)
- [ ] OG image renderiza no compartilhamento (WhatsApp, Facebook)
- [ ] Analytics capturando eventos
- [ ] Backup do Supabase rodando
- [ ] Back office acessível pelas 4 contas
- [ ] **Teste de hardening D030:** `curl /admin/contatos` sem sessão retorna
      302 pra login, payload sem dados de contatos
- [ ] Tag `v1.0.0` no repositório
- [ ] Commit final em `main` com mensagem
      `release: v1.0.0 — go-live spinharditurismo.com.br`

---

## 3.7 Treinamento e documentação

- [ ] Loom: tour completo do back office pra Nina e Julia (10-15 min)
- [ ] Loom curto: como Amanda publica um post (Sanity Studio ou nosso admin
      conforme decisão na 3.2)
- [ ] Loom curto: monitoramento técnico pra Alan (Supabase, Vercel, logs)
- [ ] Criar `docs/MANUTENCAO.md` — o que fazer quando algo quebrar
- [ ] Atualizar README com URL de produção e links pros painéis
- [ ] Atualizar CHANGELOG com entrada de go-live
- [ ] Atualizar DECISION_LOG com decisões da Fase 3

**Checkpoint Fase 3 COMPLETO:** site no ar, operacional, monitorado,
documentado, time treinado.

---

# FASE 4 — Pós-launch / Roadmap

**Estado de saída:** integrações Iddas/ClickMassa operacionais, dashboard com
métricas de integração reais (os cards de contatos já são reais desde o Lote
C), camada de IA com primeira aplicação real, melhorias contínuas.

**Sem prazo fixo.** Cada item entra quando faz sentido.

---

## 4.1 Integrações operacionais

### Iddas (ERP de viagens)

- [ ] Implementar de verdade `lib/integrations/iddas.ts` (substituindo stubs)
- [ ] OAuth Bearer + REST polling (sem webhooks nativos)
- [ ] Tipagem TypeScript completa do schema Iddas
- [ ] Documentar endpoints usados em `docs/INTEGRATIONS.md`

### ClickMassa (WhatsApp CRM)

- [ ] Implementar `lib/integrations/clickmassa.ts` (substituindo stubs)
- [ ] Mapear pipeline (11 stages) e tags (20) já configurados
- [ ] Documentar uso em `docs/INTEGRATIONS.md`

### Make (bridge Iddas ↔ ClickMassa, polling-based)

- [ ] Criar cenário Make pra polling do Iddas e push pro ClickMassa
- [ ] Automação de follow-up por estágio de pipeline
- [ ] Documentar cenário em `docs/INTEGRATIONS.md`

### Religar Server Actions de contato com sync real

Hoje (pós-Lote C) o form do site e a criação manual gravam no Supabase com
`sync_status='pending'`. Na Fase 4 essa camada vira ativa.

- [ ] Religar `/contato/actions.ts` pra chamar `iddas.createSolicitacao()` e
      `clickmassa.createTicket()` via `Promise.allSettled` após o insert no
      Supabase
- [ ] Atualizar `sync_status` pra `synced` ou `failed` conforme retorno; gravar
      `iddas_pessoa_id`, `iddas_orcamento_id`, `clickmassa_contact_id` etc
- [ ] Criar interações `sync_iddas` e `sync_clickmassa` na timeline
- [ ] Botão "Forçar nova sync" na visão 360 passa a chamar de verdade

---

## 4.2 Dashboard de integrações real

Os 6 cards de contatos no dashboard já são reais desde o Lote C. Resta tornar
reais os 4 cards de integração.

- [ ] Implementar `lib/analytics/ga4.ts` consumindo Data API do GA4
- [ ] Trocar provider ativo de mock pra GA4 real (1 linha em
      `lib/analytics/index.ts`)
- [ ] Card "Orçamentos no Iddas" passa a chamar `iddas.getStats()` real
- [ ] Card "Vendas no Iddas" idem
- [ ] Card "Tickets abertos no ClickMassa" chama `clickmassa.getStats()` real
- [ ] Card "Posts publicados" passa a contar via Sanity
- [ ] Remover qualquer indicação de "mock" / "plausível" do dashboard

---

## 4.3 Conectar integrações ao back office

- [ ] Trazer de volta `/admin/integracoes` (foi removida em D026 enquanto era
      placeholder) com tela funcional
- [ ] `/admin/integracoes/iddas` — config (API key, polling interval) + logs
      + botão "testar conexão"
- [ ] `/admin/integracoes/clickmassa` — similar
- [ ] `/admin/integracoes/make` — link pros cenários + status

---

## 4.4 Camada de IA

- [ ] Implementar `lib/ai/anthropic.ts` (provider real)
- [ ] Configurar `ANTHROPIC_API_KEY` em `.env.local` e Vercel
- [ ] Definir schema de contexto Spinhardi (produtos, perfis de cliente,
      destinos) injetado em todos os prompts
- [ ] **Primeira aplicação:** `/api/ai/suggest-itinerary` (recebe perfil de
      cliente, retorna sugestão estruturada de roteiro)
- [ ] Cada nova função de IA é um módulo separado em `lib/ai/modules/`
- [ ] Documentar arquitetura em `docs/AI_LAYER.md`

**Princípio:** troca de provider (Anthropic → outro) não toca código de
produto. Só muda a implementação do provider.

---

## 4.5 Página de Passagens Avulsas (interface operacional)

Conforme D020, Passagens Avulsas vira interface de booking operacional na
Fase 4, ligada ao Iddas.

- [ ] Definir UX da interface (rota dedicada, ex.: `/passagens` ou `/reservas`)
- [ ] Implementar consulta Iddas via `lib/integrations/iddas.ts`
- [ ] Atualizar link do ServiceCard 01 da Home

---

## 4.6 Melhorias contínuas

Lista aberta. Itens entram conforme priorização.

- [ ] Página de Política de Privacidade e Termos de Uso
- [ ] Página de cases/portfólio (quando houver depoimentos reais + permissão)
- [ ] Sistema de agendamento de posts no Sanity (plugin Scheduled Publishing)
- [ ] Subdomínios criativos pra campanhas
- [ ] Tradução EN-US (se houver demanda)
- [ ] Newsletter (integração com ferramenta de e-mail marketing)
- [ ] Programa de indicação automatizado (ClickMassa + Iddas + Make)
- [ ] Implementação real de `/admin/usuarios` (quando virar dor)

---

# Pendências externas (das sócias)

- [x] Aprovar cenário de domínio (Cenário com domínio existente)
- [x] Confirmar que `spinharditurismo.com.br` é da Spinhardi LTDA
- [x] Criar cartão virtual e enviar dados pra Alan
- [x] Aprovar preview inicial enviado em 2026-05-31
- [ ] Comentários da Nina sobre o preview pós-Lote B — endereçados na Fase 2.2
- [ ] Indicação de imagens finais — aplicadas na Fase 2.3 (Amanda já entregou)
- [ ] Nina aprovar criação da conta Gmail da Spinhardi (informativo)
- [ ] Treinamento da Amanda no Sanity (agendar quando Fase 3 estiver próxima)
- [ ] Validação da mensagem padrão do WhatsApp

---

# Pendências técnicas em aberto

- [ ] Decidir formato exato dos `slug`s de blog (manter PT-BR, sem stop-words)
- [ ] Decidir política de retenção de submissões do formulário no Supabase
      (LGPD; impacta `status='anonimizado_lgpd'`)
- [ ] Decidir backup strategy do Sanity (export periódico ou só confiar no SaaS)
- [ ] **Refazer `public/logos/logo-icone.svg` como vetor real** (atualmente
      PNG raster embutido com 288 KB — ver D017). Prioridade: ALTA quando virar
      favicon, porque impacta Core Web Vitals
- [ ] **Refazer `public/logos/logo-clara.svg` e `logo-escura.svg` como vetor
      real**. Prioridade: MÉDIA-BAIXA
- [ ] **Manter `LIGHT_ROUTES` atualizada** (D018) — adicionar pathname de novas
      páginas com fundo claro à constante em `src/components/ui/Header.tsx`
- [ ] Decidir formato definitivo do admin de blog na 3.2 (Sanity Studio direto
      vs interface dentro do nosso admin)
- [ ] **Criar `docs/SECURITY_GO_LIVE.md`** com checklist de hardening
      pré-produção (D030)
- [ ] **Limpar `.gitignore`:** resíduo de here-string PowerShell na linha 1
      (`@'`) e na última (`'@ | Out-File ...`). Não quebra ignore do
      `.env.local` (verificado), prioridade BAIXA
- [ ] **Tabelas `capture_origins` e `tags` no Supabase** + types TS
      correspondentes (entram com 3.4, página de Configurações real)

---

# Critérios de "pronto"

| Fase | Critério de "pronto"                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `npm run dev` roda. Site público completo. Back office completo (login mock + contatos reais via Supabase + dashboard híbrido + placeholders). Blog público + admin com UI pronta. Schema Lote C de pé. Métricas Lighthouse no target. |
| 2    | Aprovação institucional (Amanda) e operacional (Nina e Julia) em URL pública. Imagens reais substituídas. Comentários de Nina endereçados.                                                                                    |
| 3    | Site no ar em `spinharditurismo.com.br` com HTTPS. **Supabase Auth real protegendo `/admin/*` server-side (D030).** Sanity ligado. Resend enviando. GA4 capturando. Back office com 4 contas ativas. Configurações reais (3.4). |
| 4    | Em fluxo contínuo. Cada item tem seu próprio critério.                                                                                                                                                                       |

---

_Plano de Desenvolvimento v3.1 · Substitui v3.0 · Gattiboni Enterprises para
Spinhardi Turismo · Junho 2026_
