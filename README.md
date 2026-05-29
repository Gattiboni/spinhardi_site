# Spinhardi Turismo — Site

Site oficial da Spinhardi Turismo, desenvolvido como parte do projeto de
Presença Digital.

**Stack:** Next.js 14+ · TypeScript · Tailwind CSS · Vercel · Supabase · Sanity
**Repositório:** https://github.com/Gattiboni/spinhardi_site **Deploy:**
https://spinharditurismo.com.br _(produção a partir da Fase 3)_

---

## Princípios do projeto

- **Incrementalidade** — nenhuma decisão pode ser um impedimento óbvio para a
  próxima.
- **Modularidade** — preservar a liberdade da arquitetura pra plugar e desplugar
  qualquer coisa que seja pertinente.
- **Zero dívida técnica** — sem workaround, sem gambiarra, sem "depois a gente
  resolve".
- **Documentação sempre atualizada** — se mudou, documentou. Se decidiu,
  registrou.

---

## Estrutura de pastas

```
spinhardi_site/
├── src/                    # Código-fonte da aplicação
│   ├── app/                # Rotas e páginas (Next.js App Router)
│   │   ├── page.tsx        # Home /
│   │   ├── sobre/          # /sobre
│   │   ├── viagens/        # /viagens e subpáginas
│   │   ├── blog/           # /blog e /blog/[slug]
│   │   └── contato/        # /contato
│   ├── components/         # Componentes reutilizáveis
│   │   └── ui/             # Componentes base (Button, Card, Section, etc)
│   └── lib/                # Utilitários, integrações e abstrações
│       ├── ai/             # Camada de IA (abstração sobre provider)
│       ├── blog/           # Acesso a posts (mock na Fase 1, Sanity na Fase 3)
│       ├── email/          # E-mail transacional (mock na Fase 1, Resend na Fase 3)
│       ├── integrations/   # IDAS, ClickMassa, Make (abstrações preparadas)
│       ├── sanity/         # Cliente Sanity (Fase 3)
│       └── supabase/       # Cliente Supabase
├── public/                 # Assets estáticos
└── docs/                   # Documentação do projeto
    ├── CHANGELOG.md
    ├── DECISION_LOG.md
    ├── identidade_visual.md
    ├── arquitetura_v1.md
    ├── plano_de_desenvolvimento_site_v2.md
    ├── plano_de_infraestrutura_spinhardi_v1.docx
    ├── mapa_de_copies_spinhardi_v1_ready.docx
    ├── mapa_de_imagens_spinhardi_v1.docx
    ├── spinhardi_wireframe.html
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
# Preencher as variáveis em .env.local (ver seção abaixo)

# Rodar em desenvolvimento
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

---

---

## Scripts disponíveis

Comandos que você roda na raiz do projeto.

| Comando                | O que faz                                                              |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Sobe servidor de desenvolvimento em http://localhost:3000 (Turbopack)  |
| `npm run build`        | Build de produção (também com Turbopack como default no Next 16)       |
| `npm run start`        | Sobe servidor de produção (precisa rodar `build` antes)                |
| `npm run lint`         | Roda ESLint em todo o projeto e reporta problemas sem corrigir         |
| `npm run lint:fix`     | Roda ESLint e corrige automaticamente o que dá pra corrigir            |
| `npm run format`       | Roda Prettier e formata todos os arquivos (modifica disco)             |
| `npm run format:check` | Roda Prettier em modo verificação (só lista o que está fora do padrão) |

**Recomendado antes de cada commit:** rodar `npm run format` seguido de
`npm run lint:fix`. Garante código formatado e sem erros de lint sem precisar de
Husky/lint-staged (ver decisão D013).

---

## Variáveis de ambiente

Copiar `.env.example` para `.env.local` e preencher conforme as fases do
projeto.

### Fase 1 (Fundação local) — variáveis necessárias

```
# Supabase (banco de dados — já provisionado)
NEXT_PUBLIC_SUPABASE_URL=https://grjkqljucszoaujmhgpi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_*
SUPABASE_SERVICE_ROLE_KEY=*  # nunca expor no frontend
```

### Fase 3 (Produção) — variáveis adicionais

```
# Sanity (CMS do blog)
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=

# Resend (e-mail transacional do formulário)
RESEND_API_KEY=

# Anthropic (camada de IA)
ANTHROPIC_API_KEY=
```

### Fase 4 (Pós-launch) — variáveis adicionais

```
# IDAS (reservas)
IDAS_API_URL=
IDAS_API_KEY=

# ClickMassa (CRM / WhatsApp)
CLICKMASSA_API_URL=
CLICKMASSA_API_KEY=

# Make (automações)
MAKE_WEBHOOK_URL=
```

**Nunca commitar `.env.local`.** O `.gitignore` já cobre isso.

---

## Deploy

Deploy automático via Vercel. Cada push para `main` gera um deploy. Cada PR gera
um preview com URL única.

```
main       → produção (spinharditurismo.com.br)
staging    → homologação
feature/*  → preview automático no PR
```

**Tier da Vercel:** Hobby (free) durante Fases 1 e 2 (uso não-comercial:
desenvolvimento e preview). Pro a partir da Fase 3 (uso comercial em produção).
Detalhes em `docs/DECISION_LOG.md` (D008).

---

## Blog — como publicar um post

Na Fase 3 em diante, posts são publicados pela Amanda via Sanity Studio.

Ver `docs/COMO_PUBLICAR_POST.md` para o fluxo completo (criado durante a Fase
3).

Durante a Fase 1, posts ficam mockados em `lib/blog/mock-posts.ts` apenas para
fins de desenvolvimento.

---

## Documentação

| Arquivo                                          | Descrição                                        |
| ------------------------------------------------ | ------------------------------------------------ |
| `docs/CHANGELOG.md`                              | Histórico cronológico de eventos e entregas      |
| `docs/DECISION_LOG.md`                           | Decisões estratégicas e técnicas com racional    |
| `docs/identidade_visual.md`                      | Paleta, tipografia, logo, tokens Tailwind        |
| `docs/arquitetura_v1.md`                         | Árvore de páginas e justificativa por rota       |
| `docs/refs/referencias_design.md`                | Referências visuais com CSS extraído             |
| `docs/plano_de_desenvolvimento_site_v2.md`       | Roadmap atualizado de desenvolvimento em 4 fases |
| `docs/plano_de_infraestrutura_spinhardi_v1.docx` | Decisões de stack, custos, propriedade           |
| `docs/mapa_de_copies_spinhardi_v1_ready.docx`    | Conteúdo textual aprovado pela Amanda            |
| `docs/mapa_de_imagens_spinhardi_v1.docx`         | Specs técnicas e papel de cada imagem            |
| `docs/spinhardi_wireframe.html`                  | Estrutura visual aprovada por Nina e Julia       |

---

## Contexto do projeto

O site faz parte de um engagement maior de consultoria entre a **Gattiboni
Enterprises** e a **Spinhardi Turismo**. O escopo inclui Branding Book Lite,
desenvolvimento do site, integrações com IDAS e ClickMassa, analytics e gestão
mensal de estratégia digital.

Mais contexto em `docs/plano_de_desenvolvimento_site_v2.md`.

---

_Desenvolvido por Alan Gattiboni · Gattiboni Enterprises_
