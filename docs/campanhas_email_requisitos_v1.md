# Campanhas de Email — Requisitos v1

**Feature:** módulo de campanhas de email dentro do back-office CRM **Motor de
envio:** Resend Broadcasts API **Status:** requisitos fechados · aguardando
wireframe → aprovação Nina/Julia → contrato de dados → implementação **Data:**
2026-07-08 **Responsável:** Alan Gattiboni

---

## 1. Contexto e decisão de modelo

O back-office nasceu para tirar Nina e Julia dos mil sistemas. Por isso o modelo
adotado é **UI própria no CRM + Resend como motor** (caminho C): a Nina nunca
abre o painel do Resend. O Resend fornece envio, fila, unsubscribe, supressão e
eventos; o CRM fornece a cara, o fluxo e a fonte de verdade.

Modelos descartados:

- **A — operar no painel do Resend:** lista duplicada e dessincronizada,
  contradiz a razão de existir do back-office.
- **B — sync automático + composição no painel:** tecnicamente mais barato, mas
  devolve a Nina para um sistema externo. Vetado pelo critério "Nina é a
  usuária".

A pesquisa de campo (Perplexity, 2026-07-08) retornou quase exclusivamente
documentação do próprio Resend — sinal de que somos early adopters do padrão
"Broadcasts API como backend de CRM próprio". Consequência assumida: o contrato
de dados nasce defensivo e toda afirmação crítica da pesquisa foi verificada na
fonte antes de entrar neste documento.

---

## 2. Restrições arquiteturais verificadas (fonte: docs oficiais Resend)

Estas duas verificações condicionam tudo o que segue:

**2.1 — Audiences está deprecado. Construir sobre Contacts + Segments +
Topics.** O Resend migrou para um modelo de Contacts globais (um contato por
email, independente de lista), Segments (agrupamento interno para envio) e
Topics (preferências visíveis ao destinatário, com página de gerenciamento de
inscrição). Os docs de Broadcasts ainda citam Audiences; o API reference e o
tooling oficial já tratam Audiences como legado. **Nenhuma linha do nosso código
referencia Audiences.**

**2.2 — Broadcasts criados via API só podem ser editados e enviados via API.**
API e editor visual do dashboard são pistas separadas. Como o modelo é 100% API,
a restrição é neutra — mas fica proibido qualquer workflow híbrido ("cria no
CRM, ajusta no painel"). O painel do Resend é ferramenta de observabilidade do
Alan, nunca parte do fluxo operacional.

Bônus do modelo novo: Topics mapeia naturalmente nos tipos de campanha da
Spinhardi (ex.: Newsletter, Saídas de grupo). O destinatário ganha descadastro
granular sem custo adicional de produto.

---

## 3. MUST-HAVE v1

Lista única, sem nice-to-have. Racional da consolidação: incrementalidade não é
"deixar pra depois" o que é essencial a qualquer CRM; adiar capacidade que a API
já oferece (rascunho, agendamento, tags) é retrabalho agendado, não
simplicidade.

### 3.1 Fundação e fonte de verdade

- **F1.** Tabela local de campanhas com FK para o `broadcast_id` do Resend. O
  CRM é a fonte de verdade de rascunhos, status, conteúdo e resultados; o Resend
  guarda a cópia operacional de envio.
- **F2.** Modelo Resend: Contacts + Segments + Topics (ver 2.1). Zero Audiences.
- **F3.** Sync one-way de contatos elegíveis CRM → Resend antes de cada envio.
  Coerente com a disciplina bronze/silver/gold (D041): gold alimenta o externo,
  o externo nunca alimenta o front diretamente.

### 3.2 Consentimento e LGPD (inegociável)

- **C1.** Campo local de consentimento de marketing por contato, com no mínimo
  três estados: `opt_in` · `opt_out` · `unknown`.
- **C2.** `unknown` e `opt_out` **excluídos por default** de todo sync e envio.
- **C3.** Fluxo de re-permissão como capacidade do sistema: envio de exceção,
  deliberado e **logado**, direcionável a contatos `unknown`, com mecanismo de
  captura de consentimento (link que registra o opt-in e atualiza o status no
  CRM). É o único caminho legítimo para ativar a base importada (850+ contatos
  com `origem='importado'` e consentimento desconhecido).
- **C4.** Placeholder de unsubscribe do Resend obrigatório e hard-coded em todo
  template, fora do alcance de edição da usuária.
- **C5.** Descadastro e bounce refletidos no contato do CRM como estado
  não-enviável, visível na ficha 360. Supressão nunca é silenciosa.

### 3.3 Composição e fluxo de envio

- **E1.** Composição por template fixo com slots editáveis (headline, intro,
  corpo, CTA, nota de rodapé). **Sem editor drag-and-drop.**
- **E2.** Três tipos de campanha no lançamento: newsletter · anúncio de viagem ·
  saída de grupo. Layout brandado (BB Lite v3) imposto pelo template.
- **E3.** Preview fiel + test send ("enviar para mim") obrigatórios antes de
  liberar o envio real.
- **E4.** Ciclo de vida: `Rascunho → Testada → Agendada → Enviada`. Salvar como
  rascunho e retomar depois é comportamento básico, não extra.
- **E5.** Agendamento de envio (`scheduledAt` da API) com presets simples
  ("enviar agora", data/hora custom).
- **E6.** Segmentação de destinatários no envio: "todos os elegíveis" +
  segmentos por critério simples (a definir no wireframe; implementado via
  Segments do Resend, espelhados do CRM).
- **E7.** Tags por campanha desde o primeiro envio, garantindo analytics
  consistente durante o período de amadurecimento da base — sem "base antiga sem
  tag" para remendar depois.

### 3.4 Eventos, métricas e observabilidade

- **M1.** Webhooks do Resend ingeridos e persistidos localmente: eventos entram
  como **bronze** (JSONB bruto), silver normaliza, gold alimenta a UI. Mesmo
  padrão dos syncs Iddas/ClickMassa.
- **M2.** Verificação de assinatura do webhook + processamento idempotente
  (eventos duplicados ou replays não corrompem métricas).
- **M3.** Tela de resultados por campanha: enviados, entregues, abertos,
  cliques, descadastros, bounces.
- **M4.** Eventos de email na timeline da ficha 360 do contato (recebeu, abriu,
  clicou, descadastrou), integrados à timeline de interações existente.

---

## 4. Fora de escopo (explicitamente)

- Editor visual drag-and-drop de email.
- Automação de réguas/nutrição (enviou X, espera N dias, envia Y).
- A/B testing.
- Reabrir a escolha de provider. Decisão tomada: Resend.
- Dados contábeis ou financeiros na tela de resultados.

Qualquer item desta seção só entra por decisão registrada em DECISION_LOG.

---

## 5. Notas técnicas (a fechar no contrato de dados)

- **Autoria de templates:** React Email é a camada provável (dev-side, invisível
  para a usuária). Decisão final no passo do contrato de dados.
- **Verificar na fonte durante o contrato:** rate limits vigentes da API,
  payload exato dos eventos de webhook no modelo novo, semântica de
  `scheduledAt`, comportamento de Segments/Topics na criação de broadcast. Nada
  entra no contrato por citação de agregador.
- **Limites de plano (contatos/emails por mês):** verificação adiada por decisão
  de Alan; obrigatória antes da implementação do sync (F3).

---

## 6. Próximos passos

1. ~~Pesquisa de campo e fechamento da lista~~ ✔ (este documento)
2. Wireframe em .md para aprovação do Alan
3. Wireframe HTML standalone para aprovação de Nina e Julia
4. Contrato de dados (em paralelo à aprovação)
5. Plano de implementação lógico e sequencial

---

## Anexo A — Ingestão de eventos Resend (bronze, dia 1)

Princípio: o endpoint de webhook assina TODOS os eventos disponíveis e persiste
o payload bruto em bronze (JSONB), sem filtro. Filtrar na ingestão é decidir
hoje o que não poderemos analisar amanhã. Catálogo verificado na fonte em
2026-07-08; revalidar no contrato de dados.

### A.1 — Eventos ingeridos (todos)

**Família email:**

| Evento                   | Justificativa (1 frase)                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `email.sent`             | Confirma que o Resend aceitou o envio; é o denominador de todas as taxas.                                                 |
| `email.delivered`        | Entrega confirmada no servidor do destinatário; base da taxa de entrega.                                                  |
| `email.delivery_delayed` | Soft bounce/atraso temporário; precursor de bounce definitivo e sinal precoce de problema de reputação.                   |
| `email.bounced`          | Rejeição permanente; dispara supressão local (C5) e higiene de base.                                                      |
| `email.complained`       | Marcado como spam; supressão imediata e o indicador mais grave de saúde do domínio.                                       |
| `email.opened`           | Engajamento básico; alimenta taxa de abertura e timeline do contato (M4).                                                 |
| `email.clicked`          | Engajamento qualificado, com link, timestamp, IP e user-agent no payload; alimenta cliques e futura análise por link.     |
| `email.failed`           | Falha de envio (destinatário inválido, quota, domínio); distingue "não saiu" de "não chegou" no diagnóstico.              |
| `email.scheduled`        | Confirmação de agendamento aceito; permite reconciliar estado AGENDADA do CRM com o estado real no Resend.                |
| `email.suppressed`       | Envio barrado pela lista de supressão do próprio Resend; explica divergência entre destinatários selecionados e enviados. |
| `email.received`         | Email inbound (produto de recebimento); não usamos hoje, mas ingerir custa zero e evita ponto cego se o produto evoluir.  |

**Família contact:**

| Evento            | Justificativa                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `contact.created` | Auditoria do sync CRM → Resend; confirma que o espelho remoto reflete o gold.                                                        |
| `contact.updated` | É por aqui que chega o descadastro/mudança de preferência feita pelo destinatário; alimenta o estado de consentimento local (C1/C5). |
| `contact.deleted` | Detecta remoção no lado Resend (manual ou sistêmica) que quebraria o espelhamento silenciosamente.                                   |

**Família domain:**

| Evento           | Justificativa                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `domain.created` | Auditoria de infraestrutura; mudança aqui nunca deve acontecer sem rastro.                  |
| `domain.updated` | Alteração de DNS/verificação do domínio afeta transacional E campanhas; rastro obrigatório. |
| `domain.deleted` | Evento catastrófico (derruba até o reset de senha); precisa de registro e alerta.           |

### A.2 — O que NÃO vai pro front na v1 (ingerido, não exibido)

| Item                                                               | Justificativa                                                                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `email.delivery_delayed`                                           | Estado transitório que se resolve sozinho ou vira bounce; mostrar pra Nina gera ansiedade sem ação possível.                                  |
| `email.failed` / `email.suppressed` / `email.scheduled`            | Diagnóstico operacional; divergências aparecem pra Nina já traduzidas ("X não puderam ser entregues"), o detalhe técnico é do Alan via dados. |
| `email.complained` como métrica própria                            | Nina vê o efeito (contato não-enviável na ficha); a taxa de spam como KPI é leitura de operador, não de usuária.                              |
| `email.received`                                                   | Produto inbound não contratado no escopo.                                                                                                     |
| Família `contact.*` como tela                                      | É mecânica de sincronização; o front mostra o resultado (status de consentimento na ficha), nunca o evento.                                   |
| Família `domain.*`                                                 | Infraestrutura pura; se um dia precisar de alerta, é notificação pro Alan, não tela no CRM.                                                   |
| Sub-dados de payload (IP, user-agent, link clicado, bounce_type)   | Ficam íntegros no bronze para análise futura (cliques por link, hard vs soft); expor na v1 é ruído sem pergunta que responda.                 |
| Comparativo temporal além de "vs. campanha anterior do mesmo tipo" | Envio ocasional não gera série; o delta simples (padrão HubSpot de referência) já responde "melhorou ou piorou?".                             |

Regra de evolução: promover qualquer item de A.2 para o front não exige migração
ou backfill — o dado já existe em bronze desde o primeiro envio. É só camada
silver/gold + UI.

_Documento vivo até o início da implementação. Alterações de escopo exigem
atualização aqui e, quando estruturais, entrada no DECISION_LOG._
