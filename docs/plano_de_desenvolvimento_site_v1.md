# Plano de Desenvolvimento — Presença Digital Spinhardi
**Stack:** Next.js · Vercel · Tailwind · TypeScript  
**Princípios:** Incrementalidade · Escalabilidade · Zero dívida técnica · Documentação sempre atualizada  
**Regra de ouro:** cada etapa entrega algo funcional. Nenhuma etapa cria dependência que trave a próxima.

---

## 1. Fundação e Stack

- [ ] Inicializar projeto Next.js 14+ com App Router, TypeScript e Tailwind
- [ ] Configurar estrutura de pastas (`/app`, `/components`, `/lib`, `/content`, `/docs`)
- [ ] Configurar repositório Git com branch strategy (main → staging → feature)
- [ ] Comprar domínio (Registro.br ou Cloudflare — decisão na hora)
- [ ] Configurar deploy automático na Vercel (plano free — preview por PR, produção no merge para main)
- [ ] Adicionar domínio customizado na Vercel e apontar DNS
- [ ] Criar `README.md` e `/docs/ARCHITECTURE.md` com decisões de stack documentadas
- [ ] Criar `/docs/CHANGELOG.md` — atualizado a cada entrega

---

## 2. Design System e Identidade Visual

- [ ] Configurar tokens de design no Tailwind (`tailwind.config.ts`):
  - Cores: navy `#1A2B4A`, ouro `#AD8330`, sage `#8CB89F`, texto `#1E1E2E`
  - Tipografia: TT Fors Display (títulos), Montserrat (corpo)
- [ ] Criar componentes base: `Button`, `Card`, `Section`, `Container`, `Divider`
- [ ] Criar componente `Logo` com variações (escura, clara, ícone)
- [ ] Criar componente `CTAWhatsApp` reutilizável com link parametrizado
- [ ] Criar layout global com `Header` e `Footer`
- [ ] Documentar design system em `/docs/DESIGN_SYSTEM.md`

---

## 3. Páginas do Site

### 3a. Decisão de arquitetura (fazer antes de qualquer código)

- [ ] Escolher referência visual — buscar e documentar site(s) de referência
- [ ] Exercício conjunto: mapear páginas necessárias a partir do Branding Book e da referência
- [ ] Definir hierarquia e nomenclatura de rotas
- [ ] Documentar arquitetura de páginas em `/docs/PAGES.md` antes de implementar qualquer página

### 3b. Implementação (somente após 3a documentado e aprovado)

- [ ] Implementar páginas conforme contrato firmado em 3a
- [ ] Cada página: conteúdo real (não lorem ipsum), identidade visual aplicada, CTA funcional
- [ ] Criar `not-found.tsx` e `error.tsx` globais

---

## 4. Sistema de Blog e Conteúdo

- [ ] Definir schema de post em TypeScript: `slug`, `title`, `date`, `category`, `excerpt`, `thumbnail`, `author`, `body (MDX)`, `seoTitle`, `seoDescription`, `ogImage`
- [ ] Configurar pipeline MDX com `next-mdx-remote` ou `contentlayer`
- [ ] Criar página de listagem de posts e página de post individual (rota dinâmica por slug)
- [ ] Criar interface simples para publicar post (CLI ou form `/admin` com senha) preenchendo todos os metadados
- [ ] Criar página de categorias dinâmica
- [ ] Documentar fluxo de publicação em `/docs/COMO_PUBLICAR_POST.md` — deve ser usável por Nina sem ajuda técnica

---

## 5. SEO Técnico

- [ ] Configurar `<Metadata>` dinâmico por página (title, description, canonical)
- [ ] Configurar Open Graph e Twitter Card por página e por post
- [ ] Gerar `sitemap.xml` automático
- [ ] Configurar `robots.txt`
- [ ] Estrutura de URLs por slug amigável e consistente
- [ ] Configurar `structured data` JSON-LD para organização e posts de blog
- [ ] Validar com Google Rich Results Test antes do go-live

---

## 6. Qualidade e Performance (pré-launch)

- [ ] Configurar ESLint + Prettier + Husky (lint antes de cada commit)
- [ ] Configurar `next/image` em todas as imagens com `alt` obrigatório
- [ ] Otimizar fontes com `next/font`
- [ ] Testar em mobile (380px) antes de qualquer merge para main
- [ ] Rodar Lighthouse manualmente antes do go-live — target: 90+ em performance e SEO
- [ ] Documentar padrão de commits em `/docs/CONTRIBUTING.md`

---

## 7. Go-live

- [ ] Checklist de revisão final: textos, links, formulários, mobile, SEO, DNS, HTTPS
- [ ] Treinamento: como publicar post, como editar texto simples
- [ ] Gravar Loom curto por funcionalidade — Nina opera sem ajuda técnica
- [ ] Criar `/docs/MANUTENCAO.md` — o que fazer quando algo quebrar
- [ ] Tag `v1.0.0` no repositório

---

## Roadmap Pós-Launch

> Cada item abaixo é independente e pode entrar em qualquer ordem.  
> Nenhum bloqueia o anterior. Cada um acrescenta uma camada nova sem tocar no que já funciona.

### Analytics
- [ ] Instalar Google Tag Manager via `<Script>` no layout
- [ ] Configurar GA4 via GTM
- [ ] Configurar eventos de conversão: clique no WhatsApp, envio de formulário, clique em CTA
- [ ] Conectar Google Search Console ao domínio

### Dashboard
- [ ] Criar Looker Studio dashboard base conectado ao GA4 (somente após dados existirem)
- [ ] Expandir dashboard com dados do IDAS quando integração estiver ativa
- [ ] Documentar métricas em `/docs/DASHBOARD.md`

### Integrações
- [ ] **Formulário de contato:** webhook Make roteando para ClickMassa e e-mail simultâneos
- [ ] **IDAS API:** criar lib `/lib/idas.ts` com tipagem completa (REST polling)
- [ ] **ClickMassa:** criar lib `/lib/clickmassa.ts`
- [ ] **Make:** cenário de bridge IDAS → ClickMassa com automação de follow-up
- [ ] Criar camada de abstração `/lib/integrations/index.ts` — integrações nunca direto nas páginas
- [ ] Variáveis de ambiente documentadas em `.env.example`
- [ ] Documentar integrações em `/docs/INTEGRATIONS.md`

### Camada de IA
- [ ] Criar `/lib/ai/` com abstração sobre provider (Anthropic SDK)
- [ ] Expor interface genérica `askAI(prompt, context)` — troca de provider sem mudar código de produto
- [ ] Injetar schema de contexto Spinhardi (produtos, perfis, destinos) em qualquer prompt
- [ ] Primeira aplicação: rota `/api/ai/suggest-itinerary` — recebe perfil e retorna sugestão estruturada
- [ ] Cada nova função de IA é um módulo novo em `/lib/ai/modules/` — nunca acoplado
- [ ] Documentar arquitetura em `/docs/AI_LAYER.md`