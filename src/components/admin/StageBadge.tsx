import { ESTAGIO_LABELS, type EstagioFunil } from "@/lib/contacts/types";

/**
 * Badge colorida por estágio do funil interno.
 *
 * As cores seguem o mapa do wireframe v3 (gold/blue/indigo/purple/orange/
 * green/teal/gray/red). Usa as escalas numéricas padrão do Tailwind, exceto
 * "gold" que é token próprio (definido em globals.css).
 */
const STAGE_CLASSES: Record<EstagioFunil, string> = {
  novo: "bg-gold/15 text-gold",
  qualificado: "bg-blue-100 text-blue-700",
  proposta_enviada: "bg-indigo-100 text-indigo-700",
  em_negociacao: "bg-purple-100 text-purple-700",
  aguardando_pagamento: "bg-orange-100 text-orange-700",
  fechado_confirmado: "bg-green-100 text-green-700",
  viagem_realizada: "bg-teal-100 text-teal-700",
  em_espera: "bg-gray-100 text-gray-600",
  perdido: "bg-red-100 text-red-700",
};

export default function StageBadge({ estagio }: { estagio: EstagioFunil }) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-body whitespace-nowrap ${STAGE_CLASSES[estagio]}`}
    >
      {ESTAGIO_LABELS[estagio]}
    </span>
  );
}
