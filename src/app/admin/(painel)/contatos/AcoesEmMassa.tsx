"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import { preverSlug, type TagInterna } from "@/lib/tags/shared";
import type { Grupo } from "@/lib/grupos/types";
import { aplicarTagEmMassa, adicionarAoGrupoEmMassa } from "./actions";
import { createTag } from "../configuracoes/actions";

/**
 * Barra de ações em massa da lista de contatos.
 *
 * Três ações, todas com o teto da PÁGINA (10/25/50 conforme o seletor). O
 * "selecionar todos os N do filtro" da folha NÃO existe aqui: exigiria uma RPC
 * de ids-por-filtro, que está fora do lote — e o incidente
 * `UND_ERR_HEADERS_OVERFLOW` já mostrou o custo de tentar por outro caminho.
 *
 * "Remover tag" passa por modal DESTRUTIVO (régua navy + filete ouro no
 * primário) porque tira dado de várias pessoas de uma vez e não tem desfazer.
 * "Adicionar" é união — não destrói nada — e vai em modal simples.
 *
 * CRIAR TAG INLINE chama `createTag`, a MESMA server action de Configurações
 * (T7): mesma geração de slug, mesma validação, zero segundo CRUD. Consequência
 * conhecida: aquela action exige role `admin`, então editor não cria tag daqui.
 * Está documentado no relatório do lote — mudar isso é decisão de permissão,
 * não deste componente.
 */
export default function AcoesEmMassa({
  selecionados,
  catalogoInterno,
  grupos,
  aoTerminar,
}: {
  selecionados: string[];
  catalogoInterno: TagInterna[];
  grupos: Grupo[];
  aoTerminar: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [aberto, setAberto] = useState<"adicionar" | "remover" | "grupo" | null>(null);
  const [slug, setSlug] = useState("");
  const [novaTag, setNovaTag] = useState("");
  const [criandoTag, setCriandoTag] = useState(false);
  const [grupoEscolhido, setGrupoEscolhido] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");

  const n = selecionados.length;
  if (n === 0) return null;

  const ativas = catalogoInterno.filter((t) => t.isActive);
  const plural = n === 1 ? "contato" : "contatos";

  const fechar = () => {
    setAberto(null);
    setSlug("");
    setNovaTag("");
    setGrupoEscolhido("");
    setNovoGrupo("");
  };

  const criarTagInline = async () => {
    const nome = novaTag.trim();
    if (nome.length < 2) {
      toast.erro("Dê um nome com ao menos 2 letras pra tag.");
      return;
    }
    setCriandoTag(true);
    // Cor default do catálogo interno — a operadora ajusta em Configurações.
    const r = await createTag({ name: nome, cor: "#1A2B4A", grupo: null, is_active: true });
    setCriandoTag(false);

    if (!r.success) {
      toast.erro(r.error ?? "Não foi possível criar a tag.");
      return;
    }
    // O slug é gerado pela action de Configurações; aqui a gente PREVÊ o mesmo
    // (mesma função de normalização) só pra já deixar a tag escolhida.
    setSlug(preverSlug(nome));
    setNovaTag("");
    toast.sucesso(`Tag "${nome}" criada.`);
    router.refresh();
  };

  const aplicarTag = async (operacao: "adicionar" | "remover") => {
    if (!slug) return "Escolha a tag.";
    const r = await aplicarTagEmMassa(selecionados, slug, operacao);
    if (!r.success) return r.error ?? "Não foi possível aplicar a tag.";

    toast.sucesso(
      operacao === "adicionar"
        ? `Tag aplicada em ${r.afetados} ${r.afetados === 1 ? "contato" : "contatos"}.`
        : `Tag removida de ${r.afetados} ${r.afetados === 1 ? "contato" : "contatos"}.`,
    );
    aoTerminar();
    router.refresh();
    return null;
  };

  const adicionarAoGrupo = async () => {
    const nome = novoGrupo.trim();
    if (!grupoEscolhido && !nome) return "Escolha um grupo ou dê um nome pro novo.";

    const r = await adicionarAoGrupoEmMassa(
      selecionados,
      nome ? { nomeNovo: nome } : { grupoId: grupoEscolhido },
    );
    if (!r.success) return r.error ?? "Não foi possível adicionar ao grupo.";

    toast.sucesso(
      `${r.adicionados} ${r.adicionados === 1 ? "contato entrou" : "contatos entraram"} no grupo.`,
      [
        {
          label: "Ver grupo",
          onClick: () => router.push(`/admin/campanhas/grupos/${r.grupoId}`),
        },
      ],
    );
    aoTerminar();
    router.refresh();
    return null;
  };

  const botao =
    "h-9 px-4 rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short";
  const campo =
    "w-full px-3 h-10 border border-border-strong rounded-md font-body text-sm text-dark bg-white focus-ring";
  const rotulo = "text-gold uppercase tracking-widest text-xs font-body block mb-1";

  return (
    <>
      <div
        data-testid="contatos-acoes-massa"
        className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-md bg-surface-selected"
      >
        <span className="font-body text-sm text-navy font-semibold">
          {n} {plural} {n === 1 ? "selecionado" : "selecionados"}
        </span>
        <button type="button" className={botao} onClick={() => setAberto("adicionar")}>
          Adicionar tag
        </button>
        <button type="button" className={botao} onClick={() => setAberto("remover")}>
          Remover tag
        </button>
        <button type="button" className={botao} onClick={() => setAberto("grupo")}>
          Adicionar ao grupo
        </button>
        <button
          type="button"
          onClick={aoTerminar}
          className="ml-auto font-body text-sm text-text-muted hover:text-navy focus-ring rounded-sm"
        >
          Limpar seleção
        </button>
      </div>

      {/* ── Adicionar tag (união, não destrutivo) ───────────────── */}
      <Modal
        open={aberto === "adicionar"}
        onClose={fechar}
        variant="confirmacao"
        titulo={`Adicionar tag a ${n} ${plural}`}
        descricao="Quem já tiver a tag continua igual. As outras tags de cada contato ficam como estão."
        primarioLabel="Adicionar tag"
        onConfirmar={() => aplicarTag("adicionar")}
        data-testid="modal-massa-adicionar-tag"
      >
        <div className="space-y-3">
          <div>
            <label className={rotulo}>Tag</label>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={campo}
              data-testid="massa-select-tag"
            >
              <option value="">Escolha a tag…</option>
              {ativas.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-40">
              <label className={rotulo}>Ou crie uma tag nova</label>
              <input
                type="text"
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                placeholder="Nome da tag"
                className={campo}
                data-testid="massa-nova-tag"
              />
            </div>
            <button
              type="button"
              onClick={criarTagInline}
              disabled={criandoTag}
              className={`${botao} disabled:text-text-disabled`}
            >
              {criandoTag ? "Criando…" : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Remover tag (destrutivo) ────────────────────────────── */}
      <Modal
        open={aberto === "remover"}
        onClose={fechar}
        variant="destrutiva"
        titulo={`Tirar a tag de ${n} ${plural}?`}
        descricao="Isso não tem como desfazer. As outras tags de cada contato ficam como estão."
        primarioLabel="Remover tag"
        onConfirmar={() => aplicarTag("remover")}
        data-testid="modal-massa-remover-tag"
      >
        <div>
          <label className={rotulo}>Tag</label>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={campo}
            data-testid="massa-select-tag-remover"
          >
            <option value="">Escolha a tag…</option>
            {/* Remover aceita tag DESATIVADA: dá pra tirar uma tag que saiu do
                catálogo depois de ter sido aplicada. */}
            {catalogoInterno.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
                {t.isActive ? "" : " (desativada)"}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* ── Adicionar ao grupo ──────────────────────────────────── */}
      <Modal
        open={aberto === "grupo"}
        onClose={fechar}
        variant="confirmacao"
        titulo={`Adicionar ${n} ${plural} a um grupo`}
        descricao="Grupo não filtra quem recebe e-mail: pode ter gente sem e-mail. Isso é resolvido na hora do envio."
        primarioLabel="Adicionar ao grupo"
        onConfirmar={adicionarAoGrupo}
        data-testid="modal-massa-grupo"
      >
        <div className="space-y-3">
          <div>
            <label className={rotulo}>Grupo</label>
            <select
              value={grupoEscolhido}
              onChange={(e) => {
                setGrupoEscolhido(e.target.value);
                setNovoGrupo("");
              }}
              className={campo}
              data-testid="massa-select-grupo"
            >
              <option value="">Escolha o grupo…</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Ou crie um grupo novo</label>
            <input
              type="text"
              value={novoGrupo}
              onChange={(e) => {
                setNovoGrupo(e.target.value);
                if (e.target.value) setGrupoEscolhido("");
              }}
              placeholder="Nome do grupo"
              className={campo}
              data-testid="massa-novo-grupo"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
