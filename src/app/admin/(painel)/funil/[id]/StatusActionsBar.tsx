"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { updateOpportunityStatusAction } from "./actions";

type Props = {
  opportunityId: number;
  currentStatus: "open" | "won" | "lost";
};

type DialogState = { open: true; status: "won" | "lost" } | { open: false };

const inputClass =
  "w-full px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

const labelClass = "text-gold uppercase tracking-widest text-xs font-body mb-1.5 block";

function StatusDialog({
  opportunityId,
  status,
  onClose,
}: {
  opportunityId: number;
  status: "won" | "lost";
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const data = new FormData(e.currentTarget);
    const result = await updateOpportunityStatusAction(opportunityId, status, data);
    setSaving(false);
    if ("success" in result) {
      router.refresh();
      onClose();
    } else {
      setFeedback(result.error);
    }
  }

  const title = status === "won" ? "Marcar como Ganha" : "Marcar como Perdida";
  const confirmClass =
    status === "won"
      ? "bg-green text-white hover:bg-green/90"
      : "bg-red-600 text-white hover:bg-red-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="font-display text-xl text-navy mb-5">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dialog-note" className={labelClass}>
              Nota (opcional)
            </label>
            <textarea
              id="dialog-note"
              name="note"
              rows={3}
              placeholder="Detalhes sobre o encerramento..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="dialog-reason" className={labelClass}>
              Motivo (ID)
              {/* TODO G.2: substituir por select quando endpoint de motivos for mapeado */}
            </label>
            <input
              id="dialog-reason"
              name="gainOrLossReasonId"
              type="text"
              placeholder="ID do motivo (opcional)"
              className={inputClass}
            />
            <p className="font-body text-xs text-dark/40 mt-1">
              Deixe em branco se nao souber o ID do motivo.
            </p>
          </div>

          {feedback && (
            <p className="font-body text-sm text-red-600">{feedback}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center justify-center px-5 py-2 rounded-md font-body font-medium text-sm transition-colors duration-medium disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass}`}
            >
              {saving ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StatusActionsBar({ opportunityId, currentStatus }: Props) {
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  if (currentStatus !== "open") {
    const label = currentStatus === "won" ? "Ganha" : "Perdida";
    const cls = currentStatus === "won" ? "text-green-700" : "text-red-600";
    return (
      <p className={`font-body text-sm font-semibold ${cls}`}>
        Oportunidade {label} — sem acoes disponiveis.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDialog({ open: true, status: "won" })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-body font-medium text-sm bg-green text-white hover:bg-green/90 transition-colors duration-medium"
        >
          Marcar como Ganha
        </button>
        <button
          type="button"
          onClick={() => setDialog({ open: true, status: "lost" })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-body font-medium text-sm bg-red-600 text-white hover:bg-red-700 transition-colors duration-medium"
        >
          Marcar como Perdida
        </button>
      </div>

      {dialog.open && (
        <StatusDialog
          opportunityId={opportunityId}
          status={dialog.status}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </>
  );
}
