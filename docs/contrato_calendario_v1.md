# Contrato de Dados — Calendário v1

**Status:** PROPOSTO (congela com o OK do Alan) · **Data:** 2026-08-14
**Referência visual e funcional:** `mock_calendario_v1.html` (aprovado
integralmente pelo Alan: lógicas, funcionalidades, ícones e organização) +
`docs/identidade_visual.md` pra adaptação de paleta.

Toda afirmação sobre dado aqui foi verificada via MCP em 14/08 — nada presumido.

> **EMENDA (2026-08-18, D098):** C5.4 registrava 5 admin + 2 editor; produção
> desde antes de 14/08 tem 4 admin + 4 editor, todos approved (Marcela Pires
> rebaixada admin→editor via MCP em 14/08). O escopo por role do C5 permanece
> válido; só o censo estava defasado.

## C1 — Postura geral

1. **Tarefa nasce e vive no back-office.** `POST/PUT/DELETE /tarefa` do Iddas
   existe (spec confirmada) e fica como **ponto de extensão nomeado, não
   implementado**. Motivos: dual-writer (lição estrutural do projeto), PUT
   full-body do Iddas (mudar a data exige reenviar 5 campos), e a direção
   declarada da operação é migrar pro dash.
2. **Derivados são espelho read-only da bronze**: tarefas do Iddas, voos,
   hospedagens, transportes, cruzeiros, seguros, aniversários. Cadeado na UI,
   edição só na origem.
3. **CRM é histórico** (postura do three-way): fantasma na bronze com data
   futura aparece no calendário; sumir da origem não apaga nada aqui.
4. Nenhuma coluna ganha segundo escritor. Bronze = sync; `tarefas` e
   `calendar_checkins` = UI; `contacts` = intocado.

## C2 — Tabela nova `tarefas` (silver, local)

| Coluna                      | Tipo                                | Regra                                                                                                                    |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                        | uuid pk default gen                 |                                                                                                                          |
| `titulo`                    | text not null                       |                                                                                                                          |
| `descricao`                 | text null                           |                                                                                                                          |
| `data`                      | date not null                       |                                                                                                                          |
| `hora`                      | time null                           | null = dia inteiro                                                                                                       |
| `tipo`                      | smallint null                       | vocabulário herdado do Iddas: 1 Tarefa · 2 Ligar · 3 E-mail · 4 Reunião · 5 Almoço · 6 Visita · 7 WhatsApp (ícone na UI) |
| `responsavel_id`            | uuid not null → `user_profiles(id)` |                                                                                                                          |
| `contact_id`                | uuid null → `contacts(id)`          | vínculo opcional                                                                                                         |
| `jornada_id`                | uuid null → `jornadas(id)`          | vínculo opcional                                                                                                         |
| `concluida_em`              | timestamptz null                    | null = pendente; preenchida = concluída (estado é derivado, não coluna booleana paralela)                                |
| `concluida_por`             | uuid null → `user_profiles(id)`     |                                                                                                                          |
| `created_by`                | uuid not null → `user_profiles(id)` | auditoria                                                                                                                |
| `created_at` / `updated_at` | timestamptz                         | trigger `updated_at` no padrão de `contacts`                                                                             |

Escritor único: server actions do back-office. Atrasada =
`data < hoje AND concluida_em IS NULL` (derivado na leitura, nunca persistido).
Exclusão: hard delete com confirmação na UI (tarefa local não é histórico de
origem externa; auditoria de criação/conclusão já cobre o rastro relevante).

## C3 — Check-in por regra (derivado + confirmação mínima)

- Lembrete de check-in é **derivado na leitura**: um por voo com `data_embarque`
  futura, projetado em `data_embarque − 2 dias` (D-2 fixo na v1; configurável =
  extensão).
- Estado "feito" vive em `calendar_checkins`: `voo_bronze_id text pk`,
  `concluido_por uuid → user_profiles`, `concluido_em timestamptz`. Escritor
  único: UI. Zero linha até alguém concluir.
- Check-in **não tem responsável** (o voo não tem); é do time, concluível por
  qualquer aprovado, com autoria registrada.
- TRAP catalogada: `bronze_iddas_voo.checkin` existe com valores enum 1-5 (337×
  "4") e **semântica desconhecida** — não é usado na v1; investigar com a Nina
  antes de qualquer uso (geladeira).

## C4 — Leitura única: RPC `calendar_events_between(inicio date, fim date)`

Definição única de "o que aparece no calendário", consumida por todas as visões
(mesmo princípio da view de elegibilidade de email — nunca reimplementada na
UI). Retorna linhas normalizadas:

`event_type · source_type · source_id · titulo · data_inicio · hora_inicio · data_fim · multi_dia · editavel · concluida · responsavel_user_id · contact_id · cliente_nome · meta jsonb · source_updated_at`

Fontes e mapeamento (colunas reais, verificadas):

| event_type     | Fonte                                                | Datas                                      | Observações                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tarefa`       | `tarefas`                                            | `data`+`hora`                              | editável; responsável = FK direta                                                                                                                                                                                             |
| `tarefa_iddas` | `bronze_iddas_tarefa`                                | `data`+`hora`                              | read-only; `id_responsavel` → `user_profiles.iddas_usuario_id`; TRAP: `hora` vem `"12:00:00"` e escalares vêm string                                                                                                          |
| `checkin`      | derivado de `bronze_iddas_voo` + `calendar_checkins` | `data_embarque − 2`                        | concluível                                                                                                                                                                                                                    |
| `voo`          | `bronze_iddas_voo`                                   | `data_embarque`+`hora_embarque`            | meta: `voo, companhia, aeroporto_*_iata, localizador`                                                                                                                                                                         |
| `hospedagem`   | `bronze_iddas_hospedagem`                            | `data_entrada` → `data_saida`              | multi-dia; meta: `nome, localizador`                                                                                                                                                                                          |
| `transporte`   | `bronze_iddas_transporte.raw_payload`                | `data_inicial/hora_inicial` → `data_final` | TRAP: colunas projetadas são só `id, id_orcamento` — datas vivem no `raw_payload` (`data_inicial, data_final, hora_inicial, hora_final, retirada, devolucao, nome, cliente`); extração no SQL da RPC, zero migração de bronze |
| `cruzeiro`     | `bronze_iddas_cruzeiro`                              | `data_entrada` → `data_saida`              | meta: `embarque, desembarque, tipo_cabine`                                                                                                                                                                                    |
| `seguro`       | `bronze_iddas_seguro`                                | `inicio_vigencia` → `fim_vigencia`         | multi-dia discreto                                                                                                                                                                                                            |
| `aniversario`  | `contacts.data_nascimento`                           | projetado no(s) ano(s) do range            | fonte silver, não bronze; TRAP herdada: sentinela `0000-00-00` já não existe em `contacts` (conferir na migração; se existir, filtrar)                                                                                        |

**Vínculo com contato (a cadeia verificada):** derivado de viagem →
`id_orcamento` → `bronze_iddas_orcamento.cliente` (= id da pessoa; casa 671/677,
6 órfãos-fantasma degradam pra `contact_id null` sem quebrar) →
`contact_external_links (provider='iddas')` → `contact_id`. `cliente_nome` vem
de `orcamento.raw_payload->>'nome_cliente'` como fallback de exibição quando o
link não resolve.

Aniversário recorrente: a RPC recebe o range e materializa as ocorrências dentro
dele (inclusive virada de ano) — a UI nunca calcula recorrência.

## C5 — Hierarquia e identidade (zero hardcoding)

1. Fonte única: `user_profiles` com `status='approved'`. **`role='admin'` vê
   tudo** e ganha seletor Meu/Time/por-pessoa; **qualquer outro role** entra
   travado em "Meu": suas tarefas (responsável) + tudo que é do time (derivados
   de viagem, check-ins, aniversários). Entrou usuário novo aprovado → aparece;
   mudou role → comportamento muda; saiu → some. Nada de lista de nomes em
   código.
2. Divergência mock→dado real, decidida: derivados de viagem **não têm
   responsável** (o dado não tem) e são visíveis a todos os aprovados —
   avatar/filtro por pessoa se aplica a `tarefa` e `tarefa_iddas`. O mock
   mostrava avatar em tudo; a implementação mostra avatar só onde há dono.
3. De-para de identidade: colunas novas
   `user_profiles.iddas_usuario_id text null unique` e
   `clickmassa_user_id text null unique`, **semeadas por migração** com os
   casamentos verificados hoje: Nina 6713/60 · Julia 6810/67 · Amanda 7916/164 ·
   Isaura 7767/144 · Bruna –/170. Editável como dado; UI de gestão = extensão.
   Motivo de não usar email: o casamento por email falha exatamente pra Nina (3
   emails diferentes) e pra Julia no Iddas.
4. Papéis atuais no banco: 5 admin (Alan, Amanda, Nina, Julia, Marcela) + 2
   editor (Bruna, Isaura). O contrato **lê**, não legisla: ajustar quem é admin
   é operação de dado do Alan, fora deste contrato.

## C6 — UI

Mock é a especificação de layout, lógica, ícones e organização: visões
Mês/Semana/Agenda, célula com máx 3 + `+N mais` em popover agrupado
Operação/Trabalho, multi-dia em barra, composer na célula, checkbox inline
otimista, drag só em editável com toast+desfazer, drawer lateral (nunca
navegação), cadeado+microtexto de origem, agenda Atrasadas/Hoje/Próximos 30 com
toggle de concluídas, chips persistentes, seletor de escopo fixo.

Adaptação obrigatória à identidade (`docs/identidade_visual.md`): tokens e
fontes do app (`globals.css`); cores de categoria são funcionais de admin
(escala numérica permitida), com navy/gold respeitados como protagonistas onde
houver cromo de marca; verde-pinheiro nunca adjacente a navy; primitivos
existentes (Toast, Modal, tokens) reusados — zero paleta paralela inventada.
Drawer usa o padrão de painel que o admin já tiver; se não houver, nasce no
padrão dos primitivos.

Persistência de preferências (chips, escopo, visão): por usuário, `localStorage`
na v1 (preferência de UI, não dado de negócio); promoção a coluna = extensão.

## C7 — Pontos de extensão nomeados (deixar óbvios, NÃO implementar)

Write-back de tarefa no Iddas · solicitações na visão · pagamentos/prazos de
emissão (espera o lote financeiro) · recorrência de tarefa · fuso por evento
(voo internacional) · D-N configurável do check-in · UI de gestão do de-para ·
semântica de `voo.checkin` · IA sobre qualquer coisa (gatilho: créditos da
Nina).

## C8 — Ordem de execução

1. Alan aprova este contrato (e responde a questão dos roles, que é ortogonal)
2. Claudinho aplica migrações via MCP: `tarefas`, `calendar_checkins`,
   colunas+seed do de-para, RPC `calendar_events_between` — com β de banco
   (chamada real da RPC num range com dado conhecido)
3. Instrução Codinho (mock + este contrato como anexos; código nunca redefine a
   regra de leitura — consome a RPC)
4. β em produção com Comet no roteiro de UI + Alan no smoke de 2 minutos
5. Papelada — **no final final da leva, como combinado**
