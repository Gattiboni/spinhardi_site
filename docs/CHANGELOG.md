# CHANGELOG — Spinhardi Turismo Site

Registro cronológico de marcos, eventos e entregas do projeto de Presença
Digital Spinhardi.

Formato: `[DATA] Categoria — Descrição`

Categorias: `DECISÃO` | `SITE` | `DOC` | `DESIGN` | `INFRA` | `CONTRATO`

Ordem: mais recente no topo.

---

## 2026

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
