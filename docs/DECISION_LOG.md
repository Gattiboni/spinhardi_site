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

## D040 — Pull-before-Codinho ao migrar de máquina (lição operacional)

**Contexto:** durante o dia 2026-06-17, Alan migrou do GitHub Codespaces (de
onde ontem rodou o Lote D, com push pro origin/main) pra máquina local. Chamou
Codinho local pra rodar Lote E + E.1 sem antes ter feito `git pull origin
main`.
O working tree local começou em estado pré-Lote D. Codinho trabalhou correto
internamente mas em base errada. Quando tentou commitar, o `git push` foi
rejeitado ("remote contains work that you do not have locally"). Tentativa
inicial de rebase revelou que o trabalho local desconhecia Sanity, Resend,
robots.ts e OG metadata do Lote D, e ia deletá-los do remoto se commitasse.
Recuperação levou ~90 minutos de zigzag.

**Alternativas consideradas:**

- (a) **Recovery via cópia manual do trabalho** — copiar working tree, reset
  hard, recolar peça por peça. Tentado parcialmente, gerou imports quebrados
  porque arquivos modificados em ambos os lotes (`.env.example`, `package.json`)
  precisavam merge manual com risco humano alto.
- (b) **Recovery via Codinho re-rodar em base certa** — reset hard pra
  origin/main + clean -fd + entregar pro Codinho UM prompt consolidado pedindo
  Lote E + E.1 em cima da base Lote D limpa, com backup como referência mas
  adaptando ao filesystem real. Funcionou em ~10 minutos sem conflito de
  conteúdo.

**Decisão:** **(b)**. E mais importante: adotar protocolo **sempre rodar
`git pull origin main` antes de invocar Codinho em qualquer máquina**, e
**confirmar `git status --branch` mostra "up to date with origin/main"** no
início de toda sessão de trabalho que vá tocar código. Se o repo local não tá
sincronizado, qualquer trabalho que Codinho fizer vai estar em base errada,
independente de quão bem ele execute.

**Racional:** Codinho é determinístico no escopo que recebe. Não tem awareness
de que o working tree local pode estar atrás do remote. O custo de verificar
sincronia antes é 2 segundos. O custo de descobrir desincronia depois é limpeza
cirúrgica de várias horas e risco real de destruir trabalho em produção. Reset +
Codinho rerodar é mais limpo que merge manual porque Codinho lê o filesystem
real, detecta conflitos sutis (resend já instalado, imports diferentes, paths
diferentes) e adapta.

**Consequências:**

- Adicionar pré-sessão checklist ao protocolo do trio:
  `git fetch && git
  status` antes de qualquer prompt pro Codinho
- Quando o `git status` mostrar diverged: NÃO chamar Codinho até resolver
- Backup físico (`Copy-Item -Recurse`) antes de qualquer reset destrutivo,
  sempre. Pelo menos um nível de segurança fora do alcance do git
- Aspas multi-linha do PowerShell são um modo recorrente de falha em git commit.
  Adotar pattern de arquivo temp lido com `git commit -F`

**Responsável:** Alan Gattiboni (incidente) + Claudinho (diagnóstico e condução
do recovery). **Status:** Ativa.

---

## D039 — Webhook Sanity → Vercel via `/api/revalidate` com HMAC dual-format

**Contexto:** o blog público (Lote D) consome Sanity com ISR de 1 minuto em
`/blog` e SSG estática em `/blog/[slug]`. Amanda publica um post no Studio e o
site só atualiza após o cache expirar (até 1 minuto na listagem, indeterminado
na página individual até nova build). Pra publicação instantânea, precisamos de
webhook Sanity → Vercel disparando `revalidatePath()`.

**Alternativas consideradas:**

- (a) **`revalidateTag` com cache tags por documento** — mais granular, dá pra
  invalidar só o post que mudou. Custo: requer marcar todos os fetches do Sanity
  com `next: { tags: [...] }`, e o endpoint precisa parsear o payload do Sanity
  pra extrair `_id`. Mais código, mais ponto de falha.
- (b) **`revalidatePath` global no `/blog`** — invalida a listagem toda toda vez
  que qualquer post muda. Custo: regera a listagem inteira mesmo se só um post
  mudou. Em escala de blog com 50+ posts, pode ser caro. No estado atual (3
  posts), inócuo.
- (c) **`revalidatePath` em duas linhas: `/blog` (literal) + `/blog/[slug]`
  (page type)** — invalida listagem e todas instâncias do dynamic route. Cobre
  publish e edit de qualquer post.

**Decisão:** **(c)**, com nota técnica importante (descoberta pelo Codinho): o
`revalidatePath` com tipo `'page'` em route com segmento dinâmico precisa
incluir o **route group** no path. Implementação final usa
`revalidatePath('/(public)/blog/[slug]', 'page')`, não `/blog/[slug]` puro. Doc
do Next 16 sobre revalidatePath cobre esse detalhe (linha 148 citada pelo
Codinho).

**Sobre assinatura:** a especificação inicial dizia "HMAC-SHA256 do body". O
Codinho descobriu que os webhooks GROQ do Sanity assinam no formato `t=,v1=`,
onde sig é HMAC-SHA256 de `${timestamp}.${body}` em base64url. Não o body cru.
Implementação final aceita **dois formatos**: o oficial Sanity (`t=`/`v1=`) com
fallback pra HMAC puro do body. Pros: funciona out-of-the-box com a config
padrão do painel Sanity e com qualquer teste manual via curl. Contras: ~15
linhas a mais de código. Segurança não fica pior porque ambos os formatos
validam contra o mesmo secret.

**Outros pontos cravados:**

- Endpoint path: `/api/revalidate` (convenção Next + Sanity)
- Header da assinatura: `sanity-webhook-signature`
- Comparação time-constant (`crypto.timingSafeEqual`) contra timing attacks
- Filter no GROQ do webhook: `_type == "post"` (endpoint não precisa filtrar)
- Status codes: 200 sucesso, 401 signature inválida/ausente, 400 body
  malformado, 500 inesperado ou env var faltando
- Runtime: Node (não Edge, porque crypto nativo)

**Racional:** dual-format de assinatura é pragmatismo defensivo. A spec da
Sanity sobre webhook signature não é trivialmente óbvia, e ter fallback evita
investigação noturna se algum dia mudarem o formato. Comparação time-constant é
boilerplate de segurança. Route group no path é descoberta operacional do Next
16 que ficaria como gotcha invisível se cravássemos só `/blog/[slug]`.

**Responsável:** Alan Gattiboni (decisão de produto) + Claudinho (spec
técnica) + Codinho (correções operacionais sobre route group e dual-format).
**Status:** Ativa.

---

## D038 — UI de Configurações com 2 editores especializados (origens ≠ tags)

**Contexto:** o Lote E inicial entregou Configurações com editor único genérico
(`SettingItem` com id/name/slug/color) compartilhado por `capture_origins` e
`tags`. Lote E.1 restaurou o schema cravado: origens ganharam `descricao` e
`campanha_ativa`, tags ganharam `cor` (obrigatória) e `grupo`. As duas tabelas
pararam de ter shape comum.

**Alternativas consideradas:**

- (a) **Editor único com campos condicionais** — mantém componente único, mas
  ele renderiza ou não cada campo conforme o tipo. Menos código, mais espaguete
  de condicional.
- (b) **Dois editores especializados** — `CaptureOriginEditor` e `TagEditor`,
  cada um com seus campos próprios, primitivos compartilhados
  (Toggle/Badge/Card). Mais arquivos, mas cada um é simples e focado.

**Decisão:** **(b)**. Editor único com condicional vira fonte de bug sutil
(campo aparece em contexto errado, validação fora de lugar). Dois editores
especializados são lineares de ler e modificar.

**Racional:** zero dívida técnica não é só sobre o código de hoje, é sobre o
código que vai mexer nele em 6 meses. Editor único com if-else pra cada campo
gera tensão recorrente. Separar agora é barato; consolidar depois é caro.

**Responsável:** Codinho (decisão técnica durante o Lote E.1), confirmada por
Claudinho. **Status:** Ativa.

---

## D037 — Módulo `src/lib/configuracoes/` seguindo pattern D029 com mapper identity explícito

**Contexto:** no Lote E inicial, os tipos `CaptureOrigin` e `Tag` viviam inline
em `configuracoes/actions.ts` como `SettingItem` genérico, e a leitura do banco
era direta na page (sem camada de abstração). Não seguia o padrão D029 do Lote
C. No Lote E.1, o Codinho criou módulo
`src/lib/configuracoes/{types,mappers,index}.ts` espelhando o pattern.

**Sobre o mapper identity:** o naming dos campos no domínio TS coincide com o
naming no DB (`is_active`, `cor`, `descricao`, etc., naming misto preservado do
projeto). O mapper `rowToCaptureOrigin` e `rowToTag` ficaria cópia 1:1. Tentação
de pular o mapper foi descartada.

**Alternativas consideradas:**

- (a) **Pular o mapper** quando naming bate 1:1 — código mais enxuto, menos
  arquivos.
- (b) **Manter mapper identity explícito** — o compilador cobra todos os campos,
  drift detection se um dia o domínio divergir do DB, consistência com pattern
  D029.

**Decisão:** **(b)**. Mantém o mapper mesmo sendo identity.

**Racional:** drift entre TS e SQL acontece em silêncio. Hoje o naming bate,
amanhã alguém adiciona `display_order` no DB e esquece de propagar pro TS; sem
mapper explícito, o compilador não cobra. Com mapper, o compilador cobra todos
os campos no momento do build. O custo do código duplicado é trivial. Honrar o
pattern D029 também elimina "qual jeito a gente usa pra X" como discussão
recorrente.

**Responsável:** Codinho (execução), Claudinho (pattern enforcement).
**Status:** Ativa.

---

## D036 — Route group `(painel)` protegido vs auth flat (`login`, `solicitar-acesso`, `aguardando`, `aprovar`)

**Contexto:** no fluxo de aprovação manual, o back office tem dois grupos de
rotas com requisitos opostos:

- Rotas que **exigem sessão ativa**: dashboard, contatos, blog, configurações,
  usuários
- Rotas que **rodam sem sessão** (ou com sessão pending): login, solicitar
  acesso, página de "aguardando aprovação", endpoint público de aprovação via
  token signed

Se o layout admin valida sessão pra todas, as rotas de auth quebram. Se não
valida pra nenhuma, as protegidas vazam.

**Alternativas consideradas:**

- (a) **Validação por página** — cada page protegida chama `requireSession()` no
  topo. Repetitivo, falha em silêncio se algum dia alguém esquecer.
- (b) **Middleware/proxy faz tudo** — só o proxy decide. Funciona mas o layout
  não sabe o usuário, e Server Components não conseguem renderizar chrome
  (header, sidebar) com info de sessão sem ir buscar de novo.
- (c) **Route group `(painel)/` com layout server-component que valida sessão**
  — todas as rotas protegidas vivem dentro, layout valida uma vez, renderiza
  chrome com info de sessão pros filhos. Rotas de auth ficam flat fora do
  `(painel)/` e não passam pelo layout.

**Decisão:** **(c)**. URLs não mudam (`(painel)/` é transparente pro Next).
Organização interna do filesystem fica clara: o que é protegido vs o que é
público dentro de `/admin/*`.

**Racional:** Next 13+ route groups foram desenhados pra exatamente esse caso de
uso. Custo de adotar: zero. Ganho: separação clara, layout pode servir como gate
única, chrome pode usar `getSession()` server-side sem re-fetch.

**Responsável:** Codinho (decisão durante o Lote E), confirmada por Claudinho.
**Status:** Ativa.

---

## D035 — `admin.createUser({ email_confirm: true })` em vez de `signUp` no fluxo de aprovação manual

**Contexto:** o fluxo de aprovação manual tem 3 estados: (1) usuário solicita
acesso, (2) admin aprova ou rejeita via email signed, (3) usuário loga (se
aprovado). O Supabase oferece dois caminhos pra criar usuário:

- `supabase.auth.signUp({ email, password })` — cria com
  `email_confirmed_at:
  null`. Se "Confirm email" tá ligado no painel, usuário
  precisa clicar link de confirmação antes de logar.
- `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm:
  true })`
  — cria já confirmado, via service role.

**Alternativas consideradas:**

- (a) **`signUp` + desligar "Confirm email" no painel** — código simples, mas
  depende de setting de painel pra funcionar; alguém pode religar o toggle sem
  perceber e quebrar o fluxo.
- (b) **`signUp` + manter "Confirm email" ligado + dual gate (confirm email do
  Supabase + status='pending' no nosso `user_profiles`)** — adiciona uma etapa
  pro usuário (confirmar email) antes do gate de aprovação manual. Ruído.
- (c) **`admin.createUser({ email_confirm: true })` no service role** — cria
  user já confirmado no Supabase Auth, gate de aprovação manual fica 100% no
  nosso `status='pending'`. Independente do setting do painel.

**Decisão:** **(c)**. Elimina dependência de setting de painel e elimina etapa
redundante. O portão real (aprovação manual via email signed) é o nosso
`user_profiles.status`.

**Racional:** dois portões pro mesmo propósito (confirmar identidade do usuário)
é ruído. O portão que importa é o de aprovação manual, e ele já tá implementado.
O `email_confirm` do Supabase virou só uma feature operacional opcional ("se eu
quiser desligar, posso, sem quebrar nada").

**Responsável:** Codinho (decisão técnica durante o Lote E), confirmada por
Claudinho. **Status:** Ativa.

---

## D034 — Next 16: `middleware` renomeado pra `proxy` + descoberta de que `middleware.ts` raiz nunca rodou

**Contexto:** o Lote E precisava de proteção server-side em `/admin/*` pra matar
o D030. A implementação ia usar `middleware.ts` na raiz do projeto. Codinho
descobriu duas coisas:

1. **Next 16 renomeou `middleware` pra `proxy`**. Arquivo deve ser
   `src/proxy.ts` (ou `proxy.ts` na raiz, depende da estrutura). Build emite
   warning de convenção deprecada se usar `middleware.ts`.
2. **O `middleware.ts` que existia no projeto na raiz nunca rodou.** O app vive
   em `src/app/`. Pra o Next ativar o middleware, o arquivo precisa estar na
   **raiz do diretório do projeto** quando o app está na raiz, ou em `src/`
   quando o app está em `src/app/`. O `middleware.ts` raiz com app em `src/app/`
   é inerte. Toda a "proteção" do back office antes do Lote E era 100%
   client-side.

**Consequência retroativa:** D030 era mais grave do que estava registrado. Não
era "auth mock + SSR vaza dados na payload anônimo". Era "back office sem
proteção server-side de qualquer tipo".

**Decisão:**

- Usar `src/proxy.ts` (convenção Next 16, vai pra `src/` pra acompanhar o app)
- Deletar `middleware.ts` raiz
- Proxy aplica gate em `/admin/*` exclusivamente, sem afetar rotas públicas
- Runtime do proxy é Node (Next 16 default; opção `runtime` lança erro se setada
  explicitamente)

**Racional:** convenção do Next 16 é convenção. Sobre o "middleware raiz nunca
rodou": catch importante e silencioso, exatamente o tipo de coisa que justifica
ter Codinho como camada de execução com awareness de filesystem real e doc
oficial.

**Responsável:** Codinho (descoberta), Claudinho (escopo final). **Status:**
Ativa.

---

## D033 — `reply_to` forçado no Resend em vez de forwarding via Registro.br

**Contexto:** durante o Lote D (Resend ligado ao form de contato), surgiu a
pergunta de como rotear respostas aos leads que chegam pelo formulário.
Alternativas operacionais:

- Configurar forwarding no Registro.br: emails enviados pra
  `contato@spinharditurismo.com.br` vão automaticamente pra uma caixa real (ex.:
  `spinhardi.turismo@gmail.com`).
- Não configurar forwarding, e usar `reply_to:` em todo email enviado via
  Resend. Quem responder o email vai direto pro Gmail real, sem precisar de
  caixa institucional ativa.

**Alternativas consideradas:**

- (a) **Forwarding via Registro.br** — caixa institucional fica "viva" no DNS;
  qualquer email enviado pra `contato@...` chega no Gmail. Mais geral, mas
  precisa de config DNS adicional e dependência do provedor.
- (b) **`reply_to` no Resend** — cada email enviado força `reply_to:` no header.
  Quem clica reply responde pro Gmail. Mais simples, 100% controlado por código.

**Decisão:** **(b)**. Em todos os emails enviados via Resend (form de contato do
Lote D, fluxo de aprovação manual do Lote E), o `reply_to` aponta pro Gmail
institucional da Spinhardi.

**Racional:** simplicidade operacional. Sem dependência de config no
Registro.br. Se um dia a Spinhardi quiser caixa institucional real, configura
forwarding/imap depois sem precisar mexer no código. Reversível com baixo custo.

**Responsável:** Alan Gattiboni (operacional) + Claudinho (técnico). **Status:**
Ativa.

---

## D032 — Billing per-cliente (Vercel team, Supabase org, Sanity org, Resend account separadas pra Spinhardi)

**Contexto:** o engagement Gattiboni Enterprises → Spinhardi Turismo precisa de
separação de billing. Gattiboni paga as contas dos próprios SaaS pra projetos
internos. Cada cliente paga as próprias. Quando o engagement Spinhardi foi pra
fase 3 (produção, custo recorrente), foi necessário decidir como arquitetar as
contas.

**Alternativas consideradas:**

- (a) **Tudo dentro da conta Gattiboni** — Vercel, Supabase, Sanity, Resend
  todos sob a conta pessoal do Alan. Cobrar Spinhardi via repasse mensal.
  Operacionalmente simples, mas mistura billing, e quando o engagement
  terminar/migrar, é trabalho transferir.
- (b) **Conta dedicada Spinhardi por SaaS, ownership Alan** — em cada SaaS,
  criar entidade dedicada pra Spinhardi (Vercel team "Spinhardi Turismo",
  Supabase org "Spinhardi Turismo", Sanity org "Spinhardi Turismo", Resend
  account com email da Spinhardi). Billing separado. Cartão da Spinhardi.
  Ownership atual com Alan, transferência futura quando Spinhardi for assumir
  diretamente.

**Decisão:** **(b)** desde o início da Fase 3. Cada SaaS tem entidade dedicada
pra Spinhardi. Cartão virtual da Spinhardi cobra cada um diretamente. Ownership
administrativo segue com Alan (Gattiboni) até handoff formal.

**Implementação:**

- **Vercel**: team "Spinhardi Turismo" (separada da conta pessoal Alan), projeto
  `spinhardi` lá dentro, cartão Spinhardi
- **Supabase**: org "Spinhardi Turismo" (separada), projeto
  `grjkqljucszoaujmhgpi` lá dentro, cartão Spinhardi
- **Sanity**: org "Spinhardi Turismo", projeto `wtc1swpj`
- **Resend**: account com email `spinhardi.turismo@gmail.com`

**Racional:** separação de billing desde o nascedouro evita complicação contábil
no Gattiboni (despesas misturadas) e na Spinhardi (gastos com SaaS não
rastreáveis). E garante que transferência de propriedade técnica no fim do
engagement é viável (basta transferir ownership de cada entidade, sem precisar
migrar projetos entre contas).

**Consequências:**

- Transferência de propriedade técnica no handoff é trabalho real (~1 dia
  estimado pra todas as 4 plataformas). Cláusula contratual sugerida.
- Cada SaaS tem dois "owners conceituais": o operacional (Alan/Gattiboni
  enquanto consultoria, depois Nina/Julia) e o financeiro (Spinhardi sempre).

**Responsável:** Alan Gattiboni. **Status:** Ativa.

````
---

## D031 — `<SpinhardiImage>` é a forma única de exibir imagens de conteúdo

**Contexto:** o lote de aplicação das primeiras imagens reais (junho 2026)
revelou uma tensão estrutural com a realidade operacional da Spinhardi. As 17
fotos entregues pela Amanda vinham em aspect ratios e orientações desencontradas
do mapa que ela mesma escreveu: equipe pedida em paisagem (5:3) entregue em
retrato (2:3 e 9:16), destinos pedidos em retrato (4:5) entregues em paisagem
(3:2), blog thumb pedido em paisagem 16:9 entregue em retrato. Esse desencontro
não é falha — é a realidade. Spinhardi não tem agência de produção fotográfica
por trás escolhendo centenas de imagens com briefing técnico. Pega o que tem
(foto de Nina na Toscana, foto da fachada antiga, foto de destino que veio do
parceiro). Engessar slots por orientação fixa cria fricção operacional pra
sempre: ou alguém vai ter que pedir crop, ou alguém vai descartar foto boa
porque "tá no aspect errado".

**Alternativas consideradas:**

- (a) **Engessar o slot por orientação.** Cada slot exige foto em orientação
  específica; quem entrega tem que adequar. Garante design previsível mas cria
  atrito recorrente que a operação real não comporta.
- (b) **Container adapta ao aspect da foto.** Layout muda conforme a foto chega.
  Quebra previsibilidade do design e força refator de página a cada foto nova.
- (c) **Aspect-ratio fixo no container do layout + imagem adapta via
  `object-fit: cover` + `object-position` ajustável.** Slot mantém o desenho
  previsto pelo layout, foto entra em qualquer orientação, crop dinâmico no
  centro (ou em posição customizada caso o centro corte algo importante).

**Decisão:** (c), encapsulada num componente único: `<SpinhardiImage>`, definido
em `src/components/ui/SpinhardiImage.tsx`. Vira **lei do projeto** pra slots de
imagem de conteúdo. Nenhum `<Image>` direto do `next/image`, nenhum `<img>`
solto, nenhum `background-image` CSS pra foto de conteúdo.

**API do componente:**

```ts
interface SpinhardiImageProps {
  src: string;
  alt: string; // "" pra decorativas
  aspect: string; // ex: "5/3", "4/5", "16/9", "3/2"
  objectPosition?: string; // default "center"
  priority?: boolean; // true só pra above-the-fold (hero)
  sizes?: string; // default "100vw"
  className?: string; // wrapper recebe; max-w-* e similares passam aqui
}
````

**Detalhes de implementação que viraram parte da especificação:**

- `style={{ aspectRatio }}` inline, NÃO `aspect-[X/Y]` em className. Motivo:
  Tailwind v4 purge não detecta classes geradas dinamicamente via template
  string. Inline style é a forma segura pra valores dinâmicos.
- `style={{ objectFit, objectPosition }}` inline pelo mesmo motivo.
- `<Image fill>` (não `width`/`height`). Wrapper define o tamanho via
  aspect-ratio + largura herdada do pai.
- **`w-full` no wrapper por default.** Esse item não estava na especificação
  inicial — virou parte dela após bug descoberto durante a aplicação (ver "Risco
  descoberto" abaixo).

**Casos onde `<Image>` direto do `next/image` continua permitido:** componentes
especializados com responsabilidades próprias. Exemplo concreto: `BlogCard.tsx`
mantém `<Image>` direto porque ele já encapsula `sizes` específico, integração
com `<Link>` parent, fallback de div quando `thumbnail` é null, e `alt=""` por
regra WAI-ARIA (thumbnail adjacente a título-link clicável). Refatorar pra
`<SpinhardiImage>` ali seria substituir um componente especializado por outro
mais genérico — perda de informação semântica, ganho zero. **`BlogCard` é a
exceção documentada da lei.**

**Casos proibidos sem exceção:**

- `<img>` solto em qualquer lugar do site público
- `background-image` CSS pra foto de conteúdo (escapa o otimizador do Next, fura
  performance)

**Racional:**

- Tolerância a orientação reflete a realidade operacional, alinha com o
  princípio "spinhardi não tem agência por trás escolhendo centenas de imagens,
  o que tem é o que há"
- Crop dinâmico no centro funciona em ~80% dos casos; os outros 20% têm
  `objectPosition` customizado caso a caso (ex.: `"top"` pra retrato com rosto
  no terço superior)
- Componente único garante consistência: todo slot futuro nasce com a tolerância
  embutida, sem precisar pensar em CSS de novo
- Aspect-ratio no container (não na imagem) preserva previsibilidade do layout
  pra design

**Consequências:**

- 9 slots aplicados com o componente na primeira rodada: Home (hero,
  posicionamento com Nina, história/1987 com fachada da agência), `/sobre`
  (Nina + Julia lado a lado), `/viagens` (2 cards), `/viagens/pacotes` e
  `/sob-medida` (colunas direitas), `/blog` indiretamente via BlogCard com 3
  thumbs preenchidas
- Próximos slots seguem a lei. Adicionar `<img>` ou `<Image>` direto pra foto de
  conteúdo passa a ser dívida
- Imagens da Amanda entregues em qualquer orientação razoável aceitas sem
  retrabalho operacional

**Risco descoberto durante implementação (documentado pra honestidade):**

O wrapper do `<SpinhardiImage>` inicialmente nasceu com
`className="relative overflow-hidden"`, sem `w-full`. A premissa era que o pai
(item de grid, flex, etc.) daria largura ao componente. Funcionou pros casos
onde a className passada incluía largura (Julia em `/sobre` tinha `max-w-md`) ou
onde a className tinha posicionamento absoluto (Hero da Home tinha
`absolute inset-0 h-full w-full`). **Quebrou silenciosamente** pros 6 slots em
CSS Grid onde o consumidor não passou largura explícita: o filho do wrapper é
`<Image fill>` com `position: absolute`, contribuição zero pro conteúdo
intrínseco; com o item de grid resolvendo largura por content-size em vez de
track-size, a largura colapsou pra 0, e o `aspect-ratio` calculou altura em cima
de 0. Resultado: caixa de 0px de altura, imagem renderizada invisível.

O smoke test do Codinho inicialmente confirmou "marca-up presente no HTML" mas
não cobriu "imagem visível na viewport". Bug pegou no walkthrough visual do Alan
no browser. Investigação cirúrgica do Codinho ratificou a hipótese (largura
colapsada em grid + aspect-ratio sem base = altura 0), e o fix foi adicionar
`w-full` ao wrapper por default. Isso virou parte permanente da especificação do
componente: o `<SpinhardiImage>` agora garante que vai ocupar 100% da largura do
pai independente do contexto, e casos onde o consumidor quer menos seguem
funcionando via `max-w-*` (que vence `width` quando menor) no className.

**Lição registrada:** smoke test HTTP de código presente não confirma
renderização. Pra mudanças de layout, validação ponta-a-ponta visual no browser
é obrigatória. Próximos trabalhos com componente novo ou alteração de container
devem incluir essa etapa explícita.

**Responsável:** Claudinho (princípio + especificação técnica) + Alan Gattiboni
(decisão estratégica de tolerância editorial, validação visual final) + Codinho
(investigação do bug + implementação do componente e dos slots) **Status:**
Ativa

## D030 — Auth mock client-side expõe dados via SSR; Supabase Auth real é pré-requisito de go-live

**Contexto:** durante o Lote C, o Codinho aplicou
`export const dynamic = "force-dynamic"` nas três páginas admin de leitura
(`/admin`, `/admin/contatos`, `/admin/contatos/[id]`). A decisão era necessária:
o `AdminLayout` é Client Component (lê auth do `localStorage`, ver D021), e sem
`force-dynamic` o Next prerenderiza um snapshot estático no build, fazendo a
lista nunca refletir os dados reais e ainda tentando bater no banco em build
time.

A consequência apareceu junto: agora essas páginas renderizam no server e buscam
contatos via service role no SSR. O `AdminLayout` só checa auth depois, no
client. Pra qualquer request, mesmo não-autenticado, o server monta o HTML com
os dados dos contatos dentro do payload, e o redirect pra `/admin/login`
acontece tarde demais no browser. Um `curl /admin/contatos` voltaria nome,
whatsapp e email dos contatos.

A causa-raiz é estrutural: auth em `localStorage` é client-side por definição,
então o server não tem como saber se o request está autenticado. Não há policy
de RLS que resolva isso, porque a query passa pela service role (que bypassa RLS
de propósito).

**Alternativas consideradas:**

- (a) Reverter `force-dynamic` e voltar pra mock client-side puro: quebra o
  requisito básico de o admin mostrar dados reais
- (b) Mover proteção pra middleware Next.js lendo `localStorage`: middleware
  roda no edge/server, não acessa `localStorage` do browser, inviável
- (c) Supabase Auth real com sessão em cookie HTTP-only: o server lê a sessão
  antes de renderizar, redireciona não-autenticados, e os Server
  Components/Actions só rodam pra quem tem sessão válida

**Decisão:** (c). Supabase Auth real vira pré-requisito de go-live, não mais
"melhoria futura" como tratado na D021.

**Racional:**

`force-dynamic` continua certo, é o que páginas de CRM precisam (sem ele,
snapshot estático e tentativa de DB no build). O problema não é da escolha do
Codinho, é consequência inevitável do auth provisório encontrando server
rendering. Resolver via auth real é o que estava previsto desde D021, só que
agora o timing dele deixou de ser "quando der" e virou "obrigatório antes do
go-live". Registrar agora evita esquecimento no checklist de pré-produção.

**Consequências:**

- Em preview, com banco vazio e sem cliente real, o risco é inócuo na prática
- Pra produção, isso não pode ir como está. Antes do go-live: Supabase Auth
  real, sessão em cookie HTTP-only, checagem server-side antes de renderizar,
  redirect 302 pra não-autenticados sem nunca montar os dados no HTML
- A RLS `authenticated` armada nas duas tabelas só protege de verdade quando o
  auth real estiver no lugar (hoje o server bypassa via service role)
- A D021 fica explicitamente substituída na fase de pré-go-live (o mock
  client-side não vai pra produção)
- Documentar requisitos exatos em `docs/SECURITY_GO_LIVE.md` (a criar)

**Responsável:** Claudinho (identificação do risco) + Alan Gattiboni (decisão de
elevação) **Status:** Ativa (substitui parcialmente D021)

---

## D029 — Lote C (código): camada de acesso server-side com service role e mapper explícito

**Contexto:** o Lote B do site usa mock TypeScript em `src/lib/contacts/`. O
Lote C precisa religar essas funções pra falar com o Supabase real, sem mudar as
páginas que consomem (mesmas assinaturas). Quatro decisões de arquitetura
precisam ser cravadas antes da execução.

**Alternativas consideradas:**

1. Mapper snake↔camel: genérico (recursivo) vs explícito por campo
2. Quantos clients Supabase: dois (anon no browser + service role no server) vs
   um (service role no server)
3. Onde rodam as operações: mistura Client/Server Components vs tudo server-side
   (Server Components leem, Server Actions escrevem)
4. Sync com Iddas/ClickMassa: chamar APIs reais agora vs manter stub mock até
   Fase 4
5. Seed dos 8 contatos mockados: inserir como seed vs começar limpo

**Decisão:**

1. **Mapper EXPLÍCITO por campo, à mão.** Tipos `ContactRow`/`ContactInsertRow`
   fazem o compilador cobrar os 53 campos nas duas direções.
2. **Um único client no Lote C:** `supabaseAdmin` server-side com service role
   em `src/lib/supabase/server.ts`, com `import 'server-only'` no topo.
3. **Leitura via Server Components, escrita via Server Actions**, ambos usando
   `supabaseAdmin`.
4. **Iddas/ClickMassa continuam STUB.** Lote C grava contato real + interação
   `form_submission`, mas `sync_status` fica `pending`.
5. **Banco começa LIMPO.** Mocks ficam no repo como referência, deixam de ser
   fonte de dados.

**Racional:**

- Mapper genérico converteria também as chaves dentro do `metadata` jsonb das
  interações, corrompendo o payload. E TypeScript cobrar 53 campos trava
  esquecimentos no compile time.
- Como auth ainda é mock client-side (D021), o browser não tem sessão
  `authenticated`. Um client anon cairia na role `anon`, que a RLS bloqueia.
  Criar o client anon agora seria órfão sem ninguém usando, ele entra junto com
  Supabase Auth real (passo futuro, D030).
- Server-side puro: a service role nunca pode chegar no bundle do browser.
  `import 'server-only'` quebra o build de propósito se algum Client Component
  importar `server.ts`.
- Integração externa real é Fase 4. Marcar `synced` sem sincronização real seria
  dado mentiroso. A estrutura (tabela `contact_interactions` com tipos
  `sync_iddas`/`sync_clickmassa`) já está pronta pra receber a camada real.
- Produção não nasce com 8 fakes que precisam ser caçados antes do go-live.
  Empty state precisa funcionar de qualquer jeito, e cria-se contatos reais via
  form pra testar a UI cheia.

**Consequências de execução:**

- `@supabase/supabase-js@2.108.1` instalado
- `src/lib/supabase/server.ts` com `supabaseAdmin` (service role, server-only)
- `src/lib/contacts/mappers.ts` com `rowToContact` / `contactToInsertRow` /
  `contactPatchToRow` / `rowToInteraction` / `interactionToInsertRow`
- `src/lib/contacts/index.ts` religado: `getContacts` / `getContactById` /
  `getContactInteractions` / `getContactStats` agora consultam Supabase.
  `getContactStats` puxa ativos uma vez e conta em memória (volume boutique, não
  justifica múltiplas `count` queries)
- Server Actions:
  - `src/app/(public)/contato/actions.ts`: form do site cria contato
    `origem=site_contato` + interação `form_submission`, sync `pending`. Contato
    salvo antes de qualquer stub de sync, zero perda de lead
  - `src/app/admin/contatos/novo/actions.ts`: criação manual cria
    `origem=manual`
  - `src/app/admin/contatos/[id]/actions.ts`: "Salvar alterações" da Gestão
    Interna persiste estágio/follow-up/notas; bumpa `estagio_atualizado_em`
    apenas quando o estágio muda
- `src/lib/contacts/from-form.ts`: defaults compartilhados site/admin (mesmo
  shape)
- Stubs de sync Iddas/ClickMassa intocados (Fase 4)
- Mocks `mock-contacts.ts` e `mock-interactions.ts` ficam como referência

**Responsável:** Claudinho (decisões técnicas) + Codinho (execução) + Alan
Gattiboni (validação) **Status:** Ativa

---

## D028 — Lote C: schema Supabase real e tradução TS→SQL

**Contexto:** Lote C precisa criar o schema real no Supabase pra substituir o
mock TypeScript do Lote B. O `src/lib/contacts/types.ts` é a fonte de verdade do
shape de Contact (53 campos camelCase em 10 grupos), ContactInteraction (7
campos) e 8 enums. A tradução desses tipos pra SQL exige várias decisões que
afetam evolução, performance e dívida.

**Alternativas consideradas:**

1. Nomenclatura no banco: snake_case vs camelCase quotado
2. Enums: ENUM type nativo vs TEXT + CHECK constraint
3. Tags: `text[]` com GIN vs tabela de junção `contact_tags`
4. Relação `origem` × `capture_origins`: FK direta vs TEXT+CHECK solto com
   `capture_origins` como catálogo independente
5. `ON DELETE` em `contact_interactions`: CASCADE vs RESTRICT
6. Escrita do form anônimo: policy permitindo INSERT pra `anon` vs
   `service_role` na Server Action
7. Timestamp em tags: adicionar `created_at` por boa prática vs fiel ao TS (sem
   timestamp)
8. Escopo do Lote C: criar todas as 4 tabelas (contacts, interactions,
   capture_origins, tags) vs criar só as 2 com código consumindo agora

**Decisão:**

1. **snake_case no banco, camelCase no TS, mapper isolado na fronteira**
   (`lib/contacts/`)
2. **TEXT + CHECK pros 8 enums** (origem, destino_tipo, orcamento_estimado,
   prazo_ideal, perfil_viajante, estagio, iddas_sync_status /
   clickmassa_sync_status, status; mais `tipo` em contact_interactions)
3. **`tags text[] not null default '{}'` com índice GIN**
4. **`origem` TEXT+CHECK (7 valores canônicos), `capture_origins` fora de FK**
   (catálogo independente)
5. **CASCADE em `contact_interactions`**
6. **`service_role` no server, anon trancado, RLS `authenticated`-only**
7. **Fiel ao TS — sem `created_at` em tags**
8. **Só `contacts` + `contact_interactions` agora**; `capture_origins` e `tags`
   entram com seus types TS quando ligar Configurações

**Defaults além do que o TS especifica** (decisões de coluna pra evitar travar
insert e refletir estado inicial óbvio):

- `status` default `'ativo'`
- `iddas_sync_status` e `clickmassa_sync_status` default `'pending'`
- `estagio_atualizado_em` default `now()`
- `notas_internas` default `''`
- `emails_abertos` default `0`

**Índices em `contacts`** (pelas queries reais de `getContacts` /
`getContactStats`): `status`, `estagio`, `origem`, `created_at desc`,
`proximo_follow_up`, `iddas_sync_status`, `clickmassa_sync_status`, GIN em
`tags`. Trigger `trg_contacts_updated_at` via função genérica
`set_updated_at()`. Em `contact_interactions`: FK
`contact_id → contacts(id) ON DELETE CASCADE`, índice composto
`(contact_id, criado_em)` pra timeline.

**Racional:**

- **snake_case** respeita PostgREST sem aspas em query; o mapper isolado mantém
  Lote B intocado e absorve a fronteira banco↔app numa única camada
- **ENUM nativo engessa evolução** (ALTER difícil, remover valor quase
  impossível); CHECK valida igual e evolui com uma linha
- **`text[]` + GIN é direto do mock** e performático pro volume boutique; tabela
  de junção seria over-engineering. A tabela `tags` é catálogo de UI,
  conceitualmente separada
- **`origem` e `capture_origins` são conceitos diferentes** (tipo canônico
  estável vs catálogo configurável); FK misturaria estabilidade dos tipos com
  dinâmica do catálogo
- **Soft-delete via `status`** é o fluxo normal; CASCADE existe só pro
  hard-delete raro (LGPD), evita órfãos sem cleanup
- **`service_role` no server centraliza escrita** (alinha com D024); publishable
  key no browser sem policy pra anon fica trancado
- **`created_at` em catálogo de tags de agência boutique não é caso de
  auditoria**; adicionar seria adição especulativa que quebra "sem estrutura
  inventada" e forçaria mexer no type TS
- **Criar tabela sem código consumindo é dívida silenciosa**. `capture_origins`
  e `tags` entram quando ligar Configurações, com type TS nascendo junto

**Consequências:**

- Tabelas `contacts` (53 colunas, 8 índices, trigger) e `contact_interactions`
  (7 colunas, FK CASCADE, índice de timeline) criadas e validadas no Supabase
  via SQL editor (insert+rollback provou defaults; CASCADE provou retorno
  `interacoes_orfas=0`)
- RLS ligada nas duas (`rowsecurity=true`); policies
  `authenticated_all_contacts` e `authenticated_all_interactions` (ALL pra
  `authenticated`)
- `capture_origins` e `tags` ficam pendentes pro passo de ligar a página de
  Configurações
- A Fase 1.11 do `docs/plano_de_desenvolvimento_site_v3.md` precisa ser
  reescrita pra refletir o schema real (substitui descrição antiga que falava de
  `contact_submissions`/`user_profiles`/`admin_activity`)

**Responsável:** Claudinho (decisões técnicas cravadas) + Alan Gattiboni
(validação) **Status:** Ativa

---

## D027 — Verde-pinheiro #3F5B30 substitui sage #8CB89F na paleta oficial

**Contexto:** o sage `#8CB89F` do Branding Book v2 (pastel, frio, hue ~140°) foi
rejeitado pela Nina em revisão de paleta. A direção pedida foi explicitada com
referência concreta: o verde da camiseta de safári da Spinhardi que ela já usa,
ajustado pra ficar "menos pastel, um pouco mais escuro, com um pingo de brilho".

A direção fechou três coisas que o sage não entregava: cor com peso e ancoragem
(não respiro), conexão com o universo real da marca (camiseta, safári, Serra
Negra), e tom de viagem que evoca raiz e continuidade em vez de leveza italiana
abstrata.

A D006 (verde provisório `#4DBF72`) também é resolvida por essa decisão: o verde
nunca chegou a virar paleta oficial, ficou só como token de dev, e agora é
substituído pela escolha real.

**Alternativas consideradas:**

- Manter sage `#8CB89F`: descartado pela Nina, pastel demais
- Sage saturado no mesmo eixo (`#6cb390`, `#4fac81`): mais vivo mas continua
  frio e claro, não atende a direção de peso
- Verde-limão (`#8ab85c`, `#a1c03b`): movimento na direção oposta, esquentava
  demais e brigava com o ouro
- `#3F5B30` (verde-oliva escuro, hue ~~85°): escolhido. Calibrado a partir da
  camiseta de safári (~~ `#4d5d3a`) com saturação aumentada e luminosidade
  reduzida

**Decisão:** `#3F5B30`. Nome oficial no BB: "Verde-pinheiro" (referência poética
da Nina, mesmo que tecnicamente seja oliva). Hierarquia mantida: Navy e ouro
continuam protagonistas, verde-pinheiro continua coadjuvante.

Restrição de uso reescrita: antes era "sage só sobre fundo branco, nunca sobre
Navy" por baixo contraste; agora é "verde-pinheiro nunca diretamente adjacente
ao Navy" por luminosidade próxima entre dois escuros, sempre branco ou claro
neutro respirando entre os dois.

**Racional:**

A cor saiu de uma referência real (camiseta usada pela Nina em safári), não de
um briefing abstrato. Conecta marca, dona e produto numa cor só. Verde-pinheiro
escuro evoca raiz, ancoragem, continuidade, vocabulário compatível com "quase 40
anos de história" e com Serra Negra (montanhas em verde escuro). Não compete com
o ouro pela atenção, mantém hierarquia atual da paleta.

Tecnicamente: hue ~85° (oliva quente), saturação ~32%, luminosidade ~27%. Tem
peso suficiente pra ancorar composição, contraste alto o bastante com branco pra
ser usado como bloco de cor ou tipografia em corpo médio.

**Consequências:**

- BB Lite v2 → v3 com hex novo aplicado nas 38 ocorrências do XML (bordas
  decorativas, headings de subtítulos) + 4 trechos textuais reescritos
  (restrição, hierarquia, Instagram, Site)
- `image1.png` (tabela de cores) e `image2.png` (variações da logo) refeitas no
  Canva
- Moodboard novo montado no Canva alinhado com a paleta
- Tokens Tailwind no site (`spinhardi-preview.vercel.app`) precisam atualizar:
  substituir `#8CB89F` por `#3F5B30` em `tailwind.config.ts` e variáveis CSS,
  checar componentes que usam o sage
- OG image e favicon a serem revistos se usarem o verde

**Responsável:** Nina (decisão de cor) + Alan Gattiboni (calibração técnica e
aplicação no BB) **Status:** Ativa, supera D006

**Aplicado em código (2026-06-12):**

- `src/app/globals.css:14` — token `--color-green` atualizado para `#3f5b30`
- `docs/identidade_visual.md` — versão 1.1: paleta, restrição crítica reescrita
  (adjacência Navy/luminosidade), variação verde da logo, seção de tokens
  reescrita como CSS-first com governança público/admin explícita, rodapé
  corrigido (não há `tailwind.config.ts`)
- `docs/plano_de_desenvolvimento_site_v3.md` e `v2.md` — referências do verde
  atualizadas
- `docs/spinhardi_wireframe.html` — token `--green` atualizado

**Governança consolidada:** no site público, qualquer uso de verde DEVE usar o
token `--color-green` via classes bare (`text-green`, `bg-green`,
`border-green`, etc.). A escala numérica do Tailwind (`green-50…green-950`) fica
reservada para estados de UI no admin (sucesso, sincronizado, publicado,
alertas). Essa regra está registrada em `docs/identidade_visual.md`.

Resolve definitivamente a D006 (verde provisório).

---

## D024 — Spinhardi como source of truth de contatos

**Contexto:** durante o planejamento do Lote B, após investigação intensiva das
APIs do Iddas e ClickMassa (via Comet em modo agente, dia 08/06/2026),
descobriu-se que ambos os sistemas têm APIs REST completas e funcionais:

- **Iddas:** Swagger oficial em `apiagencia.iddas.com.br`, com endpoints CRUD
  pra Pessoa, Orçamento, Solicitação, Venda, Voo, Hospedagem, Transporte,
  Passeio, Cruzeiro, Seguro, Etiqueta, Situação, Canal de Venda, Tarefa,
  Receita, Despesa, Aeroporto, Companhia, Usuário. Inclui **2 endpoints POST
  públicos** desenhados pra captura externa (Solicitação de Cotação + Cadastro
  de Pessoa).
- **ClickMassa:** API completa com endpoints `/v1/api/external/{apiId}` pra
  envio de mensagens, criação de notas internas, gestão de Tags, Opportunities
  (CRM próprio com pipeline e steps), Templates WABA, ChatFlows. Suporta WABA
  (Meta oficial) e WhatsApp Web.

A discussão sobre o que fazer no nosso back office levou a uma virada
arquitetural fundamental.

**Decisão:** **Spinhardi (nosso Supabase) é source of truth de contatos.**

Implicações:

- Toda pessoa com quem a Spinhardi se relaciona vira `contact` no nosso
  Supabase, independente da origem (site, Google Ads, Instagram, indicação,
  manual, importado).
- Iddas e ClickMassa são **canais operacionais especializados** que recebem
  subset dos dados conforme cada um pode consumir (Iddas pra cotação/venda,
  ClickMassa pra atendimento WhatsApp).
- A tabela `contacts` é modelada rica desde o nascimento (~50 campos em 10
  agrupamentos: identificação, dados pessoais, endereço, qualificação, estágio
  interno, tags, espelho Iddas, espelho ClickMassa, comportamento, metadados).
- Inteligência (segmentação, automação, IA, campanhas) mora no nosso admin
  porque é a única camada que consegue cruzar dados dos múltiplos sistemas
  - comportamento próprio (posts lidos, emails abertos, etc).

**Racional:**

Ter contatos de cliente espalhados em interfaces de terceiros sem capacidade
própria de cruzamento e ação automatizada via IA mais à frente é dívida
estrutural. Imagina disparar uma ação de CRM direto da interface do site
filtrando "todos que viajaram pra Itália em 2025 e ainda não voltaram" — isso
exige tabela própria com governança própria. Iddas e ClickMassa não conseguem
isso isoladamente porque cada um só vê o seu pedaço.

**Consequências:**

- Lote B reescopado: módulo Contatos completo no nosso admin (não janela de
  leitura como considerado inicialmente)
- Lote C (Supabase): schema da tabela `contacts` vira tradução direta dos tipos
  TypeScript já modelados no Lote B — zero inferência
- Fase 4: integrações com Iddas e ClickMassa são bidirecionais. Captura alimenta
  Iddas/ClickMassa, mudanças neles voltam pra nós via sync periódico (Make ou
  serverless function)

**Aprendizado registrado:**

A decisão certa só apareceu depois de investigar a realidade dos sistemas
externos. A tentativa anterior de modelar baseado em "boas práticas genéricas de
CRM de turismo" estava destinada a virar refactor no Lote C. **Investigar
realidade antes de modelar.**

---

## D025 — Dashboard híbrido em 3 grupos (nossas métricas + integrações)

**Contexto:** wireframe inicial do Dashboard propunha 6 cards (3 "Hoje" + 3
"Este mês"). Durante a execução do Lote B, ficou claro que separar nossas
métricas (que consultam nossa base) das métricas dos sistemas externos (Iddas e
ClickMassa via API) tornaria o dashboard mais honesto sobre origem dos dados. A
divisão em 3 grupos foi confirmada visualmente após implementação e considerada
mais clara que a proposta original.

**Decisão:** dashboard organizado em 3 grupos temáticos:

1. **Hoje (3 cards):** Novos contatos, A fazer follow-up, Pendentes de sync
   (tone "warning" se >0)
2. **Este mês (3 cards):** Capturas totais, Em negociação, Fechados
3. **Métricas de integração (4 cards):** Orçamentos no Iddas, Vendas no Iddas,
   Tickets abertos no ClickMassa, Posts publicados

Total: 10 cards. Sem badges "Em breve" — tudo é real (mock plausível por
enquanto, fetch real no Lote C/D).

**Racional:**

- Separação visual reflete arquitetura real (nossa base vs sistemas externos)
- Card "Pendentes de sync" com tone "warning" se >0 é alerta operacional
  importante — indica saúde da integração
- Métricas de integração rodam via stubs em `lib/integrations/iddas.ts` e
  `clickmassa.ts` retornando mock seedado por data, garantindo plausibilidade
  sem precisar de API real ainda
- Saudação dinâmica (Bom dia / Boa tarde / Boa noite) + nome do user + data
  formatada PT-BR no topo

---

## D026 — Remoção da rota `/admin/integracoes`

**Contexto:** wireframe inicial previa `/admin/integracoes` como placeholder
("Em breve · Fase 4"). Durante a execução, com a página `/admin/configuracoes`
ganhando conteúdo real (cards de Integração Iddas, Integração ClickMassa,
Origens, Mensagem padrão, Tags), ficou redundante manter as duas rotas.

**Decisão:** remover `/admin/integracoes`. Conteúdo absorvido por
`/admin/configuracoes`.

**Consequências:**

- `src/app/admin/integracoes/page.tsx` deletado
- `AdminSidebar.tsx` grupo "Admin" agora tem 2 itens (Usuários, Configurações)
- Rota retorna 404
- Quando integrações virarem operacionais (Lote D / Fase 4) e demandarem página
  própria de monitoramento, a rota volta — agora como tela funcional, não
  placeholder

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
