"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/primitives/Toast";
import { TagClickMassaBadge, TagInternaBadge, TagsOrfasCm } from "@/components/admin/TagBadge";
import {
  resolverTagsClickMassa,
  resolverTagsInternas,
  validarTagsInternas,
  type TagClickMassa,
  type TagInterna,
} from "@/lib/tags/shared";
import { salvarTagsInternas } from "./actions";

/**
 * Bloco de tags da ficha — DOIS blocos rotulados, como o contrato manda (T8).
 *
 *  • "Tags do ClickMassa": READ-ONLY. Badge com a cor do catálogo do CM. Vazio
 *    é explícito ("nenhuma"), não uma área em branco. Id órfão vira contagem,
 *    nunca número cru na tela (T3).
 *  • "Tags internas": editável no padrão Editar → Salvar/Cancelar dos outros
 *    cards da ficha. Escreve `contacts.tags` por substituição integral (T5).
 *
 * A validação que roda no clique é a MESMA do servidor (`lib/tags/shared`) —
 * aqui ela só evita uma ida ao servidor pra ouvir "não".
 *
 * Sem carimbo de edição próprio: a folha não pede coluna nova pra tag e
 * `updated_at` já registra "mexeram neste contato". Se for pra existir, é
 * decisão de contrato, não deste card.
 */
export default function TagsCard({
  contactId,
  tagsInternas,
  clickmassaTagsId,
  catalogoInterno,
  catalogoClickmassa,
}: {
  contactId: string;
  tagsInternas: string[];
  clickmassaTagsId: number[];
  catalogoInterno: TagInterna[];
  catalogoClickmassa: TagClickMassa[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [editando, setEditando] = useState(false);
  const [escolhidas, setEscolhidas] = useState<string[]>(tagsInternas);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cm = resolverTagsClickMassa(clickmassaTagsId, catalogoClickmassa);
  const internas = resolverTagsInternas(editando ? escolhidas : tagsInternas, catalogoInterno);
  const disponiveis = catalogoInterno.filter((t) => t.isActive);

  const alternar = (slug: string) => {
    setErro(null);
    setEscolhidas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const cancelar = () => {
    setEscolhidas(tagsInternas);
    setErro(null);
    setEditando(false);
  };

  const salvar = async () => {
    const validacao = validarTagsInternas(escolhidas, catalogoInterno);
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
    toast.sucesso("Tags salvas.");
    router.refresh();
  };

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-dark/10">
        <h2 className="font-display text-xl text-navy">Tags</h2>
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
                <TagInternaBadge key={t.slug} nome={t.name} cor={t.cor} orfao={t.orfao} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" data-testid="tags-internas-editor">
              {disponiveis.length === 0 && (
                <span className="font-body text-sm text-dark/40">
                  O catálogo de tags está vazio. Crie tags em Configurações.
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

            {/* Slug órfão continua na lista e continua salvável — apagar tag do
                catálogo não apaga o histórico de ninguém (T6). */}
            {internas.filter((t) => t.orfao).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-body text-xs text-dark/50">Fora do catálogo:</span>
                {internas
                  .filter((t) => t.orfao)
                  .map((t) => (
                    <TagInternaBadge
                      key={t.slug}
                      nome={t.name}
                      cor={null}
                      orfao
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
    </div>
  );
}
