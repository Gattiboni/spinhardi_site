# Wireframe — Blog público + Admin do blog

**Versão:** 1.0 **Status:** referência pra implementação **Fontes:** mapa de
copies aprovado pela Amanda (linhas 273-475 + Tabelas 16 e 17) + plano v3 (Fase
1.4)

---

## Conteúdo já disponível da Amanda

Amanda já escreveu **3 posts completos**, todos longos e bem estruturados:

1. **"Como escolher o destino certo para a sua próxima viagem internacional"**
   (categoria: Destinos) — ~1.500 palavras, 7 seções
2. **"10 coisas que você precisa definir antes de montar um roteiro de viagem"**
   (categoria: Dicas de Viagem) — ~1.400 palavras, lista numerada de 10
3. **"O que ninguém te conta antes de viajar para a Europa pela primeira vez"**
   (categoria: Dicas de Viagem) — ~1.500 palavras, lista numerada de 10

Esses 3 posts entram **direto na primeira leva**. Sem Lorem Ipsum, sem
placeholder genérico.

Categorias definidas (Tabela 16 do mapa):

- Todos (filtro padrão, mostra tudo)
- Destinos
- Bastidores
- Dicas de Viagem
- História da Agência

Títulos placeholder pra outros 6 posts mockados (Tabela 17 do mapa) — usar como
referência de tom, mas com excerpts próprios (Amanda explicitou na nota da linha
287: "Os títulos a seguir são apenas referência de tom, não são posts a serem
publicados.").

**Decisão:** vou mockar mais 2 posts (não 6) com base nesses títulos, com corpo
curto ("placeholder · este post será publicado em breve"). Total: 3 posts
completos + 2 esqueletos = 5 cards no blog inicialmente.

---

## Princípios de execução desta sub-fase

- **5 telas no total:** 2 públicas (listagem + post) + 3 admin (lista + criar +
  editar)
- **Abstração `lib/blog/`** pronta pra trocar mock por Sanity sem refactor
  (princípio modularidade)
- **Filtro de categoria funcional** no público — mas frontend-only (sem query
  params na URL nesta fase pra evitar overengineering)
- **Admin com UI completa, CRUD desativado.** Botões "Salvar" e "Excluir"
  mostram mensagem "Implementação completa virá com Sanity (Fase 3)"
- **Admin protegido por middleware** — mas o middleware em si só será
  implementado na Fase 1.7 (Back office estrutural). Por enquanto, rotas
  `/admin/*` ficam acessíveis publicamente em dev. **Vão ser bloqueadas no
  middleware quando 1.7 for feita.**

---

## Estrutura de tipos e dados (`lib/blog/`)

### `src/lib/blog/types.ts`

```ts
export type PostCategory =
  | "Destinos"
  | "Bastidores"
  | "Dicas de Viagem"
  | "História da Agência";

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  author: string;
  date: string; // ISO date
  body: string; // markdown ou HTML simples por enquanto
  thumbnail: string | null; // null = placeholder
  status: "rascunho" | "publicado";
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
};

export const CATEGORIES: PostCategory[] = [
  "Destinos",
  "Bastidores",
  "Dicas de Viagem",
  "História da Agência",
];
```

### `src/lib/blog/mock-posts.ts`

5 posts mockados. 3 completos (texto da Amanda), 2 esqueletos.

```ts
import { Post } from "./types";

export const MOCK_POSTS: Post[] = [
  {
    slug: "como-escolher-destino-viagem-internacional",
    title:
      "Como escolher o destino certo para a sua próxima viagem internacional",
    excerpt:
      'A pergunta que mais ouvimos antes de qualquer conversa sobre roteiro não é "quanto custa" nem "quando ir". É: "para onde eu vou?"',
    category: "Destinos",
    author: "Spinhardi Turismo",
    date: "2026-03-15",
    body: "[corpo completo do mapa linhas 290-344]",
    thumbnail: null,
    status: "publicado",
    seoTitle: "Como escolher o destino certo da sua próxima viagem | Spinhardi",
    seoDescription:
      "Um guia honesto para escolher o destino certo da sua próxima viagem internacional. Comece pelo que você quer viver, não pelo lugar.",
  },
  {
    slug: "10-coisas-antes-de-montar-roteiro",
    title:
      "10 coisas que você precisa definir antes de montar um roteiro de viagem",
    excerpt:
      "Montar um roteiro de viagem parece simples até você tentar fazer. Aí surgem as dúvidas: por quantos dias? Quais cidades? Hotel no centro ou fora?",
    category: "Dicas de Viagem",
    author: "Spinhardi Turismo",
    date: "2026-03-22",
    body: "[corpo completo do mapa linhas 346-406]",
    thumbnail: null,
    status: "publicado",
    seoTitle: "10 perguntas antes de planejar uma viagem | Spinhardi",
    seoDescription:
      "As 10 perguntas que fazemos antes de qualquer planejamento de roteiro. Saber as respostas certas é o que separa uma boa viagem de uma viagem comum.",
  },
  {
    slug: "europa-primeira-vez",
    title:
      "O que ninguém te conta antes de viajar para a Europa pela primeira vez",
    excerpt:
      "Você pesquisou destinos, salvou fotos no Instagram, comparou passagens em três abas diferentes. E ainda assim, quando a viagem acontece, algo escapa.",
    category: "Dicas de Viagem",
    author: "Spinhardi Turismo",
    date: "2026-04-05",
    body: "[corpo completo do mapa linhas 407-473]",
    thumbnail: null,
    status: "publicado",
    seoTitle:
      "O que ninguém te conta sobre a primeira viagem à Europa | Spinhardi",
    seoDescription:
      "Depois de quase quarenta anos construindo roteiros para a Europa, as percepções que nenhum guia cobre. Para quem vai pela primeira vez.",
  },
  {
    slug: "florenca-fora-do-circuito",
    title: "5 lugares em Florença que os turistas normais não conhecem",
    excerpt:
      "Florença vai muito além da Galleria Uffizi e do Duomo. Os lugares que os florentinos amam estão nas ruas que os guias não cobrem.",
    category: "Destinos",
    author: "Spinhardi Turismo",
    date: "2026-04-10",
    body: "Este post será publicado em breve. Estamos finalizando os detalhes.",
    thumbnail: null,
    status: "publicado",
  },
  {
    slug: "selecao-parceiros-locais",
    title: "Como escolhemos os parceiros locais que entram nos nossos roteiros",
    excerpt:
      "Cada roteiro Spinhardi tem nomes próprios por trás. Não é o guia genérico que aparece no booking. É alguém que a gente conhece pelo nome.",
    category: "Bastidores",
    author: "Spinhardi Turismo",
    date: "2026-04-12",
    body: "Este post será publicado em breve. Estamos finalizando os detalhes.",
    thumbnail: null,
    status: "publicado",
  },
];
```

**Observação:** corpos completos dos 3 posts da Amanda precisam ser colados na
íntegra (linhas 290-344, 346-406, 407-473 do mapa). Codinho fará a transcrição
literal.

### `src/lib/blog/index.ts` — abstração

```ts
import { Post, PostCategory } from "./types";
import { MOCK_POSTS } from "./mock-posts";

/**
 * Acesso a posts do blog.
 *
 * MOCK na Fase 1: dados estáticos em `mock-posts.ts`.
 * Vira integração com Sanity na Fase 3 — apenas a implementação destas
 * funções muda. As páginas que consomem continuam idênticas.
 */

export async function getPosts(opts?: {
  category?: PostCategory | "Todos";
  status?: "rascunho" | "publicado";
}): Promise<Post[]> {
  let posts = MOCK_POSTS;

  if (opts?.status) {
    posts = posts.filter((p) => p.status === opts.status);
  }
  if (opts?.category && opts.category !== "Todos") {
    posts = posts.filter((p) => p.category === opts.category);
  }

  // Ordenar por data desc (mais recente primeiro)
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return MOCK_POSTS.find((p) => p.slug === slug) ?? null;
}

// Stubs pra CRUD (admin) — não funcionais na Fase 1
export async function createPost(_post: Omit<Post, "slug">): Promise<Post> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}

export async function updatePost(
  _slug: string,
  _post: Partial<Post>,
): Promise<Post> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}

export async function deletePost(_slug: string): Promise<void> {
  throw new Error("Implementação completa virá com Sanity (Fase 3)");
}
```

---

## TELA 1 — `/blog` (listagem pública)

### Estrutura geral

```
┌────────────────────────────────────────────────────┐
│ HEADER (sólido — /blog em LIGHT_ROUTES)            │
├────────────────────────────────────────────────────┤
│ Bloco 1 · CABEÇALHO                         branco │
├────────────────────────────────────────────────────┤
│ Bloco 2 · FILTROS DE CATEGORIA              branco │ pills clicáveis
├────────────────────────────────────────────────────┤
│ Bloco 3 · GRID DE POSTS                     branco │ BlogCards 3 colunas
├────────────────────────────────────────────────────┤
│ FOOTER                                      navy   │
└────────────────────────────────────────────────────┘
```

### Bloco 1 · CABEÇALHO

**Wrapper:**
`<Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">`

```tsx
<Breadcrumb
  levels={[
    { label: "Home", href: "/" },
    { label: "Blog" },
  ]}
  className="mb-6"
/>
<p className="text-gold uppercase tracking-widest text-sm font-body mb-4">
  Blog
</p>
<h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-navy leading-tight mb-6 max-w-4xl">
  Histórias, destinos e bastidores
  <br className="hidden md:block" />
  de quem viaja.
</h1>
<p className="font-body text-lg lg:text-xl text-dark/80 max-w-2xl leading-relaxed">
  Dicas reais, experiências de clientes e bastidores do nosso trabalho. Conteúdo escrito por quem vive isso todo dia.
</p>
```

### Bloco 2 · FILTROS DE CATEGORIA

**Wrapper:** `<Section spacing="md" className="bg-white">`

Filtros como pills horizontais (não-rolagem no desktop, rolagem horizontal
opcional no mobile).

**Componente:** Client Component (`CategoryFilter.tsx`) gerencia estado da
categoria ativa.

```
[ Todos ] [ Destinos ] [ Bastidores ] [ Dicas de Viagem ] [ História da Agência ]
```

- **Default:** "Todos" ativo (gold uppercase, com border gold)
- **Inativo:** Montserrat dark/60, border-dark/20
- **Hover:** border vira gold
- **Ativo:** fundo gold, texto white
- **Transição:** `duration-short`

Layout:

```tsx
<div className="flex flex-wrap gap-3 lg:gap-4">
  {["Todos", ...CATEGORIES].map((cat) => (
    <button
      key={cat}
      onClick={() => setActive(cat)}
      className={`
        px-5 py-2.5 rounded-full
        font-body text-sm uppercase tracking-widest
        border transition-all duration-short
        ${
        active === cat
          ? "bg-gold text-white border-gold"
          : "border-dark/20 text-dark/60 hover:border-gold"
      }
      `}
    >
      {cat}
    </button>
  ))}
</div>;
```

### Bloco 3 · GRID DE POSTS

**Wrapper:** `<Section spacing="lg" className="bg-white">`

Grid de `BlogCard` (componente já existe no Design System) — 3 colunas desktop,
2 tablet, 1 mobile.

Quando filtro está em "Todos": mostra todos os 5 posts. Quando filtro está numa
categoria: mostra só posts daquela categoria. Quando nenhum post: mostra "Nenhum
post nesta categoria ainda." discreto.

```tsx
{
  filteredPosts.length === 0
    ? (
      <p className="font-body text-dark/60 text-center py-12">
        Nenhum post nesta categoria ainda.
      </p>
    )
    : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
        {filteredPosts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <BlogCard
              title={post.title}
              excerpt={post.excerpt}
              category={post.category}
              date={post.date}
              thumbnail={post.thumbnail}
            />
          </Link>
        ))}
      </div>
    );
}
```

**Atenção:** `BlogCard` atual provavelmente já recebe esses props (já vimos no
Design System). Se a assinatura precisar de ajuste pra aceitar `thumbnail: null`
(renderizar placeholder cinza), Codinho ajusta.

### Decisão sobre filtros e Server vs Client Component

A página `/blog` em si é Server Component. O filtro é Client Component aninhado
(`CategoryFilter.tsx`) que receba a lista completa de posts e gerencia estado de
qual categoria está ativa + renderiza o grid filtrado.

```tsx
// src/app/blog/page.tsx (Server)
import { getPosts } from "@/lib/blog";
import BlogClient from "./BlogClient"; // Client Component

export default async function Blog() {
  const posts = await getPosts({ status: "publicado" });
  return (
    <>
      {/* Bloco 1 - Cabeçalho (server) */}
      <BlogClient posts={posts} /> {/* Filtros + Grid (client) */}
    </>
  );
}
```

---

## TELA 2 — `/blog/[slug]` (post individual)

### Estrutura

```
┌────────────────────────────────────────────────────┐
│ HEADER (sólido — /blog em LIGHT_ROUTES)            │
├────────────────────────────────────────────────────┤
│ Bloco 1 · CABEÇALHO DO POST                 branco │
├────────────────────────────────────────────────────┤
│ Bloco 2 · CONTEÚDO DO POST                  branco │
├────────────────────────────────────────────────────┤
│ Bloco 3 · CTA FINAL                         branco │
├────────────────────────────────────────────────────┤
│ FOOTER                                      navy   │
└────────────────────────────────────────────────────┘
```

### Bloco 1 · CABEÇALHO DO POST

**Wrapper:**
`<Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">`

Container com max-width menor (`max-w-3xl mx-auto`) — tipografia editorial pede
coluna estreita pra leitura.

```
Breadcrumb: Home / Blog / [Título do post]

DESTINOS    ·    Spinhardi Turismo    ·    15 mar 2026
                ↑ categoria pill          ↑ autor                  ↑ data

Como escolher o destino certo para a 
sua próxima viagem internacional
                ↑ H1 Fraunces grande, navy

A pergunta que mais ouvimos antes de qualquer 
conversa sobre roteiro não é "quanto custa" nem 
"quando ir". É: "para onde eu vou?"
                ↑ lead em Montserrat italic dark/80
```

**Estrutura:**

```tsx
<Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
  <Container>
    <div className="max-w-3xl mx-auto">
      <Breadcrumb levels={[...]} className="mb-6" />
      
      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 font-body text-sm">
        <span className="px-3 py-1 bg-gold/10 text-gold uppercase tracking-widest rounded-full text-xs">
          {post.category}
        </span>
        <span className="text-dark/60">{post.author}</span>
        <span className="text-dark/30">·</span>
        <time className="text-dark/60" dateTime={post.date}>
          {formatDate(post.date)}
        </time>
      </div>
      
      <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-navy leading-tight mb-8">
        {post.title}
      </h1>
      
      <p className="font-body text-lg lg:text-xl text-dark/80 italic leading-relaxed">
        {post.excerpt}
      </p>
    </div>
  </Container>
</Section>
```

### Bloco 2 · CONTEÚDO DO POST

**Wrapper:** `<Section spacing="md" className="bg-white text-dark">`

**Tipografia editorial:** `prose` do Tailwind seria perfeito mas não temos
`@tailwindcss/typography` instalado. **Decisão:** estilizar manualmente
headings, parágrafos, listas dentro do container. Não vamos instalar plugin
extra.

```tsx
<Section spacing="md" className="bg-white text-dark">
  <Container>
    <article className="max-w-3xl mx-auto font-body text-base lg:text-lg text-dark/80 leading-relaxed space-y-6">
      {/* body renderizado */}
    </article>
  </Container>
</Section>;
```

**Sobre renderização do body:** posts da Amanda são texto plano com quebras de
parágrafo e headings (seções como "Comece por você, não pelo destino"). Markdown
ou HTML?

**Decisão:** texto plano dividido em parágrafos por `\n\n`, com convenção:
linhas que começam com `#` viram h2, linhas começando com `##` viram h3.
Renderização simples sem dependência de biblioteca markdown.

```ts
// Helper inline pra renderizar body
function renderBody(body: string) {
  return body.split("\n\n").map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h3 key={i} className="font-display text-2xl text-navy mt-12 mb-4">
          {block.replace("## ", "")}
        </h3>
      );
    }
    if (block.startsWith("# ")) {
      return (
        <h2 key={i} className="font-display text-3xl text-navy mt-12 mb-4">
          {block.replace("# ", "")}
        </h2>
      );
    }
    return <p key={i}>{block}</p>;
  });
}
```

**Importante na transcrição dos 3 posts da Amanda:**

Os posts da Amanda têm seções claras (ex: "Comece por você, não pelo destino",
"Considere o momento, não só o lugar", etc). Essas viram `##` (h2). O texto
entre seções fica como parágrafos normais. Listas numeradas ("1.", "2.") podem
virar `###` (h3) ou parágrafos com número em destaque — decisão de Codinho
conforme ler o conteúdo. Recomendo h3 pra clareza visual.

### Bloco 3 · CTA FINAL DO POST

Cada post da Amanda termina com `[Entre em contato com a Spinhardi Turismo]` —
vira CTA visual no fim.

```tsx
<Section spacing="lg" className="bg-white text-dark">
  <Container>
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="font-display text-3xl md:text-4xl text-navy mb-6 leading-tight">
        Quer planejar uma viagem que faça sentido pra você?
      </h2>
      <p className="font-body text-lg text-dark/80 mb-12 leading-relaxed">
        Sem pressa, sem lista pronta, sem destino empurrado. Só uma boa
        conversa.
      </p>
      <CTAWhatsApp variant="primary" size="lg" label="Falar com a Spinhardi" />
    </div>
  </Container>
</Section>;
```

### Sem navegação prev/next

**Decisão:** não implementar navegação "post anterior / próximo post" agora.
Pode ser melhoria futura, mas adiciona complexidade pro mock. Quem chega ao fim
do post tem 2 caminhos claros: voltar via breadcrumb ou clicar no CTA.

### Sobre slug inválido (404)

Se a rota `/blog/[slug]` for chamada com slug que não existe, retornar
`notFound()` do Next 16 — que dispara `not-found.tsx` global.

```tsx
import { notFound } from "next/navigation";

export default async function Post(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  // ...
}
```

---

## TELA 3 — `/admin/blog` (lista admin)

**Importante:** Esta tela não tem proteção de auth ainda (middleware vem na
1.7). Em dev, rota fica acessível pra qualquer um. Documenta isso explicitamente
no commit pra não virar dívida invisível.

### Layout do admin (preview do que vem na 1.7)

Para ter referência visual já agora, **vamos criar um layout admin mínimo** em
`src/app/admin/layout.tsx` que apenas envolve o conteúdo com um título de seção.
Sem sidebar funcional ainda — isso vem na 1.7 com `AdminSidebar` completo.

```tsx
// src/app/admin/layout.tsx
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";

export default function AdminLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <Section
      spacing="md"
      className="bg-dark/5 text-dark min-h-screen pt-32 lg:pt-40"
    >
      <Container>
        <div className="mb-8">
          <p className="text-gold uppercase tracking-widest text-sm font-body mb-2">
            Painel administrativo
          </p>
          <p className="font-body text-sm text-dark/60">
            Sessão sem autenticação por enquanto. Login virá na Fase 1.7.
          </p>
        </div>
        {children}
      </Container>
    </Section>
  );
}
```

**Decisão crítica:** `/admin/*` **NÃO** entra em `LIGHT_ROUTES`. Razão: o admin
tem fundo cinza claro (`bg-dark/5`) e o Header vai ser substituído na 1.7 por um
header específico do admin. Por enquanto, Header dinâmico do site público
aparece sobre o admin (fica esquisito visualmente mas é temporário). **Aceitar
isso como dívida temporária explícita** — vai ser resolvido na 1.7.

### Conteúdo da lista admin

```
┌─────────────────────────────────────────────────────────────┐
│ Posts                                       [+ Novo post]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Tabela ──────────────────────────────────────────────┐   │
│ │ Título                       │ Categoria  │ Data │ ... │   │
│ ├──────────────────────────────┼────────────┼──────┼─────┤   │
│ │ Como escolher o destino...   │ Destinos   │ 15/3 │ ⋯   │   │
│ │ 10 coisas que você precisa.. │ Dicas      │ 22/3 │ ⋯   │   │
│ │ O que ninguém te conta...    │ Dicas      │ 5/4  │ ⋯   │   │
│ │ 5 lugares em Florença...     │ Destinos   │ 10/4 │ ⋯   │   │
│ │ Como escolhemos parceiros... │ Bastidores │ 12/4 │ ⋯   │   │
│ └──────────────────────────────┴────────────┴──────┴─────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```tsx
// src/app/admin/blog/page.tsx
import Link from "next/link";
import { getPosts } from "@/lib/blog";
import Button from "@/components/ui/Button";

export default async function AdminBlogList() {
  const posts = await getPosts(); // todos, inclusive rascunhos

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-navy">Posts</h1>
        <Link href="/admin/blog/novo">
          <Button variant="primary" size="md">+ Novo post</Button>
        </Link>
      </div>

      <div className="bg-white rounded-md border border-dark/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark/10 bg-dark/5">
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Título
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Categoria
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Data
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Status
              </th>
              <th className="text-right px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.slug}
                className="border-b border-dark/5 last:border-0 hover:bg-dark/5 transition-colors duration-short"
              >
                <td className="px-6 py-4 font-body text-dark">
                  <Link
                    href={`/admin/blog/${post.slug}`}
                    className="hover:text-gold transition-colors duration-short"
                  >
                    {post.title}
                  </Link>
                </td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">
                  {post.category}
                </td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">
                  {formatDate(post.date)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs uppercase tracking-widest ${
                      post.status === "publicado"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/blog/${post.slug}`}
                    className="text-gold hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## TELAS 4 e 5 — `/admin/blog/novo` e `/admin/blog/[id]` (formulários)

Estrutura idêntica entre as duas. Diferença é que `[id]` recebe slug e
pré-popula campos.

```
┌─────────────────────────────────────────────────────────────┐
│ Novo post                                                   │  (ou "Editar post")
│ Voltar pra lista                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Título *                                                    │
│ [________________________________________________________]  │
│                                                             │
│ Slug *                                                      │
│ [________________________________________________________]  │
│                                                             │
│ Categoria *                                                 │
│ [Select ▾]                                                  │
│                                                             │
│ Excerpt *                                                   │
│ [________________________________________________________]  │
│ [________________________________________________________]  │
│                                                             │
│ Body (Markdown) *                                           │
│ [________________________________________________________]  │
│ [________________________________________________________]  │
│ [________________________________________________________]  │
│ [________________________________________________________]  │
│ [________________________________________________________]  │
│                                                             │
│ Thumbnail (URL ou upload)                                   │
│ [________________________________________________________]  │
│                                                             │
│ SEO Title                                                   │
│ [________________________________________________________]  │
│                                                             │
│ SEO Description                                             │
│ [________________________________________________________]  │
│                                                             │
│ Status                                                      │
│ [Select ▾]                                                  │
│                                                             │
│              [Cancelar]   [Salvar como rascunho]   [Publicar]│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Comportamento dos botões na Fase 1:**

- "Cancelar" → volta pra `/admin/blog`
- "Salvar como rascunho" → mostra alerta: "Implementação completa virá com
  Sanity (Fase 3). Por enquanto, posts são gerenciados via mock."
- "Publicar" → mesmo alerta

```tsx
// src/components/admin/PostForm.tsx (Client Component)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, Post } from "@/lib/blog/types";
import Button from "@/components/ui/Button";

type PostFormProps = {
  initialPost?: Post; // se fornecido, é edição; se ausente, é criação
};

export default function PostForm({ initialPost }: PostFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: initialPost?.title ?? "",
    slug: initialPost?.slug ?? "",
    category: initialPost?.category ?? "Destinos",
    excerpt: initialPost?.excerpt ?? "",
    body: initialPost?.body ?? "",
    thumbnail: initialPost?.thumbnail ?? "",
    seoTitle: initialPost?.seoTitle ?? "",
    seoDescription: initialPost?.seoDescription ?? "",
    status: initialPost?.status ?? "rascunho",
  });

  const handleSave = (asStatus: "rascunho" | "publicado") => {
    alert(
      "Implementação completa virá com Sanity (Fase 3). Por enquanto, posts são gerenciados via mock.",
    );
  };

  return (
    <div>
      {/* todos os campos */}
      <div className="flex justify-end gap-3 mt-8">
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.push("/admin/blog")}
        >
          Cancelar
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => handleSave("rascunho")}
        >
          Salvar como rascunho
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => handleSave("publicado")}
        >
          Publicar
        </Button>
      </div>
    </div>
  );
}
```

### `/admin/blog/novo`

```tsx
import PostForm from "@/components/admin/PostForm";

export default function NovoPost() {
  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Novo post</h1>
      <PostForm />
    </div>
  );
}
```

### `/admin/blog/[id]`

```tsx
import { getPostBySlug } from "@/lib/blog";
import { notFound } from "next/navigation";
import PostForm from "@/components/admin/PostForm";

export default async function EditarPost(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const post = await getPostBySlug(id);
  if (!post) notFound();

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Editar post</h1>
      <PostForm initialPost={post} />
    </div>
  );
}
```

---

## Mudanças no Header

Adicionar `/blog` ao `LIGHT_ROUTES` (cobre `/blog` e `/blog/[slug]` via
`startsWith`).

**`/admin/*` NÃO entra em LIGHT_ROUTES** — comportamento dinâmico do Header com
fundo navy do admin é dívida temporária aceita até Fase 1.7.

```ts
const LIGHT_ROUTES = [
  "/dev/components",
  "/sobre",
  "/viagens",
  "/contato",
  "/blog",
];
```

---

## Estrutura de arquivos novos

```
src/lib/blog/
  types.ts                          ← interface Post + categorias
  mock-posts.ts                     ← 5 posts (3 completos + 2 esqueletos)
  index.ts                          ← getPosts, getPostBySlug, createPost, etc

src/app/blog/
  page.tsx                          ← listagem (Server)
  BlogClient.tsx                    ← filtros + grid (Client)
  [slug]/
    page.tsx                        ← post individual

src/app/admin/
  layout.tsx                        ← layout admin temporário (Fase 1.4)
  blog/
    page.tsx                        ← lista admin
    novo/
      page.tsx                      ← form criar
    [id]/
      page.tsx                      ← form editar

src/components/admin/
  PostForm.tsx                      ← form reutilizável (criar/editar)
```

---

## Componentes utilizados

**Reuso direto:**

- `Section`, `Container`, `Button`, `BlogCard`, `Breadcrumb`, `CTAWhatsApp`

**Novos:**

- `BlogClient` (filtros + grid client-side)
- `PostForm` (admin)

**Helper:**

- `formatDate(iso: string): string` — inline em cada página ou em
  `lib/utils/date.ts`. Decisão: criar `lib/utils/date.ts` para reutilizar entre
  páginas públicas e admin.

```ts
// src/lib/utils/date.ts
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(".", "");
}
```

---

## Decisões importantes registradas

1. **3 posts completos da Amanda entram desde o dia 1**, mais 2 esqueletos = 5
   cards no blog inicial.
2. **Sem `@tailwindcss/typography`** — estilos editoriais aplicados manualmente,
   sem dependência extra.
3. **Renderização de body markdown-leve** (h2/h3 via prefixo, parágrafos por
   `\n\n`) — sem biblioteca de markdown.
4. **Filtro de categoria frontend-only** (sem query params na URL) —
   simplicidade vence overengineering.
5. **Sem navegação prev/next** entre posts — pode ser melhoria futura.
6. **`/admin/*` sem auth ainda** — middleware vem na Fase 1.7. Dívida temporária
   explícita.
7. **Layout admin mínimo** criado nesta fase — vai ser substituído por layout
   completo (com sidebar) na 1.7.
8. **`/admin/*` não entra em LIGHT_ROUTES** — Header dinâmico fica esquisito
   sobre admin temporariamente. Aceito até 1.7.
9. **CRUD desativado no admin** — botões mostram alert "vem na Fase 3 com
   Sanity".
10. **Slugs cravados no mock**. Quando Sanity entrar, geração automática a
    partir do título.

---

_Wireframe Blog · Spinhardi Turismo · Fase 1.4 · Abril 2026_
