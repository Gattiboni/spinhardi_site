# Plano — Back-office CRM orientado a cliente (gerencial + operacional) v1

**Projeto:** Presença Digital Spinhardi · back-office (admin)
**Stack:** Next.js 16 · TS · Tailwind v4 · Supabase Pro · arquitetura bronze/silver/gold
**Autor:** Alan (Gattiboni Enterprises) + Claudinho
**Última atualização:** 2026-06-18

---

## Princípios não-negociáveis (lembrar SEMPRE)

1. **Incrementalidade.** Nenhuma decisão pode ser impedimento óbvio para a próxima.
2. **Modularidade.** A arquitetura tem que plugar e desplugar qualquer fonte sem reescrita.
3. **Zero dívida técnica.** Sem gambiarra, sem "depois a gente resolve".
4. **Fonte-agnóstico.** Hoje em sync são Iddas + ClickMassa. Amanhã chega lead via site, Instagram, Google Ads, evento. A pessoa é canônica na silver; cada fonte é um plug, nunca o centro.
5. **Backoffice é a fonte da verdade.** Origem é só origem. A base vai ter dados em estados diferentes dependendo de onde vieram, e isso é esperado, não defeito. O Iddas e o CM são origens que a gente engole; o backoffice é o CRM refinado por cima.
6. **Merge não-destrutivo por proveniência.** Sync nunca sobrescreve cego. Cada campo sabe de onde veio e quando. A fusão aplica precedência por classe de campo (regra na Fase 2). Isso é o que faz "estados diferentes por origem" ser seguro em vez de virar lixão.

## Arquitetura (respeitada, sem furar camada)

- **Bronze** come cru. Completude é a virtude. Nada se decide aqui.
- **Silver** pole: normaliza, tipa, deduplica, resolve identidade. Modelo limpo e completo da pessoa. **Sem conta.**
- **Gold** consome pro front, em dois produtos sobre o mesmo silver:
  - **Gold gerencial** = agregação. Gráficos com drilldown até o fim do fio. Mora no Dashboard.
  - **Gold operacional** = linha a linha. Cards que acusam gap, drilldown até cadastro, espaço pra ação. Mora em Contatos. Funil aparece nas duas lentes (gráfico de estágio no Dashboard, kanban operacional em Funil).

## Loop de feedback (o que amarra os dois vieses)

Egress é **por canal, não por origem.** WhatsApp é ClickMassa, email é Resend. A origem do lead não decide por onde se fala com ele, o canal decide. Lead que veio do site, se a interação é WhatsApp, vai pelo CM igual. Por isso a Nina não corta o CM: o CM é o WhatsApp, e WhatsApp é onde fecha venda. Interagir por API direta do WhatsApp é lento e caro; o CM resolve isso e ela já paga.

No detalhe do contato, o botão de WhatsApp tem duas plumbings: lead de origem CM faz deep-link de volta pro CM; lead de outra origem é empurrado pro CM via API e interage lá. Mesmo botão. A interação por WhatsApp sempre acontece no CM.

O enriquecimento fecha o loop pelo evento de atendimento finalizado do CM (histórico da conversa): a gente captura e transforma em inserção de interação e candidato a orçamento no backoffice. Tratar o contato no CM ingere um contato mais qualificado no próximo sync, que dedupa e re-qualifica a silver, que enriquece a view gerencial. Operação alimenta gerência pelo sync. E dá à Nina uma função diária com ROI claro: a base melhora porque alguém a usa, usando o que ela já paga. Esse é o argumento que justifica manter o CM.

Guarda de zero-dívida: a interação passa pela abstração que já existe (`lib/integrations/`), nunca chamada cravada na tela. Canal novo (email via Resend, etc) entra como provider, não como reescrita.

**Resposta à pergunta da Nina** ("se eu falo sempre pelo CM, tenho que repetir no Iddas?"): NÃO mantém cadastro de cliente duplicado, o backoffice resolve via sync. O que sobra, enquanto não confirmamos escrita no Iddas, é um toque fiscal pontual no Iddas quando o lead vira venda com nota (é lá que mora o fiscal). Não é re-digitar cadastro, é registrar a venda no sistema que emite nota. Esse toque some quando a gente fechar o write-back ou usar uma integração que o próprio Iddas já tem.

## Estado real de partida (do retorno do Codinho, 18/06)

- Dashboard, Contatos, Funil, Blog já existem. Quase tudo é dado **real**.
- Único mock na tela: 3 cards Iddas do Dashboard (stub determinístico). `bronze_iddas_*` já está cheio pra matar isso.
- Botões "Abrir no Iddas / ClickMassa" existem no detalhe do contato, ambos `alert()` stub.
- **`contacts` silver tem 3 linhas.** Dashboard lê, lista varre, funil faz JOIN. Tudo depende dessa tabela quase vazia. Esse é o gargalo central.

---

# FASE 0 — Fechar o diagnóstico

**Estado de saída:** sabemos exatamente o que cada tela vai consumir e de onde, sem achismo. Critério de parada: a planilha de diff fechada para os campos que alimentam as perguntas reais de Nina (operacional) e Julia (gerencial). Não o universo de campos, só os que servem ao consumo conhecido.

- [x] Mapear estado real das 3 telas (Codinho, feito)
- [x] Confirmar MOAS como estado atual do bronze (feito)
- [ ] **Claudinho:** montar planilha de diff em 3 colunas, por campo de consumo: o que a UI da fonte mostra · o que veio em `raw_payload` · o que a coluna bronze guardou. Sinaliza cada gap como (a) já temos coluna, (b) está no raw_payload e promove quando precisar, (c) gap real de ETL, (d) é conta de gold e não falta no bronze.
- [ ] **Decisão:** lista final dos campos que entram no contrato (gerencial e operacional), com origem confirmada de cada um.

**Checkpoint 0:** planilha de diff aprovada por Alan. Nenhuma coluna do contrato sem origem real verificada.

---

# FASE 1 — Pesquisa externa (não inventar a roda)

**Estado de saída:** a gente sai do empirismo. Situação da Nina (dona de agência boutique que foge de número e quer um cockpit simples) beira o banal. Alguém já resolveu.

- [ ] **Claudinho:** escrever prompt contextualizado pro Perplexity Pro. Perguntas: como cockpits de CRM/financeiro pra PME de turismo apresentam gerencial vs operacional; que indicadores um dono não-financeiro consome sem travar; padrões de "card que vira ação" pra higiene de cadastro; referência de fonte-agnóstico em CRM multi-canal.
- [ ] **Alan:** rodar no Perplexity, trazer retorno pra mesa.
- [ ] **Decisão:** o que da pesquisa entra no contrato e o que descarta.

**Checkpoint 1:** retorno do Perplexity lido, 3 a 5 decisões anotadas.

---

# FASE 2 — Contrato de dados do front refatorado

**Estado de saída:** documento único que é o norte. Define, para cada tela e cada viés, qual o shape exato que o gold serve, lendo qual silver, com qual origem. É o reflexo das decisões das fases 0 e 1.

- [ ] **Claudinho:** escrever o contrato cobrindo:
  - [ ] Modelo canônico da pessoa na silver (fonte-agnóstico) e como cada fonte se pluga. Decidir aqui: as pontes `clickmassa_*` / `iddas_*` viram um padrão extensível de "vínculo externo" ou ficam como estão? (ponto de modularidade, decisão de Alan)
  - [ ] Regra de identidade: telefone normalizado, os 3 conjuntos (só-CM, só-Iddas, ambos), tratamento dos 19 ambíguos (PJ)
  - [ ] **Regra de merge por proveniência (o nó):** precedência por classe de campo. Financeiro/fiscal manda Iddas. Conversa/interação manda CM. Contato (nome, telefone, email) manda o mais recente verificado. Cada campo grava origem e timestamp. Sync nunca sobrescreve cego. (decisão de Alan, trava antes do Lote 1)
  - [ ] Gold gerencial: shape de cada gráfico do Dashboard + caminho de drilldown
  - [ ] Gold operacional: cards-de-gap de Contatos (quais gaps acusam), shape da lista, shape do detalhe, e as ações por canal de origem
  - [ ] Funil nas duas lentes: o que é gráfico no Dashboard, o que é kanban em Funil
- [ ] **Decisão:** Alan aprova o contrato. Vira a fonte de verdade dos lotes seguintes.

**Checkpoint 2:** contrato aprovado. Daqui pra frente, todo lote referencia uma seção dele.

---

# FASE 3 — Execução do MVP (lotes incrementais)

**Estado de saída:** painel saindo de 3 contatos pra base real, com os dois vieses entregando valor. Cada lote entrega algo usável e não quebra o anterior. Ordem pensada pra valor cedo e risco isolado.

## Lote 1 — Promoção bronze→silver (o coração)

**Não é trivial. É o lote de maior risco. Isolado de propósito.**

- [ ] **Claudinho:** prompt cirúrgico pro Codinho do job de promoção (idempotente, UPSERT)
- [ ] **Alan:** rodar dedupe por telefone, resolver os 3 conjuntos, marcar os 19 ambíguos pra revisão manual em vez de adivinhar
- [ ] **Validação:** contagem silver bate com o esperado (≈490 cruzados + só-CM + só-Iddas), zero duplicata, ambíguos sinalizados

**Checkpoint L1:** `contacts` silver populada e limpa. Lista de contatos do admin já mostra a base real sem mudar uma linha de UI.

## Lote 2 — Gold operacional: Contatos vira acionável

- [ ] **Claudinho/Codinho:** cards-de-gap no topo de Contatos (ex: "leads sem email", "sem origem", "sem CPF") lendo a silver
- [ ] Card clica → lista filtrada → detalhe → ação
- [ ] **Interação por canal**, pela abstração `lib/integrations/`: WhatsApp sempre via CM (lead de origem CM faz deep-link; lead de outra origem é empurrado pro CM via API e interage lá). Mesmo botão, duas plumbings. Mata os `alert()` stub.
- [ ] Botão "abrir na origem" forma URL real (CM hoje; outros canais entram como provider, nunca chamada cravada)
- [ ] **Ponte de enriquecimento (pode ficar pro fim do lote ou Lote 5):** capturar o evento de atendimento finalizado do CM e transformar em inserção de interação + candidato a orçamento no backoffice

**Checkpoint L2:** Nina abre Contatos como cockpit, vê os buracos como tarefa, e o botão a leva direto pra interação no CM sem caçar o contato. Cada interação enriquece a base pro próximo sync.

## Lote 3 — Gold gerencial: Dashboard com gráficos + drilldown

- [ ] Matar o mock Iddas: 3 cards passam a ler `bronze_iddas_*` real (faturamento, vendas, ticket médio)
- [ ] Gráficos gerenciais lendo o agregado que já temos: states/origins/tags/recency do `contacts-dashboard` CM + financeiro Iddas
- [ ] Drilldown do gráfico desemboca na lista operacional de Contatos (o fio atravessa, não quebra)
- [ ] Funil como gráfico de estágio no Dashboard (conversão "cotei X vendi Y")

**Checkpoint L3:** Dashboard sem nenhum mock. Julia vê o financeiro, Nina vê os 5 números que tranquilizam, drilldown leva ao cliente.

## Lote 4 — Funil operacional revisado

- [ ] Confirmar se o kanban atual (`/funil`, Lote G.1) já serve como fila operacional ou precisa de ajuste
- [ ] Resolver o bloqueador do módulo Opportunities do ClickMassa (ação admin de Nina/Julia) antes de merge do `feature/lote-g1-funil`

**Checkpoint L4:** kanban operacional limpo, sem mistura com gerencial.

## Riscos e dependências (não presumir)

- **Dependência do ClickMassa.** O loop de interação assume CM ativo. Nina e Julia cogitaram cancelar o CM em 16/06 (decisão em aberto). Contraponto que vira argumento de venda: este painel é o ROI que justifica manter o CM. Decisão de negócio de Nina, registrar antes de cravar o egress.
- **Escrita de volta no Iddas não confirmada.** O loop "CM enriquece → sync → Iddas recebe mais rico (orçamento, etapa)" depende de a API do Iddas aceitar escrita. Só validamos leitura. Confirmar antes de prometer o loop completo. Leitura Iddas → banco → gerencial está sólida; escrita banco → Iddas é o elo não testado.
- **Módulo Opportunities do CM** segue em 404 até ativação no admin (Nina/Julia). Bloqueia o Lote 4 e o merge de `feature/lote-g1-funil`.

---

# Fora do MVP (registrado, não esquecido)

- [ ] Sync recorrente Iddas + ClickMassa (polling via Make, Iddas re-auth 12h)
- [ ] Ingestão de lead novo por canal (site, Insta, Google) no mesmo modelo canônico
- [ ] Auth real do back-office (D030)
- [ ] Webhook ClickMassa `FinishedTicketHistoricMessages` (Lote I)
- [ ] Looker Studio

---

## Regra de ouro de cada decisão deste plano

Antes de fechar qualquer lote, três perguntas:
1. Isso impede o próximo passo? (incrementalidade)
2. Isso amarra a arquitetura a uma fonte específica? (modularidade / fonte-agnóstico)
3. Isso deixa gambiarra pra trás? (zero dívida)

Se qualquer resposta for sim, não fecha.
