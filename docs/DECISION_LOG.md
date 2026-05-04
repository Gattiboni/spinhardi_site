# DECISION_LOG — Spinhardi Turismo Site

Registro de decisões estratégicas do projeto: técnicas, de produto, de design e operacionais.
Cada entrada documenta o contexto, as alternativas consideradas, a decisão tomada e o racional.

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

### [2026-04-28] D006 — Verde provisório `#4DBF72` para desenvolvimento

**Contexto:** As sócias insistiram em um verde vibrante próximo de `#99fe00` (lime). O Branding Book usa `#8CB89F` (sage dessaturado). Há conflito entre preferência das sócias e qualidade visual da paleta.

**Alternativas consideradas:**
- `#99fe00` — lime gritante pedido pelas sócias: descartado por ser amarelado, sem elegância, incompatível com posicionamento premium
- `#8CB89F` — sage do Branding Book: mantido como referência oficial, mas pouco vibrante para o que as sócias querem
- `#5CB87A` — verde médio, elegante: candidato forte
- `#4DBF72` — mais vibrante que o sage, menos agressivo que o lime: escolhido para teste

**Decisão:** `#4DBF72` definido provisoriamente como token `color-green` no `tailwind.config.ts` e no `identidade_visual.md`. O Branding Book (`bb_lite_v2_spinhardi.docx`) e o Canva **não são alterados** até aprovação das sócias ao ver aplicado no site.

**Racional:** A decisão visual precisa ser validada em contexto real (site funcionando), não em abstrato. Alterar o documento oficial antes disso cria confusão se a aprovação não vier.

**Responsável:** Alan Gattiboni
**Status:** Ativa — aguardando aprovação das sócias

---

### [2026-04-28] D005 — Domínio: compra separada, deploy inicial na Vercel free

**Contexto:** Necessidade de definir onde o site vai rodar e como o domínio se conecta antes de começar o desenvolvimento.

**Alternativas consideradas:**
- Vercel Pro com domínio customizado imediato: custo desnecessário para MVP
- Hospedagem própria (VPS, Hostinger, etc.): overhead de infra sem ganho real para esse stack
- Vercel free + domínio próprio: a Vercel permite domínio customizado no plano gratuito sem custo adicional

**Decisão:** Comprar domínio separadamente (Registro.br ou Cloudflare — decidir na hora). Deploy na Vercel free com preview automático por PR e produção no merge para main. Domínio apontado via DNS para a Vercel sem necessidade de plano pago.

**Racional:** Vercel free resolve tudo para v1: SSL automático, domínio customizado, deploy contínuo, preview por PR. Vercel Pro só entra se precisar de SSL wildcard, múltiplos membros de time ou remoção do banner "Powered by Vercel".

**Responsável:** Alan Gattiboni
**Status:** Ativa

---

### [2026-04-28] D004 — Arquitetura de páginas: sem `/tenis-italia` nem `/experiencias-esportivas` no lançamento

**Contexto:** O Branding Book define três momentos da marca: AGORA, PRÓXIMO PASSO e HORIZONTE. Tênis e experiências esportivas pertencem ao PRÓXIMO PASSO — não há produto nem conteúdo prontos para sustentar páginas dedicadas no lançamento.

**Alternativas consideradas:**
- Criar páginas vazias ou com conteúdo placeholder: cria expectativa que a operação não consegue entregar
- Criar páginas com conteúdo genérico: inconsistente com o posicionamento de curadoria real
- Não criar: correto para o momento AGORA

**Decisão:** Nenhuma página dedicada a tênis ou experiências esportivas no lançamento. Itália aparece como especialidade em `/viagens/sob-medida`, não como foco exclusivo. As páginas entram quando houver produto real para sustentar.

**Racional:** Comunicar o que a marca não é ainda gera dissonância com o cliente atual. Incrementalidade: o site cresce junto com a oferta, não na frente dela.

**Responsável:** Alan Gattiboni
**Status:** Ativa

---

### [2026-04-28] D003 — Sistema de conteúdo: MDX + schema TypeScript, sem CMS externo

**Contexto:** O blog precisa de uma interface para Nina publicar posts com metadados completos de SEO sem depender de ajuda técnica. WordPress teria o WP Admin. Sem WordPress, precisamos de alternativa.

**Alternativas consideradas:**
- CMS headless pago (Contentful, Sanity): custo mensal, dependência de terceiro, over-engineering para volume atual
- Notion como CMS via API: frágil, sem controle de schema, limite de API
- MDX com frontmatter + interface local simples: zero custo, schema controlado, posts versionados no Git

**Decisão:** Posts em MDX com frontmatter tipado em TypeScript. Schema: `slug`, `title`, `date`, `category`, `excerpt`, `thumbnail`, `author`, `body`, `seoTitle`, `seoDescription`, `ogImage`. Interface de publicação: CLI ou form `/admin` com senha simples. Fluxo documentado em `docs/COMO_PUBLICAR_POST.md` — deve ser usável por Nina sem ajuda técnica.

**Racional:** Zero dívida técnica, zero custo adicional, posts versionados no Git como código. A interface simples é mais confiável do que um CMS que pode sair do ar ou mudar de planos.

**Responsável:** Alan Gattiboni
**Status:** Ativa

---

### [2026-04-28] D002 — Camada de IA: abstração sobre provider desde o início

**Contexto:** O site vai integrar IA (sugestão de roteiro, análise de perfil de cliente, etc.). Decisão de como estruturar o código para não criar acoplamento com um provider específico.

**Alternativas consideradas:**
- Chamar Anthropic SDK diretamente nas rotas: rápido, mas cria acoplamento — trocar de provider exige reescrever código de produto
- Wrapper genérico em `/lib/ai/`: custo mínimo de abstração, elimina acoplamento

**Decisão:** Criar `/lib/ai/` com interface genérica `askAI(prompt, context)` desde o início. Cada função de IA é um módulo em `/lib/ai/modules/`. Provider atual: Anthropic. Troca de provider não toca código de produto — só a implementação do módulo.

**Racional:** O custo de criar a abstração no início é mínimo. O custo de refatorar depois que o código estiver espalhado é alto. Consistente com o princípio de zero dívida técnica.

**Responsável:** Alan Gattiboni
**Status:** Ativa

---

### [2026-04-28] D001 — Stack do site: Next.js sem WordPress

**Contexto:** A proposta original previa WordPress como CMS. Antes de iniciar o desenvolvimento, Alan questionou se WordPress ainda faz sentido dado o perfil técnico do projeto (Claude Code + emergent.sh, VS Code, TypeScript, familiaridade com documentação).

**Alternativas consideradas:**
- WordPress: fácil para quem não programa, mas exige gerenciamento de plugins, temas, updates de segurança, hospedagem PHP, e tem custo alto de plugins para funcionalidades que seriam código simples em Next.js
- Next.js + Vercel + TypeScript + Tailwind: stack controlada, sem dependência de plugin, blog com MDX replicando o que o WordPress faz bem, SEO nativo via `next/sitemap` e `<Metadata>`, deploy automático

**Decisão:** WordPress descartado. Stack: Next.js 14+ (App Router) · TypeScript · Tailwind · Vercel. O que o WordPress faz bem (SEO, blog, sitemap) é replicado com controle total e 1/20 do overhead operacional.

**Racional:** WordPress faz sentido para quem não programa. Para quem tem mestrado em IA, domina VS Code e trabalha com Claude Code, o WordPress é fricção pura: tempo gasto em template, plugins que quebram, mistério de horas para fazer coisas simples. Com Next.js, o contrato de dados é firme, a UI do admin do blog é construída do zero com a melhor UX possível, e qualquer referência visual pode ser replicada a partir do HTML original.

**Responsável:** Alan Gattiboni
**Status:** Ativa

---

_Todo membro do projeto pode propor uma entrada. Decisões sem log são decisões que se perdem._
