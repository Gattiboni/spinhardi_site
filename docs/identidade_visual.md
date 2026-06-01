# Guia de Identidade Visual — Spinhardi Turismo

**Versão:** 1.0 (em aprovação pelas sócias)\
**Fonte de verdade:** `bb_lite_v2_spinhardi.docx`\
**Última atualização:** Abril 2026

> ⚠️ O verde (`#4DBF72`) está definido provisoriamente para desenvolvimento do
> site. A paleta do Branding Book usa `#8CB89F` (sage). A substituição será
> validada pelas sócias ao ver aplicado, e aí atualizamos o Canva e o manual.
> Não alterar o docx até aprovação.

---

## Paleta de Cores

| Token         | Nome         | Hex       | Uso                                                      |
| ------------- | ------------ | --------- | -------------------------------------------------------- |
| `color-navy`  | Navy         | `#1A2B4A` | Cor principal. Fundo dominante, ancora tudo.             |
| `color-gold`  | Ouro         | `#AD8330` | Destaque. Ícone, CTAs, elementos que pedem atenção.      |
| `color-green` | Verde        | `#4DBF72` | Apoio vibrante. **Provisório — em aprovação.**           |
| `color-text`  | Texto escuro | `#1E1E2E` | Todo texto corrido. Nunca substituir por cinza neutro.   |
| `color-white` | Branco       | `#FFFFFF` | Contraste e respiro. Sempre funcional, nunca decorativo. |

### Hierarquia obrigatória

- **Protagonistas:** Navy + Ouro
- **Coadjuvante:** Verde
- **Funcionais:** Texto escuro + Branco
- Qualquer composição que inverta essa hierarquia vai parecer fora de lugar.

### Restrição crítica

> Verde **nunca** aparece como texto ou elemento sobre fundo navy. Baixa
> legibilidade — inclusive para pessoas com dificuldade visual. Verde só sobre
> fundo branco ou claro neutro.

---

## Tipografia

| Fonte               | Uso                                                                | Peso                        | Notas                                                                                                 |
| ------------------- | ------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **TT Fors Display** | Nome da marca, H1, H2, destaques editoriais                        | Regular e variações nativas | Personalidade própria. Funciona bem em tamanho grande. Espessuras diferentes sem precisar customizar. |
| **Montserrat**      | Taglines, subtítulos, "Turismo" na logo, corpo de texto em títulos | Light e Regular             | Sans neutra. Cria contraste com TT Fors Display. Nunca usar como destaque principal.                  |

### Regras de combinação

- TT Fors Display em tamanho **grande**, Montserrat em tamanho **menor**. Essa
  hierarquia não se inverte.
- TT Fors Display se beneficia de tracking levemente ampliado em títulos curtos.
- **Nunca condensar nenhuma das duas.**

---

## Logo

### Variações e quando usar

A nomenclatura dos arquivos segue a **cor dominante do texto da logo** (não do
fundo onde ela é aplicada). Isso facilita reconhecimento visual ao bater olho no
nome do arquivo.

| Variação (arquivo) | Composição                                          | Fundo ideal de aplicação                          | Onde NÃO usar                                   |
| ------------------ | --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `logo-clara`       | Pássaro gold + "SPINHARDI" gold + "Turismo" branco  | Fundo navy (Header, Footer, hero)                 | Fundos brancos ou claros — a logo desaparece    |
| `logo-escura`      | Pássaro gold + "SPINHARDI" navy + "Turismo" gold    | Fundo branco ou tons claros (papelaria, conteúdo) | Fundos escuros — perde contraste                |
| `logo-icone`       | Apenas o pássaro gold isolado                       | Qualquer fundo (com contraste suficiente)         | Quando há espaço para a logo completa com texto |
| Verde (pendente)   | A definir após aprovação do verde definitivo (D006) | Variação editorial em peças específicas           | Uso principal de marca                          |

**Convenção de nomes:** o nome do arquivo descreve o **conteúdo visual da logo**
(cor do texto), não o fundo onde ela vai. Exemplo: `logo-clara.svg` tem texto
claro (branco no "Turismo") porque foi pensada pra fundo escuro. Essa convenção
é o oposto da intuição inicial — vale conferir os nomes ao usar.

### Regras de aplicação

- **Área de proteção:** manter margem mínima equivalente à altura da letra "S"
  de SPINHARDI em todos os lados.
- **Tamanho mínimo:** 120px de largura em digital / 35mm em impresso. Abaixo
  disso, usar só o ícone.
- **Nunca:** distorcer proporções, alterar cores fora da paleta, adicionar
  sombra ou brilho, usar sobre fundo com pouco contraste, rotacionar o símbolo.

---

## Aplicação por Canal

### Site

- Fundo navy em seções de destaque, branco nas seções de conteúdo
- Ouro em títulos principais (H1, H2) e CTAs
- Verde apenas em seções de apoio com fundo branco ou claro
- CTAs diretos: "Fale com a gente" ou "Me conta sua viagem" — nunca "Clique
  aqui"
- Fotografias grandes e reais — sem stock photo óbvio

### Instagram

- Fundo navy como base das artes gráficas e cards de texto
- Ouro para destaque tipográfico e elementos de atenção
- Verde apenas sobre fundo branco — nunca sobre navy
- Fotos com paleta quente e de viagem: luz natural, momentos reais, sem filtros
  excessivos
- TT Fors Display em títulos de cards, Montserrat em textos de apoio

### WhatsApp

- Foto de perfil: logo variação clara sobre fundo branco
- Status: frase curta de posicionamento — renovar a cada 2 a 3 meses
- Sem elementos gráficos nas mensagens — o canal não comporta

### Materiais impressos

- Papel mínimo 300g para cartões
- Acabamento fosco preferencialmente
- Cartão (frente): logo ouro sobre navy / (verso): dados em texto escuro sobre
  branco
- Máximo 3 dados: nome, WhatsApp, site

---

## Tokens para `tailwind.config.ts`

```ts
colors: {
  navy:  '#1A2B4A',
  gold:  '#AD8330',
  green: '#4DBF72', // provisório — aguardando aprovação
  dark:  '#1E1E2E',
  white: '#FFFFFF',
},
fontFamily: {
  display: ['TT Fors Display', 'serif'],
  body:    ['Montserrat', 'sans-serif'],
},
```

---

_Este documento é referência para desenvolvimento. Não substitui o Branding
Book._ _Qualquer alteração de paleta ou tipografia deve ser refletida aqui e no
`tailwind.config.ts` simultaneamente._
