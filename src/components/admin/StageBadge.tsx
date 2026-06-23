import { ESTAGIO_LABELS, type EstagioFunil } from "@/lib/contacts/types";

/**
 * Badge colorida por estágio da jornada (5 valores do modelo D072).
 *
 * Abertas: primeiro contato (gold), cotação enviada (blue), pediu pra esperar
 * (gray). Fechadas: aprovado (green), reprovado (red). Usa as escalas numéricas
 * padrão do Tailwind, exceto "gold" que é token próprio (definido em globals.css).
 */
const STAGE_CLASSES: Record<EstagioFunil, string> = {
  "primeiro contato": "bg-gold/15 text-gold",
  "cotação enviada": "bg-blue-100 text-blue-700",
  "pediu pra esperar": "bg-gray-100 text-gray-600",
  aprovado: "bg-green-100 text-green-700",
  reprovado: "bg-red-100 text-red-700",
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
