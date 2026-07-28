# Contrato de Dados — Ficha, Documentos e Comunicação v1

Data: 2026-07-27
Status: congelado
Escopo: newsletter via Resend, link WhatsApp→ClickMassa, documentos de clientes, edição na ficha e política de merge com as origens.
Relação com o Contrato de Dados do Back-office v1 (`contrato_dados_backoffice_v1.md`): complementa. Onde houver conflito na política de preenchimento (fill-null), ESTE contrato prevalece (ver M6).

---

## N — Newsletter via Resend

**N1.** O envio de campanhas de email acontece pelo back-office, usando a Resend Broadcasts API. Nina e Julia não operam o painel do Resend.

**N2.** Fonte única de destinatários: `contacts` (silver). Elegível para campanha: `status = 'ativo'` E `email IS NOT NULL`. Contatos `arquivado`, `duplicado` e `anonimizado_lgpd` nunca recebem campanha.

**N3.** Sincronização back-office → Resend Contacts/Segments é unidirecional de saída, disparada no fluxo de envio (não em cron). O Resend não é fonte de dados cadastrais.

**N4.** Unsubscribe é honrado: o estado de opt-out registrado no Resend é lido antes de cada envio e refletido no back-office (campo a definir na implementação). Contato com opt-out não recebe campanha por nenhum caminho.

**N5. Pendência de negócio:** base importada (Iddas/CM) não tem opt-in explícito de email marketing. Definição LGPD (enviar para base legada ou só opt-in novo) é decisão de Alan/Nina/Julia ANTES do primeiro disparo real. O contrato não presume.

Requisitos funcionais e UI: `docs/campanhas_email_requisitos_v1.md` (inalterado).

---

## W — WhatsApp aponta para o ClickMassa

**W1.** Todo ponto de interação de WhatsApp na FICHA do contato abre o perfil do contato no painel do ClickMassa (`{PANEL_URL}/#/contact/{clickmassa_contact_id}/perfil`, helper `clickmassaContactUrl()`). Nenhum `wa.me` sobrevive na ficha.

**W2.** Condição de renderização: o link só existe se o contato tem `clickmassa_contact_id` E a env `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` está setada. Sem os dois, o elemento não renderiza como link (número aparece como texto).

**W3.** A LISTA de contatos permanece sem link de WhatsApp (decisão anterior por risco de ban da Meta, mantida).

**W4.** Pré-requisito operacional: Alan seta `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` na Vercel e no `.env.local`.

---

## D — Documentos de clientes

**D1.** O Iddas continua sendo o que é. Não há importação de documentos do Iddas: 651/651 orçamentos sem anexo, telas de Documentos sem endpoint público, sem evidência de uso organizado. Cláusula revisitável se o uso do Iddas mudar.

**D2.** Documento de cliente nasce e mora no back-office: `AnexosBlock` da ficha + bucket privado `anexos` (Supabase Storage) + tabela `anexos` (FK contacts, CASCADE). Upload, visualização (URL assinada) e exclusão pela ficha. Fonte da verdade.

**D3.** Link "Ver no Iddas" por contato: implementado e DORMENTE. Renderiza desabilitado com tooltip "aguardando mudança de acesso dev". Liga quando o padrão de URL de edição de pessoa for confirmado (depende de elevação do acesso de branding@amandagattiboni.com no Iddas). `iddasPessoaUrl()` é o ponto único de ativação.

**D4.** Horizonte registrado (fora deste contrato): cotação e funções operacionais nativas no back-office, eliminando a necessidade de abrir o Iddas no dia a dia.

---

## M — Edição na ficha e merge com as origens

**M1.** A ficha do contato passa a permitir edição dos campos cadastrais: nome, whatsapp, email, cpf, data de nascimento, cidade, estado, cep (mesma server action da lista, estendida). Campos de Qualificação (origem, destino, prazo, orçamento, perfil, passageiros) são internos do back-office: editáveis livremente, o sync nunca os toca.

**M2. Política de merge three-way, por campo.** Para cada link contato↔origem, `contact_external_links.last_synced_values` (jsonb) guarda o último valor que o sync aplicou de cada campo mapeado. A cada sync, campo a campo:
- `bronze ≠ last_synced` → a origem mudou → sobrescreve o contato e atualiza `last_synced`. Última edição da origem vence.
- `bronze = last_synced` → a origem não mudou → o sync não toca. Última edição humana permanece.

Resultado: o contato reflete sempre o último estado, humano ou da origem, por campo.

**M3.** Mudança para vazio na origem também é mudança: se a origem apagou um valor, o apagamento propaga. Coerente com "último estado sempre".

**M4.** Campos cobertos pelo three-way (os que o sync atualiza hoje): email, cidade, estado, cep, data_nascimento, cpf. `name` e `whatsapp` continuam fora do update do sync em contato existente (sync só os define na criação); edição humana deles nunca é revertida.

**M5.** Precedência entre origens: cada origem só escreve quando ELA mudou. Se Iddas e CM mudarem o mesmo campo no mesmo ciclo, vence a que rodar por último no ciclo (ordem atual: Iddas, depois CM). Conflito esperado: raro.

**M6.** O fill-null do Contrato v1 morre, substituído por M2. Efeito colateral desejado: email apagado por humano deixa de ressuscitar.

**M7. Migração (seed).** Primeira execução pós-mudança: para links existentes, `last_synced_values` é semeado com os valores ATUAIS da bronze SEM aplicar nada no contato. Nenhuma edição humana feita até aqui (incl. revisão da Nina) é sobrescrita no seed. O three-way passa a valer do ciclo seguinte em diante.

---

## Pendências consolidadas
1. LGPD/opt-in da newsletter (N5) — Alan/Nina/Julia
2. URL de edição de pessoa no Iddas (D3) — depende de acesso dev
3. `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` (W4) — Alan
