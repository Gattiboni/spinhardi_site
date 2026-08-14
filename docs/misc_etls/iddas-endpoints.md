# Iddas Agência — Exploração de Endpoints (Turno A, 2026-06-18)

## 1. Autenticação

### Resultado: Caminho B venceu — `POST /api/v1/auth/login` com body `{ chave }`

**Caminho A falhou:** `GET /api/v1/situacao` com `Authorization: Bearer {IDDAS_API_KEY}` → **401 Unauthorized**.  
A `IDDAS_API_KEY` é uma credencial de login, não um Bearer token pronto.

**Caminho B — variações testadas:**

| body | resultado |
|------|-----------|
| `{ "key": "..." }` | 400 |
| `{ "token": "..." }` | 400 |
| `{ "apiKey": "..." }` | 400 |
| `{ "chave": "..." }` | **200 ✓** |

**Resposta do login (shape completo):**
```json
{
  "success": true,
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 43200
}
```

**Token JWT — payload decodificado:**
```json
{
  "iss": "https://agencia.iddas.com.br",
  "iat": 1781798775,
  "exp": 1781841975,
  "user_id": "6713"
}
```

- Emitido: 2026-06-18 16:06:15 UTC
- Expira: 2026-06-19 04:06:15 UTC
- **Validade: 12 horas**
- Sem claim de tenant/empresa (user_id fixo associado à agência)
- **Sem refresh token** — requer re-autenticação a cada 12h
- Header de uso: `Authorization: Bearer {access_token}`
- Sem header de expiração na resposta HTTP

---

## 2. Mapeamento dos 27 Recursos (GET de lista)

**Formato universal:** `{ "success": true, "data": [...], "meta": { "page": N, "per_page": 10, "total": N, "next": "...", "previous": "..." } }`

Paginação via query param `?page=N`. Page size padrão: **10**. Testado e confirmado: `?page=2` retorna próximo lote.

| recurso | status | tem dados | qtd (pg 1) | total real | é paginado | campos-chave |
|---------|--------|-----------|------------|------------|------------|--------------|
| `aeroporto` | 200 | sim | 10 | **4564** | sim | id, nome |
| `canal` | 200 | sim | 9 | 9 | não | id, nome |
| `cartao` | 200 | sim | 7 | 7 | não | id, descricao, digitos, fechamento, vencimento, limite |
| `categoriareceitasdespesas` | 200 | sim | 10 | **30** | sim | id, nome, tipo, ativo |
| `companhia` | 200 | sim | 10 | **1018** | sim | id, nome |
| `conta` | 200 | sim | 2 | 2 | não | id, nome, saldo_inicial, agencia, numero_conta |
| `cruzeiro` | 200 | sim | 6 | 6 | não | id, **id_orcamento**, identificador_orcamento, nome, embarque, desembarque, tipo_cabine, data_entrada, data_saida, localizador, cliente |
| `despesa` | 200 | sim | 10 | **327** | sim | id, (campos financeiros) |
| `etiqueta` | 200 | sim | 10 | 20 | sim | id, nome, cor |
| `forma` | 200 | **NÃO** | 0 | **0** | n/a | (sem dados — recurso vazio) |
| `hospedagem` | 200 | sim | 10 | **109** | sim | id, **id_orcamento**, identificador_orcamento, nome, data_entrada, data_saida, localizador |
| `infosolicitacao` | 200 | sim | 3 | 3 | não | nome, campo, tipo, opcoes, obrigatorio (config de campos do form público) |
| `motivoreprovacao` | 200 | sim | 8 | 8 | não | id, nome, ativo |
| `orcamento` | 200 | sim | 10 | **614** | sim | id, titulo, identificador, situacao, nome_situacao, **cliente** (pessoa.id), **canal_venda**, **usuario**, passageiros_*, valor, data_orcamento, voos[], hospedagem[], transporte[], cruzeiro[], seguro[], roteiro[] — **`etiquetas[]` NÃO vem na lista**, só no detalhe `GET /orcamento/{id}` (medido pela sonda `scripts/sonda-iddas-etiquetas.ts`, 13/08/2026: etiquetas tipo C, 470 aplicações) |
| `passeio` | 200 | **NÃO** | 0 | **0** | n/a | (sem dados — recurso vazio) |
| `pessoa` | 200 | sim | 10 | **838** | sim | id, nome, nascimento, sexo, tipo_cliente, celular, email, cpf_cnpj, rg, passaporte, canal_venda, familia[], created_at |
| `produtoservico` | 200 | **NÃO** | 0 | **0** | n/a | (sem dados — recurso vazio) |
| `receita` | 200 | sim | 10 | **441** | sim | id, (campos financeiros) |
| `roteiro` | 200 | **NÃO** | 0 | **0** | n/a | (sem dados — recurso vazio) |
| `seguro` | 200 | sim | 3 | 3 | não | id, **id_orcamento**, identificador_orcamento, nome, inicio_vigencia, fim_vigencia, localizador, cliente |
| `situacao` | 200 | sim | 8 | 8 | não | id, nome, cor, codigo, ordem, situacao_final, situacao_padrao |
| `solicitacao` | 200 | sim | 9 | 9 | não | id, identificador, nome, email, telefone, origem, destino, data_ida, data_volta, adultos, criancas, bagagem_despachada, possui_flexibilidade, adicional[], data_solicitacao |
| `tarefa` | 200 | sim | 10 | **629** | sim | id, (campos de tarefa) |
| `transporte` | 200 | sim | 10 | 11 | sim | id, **id_orcamento**, e outros |
| `usuario` | 200 | sim | 4 | 4 | não | id, nome, situacao, email |
| `venda` | 200 | sim | 10 | **208** | sim | id, cliente (string nome), **id_orcamento**, data, orcado, custo, venda, lucro, situacao, status_pagamento |
| `voo` | 200 | sim | 10 | **387** | sim | id, (campos de voo) |

**Resumo:** 27/27 retornaram 200. 23 têm dados, 4 estão vazios (forma, passeio, produtoservico, roteiro).

---

## 3. Relacionamentos Inferidos (OURO para DDL)

```
solicitacao ──→ (lead de entrada, não tem FK para pessoa — é pre-cadastro)

orcamento.cliente         ──FK──→ pessoa.id
orcamento.canal_venda     ──FK──→ canal.id
orcamento.usuario         ──FK──→ usuario.id
orcamento.situacao (code) ──FK──→ situacao.codigo  (ATENÇÃO: é o campo "codigo", não "id"!)
orcamento.etiquetas[]     ──embed──→ etiqueta.id   (só no DETALHE /orcamento/{id}, não na lista)

venda.id_orcamento        ──FK──→ orcamento.id
cruzeiro.id_orcamento     ──FK──→ orcamento.id
hospedagem.id_orcamento   ──FK──→ orcamento.id
seguro.id_orcamento       ──FK──→ orcamento.id
transporte.id_orcamento   ──FK──→ orcamento.id

receita / despesa         ──provável FK──→ conta.id + categoriareceitasdespesas.id
tarefa                    ──provável FK──→ orcamento.id e/ou pessoa.id
```

**Fluxo de negócio implícito:**
```
solicitacao (lead público) → orcamento (cotação) → venda (venda fechada)
                              ↓ sub-recursos embedded no orcamento:
                              voos[], hospedagem[], cruzeiro[], seguro[], transporte[], roteiro[]
```

**IMPORTANTE — IDs são strings:** todos os IDs retornados pela API são strings JSON mesmo quando são números inteiros (ex: `"id": "894558"`, `"cliente": "552991"`). Na bronze layer, mapear como `text`, não `bigint`.

---

## 4. Quirks e Bandeiras

### Quirk 1 — URL interna com `index.php` nos links de paginação
O campo `meta.next` retorna a URL interna da aplicação:
```
"next": "https://agencia.iddas.com.br/index.php/api/v1/forma"
```
Mas a URL pública correta é:
```
https://apiagencia.iddas.com.br/api/v1/forma
```
**Não usar `meta.next` para navegação.** Construir a URL manualmente com `?page=N+1`.

### Quirk 2 — `meta.next` não é null quando `total = 0`
Os 4 recursos vazios (forma, passeio, produtoservico, roteiro) retornam:
```json
{ "data": [], "meta": { "total": 0, "next": "https://agencia.iddas.com.br/index.php/api/v1/forma" } }
```
`next` deveria ser `null` quando não há dados. O backfill deve checar `total` antes de paginar.

### Quirk 3 — Formatos de data inconsistentes
Três formatos diferentes no mesmo sistema:

| campo | recurso | formato |
|-------|---------|---------|
| `data_orcamento` | orcamento | `yyyy-MM-dd` |
| `data_solicitacao` | solicitacao | `yyyy-MM-dd HH:mm:ss` |
| `data` | venda | `dd/MM/yyyy` |
| `nascimento`, `emissao_passaporte` | pessoa | `0000-00-00` quando vazio |
| `created_at` | maioria | `yyyy-MM-dd HH:mm:ss` |

O mapper bronze deve normalizar `0000-00-00` → `NULL` e `dd/MM/yyyy` → ISO antes de inserir.

### Quirk 4 — Floating point em `venda.venda`
```json
"venda": 0.010000000000000000208166817117216851329...
```
Valores monetários na `venda` são `double` com artefato de ponto flutuante. Usar `numeric(15,2)` no Postgres e arredondar no mapper.

### Quirk 5 — `venda.cliente` é string de nome, não ID
Ao contrário de `orcamento.cliente` (que é `pessoa.id`), `venda.cliente` contém o nome completo do cliente como string denormalizada. Não é uma FK. Para vincular venda → pessoa, precisa ir via `venda.id_orcamento → orcamento.cliente → pessoa.id`.

### Quirk 6 — Token sem refresh, 12h de validade
Sem endpoint de refresh ou `refresh_token` na resposta de login. O pipeline de backfill/sync deve re-autenticar via `POST /api/v1/auth/login` quando o token expirar (checar header `401` ou `exp` do JWT antes de cada batch).

### Quirk 7 — `orcamento.situacao` é código, não ID
O campo `situacao` em orcamento retorna um código string (`"R"` = Reprovado, `"nome_situacao"` é desnormalizado junto). O recurso `situacao` tem campos `id`, `nome`, `cor`, **`codigo`**, `ordem`. A FK é `orcamento.situacao → situacao.codigo`, não `situacao.id`.

### Quirk 8 — `infosolicitacao` é configuração, não dados de negócio
Retorna 3 registros que definem os campos do formulário público de solicitação (não são solicitações em si). Shape diferente dos outros: `{ nome, campo, tipo, opcoes, obrigatorio }`. Não tem `id`. Provavelmente não entra na bronze layer.

---

## 5. Volumes e Escala

| recurso | total registros |
|---------|----------------|
| aeroporto | 4.564 |
| companhia | 1.018 |
| pessoa | 838 |
| tarefa | 629 |
| orcamento | 614 |
| receita | 441 |
| voo | 387 |
| despesa | 327 |
| venda | 208 |
| hospedagem | 109 |
| categoriareceitasdespesas | 30 |
| etiqueta | 20 |
| transporte | 11 |
| solicitacao | 9 |
| canal | 9 |
| motivoreprovacao | 8 |
| situacao | 8 |
| cartao | 7 |
| cruzeiro | 6 |
| seguro | 3 |
| infosolicitacao | 3 |
| conta | 2 |
| usuario | 4 |
| forma | **0** |
| passeio | **0** |
| produtoservico | **0** |
| roteiro | **0** |

Backfill inicial estimado: ~9.000 registros úteis de negócio + 4.564 aeroportos (referência) + 1.018 companhias (referência).

---

## 6. Samples Capturados

Todos em `docs/samples/iddas/`, dados PII anonimizados com `<redacted-*>`:

- [pessoa-sample.json](samples/iddas/pessoa-sample.json) — 34 campos, inclui tipo_cliente, familia[], flags aceita_comunicacao
- [orcamento-sample.json](samples/iddas/orcamento-sample.json) — 37 campos + arrays embedded (voos, hospedagem, cruzeiro, etc.)
- [venda-sample.json](samples/iddas/venda-sample.json) — 14 campos financeiros, cliente como string nome
- [solicitacao-sample.json](samples/iddas/solicitacao-sample.json) — 15 campos, lead público pré-orcamento
