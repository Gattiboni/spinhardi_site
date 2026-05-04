# Spinhardi Turismo — Site

Site oficial da Spinhardi Turismo, desenvolvido como parte do projeto de Presença Digital.

**Stack:** Next.js 14+ · TypeScript · Tailwind CSS · Vercel  
**Repositório:** https://github.com/Gattiboni/spinhardi_site  
**Deploy:** https://spinhardi.com.br _(domínio a confirmar)_

---

## Princípios do projeto

- **Incrementalidade** — cada entrega é funcional. Nenhuma etapa cria dependência que trave a próxima.
- **Escalabilidade** — código estruturado para crescer sem reescrever.
- **Zero dívida técnica** — sem workaround, sem gambiarra, sem "depois a gente resolve".
- **Documentação sempre atualizada** — se mudou, documentou. Se decidiu, registrou.

---

## Estrutura de pastas

```
spinhardi_site/
├── app/                    # Rotas e páginas (Next.js App Router)
│   ├── page.tsx            # Home /
│   ├── sobre/              # /sobre
│   ├── viagens/            # /viagens e subpáginas
│   ├── blog/               # /blog e /blog/[slug]
│   └── contato/            # /contato
├── components/             # Componentes reutilizáveis
├── content/                # Posts do blog em MDX
├── lib/                    # Utilitários, integrações e camada de IA
│   ├── ai/                 # Abstração sobre provider (Anthropic)
│   └── integrations/       # IDAS, ClickMassa, Make
├── public/                 # Assets estáticos
└── docs/                   # Documentação do projeto
    ├── ARCHITECTURE.md
    ├── CHANGELOG.md
    ├── DECISION_LOG.md
    ├── DESIGN_SYSTEM.md
    ├── identidade_visual.md
    ├── arquitetura_v1.md
    ├── plano_de_desenvolvimento_site_v1.md
    └── refs/               # Referências de design capturadas
```

---

## Setup local

```bash
# Clonar o repositório
git clone https://github.com/Gattiboni/spinhardi_site.git
cd spinhardi_site

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Preencher as variáveis em .env.local

# Rodar em desenvolvimento
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

---

## Variáveis de ambiente

Copiar `.env.example` para `.env.local` e preencher:

```
# Anthropic
ANTHROPIC_API_KEY=

# IDAS (reservas)
IDAS_API_URL=
IDAS_API_KEY=

# ClickMassa (CRM / WhatsApp)
CLICKMASSA_API_URL=
CLICKMASSA_API_KEY=

# Make (automações)
MAKE_WEBHOOK_URL=
```

Nunca commitar `.env.local`. O `.gitignore` já cobre isso.

---

## Deploy

Deploy automático via Vercel. Cada push para `main` gera um deploy de produção. Cada PR gera um preview com URL única.

```
main       → produção (spinhardi.com.br)
staging    → homologação
feature/*  → preview automático no PR
```

---

## Blog — como publicar um post

Ver `docs/COMO_PUBLICAR_POST.md` para o fluxo completo.

Resumo: criar arquivo `.mdx` em `/content/blog/` com frontmatter preenchido:

```mdx
---
slug: "nome-do-post"
title: "Título do post"
date: "2026-05-01"
category: "Destinos"
excerpt: "Resumo curto para listagem e SEO."
thumbnail: "/images/blog/nome-do-post.jpg"
author: "Nina Spinhardi"
seoTitle: "Título SEO — Spinhardi Turismo"
seoDescription: "Descrição para Google, até 160 caracteres."
ogImage: "/images/blog/nome-do-post-og.jpg"
---

Conteúdo do post em Markdown...
```

---

## Documentação

| Arquivo | Descrição |
|---|---|
| `docs/CHANGELOG.md` | Histórico de eventos e entregas |
| `docs/DECISION_LOG.md` | Decisões estratégicas e técnicas registradas |
| `docs/ARCHITECTURE.md` | Decisões de arquitetura e stack |
| `docs/identidade_visual.md` | Paleta, tipografia, logo, tokens Tailwind |
| `docs/arquitetura_v1.md` | Árvore de páginas e justificativa por rota |
| `docs/referencias_design.md` | Referências visuais com CSS extraído dos sites de origem |
| `docs/plano_de_desenvolvimento_site_v1.md` | Roadmap de desenvolvimento |

---

## Contexto do projeto

O site faz parte de um engagement maior de consultoria entre a **Gattiboni Enterprises** e a **Spinhardi Turismo**. O escopo inclui Branding Book Lite, desenvolvimento do site, integrações com IDAS e ClickMassa, analytics e gestão mensal de estratégia digital.

Mais contexto em `docs/ARCHITECTURE.md`.

---

_Desenvolvido por Alan Gattiboni · Gattiboni Enterprises_
