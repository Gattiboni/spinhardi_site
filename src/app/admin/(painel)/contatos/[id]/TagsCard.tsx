"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import TagRow from "@/components/admin/TagRow";
import { TagClickMassaBadge, TagInternaBadge, TagsOrfasCm } from "@/components/admin/TagBadge";
import {
  resolverTagsClickMassa,
  resolverTagsInternas,
  situacaoDaTag,
  validarTagsInternas,
  type TagClickMassa,
  type TagInterna,
} from "@/lib/tags/shared";
import { criarTagInline } from "@/lib/tags/actions";
import { salvarTagsInternas } from "./actions";

/**
 * Bloco de tags da ficha — DOIS blocos rotulados, como o contrato manda (T8).
 *
 *  • "Tags do ClickMassa": READ-ONLY. Badge com a cor do catálogo do CM. Vazio
 *    é explícito ("nenhuma"), não uma área em branco. Id órfão vira contagem,
 *    nunca número cru na tela (T3 do contrato de tags de 07/2026).
 *  • "Tags internas": editável no padrão Editar → Salvar/Cancelar dos outros
 *    cards da ficha. Escreve `contacts.tags` por substituição integral.
 *
 * A validação que roda no clique é a MESMA do servidor (`lib/tags/shared`) —
 * aqui ela só evita uma ida ao servidor pra ouvir "não".
 *
 * O QUE O CONTRATO DE TAGS TRANSVERSAIS v1 TROUXE PRA CÁ:
 *
 *  1. CRIAÇÃO INLINE (T4). Antes a ficha só sabia mandar a operadora pra
 *     Configurações quando faltava uma tag. Agora cria aqui, via
 *     `criarTagInline` — sessão aprovada basta, e a tag volta na resposta, então
 *     ela já entra MARCADA sem esperar o `router.refresh()` trazer o catálogo.
 *  2. TAG DESATIVADA SAI PELO ✕ (T3). O bloco "Fora do catálogo" listava só
 *     órfãs. Uma tag desativada mas ainda catalogada não tinha botão pra sair e
 *     era recusada por `validarTagsInternas` — o save da ficha inteira travava,
 *     sem caminho de saída pela UI. As duas situações agora dividem o bloco.
 *  3. GERENCIAR TAGS (T4), admin. Renomear, recolorir e excluir do catálogo sem
 *     sair da ficha, reusando a MESMA linha de Configurações.
 *
 * Sem carimbo de edição próprio: a folha não pede coluna nova pra tag e
 * `updated_at` já registra "mexeram neste contato".
 */
export default function TagsCard({
  contactId,
  tagsInternas,
  clickmassaTagsId,
  catalogoInterno,
  catalogoClickmassa,
  ehAdmin,
}: {
  contactId: string;
  tagsInternas: string[];
  clickmassaTagsId: number[];
  catalogoInterno: TagInterna[];
  catalogoClickmassa: TagClickMassa[];
  /** Só admin vê "Gerenciar tags" — `updateTag`/`deleteTag` exigem admin (T2). */
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editando, setEditando] = useState(false);
  const [escolhidas, setEscolhidas] = useState<string[]>(tagsInternas);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novaTag, setNovaTag] = useState("");
  const [criando, setCriando] = useState(false);
  const [gerenciando, setGerenciando] = useState(false);
  // Criadas nesta sessão de edição: o catálogo da prop só chega na próxima
  // árvore do servidor, e até lá a tag recém-criada precisa existir na tela.
  const [criadasAgora, setCriadasAgora] = useState<TagInterna[]>([]);

  const catalogo = [
    ...catalogoInterno,
    ...criadasAgora.filter((nova) => !catalogoInterno.some((t) => t.slug === nova.slug)),
  ];

  const cm = resolverTagsClickMassa(clickmassaTagsId, catalogoClickmassa);
  const internas = resolverTagsInternas(editando ? escolhidas : tagsInternas, catalogo);
  const disponiveis = catalogo.filter((t) => t.isActive);

  // Órfã e inativa dividem o bloco "Fora do catálogo": as duas são recusadas na
  // escrita, e as duas precisam do ✕ pra que o save da ficha volte a ser possível.
  const foraDoCatalogo = internas
    .map((t) => ({ ...t, situacao: situacaoDaTag(t.slug, catalogo) }))
    .filter((t) => t.situacao !== "ativa");

  const alternar = (slug: string) => {
    setErro(null);
    setEscolhidas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const cancelar = () => {
    setEscolhidas(tagsInternas);
    setErro(null);
    setNovaTag("");
    setEditando(false);
  };

  const criar = async () => {
    const nome = novaTag.trim();
    if (nome.length < 2) {
      setErro("Dê um nome com ao menos 2 letras pra tag.");
      return;
    }
    setCriando(true);
    setErro(null);
    // Sem `cor`: quem resolve é a paleta de `lib/tags/shared` (T3).
    const r = await criarTagInline({ name: nome });
    setCriando(false);

    if (!r.success || !r.tag) {
      setErro(r.error ?? "Não foi possível criar a tag.");
      return;
    }
    const tag = r.tag;
    setCriadasAgora((prev) => (prev.some((t) => t.slug === tag.slug) ? prev : [...prev, tag]));
    setEscolhidas((prev) => (prev.includes(tag.slug) ? prev : [...prev, tag.slug]));
    setNovaTag("");
    toast.sucesso(`Tag "${tag.name}" criada e aplicada.`);
    router.refresh();
  };

  const salvar = async () => {
    const validacao = validarTagsInternas(escolhidas, catalogo);
    if (!validacao.ok) {
      setErro(validacao.erro);
      return;
    }

    setSalvando(true);
    setErro(null);
    const resultado = await salvarTagsInternas(contactId, validacao.slugs);
    setSalvando(false);

    if (!resultado.success) {
      setErro(resultado.error ?? "Não foi possível salvar.");
      return;
    }
    setEditando(false);
    setCriadasAgora([]);
    toast.sucesso("Tags salvas.");
    router.refresh();
  };

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-dark/10">
        <h2 className="font-display text-xl text-navy">Tags</h2>
        <div className="flex items-center gap-4">
          {ehAdmin && !editando && (
            <button
              type="button"
              onClick={() => setGerenciando(true)}
              data-testid="tags-gerenciar"
              className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
            >
              Gerenciar tags
            </button>
          )}
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              data-testid="tags-editar"
              className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
            >
              Editar tags internas
            </button>
          )}
        </div>
      </div>

      {/* ── ClickMassa (read-only) ─────────────────────────────── */}
      <section>
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">
          Tags do ClickMassa
        </p>
        <div className="flex flex-wrap items-center gap-2" data-testid="tags-clickmassa">
          {cm.tags.length === 0 && cm.orfaos === 0 ? (
            <span className="font-body text-sm text-dark/40">Nenhuma tag vinda do ClickMassa.</span>
          ) : (
            <>
              {cm.tags.map((t) => (
                <TagClickMassaBadge key={t.id} nome={t.nome} cor={t.cor} />
              ))}
              <TagsOrfasCm quantas={cm.orfaos} />
            </>
          )}
        </div>
        <p className="font-body text-xs text-dark/40 mt-2">Vêm do ClickMassa e só mudam lá.</p>
      </section>

      {/* ── Internas (editável) ────────────────────────────────── */}
      <section>
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">Tags internas</p>

        {!editando ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="tags-internas">
            {internas.length === 0 ? (
              <span className="font-body text-sm text-dark/40">Nenhuma tag interna ainda.</span>
            ) : (
              internas.map((t) => (
                <TagInternaBadge
                  key={t.slug}
                  nome={t.name}
                  cor={t.cor}
                  orfao={t.orfao}
                  inativa={situacaoDaTag(t.slug, catalogo) === "inativa"}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" data-testid="tags-internas-editor">
              {disponiveis.length === 0 && (
                <span className="font-body text-sm text-dark/40">
                  O catálogo de tags está vazio. Crie a primeira aqui embaixo.
                </span>
              )}
              {disponiveis.map((t) => {
                const marcada = escolhidas.includes(t.slug);
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => alternar(t.slug)}
                    aria-pressed={marcada}
                    data-testid={`tag-opcao-${t.slug}`}
                    className={`inline-flex items-center h-8 px-3 rounded-full border font-body text-xs transition-colors duration-short focus-ring ${
                      marcada ? "text-white" : "bg-white hover:bg-dark/5"
                    }`}
                    style={
                      marcada
                        ? { backgroundColor: t.cor, borderColor: t.cor }
                        : { color: t.cor, borderColor: t.cor }
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>

            {/* Criar tag no ponto de uso (T4): a tag volta da action e entra
                marcada na hora — sem prever slug, sem esperar refresh. */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-40">
                <label
                  htmlFor="tags-nova"
                  className="text-gold uppercase tracking-widest text-xs font-body block mb-1"
                >
                  Criar tag nova
                </label>
                <input
                  id="tags-nova"
                  type="text"
                  value={novaTag}
                  onChange={(e) => setNovaTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!criando) criar();
                    }
                  }}
                  placeholder="Nome da tag"
                  data-testid="tags-nova"
                  className="w-full px-3 h-10 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus-ring"
                />
              </div>
              <button
                type="button"
                onClick={criar}
                disabled={criando}
                data-testid="tags-criar"
                className="h-10 px-4 rounded-md border border-dark/20 bg-white font-body text-sm text-navy hover:bg-dark/5 focus-ring transition-colors duration-short disabled:text-dark/30"
              >
                {criando ? "Criando…" : "Criar e aplicar"}
              </button>
            </div>

            {/* Órfã e inativa: continuam na lista e continuam salváveis depois
                do ✕ — apagar ou desativar tag não apaga o histórico de ninguém,
                mas também não pode travar o save da ficha (T3). */}
            {foraDoCatalogo.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" data-testid="tags-fora-catalogo">
                <span className="font-body text-xs text-dark/50">Fora do catálogo ativo:</span>
                {foraDoCatalogo.map((t) => (
                  <TagInternaBadge
                    key={t.slug}
                    nome={t.name}
                    cor={null}
                    orfao={t.situacao === "orfa"}
                    inativa={t.situacao === "inativa"}
                    onRemover={() => alternar(t.slug)}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={salvar}
                disabled={salvando}
                data-testid="tags-salvar"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
              <button
                type="button"
                onClick={cancelar}
                disabled={salvando}
                className="font-body text-sm text-dark/60 hover:text-dark transition-colors duration-short"
              >
                Cancelar
              </button>
              {erro && <span className="font-body text-sm text-navy">{erro}</span>}
            </div>
          </div>
        )}
      </section>

      {/* ── Gerenciar tags (admin) ─────────────────────────────── */}
      {ehAdmin && (
        <Modal
          open={gerenciando}
          onClose={() => {
            setGerenciando(false);
            router.refresh();
          }}
          variant="conteudo"
          titulo="Gerenciar tags"
          data-testid="modal-gerenciar-tags"
        >
          <p className="font-body text-sm text-text-muted mb-4">
            Renomear e recolorir valem pra todos os contatos na hora. Excluir não tem desfazer: quem
            já tem a tag continua com ela, marcada como fora do catálogo.
          </p>
          {catalogo.length === 0 ? (
            <p className="font-body text-sm text-dark/40">Nenhuma tag cadastrada ainda.</p>
          ) : (
            <ul>
              {catalogo.map((t) => (
                // `confirmacao="inline"`: a folha de primitivos proíbe modal a
                // partir de modal, então a confirmação de exclusão é embutida.
                <TagRow
                  key={t.id}
                  tag={t}
                  confirmacao="inline"
                  onChanged={() => router.refresh()}
                />
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
