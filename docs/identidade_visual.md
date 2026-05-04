# Guia de Identidade Visual — Spinhardi Turismo
**Versão:** 1.0 (em aprovação pelas sócias)  
**Fonte de verdade:** `bb_lite_v2_spinhardi.docx`  
**Última atualização:** Abril 2026

> ⚠️ O verde (`#4DBF72`) está definido provisoriamente para desenvolvimento do site.
> A paleta do Branding Book usa `#8CB89F` (sage). A substituição será validada pelas sócias
> ao ver aplicado, e aí atualizamos o Canva e o manual. Não alterar o docx até aprovação.

---

## Paleta de Cores

| Token | Nome | Hex | Uso |
|---|---|---|---|
| `color-navy` | Navy | `#1A2B4A` | Cor principal. Fundo dominante, ancora tudo. |
| `color-gold` | Ouro | `#AD8330` | Destaque. Ícone, CTAs, elementos que pedem atenção. |
| `color-green` | Verde | `#4DBF72` | Apoio vibrante. **Provisório — em aprovação.** |
| `color-text` | Texto escuro | `#1E1E2E` | Todo texto corrido. Nunca substituir por cinza neutro. |
| `color-white` | Branco | `#FFFFFF` | Contraste e respiro. Sempre funcional, nunca decorativo. |

### Hierarquia obrigatória

- **Protagonistas:** Navy + Ouro
- **Coadjuvante:** Verde
- **Funcionais:** Texto escuro + Branco
- Qualquer composição que inverta essa hierarquia vai parecer fora de lugar.

### Restrição crítica

> Verde **nunca** aparece como texto ou elemento sobre fundo navy.
> Baixa legibilidade — inclusive para pessoas com dificuldade visual.
> Verde só sobre fundo branco ou claro neutro.

---

## Tipografia

| Fonte | Uso | Peso | Notas |
|---|---|---|---|
| **TT Fors Display** | Nome da marca, H1, H2, destaques editoriais | Regular e variações nativas | Personalidade própria. Funciona bem em tamanho grande. Espessuras diferentes sem precisar customizar. |
| **Montserrat** | Taglines, subtítulos, "Turismo" na logo, corpo de texto em títulos | Light e Regular | Sans neutra. Cria contraste com TT Fors Display. Nunca usar como destaque principal. |

### Regras de combinação

- TT Fors Display em tamanho **grande**, Montserrat em tamanho **menor**. Essa hierarquia não se inverte.
- TT Fors Display se beneficia de tracking levemente ampliado em títulos curtos.
- **Nunca condensar nenhuma das duas.**

---

## Logo

### Variações e quando usar

| Variação | Fundo ideal | Usar quando | Não usar quando |
|---|---|---|---|
| Principal (escura) | Navy `#1A2B4A` | Site, redes sociais, apresentações, materiais com fundo navy | Fundos claros — o navy some |
| Clara | Branco ou tons claros neutros | Documentos impressos, papelaria, fundos fotográficos claros, e-mail | Fundos escuros — perde contraste |
| Verde | Verde `#4DBF72` | Variação editorial em peças específicas | Uso principal de marca — é apoio, não protagonista |
| Ícone isolado (pássaro) | Qualquer cor da paleta | Favicon, perfil de redes sociais, aplicações pequenas | Quando há espaço suficiente para a logo completa |

### Regras de aplicação

- **Área de proteção:** manter margem mínima equivalente à altura da letra "S" de SPINHARDI em todos os lados.
- **Tamanho mínimo:** 120px de largura em digital / 35mm em impresso. Abaixo disso, usar só o ícone.
- **Nunca:** distorcer proporções, alterar cores fora da paleta, adicionar sombra ou brilho, usar sobre fundo com pouco contraste, rotacionar o símbolo.

---

## Aplicação por Canal

### Site

- Fundo navy em seções de destaque, branco nas seções de conteúdo
- Ouro em títulos principais (H1, H2) e CTAs
- Verde apenas em seções de apoio com fundo branco ou claro
- CTAs diretos: "Fale com a gente" ou "Me conta sua viagem" — nunca "Clique aqui"
- Fotografias grandes e reais — sem stock photo óbvio

### Instagram

- Fundo navy como base das artes gráficas e cards de texto
- Ouro para destaque tipográfico e elementos de atenção
- Verde apenas sobre fundo branco — nunca sobre navy
- Fotos com paleta quente e de viagem: luz natural, momentos reais, sem filtros excessivos
- TT Fors Display em títulos de cards, Montserrat em textos de apoio

### WhatsApp

- Foto de perfil: logo variação clara sobre fundo branco
- Status: frase curta de posicionamento — renovar a cada 2 a 3 meses
- Sem elementos gráficos nas mensagens — o canal não comporta

### Materiais impressos

- Papel mínimo 300g para cartões
- Acabamento fosco preferencialmente
- Cartão (frente): logo ouro sobre navy / (verso): dados em texto escuro sobre branco
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

*Este documento é referência para desenvolvimento. Não substitui o Branding Book.*
*Qualquer alteração de paleta ou tipografia deve ser refletida aqui e no `tailwind.config.ts` simultaneamente.*
