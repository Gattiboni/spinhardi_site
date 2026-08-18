"use client";

import { useState, useTransition } from "react";
import Modal, { type ConfirmResult } from "@/components/ui/primitives/Modal";
import { updateTag, deleteTag } from "@/app/admin/(painel)/configuracoes/actions";
import type { TagInterna } from "@/lib/tags/shared";

/**
 * Linha editável de uma tag do catálogo — renomear, recolorir, agrupar,
 * ativar/desativar e excluir.
 *
 * Nasceu privada em `ConfiguracoesClient` e subiu pra cá porque o contrato de
 * tags v1 (T4) coloca a MESMA gestão dentro da ficha do contato, num modal
 * admin-only. Uma implementação, dois lugares: Configurações importa daqui.
 *
 * Permissão (T2): as duas actions que esta linha chama exigem `admin`, e
 * `requireRole` REDIRECIONA em vez de devolver erro. Por isso quem renderiza
 * este componente é responsável por só mostrá-lo pra admin — a ficha esconde o
 * botão que abre o modal, e a página de Configurações já é admin-only inteira.
 *
 * CONFIRMAÇÃO DE EXCLUSÃO, e por que ela é configurável: a folha de primitivos
 * proíbe modal a partir de modal ("Um modal por vez"). Em Configurações a linha
 * vive numa página, então a exclusão usa `Modal variant="destrutiva"` — que é o
 * padrão da casa e substitui o `confirm()` nativo que estava aqui. Dentro do
 * modal "Gerenciar tags" da ficha, um segundo modal seria ilegal, então a
 * confirmação vira uma faixa embutida na própria linha, com os mesmos dois
 * botões e o mesmo texto. Nenhum dos dois caminhos usa `confirm()`.
 */

// ─────────────────────────────────────────────────────────────────
// Átomos compartilhados com a página de Configurações
//
// Vieram junto na extração: são os mesmos três de sempre, e deixá-los lá
// obrigaria a duplicá-los aqui. Ficam exportados pra que `ConfiguracoesClient`
// importe em vez de manter cópia.
// ─────────────────────────────────────────────────────────────────

export const inputClassCatalogo =
  "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

export function BadgeCatalogo({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "gold";
}) {
  const cls = tone === "gold" ? "bg-gold/10 text-gold" : "bg-dark/10 text-dark/50";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-body ${cls}`}>
      {children}
    </span>
  );
}

export function LinhaErro({ message }: { message: string | null }) {
  if (!message) return null;
  return <span className="w-full font-body text-xs text-red-700">{message}</span>;
}

export function ToggleCatalogo({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 font-body text-sm text-dark/70"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-short ${
          checked ? "bg-gold" : "bg-dark/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-short ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// A linha
// ─────────────────────────────────────────────────────────────────

export default function TagRow({
  tag,
  onChanged,
  confirmacao = "modal",
}: {
  tag: TagInterna;
  /** Chamado depois de salvar ou excluir (quem monta decide se é refresh). */
  onChanged: () => void;
  /** `"inline"` quando a linha já vive dentro de um modal (ver docstring). */
  confirmacao?: "modal" | "inline";
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [cor, setCor] = useState(tag.cor);
  const [grupo, setGrupo] = useState(tag.grupo ?? "");
  const [isActive, setIsActive] = useState(tag.isActive);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName(tag.name);
    setCor(tag.cor);
    setGrupo(tag.grupo ?? "");
    setIsActive(tag.isActive);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateTag(tag.id, { name, cor, grupo, is_active: isActive });
      if (res.success) {
        setEditing(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao salvar.");
      }
    });
  };

  /** Devolve `null` em sucesso ou a mensagem — o formato que o Modal espera. */
  const excluir = async (): Promise<ConfirmResult> => {
    const res = await deleteTag(tag.id);
    if (!res.success) return res.error ?? "Erro ao excluir.";
    onChanged();
    return null;
  };

  const excluirInline = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteTag(tag.id);
      if (res.success) {
        setConfirmandoExclusao(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao excluir.");
      }
    });
  };

  const DESCRICAO_EXCLUSAO =
    "Os contatos que já têm esta tag continuam com ela, marcada como fora do catálogo. Isso não tem como desfazer.";

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3 border-b border-dark/5 last:border-0">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-dark/20"
            aria-label="Cor"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            aria-label="Nome da tag"
            className={`${inputClassCatalogo} flex-1 min-w-32`}
          />
        </div>
        <input
          type="text"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          placeholder="Grupo (opcional)"
          aria-label="Grupo da tag"
          className={inputClassCatalogo}
        />
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <ToggleCatalogo checked={isActive} onChange={setIsActive} label="Ativa" />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="font-body text-sm text-green-700 hover:underline disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                reset();
              }}
              className="font-body text-sm text-dark/50 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
        <LinhaErro message={error} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 border-b border-dark/5 last:border-0 font-body text-sm">
      <span
        className="h-4 w-4 shrink-0 rounded-full border border-dark/10"
        style={{ backgroundColor: tag.cor }}
        aria-hidden="true"
      />
      <span className="text-dark font-medium">{tag.name}</span>
      <span className="text-dark/30 text-xs">{tag.slug}</span>
      {tag.grupo && <BadgeCatalogo tone="muted">{tag.grupo}</BadgeCatalogo>}
      {!tag.isActive && <BadgeCatalogo tone="muted">Inativa</BadgeCatalogo>}
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-gold hover:underline"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setConfirmandoExclusao(true)}
          disabled={pending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Excluir
        </button>
      </div>

      {/* Confirmação embutida — usada quando a linha já está dentro de um modal. */}
      {confirmacao === "inline" && confirmandoExclusao && (
        <div
          role="alertdialog"
          aria-label={`Excluir a tag ${tag.name}?`}
          className="w-full mt-1 px-3 py-2.5 rounded-md bg-red-50 border border-red-200 flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <p className="font-body text-xs text-red-700 flex-1 min-w-48">
            Excluir <b>{tag.name}</b>? {DESCRICAO_EXCLUSAO}
          </p>
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(false)}
            disabled={pending}
            className="font-body text-xs px-3 py-1.5 rounded-md border border-dark/20 text-dark hover:bg-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={excluirInline}
            disabled={pending}
            className="font-body text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      )}

      {confirmacao === "modal" && (
        <Modal
          open={confirmandoExclusao}
          onClose={() => setConfirmandoExclusao(false)}
          variant="destrutiva"
          titulo={`Excluir a tag "${tag.name}"?`}
          descricao={DESCRICAO_EXCLUSAO}
          primarioLabel="Excluir tag"
          onConfirmar={excluir}
          data-testid="modal-excluir-tag"
        />
      )}

      <LinhaErro message={error} />
    </li>
  );
}
