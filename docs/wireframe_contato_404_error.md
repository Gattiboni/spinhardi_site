# Wireframe — `/contato` + `not-found.tsx` + `error.tsx`

**Status:** proposta pra revisão · **Fontes:** mapa de copies (linhas 476-506 +
Tabelas 22 e 23) + padrão estabelecido nas páginas anteriores

---

## Princípios de execução deste lote

- **3 entregas, 1 sessão.** Contato é a página principal, 404 e error são telas
  estruturais curtas que dependem dos mesmos componentes.
- **Página com fundo claro** — `/contato` entra em `LIGHT_ROUTES` (D018 em
  ação).
- **Envio mockado.** Server Action existe, valida, "salva" via `console.log`
  estruturado + simula latência. Plug no Supabase real entra na Fase 1.11
  (conforme decisão tua de fazer Supabase por último com SQL em lote).
- **Sem componentes novos.** Composição inline. Se eventualmente outras páginas
  precisarem de formulário, aí componentizamos.
- **Form: client component justificado.** Precisa de estado React (valores,
  validação, loading, sucesso). `'use client'` necessário.

---

## ENTREGA 1 — Página `/contato`

### Estrutura geral

```
┌────────────────────────────────────────────────────┐
│ HEADER (já no layout global)                       │ Sólido (LIGHT_ROUTES)
├────────────────────────────────────────────────────┤
│ Bloco 1 · CABEÇALHO DA PÁGINA               branco │
├────────────────────────────────────────────────────┤
│ Bloco 2 · GRID 2 COLUNAS                    branco │ Contatos (esq.) + Formulário (dir.)
├────────────────────────────────────────────────────┤
│ FOOTER (já no layout global)                navy   │
└────────────────────────────────────────────────────┘
```

**Padrão visual:** mesmo das outras páginas claras (Sobre, Viagens hub, Pacotes,
Sob Medida). Página enxuta — 2 blocos só. O formulário em si é o "conteúdo"
principal.

---

### Bloco 1 · CABEÇALHO

**Wrapper:**
`<Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│ CONTATO                                         │ Eyebrow gold uppercase tracking-widest
│                                                 │
│ Vamos conversar                                 │ H1 Fraunces, navy
│                                                 │
│ Sem compromisso. Sem pressão. Me conte o que    │ Subtítulo Montserrat dark/80
│ você tem em mente e a gente pensa juntos.       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Copy exato (mapa):**

- Eyebrow: `Contato`
- Título: `Vamos conversar`
- Subtítulo:
  `Sem compromisso. Sem pressão. Me conte o que você tem em mente e a gente pensa juntos.`

---

### Bloco 2 · GRID 2 COLUNAS

**Wrapper:** `<Section spacing="lg" className="bg-white text-dark">`

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  COMO FALAR COM A GENTE   │  ENVIE UMA MENSAGEM │
│  (col esq 5/12)           │  (col dir 7/12)     │
│                           │                     │
│  WhatsApp                 │  Nome                │
│  +55 19 99776-1226        │  [____________]      │
│  Atendimento próximo,     │                      │
│  resposta no mesmo dia.   │  WhatsApp            │
│                           │  [____________]      │
│  Instagram                │                      │
│  @spinharditurismo        │  Destino de interesse│
│  Bastidores, destinos     │  [Select ▾]          │
│  e novidades.             │                      │
│                           │  O que você tem      │
│  Localização              │  em mente?           │
│  Serra Negra, SP          │  [____________]      │
│  Atendimento em todo o    │  [____________]      │
│  Brasil, presencial em    │  [____________]      │
│  Serra Negra.             │                      │
│                           │  [Enviar mensagem]   │
│  Horário                  │                      │
│  Segunda a sábado         │  Também pode chamar  │
│  9h às 19h                │  direto no WhatsApp. │
│                           │                      │
└─────────────────────────────────────────────────┘
```

**Desktop:** grid 12 colunas — coluna esquerda 5, coluna direita 7 **Mobile:** 1
coluna empilhada — contatos primeiro, formulário abaixo

---

### Coluna esquerda — Lista de contatos

**Estrutura por item:**

- Título (label em gold uppercase, mesmo padrão dos eyebrows)
- Linha principal (Fraunces text-2xl navy)
- Linha secundária descritiva (Montserrat text-sm dark/70)

**4 itens (mapa, Bloco 2):**

#### 2.1 · WhatsApp

- Label: `WhatsApp`
- Principal: `+55 19 99776-1226` (link com `tel:` ou `wa.me`)
- Secundária: `Atendimento próximo, resposta no mesmo dia.`

#### 2.2 · Instagram

- Label: `Instagram`
- Principal: `@spinharditurismo` (link externo
  `https://instagram.com/spinharditurismo`)
- Secundária: `Bastidores, destinos e novidades.`

#### 2.3 · Localização

- Label: `Localização`
- Principal: `Serra Negra, SP`
- Secundária: `Atendimento em todo o Brasil, presencial em Serra Negra.`

#### 2.4 · Horário

- Label: `Horário`
- Principal: `Segunda a sábado · 9h às 19h`
- Secundária: ~~não tem no mapa~~ — **decisão:** omitir secundária aqui. Item
  fica visualmente mais curto que os outros, ok.

**Importante:** o mapa não traz copy específico das linhas secundárias. Eu
propus textos curtos coerentes com o tom da marca. **Confirma ou ajusta?**

---

### Coluna direita — Formulário

**Componente:** Client Component inline na própria `/contato/page.tsx` ou
separado em `src/components/ui/ContactForm.tsx` se ficar grande demais.
Recomendo separar — fica mais legível.

**Decisão técnica:** `'use client'` no `ContactForm.tsx`, página `/contato`
continua Server Component. Importa o form.

#### Estrutura HTML

```tsx
<form onSubmit={handleSubmit}>
  {/* Nome */}
  <label htmlFor="nome">Nome</label>
  <input
    type="text"
    id="nome"
    name="nome"
    required
    placeholder="Seu nome"
    value={values.nome}
    onChange={...}
  />

  {/* WhatsApp */}
  <label htmlFor="whatsapp">WhatsApp</label>
  <input
    type="tel"
    id="whatsapp"
    name="whatsapp"
    required
    placeholder="+55 19 99776-1226"
    value={values.whatsapp}
    onChange={...}
  />

  {/* Destino (select) */}
  <label htmlFor="destino">Destino de interesse</label>
  <select id="destino" name="destino" required value={values.destino} onChange={...}>
    <option value="" disabled>Selecione um destino</option>
    <option value="italia">Itália</option>
    <option value="europa">Europa em geral</option>
    <option value="cruzeiro">Cruzeiro</option>
    <option value="america-do-sul">América do Sul</option>
    <option value="outro">Outro destino</option>
    <option value="ajuda">Ainda não sei, quero ajuda</option>
  </select>

  {/* Mensagem (textarea) */}
  <label htmlFor="mensagem">O que você tem em mente?</label>
  <textarea
    id="mensagem"
    name="mensagem"
    rows={6}
    placeholder="Me conte um pouco sobre a viagem que você está pensando. Período, quem vai, se tem alguma preferência. Sem compromisso, é só para a gente entender melhor."
    value={values.mensagem}
    onChange={...}
  />

  {/* Botão de envio */}
  <Button type="submit" variant="primary" size="lg" disabled={loading}>
    {loading ? "Enviando..." : "Enviar mensagem"}
  </Button>

  {/* Texto auxiliar */}
  <p className="text-sm text-dark/60 mt-4">
    Também pode chamar direto no WhatsApp.
  </p>
</form>
```

#### Estados do formulário

1. **Padrão (não enviado):** form normal, botão habilitado
2. **Loading (durante envio):** botão "Enviando...", inputs desabilitados,
   simula latência ~1s
3. **Sucesso:** form some, aparece mensagem de sucesso (inline na mesma seção,
   sem redirect)
4. **Erro:** form continua, alerta vermelho discreto acima dos campos

#### Mensagem de sucesso

Substituir o form inteiro por:

```
┌──────────────────────────────────────┐
│  ✓ (ícone gold)                      │
│                                      │
│  Mensagem recebida.                  │ Fraunces, navy
│                                      │
│  Em breve a gente entra em contato.  │ Montserrat, dark/80
│  Se preferir falar agora, é só       │
│  chamar no WhatsApp.                 │
│                                      │
│  [Abrir WhatsApp →]                  │ CTAWhatsApp
└──────────────────────────────────────┘
```

**Copies de sucesso (não estão no mapa — eu propus):**

- Título: `Mensagem recebida.`
- Texto:
  `Em breve a gente entra em contato. Se preferir falar agora, é só chamar no WhatsApp.`
- CTA: `Abrir WhatsApp →` (variant primary)

**Confirma essa proposta de copy de sucesso? Ou prefere outra abordagem?**

#### Validação

- Todos os campos obrigatórios (HTML5 `required`)
- E-mail: ~~não tem campo de e-mail no mapa~~. **Mapa pede apenas Nome,
  WhatsApp, Destino, Mensagem.** Não vou adicionar e-mail. Telefone (WhatsApp) é
  o contato principal.
- Validação básica de telefone via `pattern` HTML (qualquer formato com dígitos)
- Erros aparecem inline abaixo do campo

---

### Server Action mockada

Criar `src/app/contato/actions.ts`:

```ts
"use server";

export async function submitContact(data: {
  nome: string;
  whatsapp: string;
  destino: string;
  mensagem: string;
}) {
  // Simula latência de rede
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock — vira Supabase real na Fase 1.11
  console.log("[contact submission - mock]", {
    timestamp: new Date().toISOString(),
    ...data,
  });

  // Mock de e-mail — vira Resend real na Fase 3
  console.log("[email mock] would notify equipe@spinhardi.com.br");

  return { success: true };
}
```

**Importante:** Server Action garante que a chamada vai pro server. Não vamos
usar `fetch` client-side por enquanto. Quando Supabase entrar, é só trocar o
miolo da função.

---

### Decisões importantes do formulário

1. **E-mail no formulário?** **NÃO.** Mapa pede só Nome, WhatsApp, Destino e
   Mensagem. Mantém o foco no WhatsApp como canal preferencial. Confirma?
2. **Salvar como rascunho local (localStorage)?** **NÃO.** Overkill pra essa
   etapa. Se o usuário fechar a aba, perde o que digitou. Pode ser melhoria
   futura, mas não na 1.6.
3. **reCAPTCHA ou honeypot anti-spam?** **NÃO ainda.** Sem produção, sem URL
   pública sendo varrida por bots. Quando entrar no domínio real (Fase 3),
   adicionamos honeypot (campo invisível). Sem reCAPTCHA — atrito demais pra
   Spinhardi.

---

## ENTREGA 2 — `src/app/not-found.tsx` (404 global)

### Estrutura

Página simples, fundo navy (consistente com identidade quando algo dá errado —
visual de respiro, sem ruído). Header e Footer continuam aparecendo (vivem no
layout).

**Decisão:** `/not-found` **NÃO** entra em `LIGHT_ROUTES` — fundo navy, Header
transparente sobre ela funciona naturalmente como funciona na Home.

**Wireframe:**

```
┌─────────────────────────────────────────────────┐
│ [HEADER navy/transparente]                      │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│            404                                  │ Fraunces text-9xl gold
│                                                 │
│       Página não encontrada                     │ Fraunces text-4xl white
│                                                 │
│   A página que você procurou não existe ou      │ Montserrat text-lg white/80
│   pode ter sido movida.                         │
│                                                 │
│   [Voltar pra Home]   [Falar com a gente]       │ Button + CTAWhatsApp
│                                                 │
│                                                 │
│                                                 │
│ [FOOTER navy]                                   │
└─────────────────────────────────────────────────┘
```

**Centralizado verticalmente** (min-height de pelo menos 60vh, conteúdo
flex-center).

**Copy (proposta — mapa não cobre 404):**

- Número grande: `404`
- Título: `Página não encontrada`
- Texto: `A página que você procurou não existe ou pode ter sido movida.`
- CTA primário: `Voltar pra Home` (Button variant primary, linka pra `/`)
- CTA secundário: `Falar com a gente` (CTAWhatsApp secondary)

**Tom:** sóbrio, não fofo demais. Spinhardi não é uma marca brincalhona. Sem
piadas "Você se perdeu?" — direta, resolutiva.

---

## ENTREGA 3 — `src/app/error.tsx` (error global)

### Estrutura

Similar ao 404, mas com mensagem diferente. **Obrigatoriamente Client
Component** — é assim que Next 16 funciona pra error boundaries.

```tsx
"use client";

import { useEffect } from "react";
// ... resto do código
```

**Wireframe:** idêntico ao 404 estruturalmente, copy diferente.

**Copy (proposta):**

- Número grande: ~~não usa "500" — fica menos amigável~~
- Substituir por ícone ou símbolo: `!` em Fraunces gigante gold, OU omitir o
  número
- **Recomendação:** omitir o número, deixar só o título grande
- Título: `Algo deu errado.`
- Texto:
  `Aconteceu um erro inesperado da nossa parte. A gente já foi notificado. Enquanto isso, você pode tentar de novo ou voltar pra Home.`
- CTA primário: `Tentar de novo` (Button que chama `reset()` — função do error
  boundary)
- CTA secundário: `Voltar pra Home` (Link Button pra `/`)

**Tom:** assume responsabilidade ("da nossa parte"), não culpa o usuário,
oferece 2 ações claras.

**Mecânica:**

```tsx
"use client";

import { useEffect } from "react";
import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro (em produção vai pro Sentry/similar, por enquanto console)
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <Section
      spacing="lg"
      className="bg-navy text-white min-h-[70vh] flex items-center"
    >
      <Container>
        <div className="text-center max-w-2xl mx-auto">
          {/* conteúdo */}
          <Button onClick={() => reset()} variant="primary" size="lg">
            Tentar de novo
          </Button>
          <Link href="/">
            <Button variant="secondary" size="lg">
              Voltar pra Home
            </Button>
          </Link>
        </div>
      </Container>
    </Section>
  );
}
```

---

## Mudança no Header

**Adicionar `/contato` ao `LIGHT_ROUTES`:**

```ts
const LIGHT_ROUTES = ["/dev/components", "/sobre", "/viagens", "/contato"];
```

**404 e error NÃO entram** — ambos têm fundo navy, Header dinâmico funciona
neles.

---

## Estrutura de arquivos novos

```
src/app/
  contato/
    page.tsx              ← Server Component, importa ContactForm
    actions.ts            ← Server Action mockada (submitContact)
  not-found.tsx           ← 404 global
  error.tsx               ← Error boundary global

src/components/ui/
  ContactForm.tsx         ← Client Component com estado, validação, submit
```

---

## Componentes utilizados

Reuso direto:

- `<Section>`, `<Container>` — wrappers
- `<Button>` — submit do form, CTAs do 404/error
- `<CTAWhatsApp>` — alternativa de contato no 404, sucesso do form
- `<Link>` (next/link) — navegação interna

Não-reuso (inline ou em ContactForm.tsx):

- Inputs, labels, select, textarea — estilizados inline com classes Tailwind
- Mensagem de sucesso — inline

---
