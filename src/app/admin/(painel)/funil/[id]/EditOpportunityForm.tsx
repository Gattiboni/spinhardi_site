"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import type { Opportunity, PipelineStep, ExternalUser } from "@/lib/integrations/clickmassa";
import { updateOpportunityAction } from "./actions";

const inputClass =
  "w-full px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

const labelClass = "text-gold uppercase tracking-widest text-xs font-body mb-1.5 block";

type Props = {
  opp: Opportunity;
  steps: PipelineStep[];
  users: ExternalUser[];
};

export default function EditOpportunityForm({ opp, steps, users }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const data = new FormData(e.currentTarget);
    const result = await updateOpportunityAction(opp.id, data);
    setSaving(false);
    if ("success" in result) {
      setFeedback({ type: "ok", text: "Alteracoes salvas." });
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error });
    }
  }

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-xl text-navy">Editar oportunidade</h2>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setFeedback(null); }}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="edit-name" className={labelClass}>Nome</label>
          <input
            id="edit-name"
            name="name"
            type="text"
            required
            defaultValue={opp.name}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="edit-description" className={labelClass}>Descricao</label>
          <textarea
            id="edit-description"
            name="description"
            rows={3}
            defaultValue={opp.description ?? ""}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="edit-value" className={labelClass}>Valor (R$)</label>
            <input
              id="edit-value"
              name="value"
              type="number"
              min={0}
              step={0.01}
              defaultValue={opp.value ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="edit-date" className={labelClass}>Data prevista de fechamento</label>
            <input
              id="edit-date"
              name="expectedCloseDate"
              type="date"
              defaultValue={opp.expectedCloseDate?.slice(0, 10) ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="edit-step" className={labelClass}>Etapa do funil</label>
            <select
              id="edit-step"
              name="pipelineStepId"
              defaultValue={opp.pipelineStepId}
              className={inputClass}
            >
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-responsible" className={labelClass}>Responsavel</label>
            <select
              id="edit-responsible"
              name="responsibleId"
              defaultValue={opp.responsibleId ?? ""}
              className={inputClass}
            >
              <option value="">(sem responsavel)</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
          {feedback && (
            <span
              className={`font-body text-sm ${
                feedback.type === "ok" ? "text-green-700" : "text-red-600"
              }`}
            >
              {feedback.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
