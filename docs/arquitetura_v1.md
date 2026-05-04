# Arquitetura de Páginas — Spinhardi Turismo
**Status:** proposta para aprovação  
**Próximo passo:** wireframe navegável em HTML após aprovação desta estrutura

---

## Critério de decisão

Cada página existe porque resolve uma necessidade real de um perfil de cliente
ou porque sustenta um objetivo estratégico do momento AGORA da marca.
Nenhuma página foi incluída por "é comum ter em site de agência".

---

## Árvore de páginas
/                        → Home
/sobre                   → Sobre a Spinhardi
/viagens                 → Viagens (hub de serviços)
/viagens/pacotes       → Pacotes e Roteiros
/viagens/sob-medida    → Viagem Sob Medida
/blog                    → Blog
/blog/[slug]           → Post individual
/contato                 → Contato

---

## Por que cada página existe

### `/` — Home
**Papel:** primeira impressão. Tem 5 segundos para comunicar quem é a Spinhardi
e por que ela é diferente de uma plataforma de reservas.

Contém:
- Hero com frase de manifesto e CTA para WhatsApp
- Bloco de posicionamento (quem somos, como trabalhamos)
- Vitrine resumida de serviços (leva para `/viagens`)
- Bloco de história/legado (âncora emocional — 1987, Serra Negra)
- Depoimentos reais
- CTA de contato

---

### `/sobre` — Sobre a Spinhardi
**Papel:** construir confiança com quem já tem interesse mas quer saber
com quem está falando antes de entrar em contato.

Contém:
- História da agência (1987, Lilian e Dudu, Nina)
- Valores em prática
- Foto real da equipe
- CTA para contato

---

### `/viagens` — Hub de Serviços
**Papel:** página de entrada para quem sabe que quer viajar mas não sabe
ainda qual produto é o certo. Redireciona para as subpáginas certas
de acordo com o perfil.

Contém:
- Explicação curta dos dois modos de trabalho da agência
- Cards para `/viagens/pacotes` e `/viagens/sob-medida`
- CTA de contato genérico

---

### `/viagens/pacotes` — Pacotes e Roteiros
**Papel:** atender o Cliente Independente e o Cliente Pacote Tradicional —
os dois perfis que representam a base atual do negócio.

Contém:
- O que é e como funciona
- Destinos e tipos disponíveis (sem listar preço)
- CTA direto para WhatsApp

**Nota:** esta página não menciona Itália como foco. Qualquer destino que a
agência opera pode aparecer aqui.

---

### `/viagens/sob-medida` — Viagem Sob Medida
**Papel:** apresentar o produto de curadoria para o Cliente Curadoria e o
Cliente Alto Padrão. Aqui o tom muda — mais consultivo, mais profundo.

Contém:
- O que é curadoria e como funciona o processo (briefing, proposta, contrato)
- Para quem é (sem usar linguagem excludente)
- Destinos com afinidade natural da agência — Itália entra aqui como especialidade,
  não como exclusividade
- CTA para conversa inicial (WhatsApp ou formulário)

---

### `/blog` — Blog
**Papel:** SEO, construção de autoridade e conteúdo de descoberta.
É o canal que atrai pessoas que não conhecem a Spinhardi por pesquisa orgânica.

Contém:
- Listagem de posts com filtro por categoria
- Categorias sugeridas: Destinos, Bastidores, Dicas de Viagem, História da Agência

---

### `/blog/[slug]` — Post Individual
**Papel:** página gerada dinamicamente a partir do schema de conteúdo.
Cada post tem metadados completos de SEO.

---

### `/contato` — Contato
**Papel:** página de conversão final. Quem chega aqui já decidiu que quer falar.
Não precisa convencer — precisa facilitar.

Contém:
- Formulário simples (nome, e-mail, mensagem, destino de interesse)
- Botão WhatsApp em destaque
- Localização (Serra Negra — reforça o vínculo com a cidade)

---

## O que foi deliberadamente deixado de fora

| Página | Por que não entra agora |
|---|---|
| `/tenis-italia` | É PRÓXIMO PASSO. Não tem conteúdo nem produto pronto para sustentar uma página dedicada. |
| `/serra-negra` | Aparece como contexto em `/sobre` e no blog. Não justifica página própria agora. |
| `/experiencias-esportivas` | Idem — PRÓXIMO PASSO. Entra quando houver produto real. |
| `/faq` | O conteúdo vai para o blog e para os CTAs de cada página. FAQ isolado cria página órfã. |
| `/destinos/[pais]` | Complexidade desnecessária no lançamento. Blog resolve a demanda de conteúdo por destino. |

---