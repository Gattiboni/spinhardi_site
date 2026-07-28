# Contrato de Dados: Campanhas de Email e Tags v1

**Status:** congelado. Divergência vira entrada no DECISION_LOG ou v2, não edição neste arquivo.

**Complementa:** `contrato_dados_backoffice_v1.md` e `contrato_dados_ficha_docs_comunicacao_v1.md`. Onde conflitar com as cláusulas N1-N5 do segundo, este prevalece.

**Base factual (medida em 27/07/2026, produção `grjkqljucszoaujmhgpi`):** 878 contatos, 864 ativos, 205 com email (todos ativos, todos com sintaxe válida, 205 emails distintos, zero duplicata). 393 contatos da bronze ClickMassa têm tag; 285 chegam no silver; 41 desses têm email. Catálogo `tags` com 6 linhas, zero contatos taguados. Catálogo ClickMassa com 20 tags, 19 em uso, 19 de 19 casam por nome com `bronze_clickmassa_tags`.

---

## Bloco T. Tags

**T1. Duas colunas, um escritor cada. Não existe merge.**
- `contacts.clickmassa_tags_id` (`integer[]`, já existe, hoje vazia em 878 linhas): dona é o sync. Read-only na UI.
- `contacts.tags` (`text[]`, já existe, hoje vazia em 878 linhas): dona é a operadora. O sync nunca escreve nesta coluna.

Motivo: `contacts.tags` com dois escritores é o mesmo problema de `email` e `cidade` com dois escritores, resolvido pela cláusula M (three-way) do contrato anterior. Separar por coluna elimina a regra de precedência em vez de duplicá-la.

**T2. Resolução do sync.** A promoção lê `bronze_clickmassa_contacts.raw_payload->'tags'`, que é array de **nomes** (string), resolve cada nome contra `bronze_clickmassa_tags.name` e grava os `id` correspondentes em `contacts.clickmassa_tags_id`. Nome sem correspondência no catálogo é ignorado e registrado no `ingestion_log`, nunca inventado.

**T3. Exibição das tags do ClickMassa** resolve `id` para `name` contra `bronze_clickmassa_tags` no momento da leitura. Consequência deliberada: rename de tag no ClickMassa aparece sozinho no back-office, sem migração.

**T4. Idempotência.** A gravação de `clickmassa_tags_id` é substituição integral do array a cada ciclo, não união. O sync é full refresh (comprovado: `contacts: 1673` em todo ciclo do `ingestion_log`), então o array reflete o estado atual da origem. Tag removida no ClickMassa desaparece aqui.

**T5. Chave de `contacts.tags`.** Guarda `tags.slug` (kebab-case, como já está nas 6 linhas do catálogo), nunca `id`, nunca `name`. Motivo: todo consumidor existente trata o elemento como texto legível (renderiza cru na ficha, joga no haystack de busca, usa como value e label do filtro). `slug` é estável sob rename de `name`.

**T6. Integridade de `contacts.tags`.** Sem FK (é `text[]`). Regras: a escrita valida que o slug existe em `tags` e que `is_active = true`. Apagar tag do catálogo **não** remove o slug dos contatos, e slug órfão é exibido normalmente. Renomear `name` no catálogo não altera `slug`; alterar `slug` é proibido depois da criação (a UI de Configurações não expõe edição de slug).

**T7. Único lugar de criar e editar o catálogo:** Configurações. Onde couber criar tag sem trocar de tela, é chamada à mesma server action de Configurações, não um segundo CRUD.

**T8. Onde as tags aparecem.** Ficha do contato: dois blocos distintos e rotulados, "Tags do ClickMassa" (read-only) e "Tags internas" (editável). Lista de contatos: coluna e filtro para as duas origens, além da ação em massa de aplicar tag interna. Persistência entre telas é consequência de ambas lerem as mesmas duas colunas, sem cópia local.

---

## Bloco P. Permissão de email marketing

**P1. Três colunas novas em `contacts`:**
- `email_marketing_status` TEXT NOT NULL DEFAULT `'legitimo_interesse'`, CHECK em quatro valores: `legitimo_interesse`, `optin`, `descadastrado`, `invalido`.
- `email_marketing_status_em` TIMESTAMPTZ NULL.
- `email_marketing_status_origem` TEXT NULL, CHECK em: `importacao`, `backoffice`, `repermissao`, `descadastro`, `bounce`, `reclamacao`.

**P2. Semântica.** `legitimo_interesse` recebe (base legada com relação comercial existente). `optin` recebe e tem consentimento explícito registrado. `descadastrado` e `invalido` **nunca** recebem, e a transição para esses dois é irreversível por UI: só a própria pessoa, via novo opt-in, pode sair de `descadastrado`.

**P3. Quem escreve.** Webhook do Resend escreve `descadastrado` (evento de unsubscribe), `invalido` (bounce hard) e `descadastrado` (reclamação de spam). O back-office escreve `optin` (fluxo de re-permissão) e pode corrigir `invalido` para `legitimo_interesse` quando a operadora conserta o email na ficha. O sync de ClickMassa e Iddas **nunca** toca estas três colunas.

**P4. Prova.** Toda transição grava `status_em` e `status_origem`. O histórico completo vive em `campanha_eventos` (bloco V) mais o log de auditoria (E6). Não existe tabela de histórico de consentimento em v1: as duas fontes acima cobrem quem, quando e por quê.

**P5. Base legal.** O primeiro disparo real depende de aprovação de Nina e Julia sobre legítimo interesse. Isso bloqueia envio, não implementação. Quando aprovado, a decisão entra no DECISION_LOG e o texto do rodapé reflete a base usada.

---

## Bloco G. Grupos

**G1. Duas tabelas novas:** `grupos` (id, nome, descricao, resend_segment_id, criado_em, atualizado_em) e `grupo_contatos` (grupo_id, contact_id, adicionado_em), com PK composta e FK `ON DELETE CASCADE` nas duas pontas.

**G2. Grupo é estático e humano.** Conjunto explícito de contatos, curado pela operadora. Não existe grupo dinâmico por regra em v1.

**G3. Seleção múltipla manual É a construção de grupo,** não um terceiro modo de público. Enviar para um conjunto avulso exige criar grupo. Motivo: seleção solta por campanha jogaria fora o mesmo trabalho manual todo mês.

**G4. Nasce vazio.** Nenhum grupo é semeado por regra automática. Segmentação por tag está fora de v1 porque a maior tag entre contatos com email alcança 17 pessoas (medido).

**G5. Grupo é vivo, destinatário é congelado.** Alterar um grupo depois do envio não altera nenhum registro de campanha já enviada.

---

## Bloco C. Campanha

**C1. Tabela `campanhas`,** campos mínimos: `id`, `nome_interno`, `tipo` (CHECK: `newsletter`, `anuncio`, `saida_grupo`), `assunto`, `titulo`, `intro`, `corpo`, `cta_texto`, `cta_link`, `nota_rodape`, `imagem_path`, `imagem_alt`, `estado`, `conteudo_hash`, `publico_tipo`, `grupo_id`, `testado_em`, `testado_hash`, `agendado_para`, `enviado_em`, `resend_broadcast_id`, `criado_por`, `created_at`, `updated_at`.

**C2. Estados.** CHECK em `rascunho`, `testada`, `agendada`, `enviada`. Transições permitidas: rascunho→testada, testada→agendada, testada→enviada, agendada→testada (cancelar agendamento), agendada→enviada. Nenhuma transição sai de `enviada`.

**C3. Público.** `publico_tipo` CHECK em `todos_elegiveis` e `grupo`. Quando `grupo`, `grupo_id` é obrigatório; quando `todos_elegiveis`, é nulo.

**C4. Hash de conteúdo.** `conteudo_hash` é calculado no servidor sobre os campos de conteúdo (assunto, titulo, intro, corpo, cta_texto, cta_link, nota_rodape, imagem_path, imagem_alt). Salvar rascunho recalcula. Se `conteudo_hash <> testado_hash`, o estado volta a `rascunho` e o envio fica travado. A regra roda no servidor, não na tela.

**C5. Imutabilidade.** Depois de `enviada`, conteúdo, público e hash são imutáveis. A garantia é do servidor (a server action recusa), não da UI.

---

## Bloco E. Envio

**E1. Elegibilidade tem definição única,** materializada como view `contatos_elegiveis_email`: `status = 'ativo'` AND `email` não nulo e não vazio AND `email_marketing_status NOT IN ('descadastrado','invalido')`. UI e envio leem a mesma view. Nenhuma tela reimplementa o filtro.

**E2. Elegibilidade sempre por cima do público.** Contato dentro de um grupo que não passa em E1 não recebe. A tela mostra a contagem excluída por motivo; o servidor exclui mesmo se a tela mandar o contrário.

**E3. Recontagem no envio.** O número que vale é resolvido no instante do envio, não no da seleção. Se a contagem mudou desde a revisão, a operadora reconfirma.

**E4. Congelamento.** Tabela `campanha_destinatarios` (campanha_id, contact_id, email, nome, enviado_em), append-only, um registro por pessoa, gravada no envio. `email` e `nome` são cópia literal do momento do envio, não FK de leitura: mudar o email do contato depois não reescreve o que foi enviado.

**E5. Idempotência.** Campanha em `enviada` não envia de novo. A trava é no servidor, por estado mais chave de idempotência no request pro Resend.

**E6. Auditoria.** Toda transição de estado grava operador, timestamp, estado anterior, estado novo, e no envio também a contagem resolvida e as exclusões por motivo. Sem essa linha não existe prova de nada.

**E7. Checagens que bloqueiam o envio** (todas no servidor): assunto vazio, corpo vazio, `cta_link` malformado, `imagem_alt` vazio quando existe imagem, ausência do token de descadastro no corpo montado, e `conteudo_hash <> testado_hash`.

**E8. Teste é pré-requisito.** Envio real só libera com `testado_hash` igual ao `conteudo_hash` atual.

---

## Bloco R. Resend

**R1. Broadcast exige segmento.** Verificado na doc oficial: `broadcasts.create` recebe `segmentId`; Audiences está deprecado com retrocompatibilidade; não existe envio para array avulso de destinatários. Consequência: todo público precisa existir como Segment no Resend antes do envio.

**R2. Mapeamento.** Contato do CRM → Resend Contact, correspondência por email. Grupo → Resend Segment persistente, id guardado em `grupos.resend_segment_id`. `todos_elegiveis` → um Segment reservado, mantido por nós.

**R3. Vínculo de identidade externa** vai em `contact_external_links` com `provider = 'resend'`, reusando a tabela que já existe. Nenhuma coluna nova em `contacts` para isso.

**R4. Sincronização é unidirecional e sob demanda.** Back-office escreve no Resend no fluxo de envio. Não existe cron de sync com Resend. Nada no Resend é fonte da verdade sobre dados de contato.

**R5. Exceção à unidirecionalidade: descadastro.** Estado de opt-out é lido do Resend antes de cada envio e refletido em `email_marketing_status`. O Resend hospeda a página de descadastro e a de preferências, então não construímos nenhuma das duas.

**R6. Sem Topics em v1.** Preferência por categoria fica fora. O modelo é descadastro global. Motivo: o default de subscription de um Topic não pode ser alterado depois de criado, e não temos categoria estabilizada para congelar.

**R7. Broadcast criado por API só é editável e enviável por API.** Nenhum fluxo depende do editor visual do Resend, coerente com a decisão de produto de que Nina e Julia nunca abrem o painel.

---

## Bloco V. Eventos e telemetria

**V1. Tabela `campanha_eventos`,** append-only: `id`, `campanha_id` (nullable), `contact_id` (nullable), `resend_email_id`, `tipo`, `ocorrido_em`, `recebido_em`, `raw_payload` jsonb. Nunca UPDATE, nunca DELETE.

**V2. Eventos consumidos** (verificados na doc oficial): `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced` (com `bounce_type` distinguindo hard de soft), `email.complained`, `email.opened`, `email.clicked`, `email.failed`. Evento desconhecido é gravado com `raw_payload` e ignorado na agregação, nunca descartado.

**V3. Borda do webhook** segue o padrão já existente em `/api/revalidate`: runtime nodejs, corpo cru, verificação de assinatura antes de qualquer parse, 401 em assinatura inválida, 500 em env ausente, lógica fora da rota. A verificação usa os headers `svix-id`, `svix-timestamp` e `svix-signature` com o helper do SDK e o secret em env.

**V4. Idempotência do webhook.** Chave de deduplicação é `resend_email_id` mais `tipo` mais `ocorrido_em`. Reentrega produz o mesmo resultado.

**V5. Supressão automática, no servidor, independente de UI.** `email.bounced` com hard → `email_marketing_status = 'invalido'`. `email.complained` → `descadastrado`. Evento de unsubscribe → `descadastrado`. Soft bounce não suprime em v1; é contado e exibido.

**V6. Métricas são derivadas, nunca colunas contadoras.** Enviados, entregues, abertos, cliques, descadastros e não entregues são agregações de `campanha_eventos` sobre `campanha_destinatarios`. Nenhum contador incremental em `contacts` nem em `campanhas`.

---

## Bloco I. Imagem no email

**I1. Bucket público novo** (`campanhas`), separado do bucket privado `anexos`. Motivo físico, não preferência: URL assinada expira e o email vive na caixa da pessoa para sempre.

**I2. Uma imagem por campanha.** Formato jpg ou png. Fora webp, por suporte irregular em cliente de email. Tamanho e largura validados no servidor, sem pipeline de processamento em v1.

**I3. `imagem_alt` é obrigatório** quando existe imagem, e a ausência bloqueia o envio (E7). Parte relevante do público lê com imagem bloqueada.

**I4. Append-only.** Imagem de campanha enviada nunca é apagada nem substituída, inclusive se a campanha for apagada. Apagar quebraria o email de quem já recebeu.

---

## Bloco X. Fora de v1, por decisão

**X1.** Segmentação por tag ou por regra dinâmica. Base insuficiente (17 pessoas na maior tag com email).
**X2.** Topics do Resend e preferência por categoria.
**X3.** Página própria de descadastro e de preferências. O Resend hospeda.
**X4.** Duplicar e excluir campanha. Nem o doc de requisitos nem o wireframe pedem.
**X5.** Campanha de re-permissão. Depende de P5. Lote seguinte.
**X6.** Seleção avulsa de destinatários por campanha (ver G3).
**X7.** Preview de dark mode e de imagem bloqueada, e alternativa em texto puro.

## Bloco D. Colunas mortas

**D1.** `contacts.campanhas_ativas` e `contacts.emails_abertos` são substituídas por `campanha_destinatarios` e por V6. Ordem obrigatória: código para de escrever primeiro (`from-form.ts` grava literais hoje, `mappers.ts` expõe patch sem caller), depois o DROP. Nunca o inverso.
**D2.** `contacts.posts_lidos` e `contacts.field_provenance` estão fora do escopo deste contrato. `field_provenance` pertence ao contrato do three-way.

## Bloco Z. Aberto, marcado como aberto

**Z1.** Não confirmei se o payload do webhook carrega o id do broadcast. Sem isso, a correlação evento→campanha depende de email do destinatário mais janela de tempo, o que é frágil. Resolve com um disparo real de teste, não com mais leitura de doc. Até resolver, `campanha_eventos.campanha_id` é nullable e a correlação é best-effort.
**Z2.** Status de DMARC do domínio não verificado. Não bloqueia implementação, bloqueia primeiro disparo.
**Z3.** Especificidades jurídicas brasileiras (prazo de atendimento de opt-out na LGPD, obrigatoriedade do endereço físico no rodapé, status vinculante da autorregulamentação) não confirmadas em fonte primária. O rodapé mantém endereço físico por precaução, custo baixo.
