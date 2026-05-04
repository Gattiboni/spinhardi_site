# CHANGELOG — Spinhardi Turismo Site

Registro cronológico de marcos, eventos e entregas do projeto de Presença Digital Spinhardi.

Formato: `[DATA] Categoria — Descrição`

Categorias: `DECISÃO` | `SITE` | `DOC` | `DESIGN` | `INFRA` | `CONTRATO`

Ordem: mais recente no topo.

---

## 2026

### [2026-04-28] DOC — Documentação de referências de design gerada

Arquivo `docs/refs/referencias_design.md` criado a partir de capturas reais de 4 sites de referência via script de extração de HTML/CSS. Mapeia 7 componentes (navbar, hero, layout de rolagem, grade de serviços numerada, efeito de imagem, blog grid, footer) com medidas extraídas do CSS computado e snippets de implementação prontos para uso.

---

### [2026-04-28] DOC — Script de captura de referências de design criado

Script JavaScript para rodar no console do browser (F12) e exportar HTML, CSS computado, fontes, cores e layout de qualquer página como JSON estruturado. Exporta direto para `docs/refs/`. Usado para capturar as 4 referências do projeto.

---

### [2026-04-28] DOC — Arquitetura de páginas v1 definida

Arquivo `docs/arquitetura_v1.md` criado com árvore de rotas, justificativa por página e tabela de páginas deliberadamente excluídas do lançamento. Status: proposta para aprovação por Nina e Julia via wireframe navegável.

Rotas definidas: `/` · `/sobre` · `/viagens` · `/viagens/pacotes` · `/viagens/sob-medida` · `/blog` · `/blog/[slug]` · `/contato`

---

### [2026-04-28] DESIGN — Identidade visual documentada para desenvolvimento

Arquivo `docs/identidade_visual.md` criado com paleta de 5 cores, tipografia, variações de logo, regras de aplicação por canal e tokens prontos para `tailwind.config.ts`. Verde provisório definido como `#4DBF72` (aguardando aprovação das sócias ao ver aplicado).

---

### [2026-04-28] SITE — Plano de desenvolvimento v1 criado

Arquivo `docs/plano_de_desenvolvimento_site_v1.md` definido com 7 etapas pré-launch e roadmap pós-launch. Stack confirmada: Next.js 14+ · Vercel · Tailwind · TypeScript. Princípios: incrementalidade, escalabilidade, zero dívida técnica, documentação sempre atualizada.

---

### [2026-04-28] INFRA — Repositório GitHub criado

Repositório `Gattiboni/spinhardi_site` iniciado em https://github.com/Gattiboni/spinhardi_site.git. Zerado — inauguração com a primeira entrega funcional.

---

### [2026-04-28] DECISÃO — Stack definida: Next.js sem WordPress

Decisão D001 registrada. WordPress descartado em favor de Next.js + Vercel. Ver DECISION_LOG para racional completo.

---

### [2026-04-28] CONTRATO — Proposta Presença Digital aprovada e assinada

Contrato anual fechado. Escopo: Branding Book Lite + site + ecossistema integrado + gestão mensal de estratégia e ecossistema. Valor: R$ 1.300/mês (12 meses) ou R$ 12.000 à vista.

---

_Atualizar este arquivo a cada evento relevante, por menor que pareça. O log é memória do projeto._
