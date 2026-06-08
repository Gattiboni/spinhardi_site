# Plano de Desenvolvimento — Site Spinhardi v3

**Versão:** 3.0 (substitui v2) **Stack:** Next.js 16 · TypeScript · Tailwind v4
· Vercel · Supabase · Sanity **Preparado por:** Alan Gattiboni · Gattiboni
Enterprises **Última atualização:** Abril 2026

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
- **Fase 4 — Pós-launch:** integrações IDAS/ClickMassa/Make, camada de IA,
  melhorias contínuas.

**Cada fase termina com checkpoint claro.** Não passa pra próxima sem fechar a
anterior.

---

## Fontes de verdade aprovadas

| Documento                        | Localização                                      | O que define                            |
| -------------------------------- | ------------------------------------------------ | --------------------------------------- |
| Branding Book Lite v2            | Canva (Amanda)                                   | Identidade de marca, tom, valores       |
| Identidade Visual                | `docs/identidade_visual.md`                      | Tokens Tailwind, paleta, tipografia     |
| Arquitetura de Páginas           | `docs/arquitetura_v1.md`                         | Rotas e justificativa                   |
| Mapa de Copies (aprovado Amanda) | `docs/mapa_de_copies_spinhardi_v1_ready.docx`    | Conteúdo textual da v1                  |
| Mapa de Imagens                  | `docs/mapa_de_imagens_spinhardi_v1.docx`         | Specs técnicas e papel das imagens      |
| Plano de Infraestrutura          | `docs/plano_de_infraestrutura_spinhardi_v1.docx` | Decisões de stack e custo               |
| Wireframe HTML                   | `docs/spinhardi_wireframe.html`                  | Estrutura visual aprovada               |
| Referências de design            | `docs/refs/`                                     | CSS extraído dos sites de referência    |
| Decision Log                     | `docs/DECISION_LOG.md`                           | Histórico de decisões com racional      |
| Changelog                        | `docs/CHANGELOG.md`                              | Eventos e entregas em ordem cronológica |

---

# FASE 1 — Fundação local

**Estado de saída:** projeto Next.js rodando em localhost, com design system
aplicado, estrutura de pastas completa, todas as páginas públicas e do back
office implementadas, blog funcional com posts mockados, dashboard híbrido
operando com dados reais (Supabase) e mocks plausíveis (integrações).

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
    components/         # componentes reutilizáveis
      ui/               # componentes base (Button, Card, Section, etc)
      admin/            # componentes específicos do back office
    lib/                # utilitários, integrações, abstrações
      ai/               # camada de IA (preparada, não implementada)
      auth/             # autenticação (Supabase Auth, roles, middleware)
      analytics/        # provider de analytics (mock e GA4)
      blog/             # acesso a posts (mock na Fase 1, Sanity na Fase 3)
      email/            # e-mail transacional (mock na Fase 1, Resend na Fase 3)
      integrations/     # IDAS, ClickMassa, Make (preparadas, não implementadas)
      sanity/           # cliente Sanity (preparado, não implementado na Fase 1)
      supabase/         # cliente Supabase
  public/               # assets estáticos
  ```
- [x] Configurar branch strategy: branch local renomeada de `master` pra `main`.
      Branch `staging` será criada na Fase 2, quando for usada pra revisão.
      `feature/*` quando houver iteração em paralelo.
- [x] Configurar ESLint 9 (já vem do `create-next-app`) + Prettier 3 (ver D013).
      Husky e lint-staged descartados após reavaliação.
- [x] Configurar import alias `@/` no `tsconfig.json` (já configurado pelo
      `create-next-app` apontando pra `./src/*`)
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
  - Cores: `navy #1A2B4A`, `gold #AD8330`, `green #4DBF72` (provisório, ver
    D006), `dark #1E1E2E`, `white #FFFFFF`
  - Tipografia: Fraunces (display) + Montserrat (body) — ver D014
  - Easings das referências: `--ease-smooth`, `--ease-out`
  - Durações das referências: `--duration-short` (200ms), `--duration-medium`
    (400ms), `--duration-long` (750ms)
  - Tailwind v4 não usa mais `tailwind.config.ts`. Tokens vão direto no CSS via
    `@theme inline`.
  - Espaçamentos customizados, breakpoints e sombras adicionais entram conforme
    necessidade no decorrer da Fase 1.2 — não pré-configurar tudo.
- [x] Carregar fontes com `next/font/google` no `src/app/layout.tsx`:
  - Fraunces: pesos 400, 500, 600 → CSS variable `--font-fraunces` → token
    `--font-display`
  - Montserrat: pesos 300, 400, 500, 600 → CSS variable `--font-montserrat` →
    token `--font-body`
  - Ambas com `display: "swap"` e `subsets: ["latin"]`
- [x] Criar componentes base em `src/components/ui/`:
  - [x] `Button` (variantes: primary, secondary, ghost; sizes sm/md/lg; estado
        disabled e focus visível)
  - [x] `Container` (max-width responsivo, prop `as` pra semântica — ver D015)
  - [x] `Section` (padding vertical padrão, prop `spacing` sm/md/lg)
  - [x] `ServiceCard` (número + título + descrição + link, hover via group,
        prop `tone` light/dark)
  - [x] `TestimonialCard` (blockquote com border-l gold e aspas decorativas,
        prop `tone` light/dark)
  - [x] `BlogCard` (imagem 16:9 + tag + título + data + excerpt com line-clamp)
  - [x] `Divider` (prop `tone` light/dark)
- [x] Criar componente `Logo` com variações (clara, escura, ícone) — ver D017
- [x] Criar componente `CTAWhatsApp` reutilizável com link parametrizado
- [x] Criar `Header` e `Footer`:
  - [x] `Header.tsx` (Client Component) — sticky dinâmico, detecta rota via
        `usePathname` (ver D018)
  - [x] `MobileMenu.tsx` (Client Component) — overlay full-screen com
        focus-trap, ESC pra fechar, scroll-lock no body, ARIA completo
  - [x] `Footer.tsx` (Server Component) — 4 colunas conforme mapa de copies
- [x] Criar `src/lib/navigation.ts` — fonte única de verdade dos links
- [x] Atualizar layout global em `src/app/layout.tsx`
- [~] ~~Documentar design system em `docs/DESIGN_SYSTEM.md`~~ — descartado.
  Página `/dev/components` cumpre essa função.

**Checkpoint 1.2 ✅:** página `/dev/components` em
http://localhost:3000/dev/components lista todos os componentes do design system
(11 seções). Header e Footer renderizam globalmente em toda rota.

---

## 1.3 Páginas públicas

Implementar conforme arquitetura aprovada + wireframe HTML + copies aprovados
em `docs/mapa_de_copies_spinhardi_v1_ready.docx`.

**Rotas e progresso:**

- [x] `/` (Home) — concluída em 2026-05-31
- [x] `/sobre` — concluída em 2026-05-31. Primeira página com fundo claro. D018
      (LIGHT_ROUTES) validada em produção real.
- [x] `/viagens` (hub) — concluída em 2026-05-31. 2 cards grandes (Pacotes + Sob
      Medida), sem Passagens Avulsas (ver D020).
- [x] `/viagens/pacotes` — concluída em 2026-05-31.
- [x] `/viagens/sob-medida` — concluída em 2026-05-31.
- [X] `/contato` — formulário com envio mockado (Supabase entra na 1.10)
- [ ] `not-found.tsx` (404) global
- [ ] `error.tsx` global

Para cada página:

- [X] Implementar estrutura conforme wireframe da sessão
- [X] Aplicar copy aprovado pela Amanda (literal — sem reescrever)
- [X] Sem imagens reais — fotos virão por indicação de Nina e Julia (ver Fase
      1.13)
- [X] CTAs WhatsApp funcionais via `CTAWhatsApp`
- [X] Adicionar à `LIGHT_ROUTES` em `Header.tsx` se a página tem fundo claro
      (ver D018)
- [X] Responsivo testado em 380px (mobile) e 1440px (desktop)

**Checkpoint 1.3:** todas as rotas públicas navegáveis em localhost. Visual fiel
aos wireframes aprovados sessão a sessão. Copy idêntico ao mapa aprovado.
`not-found.tsx` e `error.tsx` implementados.

---

## 1.4 Blog público + Admin do blog (estrutura completa, sem Sanity ainda)

Preparar a estrutura completa do blog com mocks. Sanity entra na Fase 3 e só
substitui a implementação, sem refactor.

- [X] Definir TypeScript interface para `Post`:
  ```ts
  interface Post {
    slug: string;
    title: string;
    date: string;
    category:
      | "Destinos"
      | "Bastidores"
      | "Dicas de Viagem"
      | "História da Agência";
    excerpt: string;
    thumbnail: string;
    author: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    ogImage: string;
  }
  ```
- [X] Criar mock de 3-4 posts em `lib/blog/mock-posts.ts`
- [X] Criar abstração `lib/blog/index.ts` com `getPosts()`, `getPostBySlug()`,
      `createPost()`, `updatePost()`, `deletePost()` — implementação mock agora,
      vira Sanity na Fase 3 sem tocar nas páginas
- [X] Implementar `/blog` (listagem com filtro de categoria funcional)
- [X] Implementar `/blog/[slug]` (post individual com tipografia editorial,
      navegação prev/next opcional)

**Admin do blog (UI completa, CRUD desativado na Fase 1):**

- [X] Implementar `/admin/blog` (lista de posts no formato administrativo —
      tabela com colunas: título, categoria, data, status, ações)
- [X] Implementar `/admin/blog/novo` (formulário de criação)
- [X] Implementar `/admin/blog/[id]` (formulário de edição)
- [X] Formulários renderizam completos (título, slug, categoria, excerpt, body,
      SEO fields, imagem) — botão "Salvar" mostra mensagem
      "Implementação completa virá com Sanity (Fase 3)"
- [X] Botão "Excluir" também mostra mensagem similar

**Checkpoint 1.4:** blog público navegável com mocks. Filtros funcionando.
Admin do blog tem UI completa, validada visualmente. Sanity (Fase 3) só pluga
implementação real.

---

## 1.5 Abstrações para integrações futuras

Criar as fronteiras de código pra que integrações pós-launch não exijam
refatoração. Zero dívida técnica desde o dia 1.

- [X] Criar `lib/integrations/index.ts` como ponto único de entrada:
  ```ts
  export { idas } from "./idas";
  export { clickmassa } from "./clickmassa";
  export { make } from "./make";
  ```
- [X] Criar `lib/integrations/idas.ts` com interface (sem implementação real):
  ```ts
  export const idas = {
    getReservations: async () => {
      throw new Error("Not implemented in v1");
    },
  };
  ```
- [X] Mesmo padrão para `lib/integrations/clickmassa.ts` e
      `lib/integrations/make.ts`
- [X] Criar `lib/ai/` com abstração genérica:
  ```ts
  // lib/ai/provider.ts
  export interface AIProvider {
    ask(prompt: string, context?: object): Promise<string>;
  }
  ```
- [X] Criar `lib/analytics/` com abstração:
  ```ts
  // lib/analytics/provider.ts
  export interface AnalyticsProvider {
    getVisits(period: Period): Promise<MetricResult>;
    getWhatsAppClicks(period: Period): Promise<MetricResult>;
    getConversions(period: Period): Promise<MetricResult>;
  }
  // lib/analytics/mock.ts (implementação retorna números plausíveis)
  // lib/analytics/ga4.ts (implementação real — Fase 4)
  // lib/analytics/index.ts (re-exporta provider ativo)
  ```
- [X] Criar `lib/auth/` com abstração:
  ```ts
  // lib/auth/provider.ts
  export interface AuthProvider {
    signIn(email: string): Promise<void>;  // magic link
    signOut(): Promise<void>;
    getUser(): Promise<User | null>;
  }
  // lib/auth/supabase.ts (implementação real)
  // lib/auth/roles.ts (tipos Role + helper hasPermission)
  // lib/auth/index.ts (re-exporta provider ativo)
  ```
- [ ] Documentar cada abstração no próprio arquivo (JSDoc)

**Checkpoint 1.5:** as páginas e o admin nunca importam direto de SDKs ou APIs
externas. Tudo passa por `lib/`. Trocar provider de IA, auth, analytics ou
adicionar nova integração não toca código de produto.

---

## 1.6 Formulário de contato (mockado)

Construir formulário de `/contato` funcional, salvando em estrutura mockada
local. Plug no Supabase real entra na Fase 1.10.

- [X] Implementar formulário em `/contato` conforme wireframe
- [X] Validação client-side (campos obrigatórios, formato de e-mail, telefone)
- [X] Criar Server Action `submitContact()` que por enquanto salva em log
      (`console.log` estruturado ou arquivo JSON local em dev)
- [X] Envio de e-mail mockado:
  ```ts
  // lib/email/index.ts
  export const email = {
    send: async (to: string, subject: string, body: string) => {
      console.log("[email mock] would send to", to);
    },
  };
  ```
- [X] Página de sucesso (`/contato/obrigado`) ou estado UI de confirmação

**Checkpoint 1.6:** formulário envia, mostra sucesso, e-mail real e
persistência Supabase ficam pra 1.10.

---

## 1.7 Back office estrutural

**Estado de saída:** rota `/admin` existe, protegida por login. Login funciona
com magic link. Layout do back office implementado. Usuário não-admin não
consegue acessar.

- [X] Implementar `lib/auth/provider.ts` (interface) e
      `lib/auth/supabase.ts` (implementação) — preparação, ativação real na 1.10
- [X] Implementar `lib/auth/roles.ts` com tipos `Role = "admin" | "editor"` e
      helper `hasPermission(user, action)`
- [X] Implementar `middleware.ts` na raiz do projeto (Next 16 middleware)
      protegendo `/admin/*`:
  - Não logado → redirect pra `/admin/login`
  - Logado mas sem `user_profile` válido → tela de erro "sem permissão"
  - Logado e válido → acesso liberado
- [X] Criar `src/app/admin/login/page.tsx` — formulário simples (campo de
      e-mail + botão "Enviar link de acesso")
- [X] Criar `src/app/admin/login/verificar/page.tsx` — página intermediária
      após clique no magic link (Supabase faz callback aqui)
- [X] Criar `src/app/admin/layout.tsx` — layout do back office:
  - Sidebar com navegação (Dashboard, Contatos, Blog, Usuários, Integrações,
    Configurações)
  - Header com nome do usuário logado + botão sair
  - Visual distinto do site público (mais funcional, menos editorial) mas
    usando os mesmos tokens
- [X] Criar componente `AdminSidebar.tsx` com lista de links e indicação de
      rota ativa
- [X] Criar componente `AdminHeader.tsx` com info do usuário e logout
- [X] Implementar logout (chamar `auth.signOut()` e redirecionar)
- [X] Esconder itens da sidebar conforme role:
  - Admin vê tudo
  - Editor não vê "Usuários" nem "Integrações" nem "Configurações"

**Checkpoint 1.7:** acessar `/admin` sem login redireciona pra login. Layout
do admin aparece após login. Sidebar mostra opções conforme role.

---

## 1.8 Back office — Módulo Contatos

**Estado de saída:** time consegue ver lista de submissões do formulário, ver
detalhe, marcar status, deixar notas internas.

Por enquanto, com mock de dados (lista estática). Plug no Supabase real
entra na 1.10.

- [ ] Criar `src/app/admin/contatos/page.tsx` — lista de submissões
  - Tabela com colunas: data, nome, e-mail, status, ação
  - Filtros: status (todos/novos/em atendimento/respondidos/arquivados), busca
    por nome ou e-mail
  - Paginação (10-20 por página)
  - Indicador visual de "novo" (não lido) — dot dourado
- [ ] Criar `src/app/admin/contatos/[id]/page.tsx` — detalhe da submissão
  - Mostra todos os campos do formulário
  - Permite mudar status (dropdown)
  - Campo de notas internas (textarea)
  - Botão "abrir WhatsApp" se telefone foi informado
  - Botão "responder por e-mail" → abre mailto: ou copia e-mail
- [ ] Implementar lógica de "marcar como lido" automática quando admin abre
      detalhe
- [ ] Criar mock em `lib/contacts/mock-submissions.ts` com 10-15 submissões
      variadas pra demonstrar UX
- [ ] Criar abstração `lib/contacts/index.ts` com `getSubmissions()`,
      `getSubmissionById()`, `updateSubmission()` — mock agora, Supabase na 1.10

**Checkpoint 1.8:** lista de contatos navegável com mocks. Mudança de status,
notas, ações funcionam visualmente. Pronto pra plugar Supabase.

---

## 1.9 Back office — Dashboard híbrido

**Estado de saída:** ao entrar em `/admin`, time vê visão geral. Tudo mockado
nesta fase (Supabase entra na 1.10, GA4 e integrações ficam pra Fase 4).

- [ ] Criar `src/app/admin/page.tsx` — dashboard inicial
- [ ] Implementar componentes:
  - `DashboardCard` — card reutilizável com título, valor principal, trend
    opcional, link "ver mais"
  - `DashboardSection` — agrupa cards numa seção temática ("Hoje", "Esta
    semana", "Mês")
- [ ] Implementar provider analytics mock (`lib/analytics/mock.ts`) — retorna
      números plausíveis (visitas, cliques WhatsApp, conversões) com pequena
      variação dia a dia (não pode ser estático demais)
- [ ] Dashboard renderiza:
  - **Saudação:** "Olá, [Nome]" + data formatada
  - **Hoje:** novos contatos (mock por enquanto), conversas WhatsApp (mock),
    reservas IDAS (mock)
  - **Esta semana:** visitas GA4 (mock), cliques WhatsApp (mock), posts
    publicados (mock)
  - **Atalhos:** botões pra Contatos, Blog (novo post), Configurações
- [ ] Indicar visualmente quais cards são reais vs mock (badge "Mock" ou
      "Em breve" pequeno e sutil)

**Checkpoint 1.9:** dashboard carrega em <1s. Visual completo, mocks plausíveis.
Pronto pra plugar dados reais na 1.10 (contatos) e Fase 4 (GA4, integrações).

---

## 1.10 Páginas administrativas auxiliares (placeholders na Fase 1)

Rotas existem, layout do admin envolve, conteúdo é placeholder "Em breve" com
explicação curta. Implementação real vem conforme demanda real surgir.

- [ ] Criar `src/app/admin/usuarios/page.tsx` — placeholder
  - Texto curto: "Gestão de usuários do back office. Disponível após go-live
    (Fase 3), quando convidaremos Nina, Julia, Amanda e demais membros do
    time."
- [ ] Criar `src/app/admin/integracoes/page.tsx` — placeholder
  - Texto curto: "Configuração e monitoramento das integrações (IDAS,
    ClickMassa, Make). Disponível na Fase 4, quando as integrações entrarem
    em operação."
- [ ] Criar `src/app/admin/configuracoes/page.tsx` — placeholder
  - Texto curto: "Configurações gerais do site (mensagem padrão WhatsApp,
    e-mail de notificação, etc). Implementação conforme demanda."

**Checkpoint 1.10:** rotas existem, sidebar do admin não tem links quebrados,
placeholders comunicam o que ainda vem.

---

## 1.11 Cliente Supabase e schema completo

**Pré-requisito:** todas as páginas (públicas e admin) já construídas com
mocks. Agora sabemos exatamente quais tabelas, colunas e relações precisamos.

- [ ] Instalar `@supabase/supabase-js`
- [ ] Criar `lib/supabase/client.ts` com cliente público (publishable key)
- [ ] Criar `lib/supabase/server.ts` com cliente server-side (service role,
      nunca exposta)
- [ ] Adicionar variáveis ao `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://grjkqljucszoaujmhgpi.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_2TQ0BVyLarDosrwVSxX1IA_ctXqmNer
  SUPABASE_SERVICE_ROLE_KEY=*** (não commitar, não logar)
  ```
- [ ] Documentar `.env.example` com placeholders
- [ ] **Sessão dedicada de SQL em lote** — criar todas as tabelas, índices e
      políticas RLS de uma vez:

  Tabelas mínimas mapeadas:

  ```sql
  -- Submissões do formulário público
  create table contact_submissions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    name text not null,
    email text not null,
    phone text,
    message text not null,
    status text default 'novo',
    notes text,
    read_at timestamptz,
    read_by uuid
  );

  -- Perfis de usuários do back office (estende auth.users)
  create table user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    name text,
    role text not null default 'editor',
    created_at timestamptz default now(),
    invited_by uuid references auth.users(id)
  );

  -- Log de atividade administrativa
  create table admin_activity (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    action text not null,
    resource_type text,
    resource_id text,
    metadata jsonb,
    created_at timestamptz default now()
  );

  -- Outras tabelas que emergirem da construção das páginas serão adicionadas
  -- neste lote.
  ```

- [ ] Configurar RLS em cada tabela:
  - `contact_submissions`: INSERT público, SELECT/UPDATE só authenticated com
    role válido, DELETE só admin
  - `user_profiles`: SELECT pelo próprio user; INSERT/UPDATE só admin
  - `admin_activity`: SELECT só admin

- [ ] Plug do formulário público (`/contato`) no Supabase real (substituir mock
      de log)
- [ ] Plug do módulo Contatos do admin (`/admin/contatos`) no Supabase real
      (substituir mock estático)
- [ ] Plug do dashboard híbrido — cards de contatos passam de mock pra real
- [ ] Plug do Supabase Auth no `lib/auth/supabase.ts` (ativação real do magic
      link)
- [ ] Validar RLS funcionando: editor pode ler/atualizar contatos mas não
      deletar; admin pode tudo

**Checkpoint 1.11:** todo o sistema funciona com dados reais do Supabase. Login
real funciona. Contatos enviados pelo formulário chegam no admin. Schema fechado.

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

**Checkpoint 1.12:** Lighthouse score 90+ em SEO (no mínimo) em todas as
páginas públicas.

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
completo (login + contatos + dashboard híbrido + placeholders), blog público
+ admin com UI pronta, Supabase ligado com schema fechado, formulário real,
métricas Lighthouse no target. **Pronto pra Fase 2.**

---

# FASE 2 — Revisão e iteração

**Estado de saída:** site aprovado em ambiente público de preview, com imagens
reais aplicadas e comentários de Nina endereçados, pronto pra ir pra produção.

**Custo:** zero (Vercel free temporário).

---

## 2.1 Deploy preview na Vercel

- [x] Criar projeto na Vercel conectado ao repo `Gattiboni/spinhardi_site`
- [x] **Plano Hobby (free) temporariamente** — uso é de preview/staging
- [x] Configurar deploy automático: push em `main` → URL pública
- [ ] Configurar variáveis de ambiente na Vercel (mesmas do `.env.local`)
- [x] URL ativa: `https://spinhardi-preview.vercel.app/`

**Checkpoint 2.1:** site acessível em URL pública. Nina, Julia e Amanda
conseguem abrir no celular.

---

## 2.2 Endereçar comentários de revisão da Nina

Comentários da Nina sobre a primeira versão do preview foram guardados durante
o build e serão atacados em sessão dedicada.

- [ ] Ler e categorizar comentários de Nina (texto, layout, navegação,
      conteúdo, outros)
- [ ] Filtrar bloqueantes vs. melhorias incrementais
- [ ] Implementar bloqueantes antes de continuar
- [ ] Documentar decisões tomadas sobre cada comentário (aceito / rejeitado /
      modificado) no DECISION_LOG ou em documento de iteração
- [ ] Re-enviar preview pra Nina validar correções

**Checkpoint 2.2:** todos os comentários de Nina endereçados (implementados ou
explicitamente justificados como rejeitados).

---

## 2.3 Mapeamento e aplicação em batch das imagens reais

Amanda forneceu orientação sobre as imagens. Aplicação será em sessão dedicada
no final, em batch único, conforme princípio definido na sessão de construção.

- [ ] Consolidar mapa de imagens — slots mapeados nas páginas + orientação da
      Amanda + entrega de Nina e Julia
- [ ] Receber pasta de imagens definitivas
- [ ] Sessão dedicada: análise de cada imagem + placement nos slots corretos
- [ ] Otimizar (próximo de 500KB cada, sRGB, formato WebP/AVIF)
- [ ] Substituir placeholders por imagens reais com `next/image`
- [ ] Validar visualmente em mobile e desktop
- [ ] Validar alt text contextual em todas as imagens (acessibilidade + SEO)
- [ ] Deploy

**Checkpoint 2.3:** site visualmente idêntico ao que vai pra produção.

---

## 2.4 Aprovação final

- [ ] Sessão de revisão final com Amanda (validação institucional)
- [ ] Sessão de revisão final com Nina e Julia (validação operacional)
- [ ] Aprovação explícita pra ir pra produção

**Checkpoint 2.4:** aprovação explícita registrada. Pronto pra contratar
serviços pagos e ir pra produção.

---

# FASE 3 — Produção

**Estado de saída:** site no ar em `spinharditurismo.com.br`, todos os serviços
pagos contratados e configurados, blog editável pela Amanda via Sanity,
formulário enviando e-mail real, analytics rodando, back office com Nina,
Julia e Amanda convidadas.

**Custo recorrente:** ~R$ 250/mês.

---

## 3.1 Contratações (na ordem)

### 3.1.1 Vercel Pro

- [ ] Upgrade do projeto na Vercel pra plano Pro ($20/mês)
- [ ] Cadastrar cartão virtual da Spinhardi
- [ ] Habilitar Vercel Analytics no projeto (incluído no Pro)
- [ ] Configurar spending limit como segurança contra surpresas

### 3.1.2 Supabase Pro

- [ ] Upgrade do projeto Supabase pra plano Pro ($25/mês)
- [ ] Timing: uma semana antes do go-live (margem pra testes em Pro)
- [ ] Validar que tudo funciona em Pro (auth, RLS, conexões)
- [ ] Configurar backups automáticos

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
- [ ] Configurar eventos de conversão:
  - Clique no WhatsApp
  - Envio de formulário de contato
  - Clique em CTA principal
- [ ] Adicionar Search Console à mesma conta Google
- [ ] Verificar propriedade via DNS ou meta tag
- [ ] Submeter sitemap.xml

---

## 3.2 Ligar Sanity ao site público e ao admin

- [ ] Trocar mock de blog por integração real com Sanity
- [ ] Implementar `lib/sanity/client.ts` e `lib/sanity/queries.ts`
- [ ] Atualizar `lib/blog/index.ts` pra consumir Sanity (`getPosts()`,
      `getPostBySlug()`)
- [ ] Decisão sobre `/admin/blog` (Sanity próprio ou interface dentro do nosso
      admin):
  - **Opção A:** Amanda usa Sanity Studio diretamente (mais simples, menos
    código nosso)
  - **Opção B:** Nosso `/admin/blog` consome API do Sanity (mantém UX
    consistente com o resto do back office)
  - Decisão final será tomada nesta etapa com Amanda
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
- [ ] Validar permissões funcionando (editor não vê Usuários/Integrações/
      Configurações)

**Checkpoint 3.3:** 4 contas ativas no back office.

---

## 3.4 Configurar DNS e domínio

- [ ] Apontar DNS de `spinharditurismo.com.br` pra Vercel:
  - Registro `A` apontando pro IP da Vercel
  - Registro `CNAME` `www` apontando pro domínio
- [ ] Adicionar domínio customizado na Vercel
- [ ] Validar HTTPS automático (Let's Encrypt via Vercel)
- [ ] Configurar redirect `www` → `apex` (ou vice-versa)
- [ ] Atualizar e-mail de contato do domínio no Registro.br
- [ ] Aguardar propagação DNS (até 24h, geralmente 1h)

**Checkpoint 3.4:** site acessível em `https://spinharditurismo.com.br`.

---

## 3.5 Checklist final de go-live

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
- [ ] Tag `v1.0.0` no repositório
- [ ] Commit final em `main` com mensagem
      `release: v1.0.0 — go-live spinharditurismo.com.br`

---

## 3.6 Treinamento e documentação

- [ ] Loom: tour completo do back office pra Nina e Julia (10-15 min)
  - Como ver contatos
  - Como mudar status / deixar nota
  - Como abrir WhatsApp direto
  - Como ler o dashboard
  - Como sair / problemas comuns
- [ ] Loom curto: como Amanda publica um post (Sanity Studio ou nosso admin
      conforme decisão na 3.2)
- [ ] Loom curto: monitoramento técnico pra Alan (Supabase, Vercel, logs)
- [ ] Criar `docs/MANUTENCAO.md` — o que fazer quando algo quebrar
- [ ] Atualizar README com URL de produção e links pros painéis
- [ ] Atualizar CHANGELOG com entrada de go-live
- [ ] Atualizar DECISION_LOG se tiver alguma decisão nova registrada na Fase 3

**Checkpoint Fase 3 COMPLETO:** site no ar, operacional, monitorado,
documentado, time treinado.

---

# FASE 4 — Pós-launch / Roadmap

**Estado de saída:** integrações operacionais, dashboard com dados reais,
camada de IA com primeira aplicação real, melhorias contínuas em ciclos curtos.

**Sem prazo fixo.** Cada item entra quando faz sentido.

---

## 4.1 Integrações operacionais

### IDAS (sistema de reservas)

- [ ] Implementar de verdade `lib/integrations/idas.ts`
- [ ] REST polling pra puxar dados (sem webhooks nativos)
- [ ] Tipagem TypeScript completa do schema IDAS
- [ ] Documentar endpoints usados em `docs/INTEGRATIONS.md`

### ClickMassa (WhatsApp CRM)

- [ ] Implementar `lib/integrations/clickmassa.ts`
- [ ] Mapear pipeline (11 stages) e tags (20) já configurados
- [ ] Documentar uso em `docs/INTEGRATIONS.md`

### Make (bridge IDAS ↔ ClickMassa)

- [ ] Criar cenário Make pra polling do IDAS e push pro ClickMassa
- [ ] Automação de follow-up por estágio de pipeline
- [ ] Documentar cenário em `docs/INTEGRATIONS.md`

### Formulário de contato com roteamento inteligente

- [ ] Webhook Make: formulário do site → ClickMassa (cria card) + e-mail
      (Resend)
- [ ] Tag automática no ClickMassa por origem (site, instagram, indicação)

---

## 4.2 Dashboard real

- [ ] Implementar `lib/analytics/ga4.ts` consumindo Data API do GA4
- [ ] Trocar provider ativo de mock pra GA4 real (1 linha em
      `lib/analytics/index.ts`)
- [ ] Adicionar cards reais do ClickMassa (conversas ativas, novos contatos)
- [ ] Adicionar cards reais do IDAS (reservas, faturamento do mês)
- [ ] Dashboard híbrido vira dashboard 100% real
- [ ] Remover badges "Mock" e "Em breve" do dashboard

---

## 4.3 Conectar integrações ao back office

- [ ] `/admin/integracoes` deixa de ser placeholder
- [ ] `/admin/integracoes/idas` — config (API key, polling interval) + logs
      últimas chamadas + botão "testar conexão"
- [ ] `/admin/integracoes/clickmassa` — similar
- [ ] `/admin/integracoes/make` — link pros cenários + status

---

## 4.4 Camada de IA

- [ ] Implementar `lib/ai/anthropic.ts` (provider real)
- [ ] Configurar `ANTHROPIC_API_KEY` em `.env.local` e Vercel
- [ ] Definir schema de contexto Spinhardi (produtos, perfis de cliente,
      destinos) — injetado em todos os prompts
- [ ] **Primeira aplicação:** `/api/ai/suggest-itinerary`
  - Recebe perfil de cliente (orçamento, interesse, tempo, perfil de viagem)
  - Retorna sugestão estruturada de roteiro
- [ ] Cada nova função de IA é um módulo separado em `lib/ai/modules/`
- [ ] Documentar arquitetura em `docs/AI_LAYER.md`

**Princípio:** troca de provider (Anthropic → outro) não toca código de
produto. Só muda a implementação do provider.

---

## 4.5 Página de Passagens Avulsas (interface operacional)

Conforme D020, Passagens Avulsas vira interface de booking operacional na
Fase 4, ligada ao IDAS.

- [ ] Definir UX da interface (rota dedicada, ex.: `/passagens` ou `/reservas`)
- [ ] Implementar consulta IDAS via `lib/integrations/idas.ts`
- [ ] Atualizar link do ServiceCard 01 da Home (atualmente aponta pra `/viagens`,
      vai apontar pra rota nova)

---

## 4.6 Melhorias contínuas

Lista aberta. Itens entram conforme priorização.

- [ ] Página de Política de Privacidade e Termos de Uso (recomendado mesmo
      simples)
- [ ] Página de cases/portfólio (quando houver depoimentos reais + permissão)
- [ ] Sistema de agendamento de posts no Sanity (plugin Scheduled Publishing)
- [ ] Subdomínios criativos pra campanhas
- [ ] Tradução EN-US (se houver demanda)
- [ ] Newsletter (integração com ferramenta de e-mail marketing — não Resend)
- [ ] Programa de indicação automatizado (ClickMassa + IDAS + Make)
- [ ] Implementação real de `/admin/usuarios` (quando virar dor)
- [ ] Implementação real de `/admin/configuracoes` (quando virar dor)

---

# Pendências externas (das sócias)

- [x] Aprovar cenário de domínio (Cenário com domínio existente)
- [x] Confirmar que `spinharditurismo.com.br` é da Spinhardi LTDA
- [x] Criar cartão virtual e enviar dados pra Alan
- [x] Aprovar preview inicial enviado em 2026-05-31
- [ ] Comentários da Nina sobre o preview — endereçados na Fase 2.2
- [ ] Indicação de imagens finais — aplicadas na Fase 2.3
- [ ] Nina aprovar criação da conta Gmail da Spinhardi (apenas informativo)
- [ ] Treinamento da Amanda no Sanity (agendar quando Fase 3 estiver próxima)
- [ ] Validação da mensagem padrão do WhatsApp

---

# Pendências técnicas em aberto

- [ ] Decidir formato exato dos `slug`s de blog (manter PT-BR, sem stop-words)
- [ ] Decidir política de retenção de submissões do formulário no Supabase
      (LGPD)
- [ ] Decidir backup strategy do Sanity (export periódico ou só confiar no
      SaaS)
- [ ] **Refazer `public/logos/logo-icone.svg` como vetor real** (atualmente
      PNG raster embutido com 288 KB — ver D017). Prioridade: ALTA quando virar
      favicon, porque impacta Core Web Vitals. Caminho sugerido: pedir ao
      Codinho redesenhar o pássaro como SVG vetorial puro a partir da
      referência visual existente.
- [ ] **Refazer `public/logos/logo-clara.svg` e `public/logos/logo-escura.svg`
      como vetor real** quando houver tempo de polimento. Prioridade:
      MÉDIA-BAIXA.
- [ ] **Manter `LIGHT_ROUTES` atualizada** (ver D018) — adicionar pathname de
      novas páginas com fundo claro à constante em
      `src/components/ui/Header.tsx`. Hoje contém `/dev/components`, `/sobre`,
      `/viagens`. Quando criar `/contato` e `/blog`, adicionar.
- [ ] Decidir formato definitivo do admin de blog na 3.2 (Sanity Studio direto
      vs interface dentro do nosso admin)

---

# Critérios de "pronto"

| Fase | Critério de "pronto"                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `npm run dev` roda. Site público completo. Back office completo (login + contatos + dashboard híbrido + placeholders). Blog público + admin com UI pronta. Supabase ligado.       |
| 2    | Aprovação institucional (Amanda) e operacional (Nina e Julia) em URL pública. Imagens reais substituídas. Comentários de Nina endereçados.                                        |
| 3    | Site no ar em `spinharditurismo.com.br` com HTTPS. Sanity ligado. Resend enviando. GA4 capturando. Back office com 4 contas ativas (Alan admin, Amanda admin, Nina editor, Julia editor). |
| 4    | Em fluxo contínuo. Cada item tem seu próprio critério.                                                                                                                            |

---

_Plano de Desenvolvimento v3 · Substitui v2 · Gattiboni Enterprises para
Spinhardi Turismo · Abril 2026_
