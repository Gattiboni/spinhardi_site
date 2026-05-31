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
