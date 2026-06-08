# DECISION_LOG — Spinhardi Turismo Site

Registro de decisões estratégicas do projeto: técnicas, de produto, de design e
operacionais. Cada entrada documenta o contexto, as alternativas consideradas, a
decisão tomada e o racional.

Isso evita que a mesma discussão aconteça duas vezes.

Ordem: mais recente no topo.

---

## Template

```
### [DATA] ID — Título da Decisão
**Contexto:** O que motivou essa decisão.
**Alternativas consideradas:** O que mais estava na mesa.
**Decisão:** O que foi escolhido.
**Racional:** Por quê.
**Responsável:** Quem decidiu.
**Status:** Ativa | Revisada | Superada | Resolvida
```

---

## Decisões Registradas

---

[2026-06-07] D023 — verifySession idempotente como defesa contra React Strict
Mode Contexto: Após implementação do back office estrutural (Lote A), um bug
intermitente apareceu: depois de logout + novo login, usuário ficava preso na
tela de /admin/login mesmo com fluxo completo executado (digitar e-mail, clicar
"Simular clique"). Curiosamente, digitar /admin direto na URL funcionava —
indicando que a sessão estava sendo criada no localStorage, mas algo cancelava o
redirect. Diagnóstico autônomo (lendo código) identificou a causa: React Strict
Mode em dev invoca cada useEffect duas vezes intencionalmente — é mecanismo de
defesa do React pra forçar idempotência. No verifySession original:

1ª invocação: lia pending-email, criava sessão no localStorage, removia
pending-email, retornava user, redirecionava pra /admin. 2ª invocação:
pending-email já tinha sido consumido, retornava null, redirecionava pra
/admin/login.

As 2 chamadas corriam em paralelo e a segunda vencia. A sessão criada pela
primeira persistia no localStorage (por isso /admin direto funcionava).
Alternativas consideradas:

(a) Desligar React Strict Mode no next.config.ts — mais rápido mas esconde a
causa-raiz e bugs futuros similares (b) Adicionar flag de "já chamou" em algum
estado externo — gambiarra (c) Tornar verifySession idempotente: se já existe
sessão, retorna ela direto sem mexer no pending-email

Decisão: (c). Tornar verifySession idempotente. Implementação em
src/lib/auth/mock.ts: tsasync verifySession() { if (typeof window ===
"undefined") return null;

// Idempotência: se já existe sessão, retorna ela direto. // Necessário pra
sobreviver ao Strict Mode (useEffect 2x em dev). const existing =
localStorage.getItem(STORAGE_KEY); if (existing) { try { return
JSON.parse(existing) as User; } catch { /* segue */ } }

const email = localStorage.getItem(PENDING_EMAIL_KEY); if (!email) return null;

const user: User = { /* ... */ }; localStorage.setItem(STORAGE_KEY,
JSON.stringify(user)); localStorage.removeItem(PENDING_EMAIL_KEY); return user;
} Resultado:

1ª invocação: não tem sessão, tem pending-email → cria sessão, remove
pending-email, retorna user, redirect pra /admin 2ª invocação: já tem sessão
(criada na 1ª) → retorna user da sessão, ignora pending-email, redirect pra
/admin (idempotente, é no-op)

Racional: desligar Strict Mode esconderia esse bug e qualquer outro similar que
possa aparecer em integrações futuras (Supabase Auth real no Lote C, GA4 na Fase
4, etc). Idempotência é o que o React pediu desde o início — Strict Mode existe
pra forçar exatamente esse cuidado. Resolver via idempotência é fazer o que era
esperado. Implicações pra Lote C (Supabase Auth real): quando supabaseAuth
substituir mockAuth, o método verifySession real também precisa ser idempotente.
Como Supabase usa cookies/JWT, isso é gerenciado pelo SDK automaticamente —
chamadas duplicadas de auth.getUser() são naturalmente idempotentes. Sem
trabalho extra. Responsável: Codinho (diagnóstico autônomo) + Alan (decisão
arquitetural) Status: Ativa Reversibilidade: Alta — basta voltar pra
implementação que consome pending-email na primeira chamada, mas Strict Mode
quebraria de novo.

[2026-06-07] D022 — Route Groups separando site público de admin Contexto: Após
o Lote do blog (Fase 1.4) ficou óbvio que o Header e o Footer públicos apareciam
sobrepostos ao admin (/admin/*) com aparência gambiarrenta. Inicialmente aceito
como "dívida temporária explícita" até o Lote A, ficou claro que tinha 2
caminhos: gambiarra (esconder Header via CSS condicional) ou refactor estrutural
(Route Groups do Next 16). Alternativas consideradas:

(a) Esconder Header/Footer no /admin/* via condicional (useEffect + CSS) —
funciona mas é gambiarra, root layout passa a ter lógica de UI que não é dele
(b) Mover páginas públicas pra Route Group src/app/(public)/ e dar layout
próprio. Admin permanece em src/app/admin/ com seu próprio layout. Root layout
vira minimal (html + body + fontes)

Decisão: (b). Refactor com Route Groups. Implementação:

Todas as 8 páginas públicas movidas via git mv (preserva histórico):

src/app/page.tsx → src/app/(public)/page.tsx src/app/sobre/, viagens/, contato/,
blog/, dev/ → idem dentro de (public)/ not-found.tsx e error.tsx → idem

Novo root layout minimal em src/app/layout.tsx: só html/body/fontes (Fraunces +
Montserrat) + metadata global Novo src/app/(public)/layout.tsx com chrome
público (Header, Footer, BackToTop) AdminLayout (src/app/admin/layout.tsx) ganha
autonomia visual completa — não compartilha mais nenhum elemento com público

Racional: Route Groups do Next 16 (pasta com nome entre parênteses) é exatamente
a primitiva certa pra esse cenário. NÃO afeta URLs — /sobre continua sendo
/sobre, não vira /public/sobre. Permite layouts independentes pro mesmo "nível"
de rota. Sem gambiarra, sem condicional, sem dívida. Implicações:

LIGHT_ROUTES no Header público deixa de precisar mencionar /admin/* (admin nunca
renderiza Header público mais). AdminLayout pode definir seu próprio chrome
(AdminHeader navy + AdminSidebar branca) sem nenhuma interferência do layout
público. 1 import absoluto em ContactForm.tsx (@/app/contato/actions) precisou
ser atualizado pra @/app/(public)/contato/actions — único caso. Todos os outros
imports usam @/ alias que sobrevive ao move.

Responsável: Alan Gattiboni (decisão arquitetural, após explicação do trade-off
por Claudinho) Status: Ativa Reversibilidade: Média — reverter exige git mv na
direção inversa em 8 caminhos + remover layout do public group + restaurar
chrome no root. Não é trivial mas é mecânico.

[2026-06-07] D021 — Auth mockado via localStorage no Lote A; Supabase Auth real
fica no Lote C Contexto: Lote A precisava entregar back office estrutural
completo (login

middleware + AdminLayout + Sidebar + AdminHeader). Mas auth real via Supabase
depende de várias peças que só estarão prontas no Lote C: tabela user_profiles
no Supabase, configuração SMTP no Supabase Pro pra enviar magic links, e
auth.users populado com contas convidadas (que só virão na Fase 3 com o convite
formal a Nina/Julia/Amanda).

Alternativas consideradas:

(a) Esperar o Lote C pra construir back office — atrasa todo o resto da Fase 1
(b) Construir back office com auth real desabilitado, retornando user hardcoded
— funciona mas não testa o fluxo de login real (c) Construir back office com
auth mockado via localStorage, com arquitetura idêntica ao Supabase real —
permite testar fluxo completo de login + logout + permissões + role override

Decisão: (c). Auth mockado via localStorage no Lote A, estrutura idêntica ao
Supabase real, plug em 1 linha no Lote C. Implementação:

src/lib/auth/provider.ts: interface AuthProvider com 4 métodos (signIn, signOut,
getUser, verifySession) src/lib/auth/mock.ts: implementação via localStorage
(chaves: spinhardi-admin-session, spinhardi-pending-email,
spinhardi-admin-role-override) src/lib/auth/supabase.ts: stub vazio com TODO
marcado pro Lote C src/lib/auth/index.ts: export const auth = mockAuth; — no
Lote C vira export const auth = supabaseAuth;. Zero refactor em código de
produto. src/lib/auth/roles.ts: Role = "admin" | "editor" + helper
hasPermission(role, path) Role override em dev: toggle no AdminHeader
(admin/editor) salva chave spinhardi-admin-role-override no localStorage.
getSession() aplica o override quando lê a sessão. Visível apenas em
process.env.NODE_ENV === "development". Permite testar UX dos 2 perfis sem
precisar de 2 contas reais.

Racional:

Princípio da incrementalidade: back office estrutural pode ser construído e
validado sem depender de SMTP configurado, Supabase Pro contratado, ou contas
reais convidadas. Modularidade: abstração AuthProvider permite trocar provider
sem tocar páginas. Páginas chamam auth.signIn(email) — não importa se é mock ou
Supabase. Zero dívida técnica: quando Supabase entrar no Lote C, mock pode ser
deletado inteiro (ou mantido como teste). Nada de código de produto muda.

Trade-off honesto registrado: localStorage NÃO é seguro como auth de produção.
Mas estamos em dev, com URL preview privada (Vercel Hobby), sem dados reais
sensíveis. Em produção (Fase 3) vai ser Supabase Auth com JWT, sessions seguras,
RLS no banco. Implicações:

Middleware do Next 16 (middleware.ts na raiz) é mínimo no Lote A: libera
/admin/login*, demais rotas passam pra validação client-side no AdminLayout
(porque Edge Runtime não tem acesso a localStorage). No Lote C com Supabase,
middleware passa a validar server-side via cookies. AdminLayout
(src/app/admin/layout.tsx) é Client Component, valida sessão via auth.getUser()
no useEffect. Quando Supabase entrar, mesma estrutura funciona porque o método
getUser() continua igual.

Responsável: Alan Gattiboni (decisão arquitetural) Status: Ativa
Reversibilidade: Alta — quando Supabase Auth entrar (Lote C), basta atualizar
src/lib/auth/index.ts pra exportar supabaseAuth em vez de mockAuth.

---

### [2026-05-31] D020 — Passagens Avulsas: serviço sem página dedicada na Fase 1, virá com interface de booking operacional

**Contexto:** Durante a construção do hub de Viagens (`/viagens`), o mapa de
copies aprovado pela Amanda especifica claramente apenas 2 cards no hub
(Pacotes + Sob Medida). "Passagens Avulsas" aparece como serviço listado na Home
(Tabela 6 — "01 Passagens e Serviços Avulsos"), mas não tem página dedicada no
mapa de copies.

Investigando, ficou claro que isso não é esquecimento — é decisão estratégica:
Passagens Avulsas é o serviço mais operacional e transacional dos 3 (passagem
aérea, hospedagem, transfer, seguro), com fluxo de booking direto. Faz mais
sentido tratar isso como **interface de booking real** quando entrarmos em
operação plena, não como página de marketing.

**Decisão:** Na Fase 1 (presença digital), Passagens Avulsas:

- Permanece listada na Home como um dos 3 serviços
- ServiceCard correspondente aponta provisoriamente pra `/viagens` (hub) —
  comportamento aceitável porque o hub apresenta os 2 serviços principais
- **Não recebe página dedicada** em `/viagens/passagens` na Fase 1
- Será endereçada na **Fase 4** (pós-launch) junto com integração IDAS +
  ClickMassa, como interface de booking operacional, possivelmente em subdomínio
  ou rota separada (`/passagens` ou `/reservas`)

**Por que registrar como decisão e não como pendência:** porque é uma escolha
consciente de **escopo e timing**, não um item esquecido. Pendência implica
"ainda não resolvido"; decisão implica "resolvido assim, reversível se a
estratégia mudar".

**Implicações:**

- Verificado que `src/app/page.tsx` (Bloco 3, Card 01) já aponta pra `/viagens`
  (hub), portanto sem ajuste técnico necessário.
- Adicionar nota institucional na mensagem de aprovação pra Nina e Julia
  explicando a decisão.

**Responsável:** Alan Gattiboni (decisão estratégica) **Status:** Ativa
**Reversibilidade:** Alta — se for decidido criar página de marketing pra
Passagens Avulsas antes da Fase 4, basta criar `/viagens/passagens/page.tsx` e
ajustar o link no Card 01.

---

### [2026-05-31] D019 — Regras CSS base no Tailwind v4 DEVEM estar dentro de @layer base

**Contexto:** Durante a construção da Home (Fase 1.3), os links de navegação do
Header apareceram em cor escura sobre o hero navy mesmo com a classe
`text-white` aplicada corretamente no JSX. Bug não tinha sido detectado nas
fases anteriores porque `/dev/components` (único contexto onde links sobre fundo
"real" foram testados) tem fundo branco — links em cor escura ali ficavam
acidentalmente legíveis.

**Diagnóstico (Codinho):** o `globals.css` tinha regras base (`body`, `h1..h6`,
`a`) escritas **fora de qualquer `@layer`**. No Tailwind v4, o
`@import "tailwindcss"` coloca tudo (preflight + utilities) dentro de `@layer`.
Na cascata do CSS do navegador, **regras sem layer sempre vencem regras com
layer**, independente de especificidade ou ordem de declaração.

Resultado prático: a regra `a { color: inherit }` (sem layer) atropelava
`.text-white { color: var(--color-white) }` (em `@layer utilities`). Os `<a>`
herdavam do `body` → `--color-dark` → invisíveis sobre navy.

Alcance do bug:

- Links do nav no Header (invisíveis sobre navy/transparente)
- CTAWhatsApp variant secondary (texto vermelhado nos `<a>`)
- Potencialmente todos `<a>` sobre fundos escuros que dependiam de utility de
  cor

**Alternativas consideradas:**

- Aumentar especificidade de cada utility no Header (`!important`, seletores
  compostos): viola Tailwind, espalha gambiarra pelo código
- Sobrescrever todos `<a>` com classes inline em cada uso: trabalho repetitivo e
  propenso a esquecimento
- **Envolver as regras base num `@layer base` no `globals.css`:** solução
  estrutural, 4 linhas de mudança no CSS, comportamento volta ao esperado em
  toda a aplicação

**Decisão:** Todas as regras CSS base (elementos sem classe — `body`, `h1..h6`,
`a`, e futuros como `button`, `input`, etc) DEVEM estar dentro de um bloco
`@layer base { ... }` no `globals.css`. Assim, utility classes do Tailwind
ganham na cascata como esperado, e qualquer override pontual via classe
sobrescreve a base corretamente.

Mudança aplicada em `src/app/globals.css`:

```css
@layer base {
  body { ... }
  h1, h2, h3, h4, h5, h6 { ... }
  a { color: inherit; text-decoration: none; }
  /* scroll-padding-top também ficou aqui dentro por consistência */
}
```

**Regra operacional do projeto a partir daqui:** ao adicionar qualquer seletor
de elemento HTML "puro" (sem classe) no `globals.css`, garantir que está dentro
de `@layer base`. Seletor sem layer cria dívida técnica silenciosa que só se
manifesta em contexto específico.

**Aprendizado meta:** este é o segundo gap silencioso descoberto na fundação do
Tailwind v4 (o primeiro foi D016 — namespaces customizados precisam de
`@utility` explícito). Padrão emergente: **a transição do Tailwind v3 pro v4
mudou regras de cascata e geração de utilities de formas não-óbvias**. Quando
algo "obviamente certo" parece não funcionar, suspeitar de comportamento de
`@layer` e `@utility` antes de qualquer outra coisa.

**Responsável:** Alan Gattiboni (validação visual) · Codinho (diagnóstico e
implementação) **Status:** Ativa

---

### [2026-05-31] D018 — Header global com adaptação de fundo por rota via usePathname

**Contexto:** Durante implementação do Bloco 5, o Header foi desenhado com
comportamento dinâmico (transparente no topo → sólido após scroll), assumindo
que todas as páginas começariam com hero navy. Durante validação visual, ficou
claro que páginas com fundo claro (como `/dev/components`, e futuramente
`/sobre`, `/viagens`, `/blog`, `/contato`) deixam o Header transparente
invisível ou em conflito visual com o conteúdo.

Como o Header está no `layout.tsx` global (renderiza uma única vez pra todas as
rotas), uma prop boolean (`forceSolid`) não resolveria — o layout não sabe qual
rota está sendo renderizada.

**Alternativas consideradas:**

- Layouts aninhados (`(public)/layout.tsx` vs `(internal)/layout.tsx`): refactor
  grande, separação prematura, exige reorganizar toda a estrutura de rotas
- Prop `forceSolid` no Header: descartado — não funciona com layout global
- Context provider (`useHeaderStyle`): mais código, mais ponto de configuração
  por página, fácil de esquecer
- `usePathname()` dentro do Header + lista hardcoded de rotas claras: simples,
  centralizado, modular, 10 linhas

**Decisão:** Header detecta a rota atual via `usePathname()` (hook do Next 16
disponível em Client Components). Mantém uma constante `LIGHT_ROUTES` no próprio
arquivo do Header — lista de rotas que renderizam em fundo claro. Quando o
Header está sendo renderizado em rota clara, força modo sólido desde o pixel 0
(sem fase transparente). Quando está em rota com hero navy, mantém comportamento
dinâmico (transparente → sólido ao scrollar).

Implementação:

```ts
const LIGHT_ROUTES = ["/dev/components"];
const pathname = usePathname();
const isLightRoute = LIGHT_ROUTES.some((route) => pathname.startsWith(route));
const isSolid = isLightRoute || scrolled;
```

Otimização: quando `isLightRoute === true`, o `useEffect` faz early-return e não
registra listener de scroll — sem trabalho desnecessário.

**Racional:** Solução proporcional ao problema. Quando criarmos páginas internas
(Sobre, Viagens, Blog, Contato), basta adicionar o pathname à lista.
Centralizado no Header — quem mexer no comportamento do Header tem todo o
contexto num só lugar. Migração futura pra layouts aninhados continua possível
se a lista crescer muito.

**Pendência operacional:** atualizar `LIGHT_ROUTES` à medida que páginas com
fundo claro forem criadas. Hoje a lista contém apenas `/dev/components`. Quando
Sobre, Viagens, Blog, Contato forem implementadas e tiverem fundo claro,
adicionar.

**Responsável:** Alan Gattiboni (decisão) · Codinho (implementação) **Status:**
Ativa

---

### [2026-05-31] D017 — Logos como SVG raster embutido aceito como dívida técnica formal na v1

**Contexto:** Os 3 arquivos de logo exportados do Canva (`logo-clara.svg`,
`logo-escura.svg`, `logo-icone.svg`) foram identificados pelo Codinho durante o
Bloco 4 da Fase 1.2 como SVG com PNG raster embutido (não vetor real).
Funcionam, mas:

- Pixelizam quando ampliados muito além do tamanho original
- Tamanho de arquivo desproporcional (`logo-icone.svg` com 288 KB, esperado <10
  KB pra vetor real)
- `logo-icone` vai virar favicon — peso alto degrada Largest Contentful Paint da
  página
- Não permite mudança de cor via CSS (que SVG vetorial permitiria, ex: ícone
  gold → ícone branco no hover)

**Alternativas consideradas:**

- Refazer no Canva exportando vetor real: Canva Pro nem sempre garante vetor
  100% — o pássaro pode ser ilustração já rasterizada na origem
- Pedir ao Codinho redesenhar o pássaro como SVG vetorial puro (factible pro
  ícone, complexo pra logo completa com tipografia)
- Contratar designer pra refazer logo em formato vetorial
- Aceitar raster embutido como dívida técnica formal e registrada

**Decisão:** Aceitar raster embutido como dívida técnica conhecida na v1 do
site. Componente `Logo.tsx` já está estruturado pra trocar os arquivos sem mudar
uma linha de código — basta substituir os SVGs em `public/logos/`. Resolução
fica como item explícito no roadmap de "Melhorias contínuas" pós-launch.

**Racional:** Performance e qualidade visual não estão impactadas
significativamente em tamanhos de uso típicos do site (Header ~240×80, ícone
~40×40). O custo de resolver agora (refazer no Canva ou contratar designer) é
desproporcional ao benefício na fase atual. Quando o site estiver no ar e houver
tempo de polimento, o `logo-icone.svg` é a prioridade pra refazer como vetor
(impacto em favicon + Open Graph + ícone mobile).

**Pendência operacional:** monitorar Core Web Vitals após go-live. Se LCP ou TBT
degradarem por causa dos logos, prioridade sobe.

**Responsável:** Alan Gattiboni (decisão) · Codinho (detecção) **Status:** Ativa
(com pendência técnica registrada no plano v2)

---

### [2026-05-31] D016 — Tokens de duração precisam de @utility explícito no Tailwind v4

**Contexto:** Durante o Bloco 3 da Fase 1.2 (Button + Cards), os componentes
começaram a usar as classes `duration-medium` e `duration-long` definidas como
tokens no `@theme inline` do `globals.css` (registradas no Bloco 1). Inspeção do
CSS gerado revelou que essas classes **não estavam sendo criadas** — caíam no
fallback de 150ms do Tailwind em vez dos 400ms / 750ms pretendidos.

**Causa raiz:** o Tailwind v4 só gera utility classes automaticamente a partir
de tokens em namespaces específicos (`--color-*`, `--font-*`, `--spacing-*`,
`--breakpoint-*`, `--ease-*`). Tokens em namespaces customizados — como o nosso
`--duration-*` — exigem registro explícito via diretiva `@utility`.

**Alternativas consideradas:**

- Manter o fallback de 150ms: descartado — esvazia o sistema de transições
  baseado nas referências (especialmente `franshalsmuseum.nl`, que prevê
  400-750ms pra efeitos de imagem)
- Usar arbitrary values inline (`duration-[400ms]`): descartado — espalha
  valores mágicos pelo código, viola modularidade, alteração futura exige mexer
  em N componentes em vez de 1 token
- Registrar `@utility` explícito no `globals.css`: escolhido — mantém os tokens
  como fonte de verdade, semântica preservada nos componentes (`duration-medium`
  em vez de `duration-[400ms]`), zero dívida técnica

**Decisão:** Adicionados 3 `@utility` ao `globals.css` logo após o bloco
`@theme inline`, registrando `duration-short`, `duration-medium` e
`duration-long` como classes funcionais que leem os tokens correspondentes.

```css
@utility duration-short {
  transition-duration: var(--duration-short);
}
@utility duration-medium {
  transition-duration: var(--duration-medium);
}
@utility duration-long {
  transition-duration: var(--duration-long);
}
```

**Racional e aprendizado operacional:** o Tailwind v4 oferece geração automática
de utilities para os namespaces "padrão", mas qualquer token customizado fora
deles precisa de `@utility` explícito. **Regra do projeto a partir daqui:** ao
definir um token novo no `@theme`, validar que ele gera utility ou registrar
`@utility` correspondente antes de declarar o bloco fechado. Tokens decorativos
(sem utility) são dívida técnica silenciosa.

**Responsável:** Alan Gattiboni (aprovação) · Codinho (detecção e implementação)
**Status:** Ativa

---

### [2026-05-31] D015 — Container como esqueleto puro, decisões de composição ficam nos consumidores

**Contexto:** Ao criar o componente `Container` no Bloco 2 da Fase 1.2, houve
tensão entre dois caminhos: (a) o Container ditar alinhamento e largura conforme
cada caso de uso (centro, esquerda, larguras variáveis), ou (b) o Container ter
responsabilidade única e mínima, deixando composições específicas pros
componentes que o consomem.

**Alternativas consideradas:**

- Container com props de alinhamento (`align="left" | "center"`) e múltiplas
  larguras (`size="sm" | "md" | "lg"`): mais flexível na chamada, mas infla a
  API e cria variantes mágicas
- Container minimalista (`max-w-7xl mx-auto` + padding horizontal responsivo,
  prop `as` pra semântica): API enxuta, comportamento previsível, composição
  feita nos children
- Vários componentes de container (`HeroContainer`, `BlogContainer`, etc):
  granular demais, duplicação inútil

**Decisão:** Container minimalista. Responsabilidades únicas:

1. Aplicar `max-w-7xl` (largura máxima do conteúdo institucional)
2. Aplicar `mx-auto` (centralização horizontal do bloco)
3. Aplicar padding horizontal responsivo (`px-4` mobile, `lg:px-12` desktop)
4. Permitir mudar a tag HTML via prop `as` (semântica)
5. Permitir extensão pontual via prop `className`

Decisões de alinhamento interno (texto à esquerda, grid, flex), cor de fundo,
max-width customizado e composições específicas são responsabilidade do
componente consumidor (Hero, Footer, BlogGrid, etc), não do Container.

**Racional:** Container puro é reusável em qualquer contexto sem cláusulas
especiais. Quando Hero, Footer e outras estruturas vierem nos próximos blocos,
eles vão **compor** com Container (envolvendo) e aplicar as decisões específicas
via classes adicionais ou wrappers internos. Princípio "modularidade": cada
componente faz uma coisa bem feita, sem inventar responsabilidades extras.

**Implicação prática:** A página `/` (validação de tokens) sofreu mudança visual
ao adotar o Container — antes era `max-w-5xl` alinhado à esquerda, agora é
`max-w-7xl` centralizado. Aceitável porque a página `/` é provisória e será
reescrita quando Hero entrar na Fase 1.2.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-05-31] D014 — Fontes display e body: Fraunces + Montserrat (Google Fonts)

**Contexto:** O Branding Book Lite v2 e o `docs/identidade_visual.md`
especificam **TT Fors Display** como fonte de títulos e **Montserrat** como
fonte de corpo. TT Fors Display é fonte comercial paga (TypeType), sem
disponibilidade no Google Fonts. Necessário decidir antes de configurar tokens
de tipografia.

**Alternativas consideradas:**

- TT Fors Display licenciada: fonte exata do Branding Book, mas exige licença
  web (~$190+) imediatamente e setup de self-hosting de fontes
- Fraunces (Google Fonts): serif contemporâneo, geométrico, com múltiplos pesos
  via `next/font/google`, gratuita, integração nativa com Next.js
- DM Serif Display: serif mais clássico, menos flexível em pesos
- Cormorant Garamond: serif elegante mas mais tradicional

**Decisão:** **Fraunces** como fonte de display e **Montserrat** como fonte de
body, ambas via `next/font/google`. Carregamento automático com `display: swap`,
sem dependência externa, sem custo de licenciamento na Fase 1.

Pesos carregados:

- Fraunces: 400, 500, 600
- Montserrat: 300, 400, 500, 600

**Racional:** Fraunces preserva o espírito editorial e contemporâneo do TT Fors
Display sem tentar imitá-la literalmente. Não é decisão "provisória" como o D006
(verde) — é decisão funcional com horizonte de longo prazo. A aquisição de TT
Fors Display continua sendo possível no futuro, mas não está no radar imediato.
Trocar fonte depois é mexer em 2 linhas do `layout.tsx` — zero dívida técnica
gerada por essa escolha.

**Responsável:** Alan Gattiboni **Status:** Ativa (reversível se houver decisão
futura de licenciar TT Fors Display)

---

### [2026-05-29] D013 — Tooling de desenvolvimento: ESLint 9 + Prettier sem Husky/lint-staged

**Contexto:** Plano de Desenvolvimento v2 previa configuração de "ESLint +
Prettier + Husky (lint antes de cada commit)" na Fase 1.1. Ao chegar nesse
ponto, reavaliação à luz do tamanho real do time do projeto.

**Alternativas consideradas:**

- ESLint + Prettier + Husky + lint-staged (plano original): automatiza
  verificações pré-commit, garante padrão mesmo se múltiplos devs commitarem
- ESLint + Prettier sem Husky: padrão garantido por rodar manualmente quando
  necessário, sem armadilha automática
- Apenas ESLint (sem Prettier): perde o formatador automático, mais
  inconsistência

**Decisão:** ESLint 9 (já configurado pelo `create-next-app`) + Prettier 3,
integrados via `eslint-config-prettier/flat` (padrão recomendado pela doc
oficial do Next.js 16). Husky e lint-staged descartados.

Pacotes instalados como devDependencies:

- `prettier`
- `eslint-config-prettier`

Pacote inicialmente instalado mas removido (desencorajado pela comunidade em
2026):

- `eslint-plugin-prettier`

Configuração:

- `.prettierrc` com convenções modernas (semi, double quotes, trailing all,
  printWidth 100, endOfLine lf)
- `.prettierignore` protege documentação manual (`docs/**/*.md`, `*.docx`,
  `*.html`, `*.json` de refs) — Prettier formata apenas código, não escrita
  humana
- `eslint.config.mjs` adiciona `prettier` (config flat) como última camada
- Scripts adicionados ao `package.json`: `lint:fix`, `format`, `format:check`

**Racional:** O time efetivo do projeto é Alan + Claude (consultoria) + Claude
Code (execução). Husky e lint-staged servem pra impor padrão em times com
múltiplos devs humanos commitando direto. Para um trio fechado onde o operador
humano é detalhista e os agentes de IA seguem instruções diretas, automação
pré-commit é overhead desnecessário sem benefício real. Padrão é mantido rodando
`npm run format` e `npm run lint:fix` quando necessário. Decisão é reversível a
qualquer momento — basta instalar e configurar Husky depois se o time mudar de
tamanho.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-05-29] D012 — Sistema de blog: Sanity como CMS, supera D003

**Contexto:** A D003 definiu MDX + schema TypeScript + interface custom de admin
como solução de blog. Reavaliada após pesquisa estruturada em 2026 (Perplexity
Pro + comparação real entre Sanity, Payload, Strapi, Contentful) e clareza sobre
quem opera o sistema na prática: Amanda publica posts, não Alan.

**Alternativas consideradas:**

- Manter D003 (MDX + admin custom): exige construir UI de admin do zero, 1-2
  semanas de dev, mais código pra manter
- Payload CMS: tecnicamente brilhante (TypeScript-first, schema em código) mas
  self-hosted exige monitoramento de patches de segurança (2 CVEs críticos em
  2025-2026)
- Strapi: open-source maduro mas overhead de self-hosting sem o ganho do
  TypeScript-first
- Contentful: removeu free tier em Q2 2025, plano mais barato $300/mês —
  inviável
- Sanity: hosted, free tier generoso (2 datasets, 10k documentos, 2 usuários),
  Sanity Studio operável por não-técnico com configuração deliberada, CDN de
  imagem com transformação automática WebP/AVIF

**Decisão:** Sanity adotado como CMS do blog. Free tier cobre a Fase 1 com
folga. Upgrade pra Growth ($15/seat) só quando crescer pra mais de 2 usuários
ativos. Studio em inglês (Amanda lida bem). Schema modelado em código, deploy do
Studio em subdomínio próprio. Posts não ficam mais no Git como MDX — ficam no
Content Lake do Sanity, com export disponível como NDJSON pra portabilidade.

**Racional:** Construir admin custom era a abordagem certa em 2024, quando D003
foi tomada. Em 2026, com Sanity oferecendo free tier maduro e Sanity Studio
sendo genuinamente operável por não-técnicos, construir do zero vira reinventar
a roda. Princípio "Crescer aos poucos" se aplica: cada nova coisa entra quando
faz sentido, e CMS pronto e bem mantido faz sentido. Lock-in mitigado: schema em
código no nosso repo, conteúdo exportável a qualquer momento.

**Responsável:** Alan Gattiboni **Status:** Ativa (supera D003)

---

### [2026-05-29] D011 — Analytics: GA4 + Search Console + Vercel Analytics, sem Looker Studio

**Contexto:** Plano de desenvolvimento v1 mencionava "GA4 via GTM + Looker
Studio dashboard". Necessidade de revalidar essa escolha em 2026 considerando
limitações conhecidas e alternativas.

**Alternativas consideradas:**

- GA4 + Looker Studio (plano original): Looker tem limitação grave de não
  suportar formato de data brasileiro DD/MM/AAAA — deal-breaker conhecido
- GA4 + Plausible/Fathom: ferramentas privacy-friendly, cookieless, dashboards
  mais limpos, mas custo recorrente $9-15/mês
- GA4 + PostHog: adiciona session replay, free tier 1M eventos/mês, complexo
  demais pra Fase 1
- Apenas GA4 + Google Search Console: gratuito, suficiente pro essencial, UX
  ruim mas tolerável

**Decisão:** GA4 + Google Search Console + Vercel Analytics como stack de
analytics da Fase 1. Looker Studio eliminado. Plausible e PostHog ficam como
roadmap pós-launch se houver necessidade real (não como prevenção). Vercel
Analytics incluído sem custo no plano Vercel Pro — entrega Core Web Vitals reais
por rota e região, dado que GA4 não tem.

**Racional:** O Google é "criança chata dona da bola" — apesar da UX ruim do
GA4, é o padrão de mercado e integra com Search Console, Ads e ecossistema.
Tolerável apanhar disso, já estamos acostumados. Looker é descartado
categoricamente: ferramenta não aguenta mudar formato de data pra padrão
brasileiro, e isso é inegociável. Vercel Analytics complementa sem custo
adicional. Decisão de adotar ferramentas pagas (Plausible, PostHog) só se houver
dor real, não preventivamente.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-05-29] D010 — E-mail transacional: Resend desde o início

**Contexto:** Formulário de contato do site precisa enviar e-mails confiáveis
pra caixa das sócias. Sem ferramenta definida no plano v1. Necessário escolher
serviço dedicado de e-mail transacional (não confundir com e-mail profissional).

**Alternativas consideradas:**

- SMTP genérico do Hostinger ou similar: configuração fácil mas deliverability
  ruim, cai em spam, sem logs decentes
- SendGrid: padrão antigo do mercado, mas UX deteriorada após aquisição pela
  Twilio, deliverability inconsistente
- Amazon SES: barato em escala mas setup complexo (sandbox, warm-up de IP,
  gestão manual de bounces), sem free tier real
- Postmark: melhor deliverability do mercado, mas free tier limitado (100 emails
  em trial), $15/mês depois
- Resend: free tier generoso (3.000 emails/mês, 100/dia), SDK TypeScript nativo
  com suporte explícito a Next.js Server Actions, React Email pra templates,
  setup DNS documentado

**Decisão:** Resend no free tier desde o início. Upgrade pra Pro ($20/mês)
gatilhado quando uso atingir 80% do limite mensal por 2 meses consecutivos, OU
quando for necessário um segundo domínio enviador. Monitoramento trimestral
compartilhado entre Alan e Amanda.

**Racional:** Pra volume estimado da Fase 1 (até 100 emails/mês), o free tier
cobre com folga absurda. Adotar serviço dedicado de transacional desde o dia 1
evita o erro comum de "depois eu resolvo" e usar SMTP genérico que cai em spam.
Resend tem o melhor DX entre os serviços modernos pra stack Next.js. Trocar de
provider depois é trivial — implementação fica em `lib/email/resend.ts` atrás de
interface genérica.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-05-29] D009 — Banco de dados: Supabase Pro desde o go-live, sem flertar com free tier em produção

**Contexto:** Supabase escolhido como banco de dados. Tier free tem catch
crítico: pausa projetos inativos após 7 dias. Inaceitável em produção.

**Alternativas consideradas:**

- Supabase free tier em produção: economiza $25/mês mas risco de perder
  mensagens do formulário se site ficar 7 dias sem tráfego
- Neon free tier: sem pause agressivo, mas cold start de 1-2s na primeira
  requisição
- Vercel Postgres: era powered by Neon, sem diferencial real
- PlanetScale: tirou free tier em abril/2024, fora do páreo
- Supabase Pro: $25/mês, sem pause, backups automáticos, suporte priority

**Decisão:** Supabase Pro ativado uma semana antes do go-live. Durante
desenvolvimento (Fase 1), tier free é tolerável porque é dev. Conta administrada
pela Gattiboni (Alan) por conveniência operacional, transferível pra Spinhardi
via ferramenta nativa do Supabase se contrato terminar.

**Racional:** Pra uma agência que cresce por indicação, perder um único lead do
formulário por causa de banco pausado é inaceitável. $25/mês é seguro de
produção, não economia mal-direcionada. A separação entre "infra técnica fica
com Gattiboni, dados de negócio com Spinhardi" segue o princípio de propriedade
correta: o cliente é dono dos próprios dados, opera a infra quem sabe operar.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-05-29] D008 — Hospedagem: Vercel Pro obrigatório, supera D005

**Contexto:** D005 estabeleceu deploy inicial em Vercel free com domínio
customizado. Necessária revalidação ao confirmar que o plano Hobby (free) da
Vercel proíbe explicitamente uso comercial nos termos de uso.

**Alternativas consideradas:**

- Manter D005 (Vercel free): proibido por ToS pra uso comercial, risco de
  suspensão inesperada
- Cloudflare Pages: free tier sem restrição comercial, mas suporte a Next.js App
  Router menos maduro
- Netlify Pro: $19/mês, comparable a Vercel Pro, sem ecossistema otimizado pra
  Next.js
- Vercel Pro: $20/mês, uso comercial liberado, edge nodes globais, 1TB
  bandwidth, spending limit configurável

**Decisão:** Vercel Pro adotado como hospedagem oficial. Ativação na transição
da Fase 2 (preview público em URL temporária da Vercel) pra Fase 3 (go-live em
spinharditurismo.com.br). Durante Fase 1 (localhost) e Fase 2 (preview), uso de
Vercel Hobby é tolerável porque é dev/staging não-comercial. Spending limit
configurado pra prevenir surpresas de custo.

**Racional:** Não é decisão técnica, é regra de uso explícita da Vercel. Hobby é
pra projetos pessoais não-comerciais. Site institucional de cliente é uso
comercial. O ToS é claro. Cloudflare Pages teria sido alternativa válida, mas
trocar de plataforma agora introduziria fricção desnecessária dado que toda a
stack está otimizada pra Vercel.

**Responsável:** Alan Gattiboni **Status:** Ativa (supera D005)

---

### [2026-05-29] D007 — Domínio: usar spinharditurismo.com.br existente, supera D005 parcialmente

**Contexto:** D005 mencionava "comprar domínio separadamente (Registro.br ou
Cloudflare — decidir na hora)". Consulta WHOIS revelou que
`spinharditurismo.com.br` já existe registrado em nome da Spinhardi Turismo LTDA
(CNPJ 53.291.591/0001-60), válido até 08/01/2027, com Nina como responsável
original e Alan agora como contato técnico habilitado.

**Alternativas consideradas:**

- Comprar `spinhardi.com.br` novo no Registro.br (R$40/ano): handle mais curto,
  mas sem consistência com o Instagram (@spinharditurismo)
- Comprar `spinhardi.com` no Cloudflare Registrar como redirect adicional
  (~R$110/ano): proteção de marca futura, fica como roadmap se sócias quiserem
  depois
- Comprar `spinhardi.travel` (~R$1.150/ano renovação): autoridade do TLD
  verificado, mas custo desproporcional
- Aproveitar `spinharditurismo.com.br` existente: zero custo adicional,
  consistência com Instagram, domínio já tem 2 anos de idade (pequeno bônus de
  SEO)

**Decisão:** `spinharditurismo.com.br` como domínio único e principal do site.
Sem aquisição de domínios adicionais na Fase 1. `.com` e `.travel` ficam como
possibilidades pra ações de marca futuras, decisão das sócias. DNS apontará pra
Vercel quando da transição pra Fase 3 (produção). Custo: apenas renovação anual
no Registro.br (R$40/ano), já planejada.

**Racional:** O melhor domínio é o que já existe e está pronto. Spinhardi LTDA é
titular legítima, válido até 2027, sem dor de transferência ou aquisição.
Subdomínios criativos (`viajedeverdade.spinharditurismo.com.br`, etc) ficam
disponíveis gratuitamente pra campanhas futuras. Não complicar o que está
simples.

**Responsável:** Alan Gattiboni (validação técnica) + Nina e Julia (aprovação de
marca) **Status:** Ativa (supera D005 parcialmente — domínio definido,
hospedagem revista em D008)

---

### [2026-04-28] D006 — Verde provisório `#4DBF72` para desenvolvimento

**Contexto:** As sócias insistiram em um verde vibrante próximo de `#99fe00`
(lime). O Branding Book usa `#8CB89F` (sage dessaturado). Há conflito entre
preferência das sócias e qualidade visual da paleta.

**Alternativas consideradas:**

- `#99fe00` — lime gritante pedido pelas sócias: descartado por ser amarelado,
  sem elegância, incompatível com posicionamento premium
- `#8CB89F` — sage do Branding Book: mantido como referência oficial, mas pouco
  vibrante para o que as sócias querem
- `#5CB87A` — verde médio, elegante: candidato forte
- `#4DBF72` — mais vibrante que o sage, menos agressivo que o lime: escolhido
  para teste

**Decisão:** `#4DBF72` definido provisoriamente como token `color-green` no
`tailwind.config.ts` e no `identidade_visual.md`. O Branding Book
(`bb_lite_v2_spinhardi.docx`) e o Canva **não são alterados** até aprovação das
sócias ao ver aplicado no site.

**Racional:** A decisão visual precisa ser validada em contexto real (site
funcionando), não em abstrato. Alterar o documento oficial antes disso cria
confusão se a aprovação não vier.

**Responsável:** Alan Gattiboni **Status:** Ativa — aguardando aprovação das
sócias

---

### [2026-04-28] D005 — Domínio: compra separada, deploy inicial na Vercel free

**Contexto:** Necessidade de definir onde o site vai rodar e como o domínio se
conecta antes de começar o desenvolvimento.

**Alternativas consideradas:**

- Vercel Pro com domínio customizado imediato: custo desnecessário para MVP
- Hospedagem própria (VPS, Hostinger, etc.): overhead de infra sem ganho real
  para esse stack
- Vercel free + domínio próprio: a Vercel permite domínio customizado no plano
  gratuito sem custo adicional

**Decisão:** Comprar domínio separadamente (Registro.br ou Cloudflare — decidir
na hora). Deploy na Vercel free com preview automático por PR e produção no
merge para main. Domínio apontado via DNS para a Vercel sem necessidade de plano
pago.

**Racional:** Vercel free resolve tudo para v1: SSL automático, domínio
customizado, deploy contínuo, preview por PR. Vercel Pro só entra se precisar de
SSL wildcard, múltiplos membros de time ou remoção do banner "Powered by
Vercel".

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-04-28] D004 — Arquitetura de páginas: sem `/tenis-italia` nem `/experiencias-esportivas` no lançamento

**Contexto:** O Branding Book define três momentos da marca: AGORA, PRÓXIMO
PASSO e HORIZONTE. Tênis e experiências esportivas pertencem ao PRÓXIMO PASSO —
não há produto nem conteúdo prontos para sustentar páginas dedicadas no
lançamento.

**Alternativas consideradas:**

- Criar páginas vazias ou com conteúdo placeholder: cria expectativa que a
  operação não consegue entregar
- Criar páginas com conteúdo genérico: inconsistente com o posicionamento de
  curadoria real
- Não criar: correto para o momento AGORA

**Decisão:** Nenhuma página dedicada a tênis ou experiências esportivas no
lançamento. Itália aparece como especialidade em `/viagens/sob-medida`, não como
foco exclusivo. As páginas entram quando houver produto real para sustentar.

**Racional:** Comunicar o que a marca não é ainda gera dissonância com o cliente
atual. Incrementalidade: o site cresce junto com a oferta, não na frente dela.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-04-28] D003 — Sistema de conteúdo: MDX + schema TypeScript, sem CMS externo

**Contexto:** O blog precisa de uma interface para Nina publicar posts com
metadados completos de SEO sem depender de ajuda técnica. WordPress teria o WP
Admin. Sem WordPress, precisamos de alternativa.

**Alternativas consideradas:**

- CMS headless pago (Contentful, Sanity): custo mensal, dependência de terceiro,
  over-engineering para volume atual
- Notion como CMS via API: frágil, sem controle de schema, limite de API
- MDX com frontmatter + interface local simples: zero custo, schema controlado,
  posts versionados no Git

**Decisão:** Posts em MDX com frontmatter tipado em TypeScript. Schema: `slug`,
`title`, `date`, `category`, `excerpt`, `thumbnail`, `author`, `body`,
`seoTitle`, `seoDescription`, `ogImage`. Interface de publicação: CLI ou form
`/admin` com senha simples. Fluxo documentado em `docs/COMO_PUBLICAR_POST.md` —
deve ser usável por Nina sem ajuda técnica.

**Racional:** Zero dívida técnica, zero custo adicional, posts versionados no
Git como código. A interface simples é mais confiável do que um CMS que pode
sair do ar ou mudar de planos.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-04-28] D002 — Camada de IA: abstração sobre provider desde o início

**Contexto:** O site vai integrar IA (sugestão de roteiro, análise de perfil de
cliente, etc.). Decisão de como estruturar o código para não criar acoplamento
com um provider específico.

**Alternativas consideradas:**

- Chamar Anthropic SDK diretamente nas rotas: rápido, mas cria acoplamento —
  trocar de provider exige reescrever código de produto
- Wrapper genérico em `/lib/ai/`: custo mínimo de abstração, elimina acoplamento

**Decisão:** Criar `/lib/ai/` com interface genérica `askAI(prompt, context)`
desde o início. Cada função de IA é um módulo em `/lib/ai/modules/`. Provider
atual: Anthropic. Troca de provider não toca código de produto — só a
implementação do módulo.

**Racional:** O custo de criar a abstração no início é mínimo. O custo de
refatorar depois que o código estiver espalhado é alto. Consistente com o
princípio de zero dívida técnica.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

### [2026-04-28] D001 — Stack do site: Next.js sem WordPress

**Contexto:** A proposta original previa WordPress como CMS. Antes de iniciar o
desenvolvimento, Alan questionou se WordPress ainda faz sentido dado o perfil
técnico do projeto (Claude Code + emergent.sh, VS Code, TypeScript,
familiaridade com documentação).

**Alternativas consideradas:**

- WordPress: fácil para quem não programa, mas exige gerenciamento de plugins,
  temas, updates de segurança, hospedagem PHP, e tem custo alto de plugins para
  funcionalidades que seriam código simples em Next.js
- Next.js + Vercel + TypeScript + Tailwind: stack controlada, sem dependência de
  plugin, blog com MDX replicando o que o WordPress faz bem, SEO nativo via
  `next/sitemap` e `<Metadata>`, deploy automático

**Decisão:** WordPress descartado. Stack: Next.js 14+ (App Router) · TypeScript
· Tailwind · Vercel. O que o WordPress faz bem (SEO, blog, sitemap) é replicado
com controle total e 1/20 do overhead operacional.

**Racional:** WordPress faz sentido para quem não programa. Para quem tem
mestrado em IA, domina VS Code e trabalha com Claude Code, o WordPress é fricção
pura: tempo gasto em template, plugins que quebram, mistério de horas para fazer
coisas simples. Com Next.js, o contrato de dados é firme, a UI do admin do blog
é construída do zero com a melhor UX possível, e qualquer referência visual pode
ser replicada a partir do HTML original.

**Responsável:** Alan Gattiboni **Status:** Ativa

---

_Todo membro do projeto pode propor uma entrada. Decisões sem log são decisões
que se perdem._
