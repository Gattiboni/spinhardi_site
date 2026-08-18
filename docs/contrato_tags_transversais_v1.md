# Contrato — Tags Transversais v1

**Status:** CONGELADO em 18/08/2026 · **Decisor:** Alan · **Insumo:** `docs/investigacao_tags_transversais_alpha.md` (fase α, evidência por path e query)

Este contrato define tag interna como conceito transversal do back-office: criada no ponto de uso por qualquer operadora aprovada, aplicada a contato, filtrável em Jornadas, Contatos e Calendário. Gestão (renomear, excluir) separada da aplicação, no modelo ClickUp.

---

## T1. Escopo e vocabulários

- **Tag interna** (`contacts.tags` text[] de slugs + catálogo `tags`): o objeto deste contrato. Escritora única segue sendo a operadora via UI (D091 intacto).
- **Tag ClickMassa** (`clickmassa_tags_id`): read-only, intocada.
- **Etiqueta Iddas:** FORA deste lote por decisão (18/08). É vocabulário de orçamento/jornada, não de contato; a receita de ingestão (12 chamadas) está pronta e vira o lote seguinte. Nada neste contrato pode bloqueá-la — a frente E da investigação confirmou que não bloqueia.
- **Jornadas ↔ Calendário** (`tarefas_jornada` fora da RPC, `meta.jornada_id` sem consumidor, deep-link): FORA, contrato próprio futuro. O mapa está na frente F da investigação.

## T2. Permissões

- **Criar tag:** qualquer sessão aprovada (`requireSession()`). Criação é operacional, não pode depender de admin.
- **Editar (nome/cor/grupo/ativa) e excluir do catálogo:** admin (`requireRole("admin")`), como hoje. Exclusão não tem desfazer nem cascata.

## T3. Ciclo de vida da tag

- **Slug** é a identidade gravada no contato; estável sob rename (regra existente mantida). Normalização de slug passa a ter UMA implementação canônica exportada de `lib/tags/shared.ts`; Configurações importa dela (mata a duplicação `slugify`/`preverSlug`).
- **Criação** devolve a tag criada (`{id, name, slug, cor}`) — fim do prever-slug no chamador.
- **Cor:** paleta fixa ancorada na identidade (navy `#1A2B4A`, ouro `#AD8330`, verde-pinheiro `#3F5B30` + tons derivados), definida em `lib/tags/shared.ts`, contraste ≥ 4,5:1 no formato de badge vazada. Criação inline usa a paleta (cicla ou primeira livre); o color picker livre continua só em Configurações. Hexes finais aprovados pelo Alan na validação visual.
- **Tag órfã** (slug sem catálogo): comportamento atual mantido — badge cinza, nunca some, ✕ pra remover na ficha, recusada em nova escrita.
- **Tag desativada:** no editor da ficha passa a aparecer no bloco "Fora do catálogo" com ✕, igual à órfã. Desarma o impasse do save travado (achado §A.2 da investigação). A regra pura `validarTagsInternas` não muda.
- **Exclusão do catálogo:** sem cascata (estado atual). Órfãos são aceitáveis e tratados.
- **Escritor latente fechado:** `contactPatchToRow` deixa de aceitar `tags` no patch; toda escrita passa por `lib/tags`.

## T4. Superfícies

| Tela | Aplicar/remover | Criar inline | Gerenciar (rename/cor/excluir) | Filtro por tag |
|---|---|---|---|---|
| Ficha do contato | sim (existente) | **sim (novo)** | **sim (novo)** — modal admin-only reusando `TagRow` extraído | n/a |
| Lista de contatos | sim (ações em massa, existente) | sim (existente, passa a usar a action nova) | não | sim (existente, inalterado) |
| Kanban Jornadas | **sim (novo)** — ícone no card, popover | **sim (novo)** — no mesmo popover | não | **sim (novo)** |
| Calendário | não | não | não | **sim (novo)** |

- Kanban: a tag aplicada no card é do CONTATO; microtexto no popover avisa ("vale pro contato, não só pra esta jornada").
- Modal "Gerenciar tags": `TagRow` extraído de Configurações pra `components/admin/`, `confirm()` nativo substituído pelo `Modal variant="destrutiva"` do padrão da casa.

## T5. Filtros — semântica

- **Kanban:** select de UMA tag, predicado client-side sobre `jornada.tagsInternas` (slugs já no payload; 614 cards). Estado local.
- **Calendário:** select de UMA tag; vocabulário via mapa `contactId → slugs` carregado em paralelo pela page (mesmo padrão do kanban, `getTagsPorContato`); predicado no `useMemo` de `eventosVisiveis`. **Filtro ativo ESCONDE evento sem contato e evento cujo contato não tem a tag** (estrito, decisão de 18/08 — "menos é mais"). Estado ativo do filtro sempre visível na UI; desligou, volta tudo. Persistência: entra em `Prefs`/localStorage (retrocompatível por construção do `decodificarPrefs`). URL fica de fora.
- **Lista de contatos:** os dois selects existentes ficam como estão.
- RPC `calendar_events_between` e `gold_kanban_jornadas` NÃO mudam. Zero migration neste lote.

## T6. Revalidação

- Escrita de tag via kanban revalida também `/admin/jornadas` (linha adicionada em `aplicarTagEmMassa`).
- `createTag`/`updateTag`/`deleteTag` revalidam `/admin/configuracoes`, `/admin/contatos`, `/admin/contatos/[id]` e `/admin/jornadas`.

## T7. Correções que entram por zero dívida

- Mensagem de erro de criação corrigida: a colisão é de SLUG, não de nome (achado #4).
- Cor default divergente eliminada pela paleta (achado #2).

## T8. Pontos de extensão nomeados (NÃO implementar)

- `p_tags text[]` como parâmetro futuro de `calendar_events_between` e `gold_kanban_jornadas` (quando houver paginação server-side; exige DROP FUNCTION).
- `?tag=` na URL do calendário (deep-link).
- `tags.iddas_etiqueta_id` no molde da ponte dormente `clickmassa_tag_id` (lote das etiquetas Iddas).
- Filtro por tag no dash (citado pelo Alan como "depois").

## T9. Emendas de papelada (final do lote)

- `contrato_dados_backoffice_v1.md`: emendar a seção `contact_tags (A CRIAR)`, substituída por D091 (DIV-3).
- `contrato_calendario_v1.md` C5.4: 4 admin + 4 editor (DIV-4).
