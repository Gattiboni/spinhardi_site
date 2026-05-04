# Referências de Design — Spinhardi Turismo
**Status:** definido para uso no wireframe e no desenvolvimento  
**Gerado a partir de:** capturas reais dos 4 sites de referência  
**Última atualização:** Abril 2026

---

## Como ler este documento

Cada seção mapeia um padrão de design a ser replicado, com a fonte da referência, o que extrair e como adaptar para a Spinhardi. "Copiar" significa replicar estrutura e proporções — não estilos visuais literais (cores, fontes e conteúdo são sempre os da Spinhardi).

---

## 1. Header e Navegação
**Fonte:** `produtos_header.json` → buchwalder-linder.ch/produktkategorien

### O que replicar
Nav fixa no topo, fundo transparente, itens all-caps em letra pequena com espaçamento generoso entre eles. Logo à esquerda, links à direita. Sem fundo visível — flutua sobre o conteúdo. Altura compacta (~51px).

### Medidas extraídas
| Propriedade | Valor |
|---|---|
| Altura | 51px |
| Padding horizontal | 53px de cada lado |
| Gap entre links | 25px |
| Font-size dos links | 9.5px (escala pra ~11px em Montserrat) |
| Font-weight dos links | regular |
| Caso tipográfico | UPPERCASE |
| Background | transparente |
| Display | flex |

### Adaptação Spinhardi
```
Logo (esquerda): variação clara da logo sobre fundo navy, ou versão ouro sobre fundo transparente
Links (direita): SOBRE · VIAGENS · BLOG · CONTATO
CTA: botão ghost "Fale com a gente" → WhatsApp
```

### CSS de referência
```css
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 53px;
  gap: 25px;
  height: 51px;
  position: sticky;
  top: 0;
  background: transparent;
  z-index: 50;
}

nav a {
  font-size: 9.5px; /* usar ~11px com Montserrat */
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  gap: 6px;
  padding-bottom: 3px;
}
```

---

## 2. Hero e Cabeçalho de Página
**Fonte:** `produtos_header.json` → seção `.section_header_center`

### O que replicar
Estrutura em dois níveis: rótulo pequeno all-caps acima, título enorme abaixo. Cria hierarquia editorial forte sem precisar de imagem. Funciona tanto como hero da Home quanto como cabeçalho de páginas internas (Viagens, Blog, Sobre).

### Medidas extraídas
| Elemento | Font-size | Fonte | Caso |
|---|---|---|---|
| Rótulo (label) | 15px | Satoshi/Montserrat | UPPERCASE |
| Título principal | 68px | "Beaumed Webfont" → TT Fors Display | Sentença |

### Adaptação Spinhardi
```
Rótulo: VIAGENS / SOBRE / BLOG / etc.
Título: frase curta e direta (ex: "Cada viagem, uma vez. Feita para você.")
Subtítulo opcional: Montserrat Regular, ~16px, max-width 600px
```

### CSS de referência
```css
.page-header {
  padding: 80px 53px 60px;
}

.page-header__label {
  font-family: 'Montserrat', sans-serif;
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-gold); /* #AD8330 */
  margin-bottom: 16px;
}

.page-header__title {
  font-family: 'TT Fors Display', serif;
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 400;
  line-height: 1.05;
  color: var(--color-white);
  max-width: 16ch;
}
```

---

## 3. Layout de Rolagem da Home
**Fonte:** `landing_rolagem_layout.json` → pedroluzelobos.com/pt

### O que replicar
Home construída em seções empilhadas verticalmente, cada uma com gap generoso. Sem carrossel, sem slider. O usuário rola e cada bloco respira. Nav sticky transparente que some no fundo conforme rola. Hero com título gigante e subtítulo em peso leve.

### Medidas extraídas
| Elemento | Valor |
|---|---|
| Padding horizontal | px-4 mobile / px-12 desktop (≈ 48px) |
| Gap entre seções | 64px desktop / 40px mobile |
| H1 hero | 72px, font-weight 400, tracking-tight |
| H1 subtítulo | 30px, font-weight 500 |
| Nav height | 96px |
| Nav layout | grid (logo + links + CTA) |

### Estrutura de seções da Home
```
┌─────────────────────────────────┐
│ NAV sticky transparente         │ 96px
├─────────────────────────────────┤
│ HERO                            │ min-height: 80vh
│   Título 72px                   │
│   Subtítulo 30px                │
│   CTA WhatsApp                  │
├─────────────────────────────────┤  gap: 64px
│ POSICIONAMENTO                  │
│   Texto + valores               │
├─────────────────────────────────┤  gap: 64px
│ SERVIÇOS (→ /viagens)           │
│   Cards numerados               │
├─────────────────────────────────┤  gap: 64px
│ HISTÓRIA / LEGADO               │
│   Foto + narrativa              │
├─────────────────────────────────┤  gap: 64px
│ DEPOIMENTOS                     │
├─────────────────────────────────┤  gap: 64px
│ CTA FINAL                       │
├─────────────────────────────────┤
│ FOOTER                          │
└─────────────────────────────────┘
```

### CSS de referência
```css
main {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
  gap: 40px;
}

@media (min-width: 1024px) {
  main {
    padding: 0 48px;
    gap: 64px;
  }
}

.hero-title {
  font-family: 'TT Fors Display', serif;
  font-size: clamp(36px, 6vw, 72px);
  font-weight: 400;
  tracking: -0.02em;
  line-height: 1.0;
}
```

---

## 4. Grade de Serviços / Viagens (Numerada)
**Fonte:** `produtos_header.json` → seção `.section_portfolio20`

### O que replicar
Lista de categorias com numeração (01, 02, 03...) + nome grande + linha divisória + hover com imagem flutuante. O efeito de hover mostra uma imagem do destino ao lado do item sem mudar o layout. Minimalista, elegante, funcional.

### Estrutura extraída
```
01  ─────────────────────────────── imagem aparece no hover
    ITÁLIA SOB MEDIDA

02  ───────────────────────────────
    PACOTES E ROTEIROS

03  ───────────────────────────────
    VIAGEM SOB MEDIDA
```

### CSS de referência
```css
/* Lista */
.services-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgb(255, 248, 240); /* adaptar para navy ou branco */
}

/* Item */
.services-item {
  display: flex;
  align-items: center;
  gap: 6rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--color-divider);
  text-decoration: none;
  transition: all 0.3s ease;
}

/* Número */
.services-item__number {
  font-family: 'Montserrat', sans-serif;
  font-size: 14px;
  color: var(--color-gold);
  min-width: 2rem;
}

/* Nome */
.services-item__name {
  font-family: 'TT Fors Display', serif;
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 400;
}

/* Hover: imagem flutuante (fixed, pointer-events: none) */
.services-hover-image {
  position: fixed;
  top: 0; left: 50%;
  width: 50%; height: 100vh;
  display: none;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
  border-radius: var(--radius-large);
}

@media (min-width: 992px) {
  .services-list:hover .services-item { color: rgb(196, 196, 196); }
  .services-list:hover .services-item:hover { color: rgb(0, 0, 0); }
}
```

---

## 5. Efeitos de Imagem
**Fonte:** `landing_efeitos_das_imagens.json` → franshalsmuseum.nl

### O que replicar
Todas as imagens do site usam o mesmo sistema de efeito no hover: combinação de `transform: scale()` + `transition` suave. Overflow hidden no container cria o efeito de zoom contained. Em algumas imagens, há uma sobreposição sutil escura que some no hover.

### Efeito padrão — aplicar em TODO lugar que tiver imagem
```css
/* Container da imagem — sempre com overflow hidden */
.img-wrapper {
  overflow: hidden;
  border-radius: var(--radius, 0px);
  position: relative;
}

/* Imagem em si */
.img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  
  /* O efeito */
  transition: transform 0.75s cubic-bezier(0.42, 0, 0, 1),
              filter 0.4s cubic-bezier(0.42, 0, 0, 1);
  transform: scale(1.0);
  filter: brightness(0.95);
  will-change: transform;
}

.img-wrapper:hover img {
  transform: scale(1.04);
  filter: brightness(1.0);
}
```

### Variante com overlay (cards de serviço, hero)
```css
.img-wrapper--overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(26, 43, 74, 0.6));
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.img-wrapper--overlay:hover::after {
  opacity: 0.6;
}
```

### Durações do sistema de transição (extraídas do CSS)
| Token | Valor |
|---|---|
| `duration-very-short` | 50ms |
| `duration-short` | 200ms |
| `duration-medium` | 400ms |
| `duration-long` | 750ms |
| `duration-1000ms` | 1000ms |
| `ease-smooth` | cubic-bezier(0.42, 0, 0, 1) |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) |

---

## 6. Blog — Listagem e Leitura
**Fonte:** `blog_leitura_organizacao.json` → buchwalder-linder.ch/news

### O que replicar
Grid de 3 colunas com cards limpos: imagem + tag de categoria + título grande + data/excerpt. Sem borda, sem sombra — só espaçamento e tipografia fazem o trabalho. Página de post: largura controlada (~65ch), tipografia confortável, sem sidebar.

### Grade de listagem extraída
| Grid | Valor |
|---|---|
| Desktop | 3 colunas (`1fr 1fr 1fr`) |
| Gap entre cards | `6rem 2rem` (96px vertical, 32px horizontal) |
| Variante 2 colunas | `1fr 1fr`, gap `2rem` |

### Anatomia do card
```
┌──────────────────────┐
│                      │
│   IMAGEM (16:9)      │  overflow hidden, efeito de hover
│   com hover scale    │
│                      │
├──────────────────────┤
│ TAG CATEGORIA        │  Montserrat, 11px, uppercase, gold
│                      │
│ Título do post       │  TT Fors Display, 25px
│ em duas linhas       │
│                      │
│ 12 Jan 2026          │  Montserrat, 12px, muted
│ Excerpt curto...     │  Montserrat, 14px, 2 linhas max
└──────────────────────┘
```

### CSS de referência
```css
/* Grid */
.blog-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6rem 2rem;
}

@media (max-width: 768px) {
  .blog-grid {
    grid-template-columns: 1fr;
    gap: 3rem 0;
  }
}

/* Card */
.blog-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-decoration: none;
  color: inherit;
}

/* Imagem do card */
.blog-card__image {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 4px;
}

/* Tag */
.blog-card__tag {
  font-family: 'Montserrat', sans-serif;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-gold);
}

/* Título */
.blog-card__title {
  font-family: 'TT Fors Display', serif;
  font-size: 25px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--color-text);
}

/* Página de post — largura controlada */
.blog-post__content {
  max-width: 65ch;
  margin: 0 auto;
  font-family: 'Montserrat', sans-serif;
  font-size: 17px;
  line-height: 1.7;
  color: var(--color-text);
}
```

---

## 7. Footer
**Fonte:** `produtos_header.json` + `blog_leitura_organizacao.json`

### O que replicar
Footer escuro (quase preto, rgb(45,40,40)) com texto branco. Estrutura em colunas: endereço/contato + links + redes sociais. Limpo, sem ornamento.

### Adaptação Spinhardi
```
Coluna 1: Logo + tagline curta
Coluna 2: Links (Sobre · Viagens · Blog · Contato)
Coluna 3: Contato (WhatsApp · Instagram)
Coluna 4: Localização (Serra Negra, SP)

Rodapé: © 2026 Spinhardi Turismo · Política de privacidade
```

### CSS de referência
```css
footer {
  background: #2D2828; /* rgb(45,40,40) da referência */
  color: #ffffff;
  padding: 3rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 4vw;
  align-items: start;
}

footer a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s ease;
}

footer a:hover {
  color: #ffffff;
}
```

---

## Resumo — Mapeamento por Componente

| Componente | Fonte principal | Prioridade |
|---|---|---|
| Navbar | `produtos_header` | Alta |
| Hero / Page header | `produtos_header` | Alta |
| Home scroll layout | `landing_rolagem_layout` | Alta |
| Grade de serviços (numerada) | `produtos_header` | Alta |
| Efeito de imagem (hover scale) | `landing_efeitos_das_imagens` | Alta — aplicar em TUDO |
| Blog grid | `blog_leitura_organizacao` | Alta |
| Blog post individual | `blog_leitura_organizacao` | Média |
| Footer | `produtos_header` | Média |

---

*Este documento alimenta o wireframe navegável em HTML e serve de contrato de design para o desenvolvimento.*  
*Qualquer decisão de desvio deve ser documentada aqui antes de ser implementada.*
