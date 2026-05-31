# Plano de Desenvolvimento — Site Spinhardi v2

**Versão:** 2.0 (substitui v1) **Stack:** Next.js 14+ · TypeScript · Tailwind ·
Vercel · Supabase · Sanity **Preparado por:** Alan Gattiboni · Gattiboni
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
- **Fase 2 — Revisão e iteração:** deploy temporário em Vercel free, Amanda
  revisa, ajustes.
- **Fase 3 — Produção:** contratar tudo que precisa pagar, ligar serviços,
  apontar DNS, go-live.
- **Fase 4 — Pós-launch:** integrações IDAS/ClickMassa/Make, camada de IA,
  melhorias contínuas.

**Cada fase termina com checkpoint claro.** Não passa pra próxima sem fechar a
anterior.

---

## Fontes de verdade aprovadas

Documentos finais que servem de base de execução. Não confundir com documentos
de trabalho.

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
aplicado, estrutura de pastas completa, todas as páginas implementadas com copy
aprovado e dados estáticos/mock, blog funcional com posts mockados.

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
    app/                # rotas
    components/         # componentes reutilizáveis
      ui/               # componentes base (Button, Card, Section, etc)
    lib/                # utilitários, integrações, abstrações
      ai/               # camada de IA (preparada, não implementada)
      blog/             # acesso a posts (mock na Fase 1, Sanity na Fase 3)
      email/            # e-mail transacional (mock na Fase 1, Resend na Fase 3)
      integrations/     # IDAS, ClickMassa, Make (preparadas, não implementadas)
      sanity/           # cliente Sanity (preparado, não implementado na Fase 1)
      supabase/         # cliente Supabase
  public/               # assets estáticos
  ```
- [x] Configurar branch strategy: branch local renomeada de `master` pra `main`.
      Branch `staging` será criada na Fase 2, quando for usada pra revisão da
      Amanda. `feature/*` quando houver iteração em paralelo.
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
  - **Nota:** Tailwind v4 não usa mais `tailwind.config.ts`. Tokens vão direto
    no CSS via `@theme inline`, e o Tailwind gera as utility classes
    automaticamente (`bg-navy`, `text-gold`, `font-display`, etc).
  - Espaçamentos customizados, breakpoints e sombras adicionais entram conforme
    necessidade no decorrer da Fase 1.2 — não pré-configurar tudo.
- [x] Carregar fontes com `next/font/google` no `src/app/layout.tsx` (otimização
      automática, sem flash of unstyled text):
  - Fraunces: pesos 400, 500, 600 → CSS variable `--font-fraunces` → token
    `--font-display` no `@theme`
  - Montserrat: pesos 300, 400, 500, 600 → CSS variable `--font-montserrat` →
    token `--font-body` no `@theme`
  - Ambas com `display: "swap"` e `subsets: ["latin"]`
- [x] Criar componentes base em `src/components/ui/`:
  - [x] `Button` (variantes: primary, secondary, ghost; sizes sm/md/lg; estado
        disabled e focus visível)
  - [x] `Container` (max-width responsivo, prop `as` pra semântica — ver D015)
  - [x] `Section` (padding vertical padrão, prop `spacing` sm/md/lg)
  - [x] Cards — implementados como 3 componentes irmãos (ver decisão de design):
    - [x] `ServiceCard` (número + título + descrição + link, hover via group)
    - [x] `TestimonialCard` (blockquote com border-l gold e aspas decorativas)
    - [x] `BlogCard` (imagem 16:9 + tag + título + data + excerpt com
          line-clamp)
  - [x] `Divider` (prop `tone` light/dark)
- [ ] Criar componente `Logo` com variações (escura, clara, ícone)
- [ ] Criar componente `CTAWhatsApp` reutilizável com link parametrizado
- [ ] Criar `Header` e `Footer` (conforme wireframe aprovado)
- [ ] Criar layout global em `app/layout.tsx`
- [ ] Documentar design system em `docs/DESIGN_SYSTEM.md`

**Checkpoint 1.2:** Storybook não, mas uma página `/dev/components` lista todos
os componentes pra inspeção visual.

**Página de validação:** `/dev/components` em
http://localhost:3000/dev/components — referência viva do design system,
atualizada conforme novos componentes entram.

---

## 1.3 Páginas do site

Implementar conforme `docs/arquitetura_v1.md` +
`docs/spinhardi_wireframe.html` + copies aprovados em
`docs/mapa_de_copies_spinhardi_v1_ready.docx`.

**Rotas:**

- `/` (Home)
- `/sobre`
- `/viagens` (hub)
- `/viagens/pacotes`
- `/viagens/sob-medida`
- `/blog` (estrutural, conteúdo mockado)
- `/blog/[slug]` (estrutural, com 2-3 posts mock)
- `/contato`

Para cada página:

- [ ] Implementar estrutura conforme wireframe
- [ ] Aplicar copy aprovado pela Amanda
- [ ] Usar imagens placeholder (`/public/placeholders/`) por enquanto
- [ ] CTAs WhatsApp funcionais com link parametrizado
- [ ] Responsivo testado em 380px (mobile) e 1440px (desktop)
- [ ] Implementar `not-found.tsx` e `error.tsx` globais

**Checkpoint 1.3:** Todas as 8 rotas navegáveis em localhost. Visual fiel ao
wireframe. Copy idêntico ao mapa aprovado.

---

## 1.4 Estrutura para Blog (sem Sanity ainda)

Preparar a estrutura do blog com mocks. Sanity entra na Fase 3.

- [ ] Definir TypeScript interface para `Post`:
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
    body: string; // ou tipo Sanity Portable Text quando ligar
    seoTitle: string;
    seoDescription: string;
    ogImage: string;
  }
  ```
- [ ] Criar mock de 3-4 posts em `lib/blog/mock-posts.ts` (apenas pra
      desenvolvimento)
- [ ] Criar página `/blog` consumindo do mock
- [ ] Criar página `/blog/[slug]` consumindo do mock
- [ ] Criar filtro de categoria funcional (frontend, sem backend ainda)
- [ ] Abstrair acesso aos posts em `lib/blog/index.ts` com função `getPosts()` e
      `getPostBySlug()` — a implementação muda de mock pra Sanity sem tocar nas
      páginas

**Checkpoint 1.4:** Blog navegável em localhost com 3-4 posts mock. Filtros
funcionando. Trocar mock por Sanity vai ser questão de mudar 1 arquivo.

---

## 1.5 Abstrações para integrações futuras (preparação, não implementação)

Criar as fronteiras de código pra que integrações pós-launch não exijam
refatoração. Zero dívida técnica desde o dia 1.

- [ ] Criar `lib/integrations/index.ts` como ponto único de entrada:
  ```ts
  // Exemplo de fronteira limpa:
  export { idas } from "./idas";
  export { clickmassa } from "./clickmassa";
  export { make } from "./make";
  ```
- [ ] Criar `lib/integrations/idas.ts` com interface (sem implementação real
      ainda):
  ```ts
  export const idas = {
    getReservations: async () => {
      throw new Error("Not implemented in v1");
    },
    // outras funções declaradas como interface
  };
  ```
- [ ] Mesmo padrão para `lib/integrations/clickmassa.ts` e
      `lib/integrations/make.ts`
- [ ] Criar `lib/ai/` com abstração genérica:
  ```ts
  // lib/ai/provider.ts
  export interface AIProvider {
    ask(prompt: string, context?: object): Promise<string>;
  }
  // lib/ai/anthropic.ts (implementação real virá depois)
  // lib/ai/index.ts (re-exporta provider ativo)
  ```
- [ ] Documentar cada abstração no próprio arquivo (JSDoc) — explicar contrato,
      não implementação

**Checkpoint 1.5:** As páginas nunca importam direto de SDKs ou APIs externas.
Tudo passa por `lib/`. Trocar provider de IA ou adicionar nova integração não
toca código de produto.

---

## 1.6 Cliente Supabase

Supabase já está provisionado (projeto `grjkqljucszoaujmhgpi`). Configurar
cliente, mas ainda sem ligar dados ao formulário (Fase 3).

- [ ] Instalar `@supabase/supabase-js`
- [ ] Criar `lib/supabase/client.ts` com cliente público (publishable key,
      segura no frontend)
- [ ] Criar `lib/supabase/server.ts` com cliente server-side (service role, só
      backend, nunca exposta)
- [ ] Adicionar variáveis ao `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://grjkqljucszoaujmhgpi.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_2TQ0BVyLarDosrwVSxX1IA_ctXqmNer
  SUPABASE_SERVICE_ROLE_KEY=*** (não commitar, não logar)
  ```
- [ ] Documentar `.env.example` com placeholders
- [ ] Criar schema inicial no Supabase via SQL migration (tabela
      `contact_submissions` no mínimo)
- [ ] Configurar RLS (Row Level Security) na tabela:
  - INSERT permitido publicamente (formulário envia sem login)
  - SELECT só com service role (você acessa pelo painel)

**Checkpoint 1.6:** Cliente Supabase importável. Schema mínimo criado. RLS
validada.

---

## 1.7 Formulário de contato (estrutura, sem envio)

- [ ] Implementar formulário em `/contato` conforme wireframe
- [ ] Validação client-side (campos obrigatórios, formato de e-mail, telefone)
- [ ] Criar Server Action ou API Route em `app/api/contact/route.ts`:
  - Recebe submissão
  - Salva no Supabase via `lib/supabase/server.ts`
  - Retorna sucesso/erro
- [ ] **Envio de e-mail fica abstraído mas não implementado:**
  ```ts
  // lib/email/index.ts
  export const email = {
    send: async (to: string, subject: string, body: string) => {
      console.log("[email mock] would send to", to);
      // Resend entra na Fase 3
    },
  };
  ```
- [ ] Página de sucesso (`/contato/obrigado`) ou estado UI de confirmação

**Checkpoint 1.7:** Formulário envia, salva no Supabase, mostra sucesso. E-mail
real fica pra Fase 3.

---

## 1.8 SEO técnico

- [ ] Configurar `Metadata` dinâmico por página (`app/layout.tsx` e por rota)
- [ ] Configurar Open Graph e Twitter Card por página
- [ ] Gerar `sitemap.xml` automático (`app/sitemap.ts`)
- [ ] Configurar `robots.txt` (`app/robots.ts`)
- [ ] Estrutura de URLs amigável e consistente (slugs em PT, sem stop-words)
- [ ] Configurar structured data JSON-LD para:
  - Organization (Spinhardi Turismo)
  - TravelAgency (schema.org)
  - Posts de blog (Article)
- [ ] Validar com Google Rich Results Test (localmente via ngrok ou pós-deploy)

**Checkpoint 1.8:** Lighthouse score 90+ em SEO (no mínimo) em todas as páginas.

---

## 1.9 Performance e qualidade

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

**Checkpoint Fase 1 COMPLETO:** Site funcional em localhost, todas as páginas,
blog mock funcionando, formulário salvando no Supabase, abstrações prontas pra
integrações futuras, métricas Lighthouse no target. **Pronto pra mostrar pra
Amanda.**

---

# FASE 2 — Revisão e iteração

**Estado de saída:** site aprovado pela Amanda em ambiente público de preview,
pronto pra ir pra produção.

**Custo:** zero (Vercel free temporário).

---

## 2.1 Deploy preview na Vercel

- [ ] Criar projeto na Vercel conectado ao repo `Gattiboni/spinhardi_site`
- [ ] **Plano Hobby (free) temporariamente** — uso é de preview/staging, não
      produção comercial ainda
- [ ] Configurar deploy automático: push em `main` → URL pública
- [ ] Configurar variáveis de ambiente na Vercel (mesmas do `.env.local`)
- [ ] URL temporária: `spinhardi-site-<hash>.vercel.app` (Vercel gera)

**Checkpoint 2.1:** Site acessível em URL pública. Amanda consegue abrir no
celular.

---

## 2.2 Iteração com Amanda

- [ ] Compartilhar URL com Amanda
- [ ] Coletar feedback (idealmente em sessão única, anotado)
- [ ] Implementar ajustes em branches `feature/ajuste-*`
- [ ] Merge para `main` gera novo deploy automaticamente
- [ ] Repetir até aprovação visual e de conteúdo

**Checkpoint 2.2:** Amanda aprova explicitamente o site.

---

## 2.3 Batch de imagens reais

Quando Amanda aprovar o visual com placeholders, fazer **batch único** de
substituição pelas imagens reais.

- [ ] Receber pasta de imagens da Amanda
- [ ] Sessão dedicada: análise de cada imagem + placement nos slots corretos
- [ ] Otimizar (próximo de 500KB cada, sRGB, formato WebP/AVIF)
- [ ] Substituir placeholders por imagens reais
- [ ] Validar visualmente em mobile e desktop
- [ ] Deploy

**Checkpoint 2.3:** Site visualmente idêntico ao que vai pra produção.

---

# FASE 3 — Produção

**Estado de saída:** site no ar em `spinharditurismo.com.br`, todos os serviços
pagos contratados e configurados, blog editável pela Amanda via Sanity,
formulário enviando e-mail real, analytics rodando.

**Custo recorrente:** ~R$ 250/mês (conforme Plano de Infraestrutura aprovado).

---

## 3.1 Contratações (na ordem)

A ordem importa: cada contratação depende de algo da anterior.

### 3.1.1 Vercel Pro

- [ ] Upgrade do projeto na Vercel pra plano Pro ($20/mês)
- [ ] Cadastrar cartão virtual da Spinhardi (dados já recebidos)
- [ ] Habilitar Vercel Analytics no projeto (incluído no Pro)
- [ ] Configurar spending limit como segurança contra surpresas

### 3.1.2 Supabase Pro

- [ ] Upgrade do projeto Supabase pra plano Pro ($25/mês)
- [ ] **Timing:** uma semana antes do go-live (margem pra testes em Pro)
- [ ] Validar que tudo funciona em Pro (auth, RLS, conexões)
- [ ] Configurar backups automáticos

### 3.1.3 Sanity

- [ ] Criar projeto Sanity (free tier, suficiente pra Fase 1)
- [ ] Configurar Sanity Studio
- [ ] Definir schemas:
  - Post (com todos os campos do TypeScript interface da Fase 1)
  - Author
  - Category
  - SEO fields (block reutilizável)
- [ ] Deploy do Studio em `studio.spinharditurismo.com.br` ou subdomínio Vercel
- [ ] Criar conta de editor para Amanda
- [ ] Treinar Amanda no Studio (sessão dedicada, ~1h)
- [ ] Documentar fluxo de publicação em `docs/COMO_PUBLICAR_POST.md`

### 3.1.4 Resend

- [ ] Criar conta Resend (free tier)
- [ ] Adicionar domínio `spinharditurismo.com.br` no Resend
- [ ] Configurar DNS (SPF, DKIM) no Registro.br
- [ ] Validar entrega de e-mail teste
- [ ] Implementar de verdade em `lib/email/resend.ts` (substituindo o mock da
      Fase 1)

### 3.1.5 Conta Google da Spinhardi

- [ ] Criar conta Gmail dedicada (`spinhardi.turismo@gmail.com` ou similar)
- [ ] Configurar 2FA com método de recuperação seguro
- [ ] Adicionar Nina e Julia como administradoras
- [ ] Documentar credenciais no local seguro (não commitar)

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

## 3.2 Conectar Sanity ao site

- [ ] Trocar mock de blog por integração real com Sanity
- [ ] Implementar `lib/sanity/client.ts` e `lib/sanity/queries.ts`
- [ ] Atualizar `lib/blog/index.ts` pra consumir Sanity
- [ ] Configurar webhook Sanity → Vercel para revalidar páginas no publish
- [ ] Validar que páginas de blog renderizam conteúdo real do Sanity
- [ ] Amanda publica 1 post teste

**Checkpoint 3.2:** Blog rodando 100% via Sanity. Mock removido.

---

## 3.3 Configurar DNS e domínio

- [ ] Apontar DNS de `spinharditurismo.com.br` pra Vercel:
  - Registro `A` apontando pro IP da Vercel
  - Registro `CNAME` `www` apontando pro domínio
- [ ] Adicionar domínio customizado na Vercel
- [ ] Validar HTTPS automático (Let's Encrypt via Vercel)
- [ ] Configurar redirect `www` → `apex` (ou vice-versa)
- [ ] Atualizar e-mail de contato do domínio no Registro.br (se ainda for
      Hotmail antigo da Nina, trocar pro seu)
- [ ] Aguardar propagação DNS (até 24h, geralmente 1h)

**Checkpoint 3.3:** Site acessível em `https://spinharditurismo.com.br`.

---

## 3.4 Checklist final de go-live

- [ ] Revisão final de todos os textos (comparar com mapa de copies aprovado)
- [ ] Todos os links funcionando (interno e externo)
- [ ] Formulário envia e e-mail chega na caixa correta
- [ ] WhatsApp abre conversa com número correto
- [ ] Mobile (380px) e desktop validados
- [ ] Lighthouse rodado em produção, scores no target
- [ ] structured data validado no Google Rich Results Test
- [ ] sitemap.xml acessível e submetido no Search Console
- [ ] robots.txt acessível e correto
- [ ] OG image renderiza no compartilhamento (WhatsApp, Facebook)
- [ ] Analytics capturando eventos
- [ ] Backup do Supabase rodando
- [ ] Tag `v1.0.0` no repositório
- [ ] Commit final em `main` com mensagem
      `release: v1.0.0 — go-live spinharditurismo.com.br`

---

## 3.5 Treinamento e documentação

- [ ] Loom curto: como Amanda publica um post no Sanity (5-10 min)
- [ ] Loom curto: como Alan monitora o painel Supabase de contatos recebidos
      (3-5 min)
- [ ] Criar `docs/MANUTENCAO.md` — o que fazer quando algo quebrar
- [ ] Atualizar README com URL de produção e links pros painéis (Vercel,
      Supabase, Sanity)
- [ ] Atualizar CHANGELOG com entrada de go-live
- [ ] Atualizar DECISION_LOG se tiver alguma decisão nova registrada na Fase 3

**Checkpoint Fase 3 COMPLETO:** Site no ar, operacional, monitorado,
documentado.

---

# FASE 4 — Pós-launch / Roadmap

**Estado de saída:** integrações operacionais, camada de IA com primeira
aplicação real, melhorias contínuas em ciclos curtos.

**Sem prazo fixo.** Cada item entra quando faz sentido. Sem ordem obrigatória.

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

## 4.2 Camada de IA

Estrutura já preparada na Fase 1. Aqui é hora de implementar.

- [ ] Implementar `lib/ai/anthropic.ts` (provider real)
- [ ] Configurar `ANTHROPIC_API_KEY` em `.env.local` e Vercel
- [ ] Definir schema de contexto Spinhardi (produtos, perfis de cliente,
      destinos) — injetado em todos os prompts
- [ ] **Primeira aplicação:** `/api/ai/suggest-itinerary`
  - Recebe perfil de cliente (orçamento, interesse, tempo, perfil de viagem)
  - Retorna sugestão estruturada de roteiro
- [ ] Cada nova função de IA é um módulo separado em `lib/ai/modules/`
- [ ] Documentar arquitetura em `docs/AI_LAYER.md`

**Princípio:** troca de provider (Anthropic → outro) não toca código de produto.
Só muda a implementação do provider.

---

## 4.3 Melhorias contínuas

Lista aberta. Itens entram conforme priorização.

- [ ] Dashboard customizado pra Nina/Julia visualizarem leads e métricas
      (Metabase ou similar — Looker descartado)
- [ ] Sistema de agendamento de posts no Sanity (plugin Scheduled Publishing)
- [ ] Página de cases/portfólio (quando houver depoimentos reais + permissão de
      uso)
- [ ] Subdomínios criativos pra campanhas
      (`viajedeverdade.spinharditurismo.com.br`, etc)
- [ ] Tradução EN-US (se houver demanda de cliente internacional)
- [ ] Newsletter (integração com ferramenta de e-mail marketing — não Resend,
      que é transacional)
- [ ] Programa de indicação automatizado (ClickMassa + IDAS + Make)

---

# Pendências externas (das sócias)

Itens que não dependem de você, mas bloqueiam alguma fase:

- [x] Aprovar cenário de domínio (Cenário com domínio existente)
- [x] Confirmar que `spinharditurismo.com.br` é da Spinhardi LTDA
- [x] Criar cartão virtual e enviar dados pra Alan
- [ ] Nina aprovar criação da conta Gmail da Spinhardi (apenas informativo)
- [ ] Treinamento da Amanda no Sanity (agendar quando Fase 3 estiver próxima)

---

# Pendências técnicas em aberto

Coisas que vão ter que ser decididas/feitas mas ainda não chegou a hora:

- [ ] Decidir formato exato dos `slug`s de blog (manter PT-BR, sem stop-words)
- [ ] Decidir política de retenção de submissões do formulário no Supabase
      (LGPD)
- [ ] Decidir se vai ter página de Política de Privacidade e Termos de Uso
      (recomendado: sim, mesmo que simples)
- [ ] Decidir backup strategy do Sanity (export periódico ou só confiar no SaaS
      deles)

---

# Critérios de "pronto"

Não passamos pra próxima fase sem fechar a anterior. Critérios objetivos:

| Fase | Critério de "pronto"                                                                                |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | `npm run dev` roda. Todas as rotas acessíveis. Lighthouse 90+ em SEO. Formulário salva no Supabase. |
| 2    | Amanda aprovou visualmente em URL pública. Imagens reais substituídas.                              |
| 3    | Site no ar em `spinharditurismo.com.br` com HTTPS. Sanity ligado. Resend enviando. GA4 capturando.  |
| 4    | Em fluxo contínuo. Cada item tem seu próprio critério.                                              |

---

_Plano de Desenvolvimento v2 · Substitui v1 · Gattiboni Enterprises para
Spinhardi Turismo · Abril 2026_
