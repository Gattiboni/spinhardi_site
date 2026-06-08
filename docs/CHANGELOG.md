# CHANGELOG — Spinhardi Turismo Site

Registro cronológico de marcos, eventos e entregas do projeto de Presença
Digital Spinhardi.

Formato: `[DATA] Categoria — Descrição`

Categorias: `DECISÃO` | `SITE` | `DOC` | `DESIGN` | `INFRA` | `CONTRATO`

Ordem: mais recente no topo.

---

## 2026

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
