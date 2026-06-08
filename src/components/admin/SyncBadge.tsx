import type { SyncStatus } from "@/lib/contacts/types";

type SyncBadgeProps = {
  iddas: SyncStatus;
  clickmassa: SyncStatus;
};

const ICON: Record<SyncStatus, { char: string; color: string; label: string }> = {
  synced: { char: "✓", color: "text-green-600", label: "Sincronizado" },
  pending: { char: "⏳", color: "text-gray-400", label: "Pendente" },
  failed: { char: "✗", color: "text-red-600", label: "Falhou" },
};

/**
 * Mostra o status de sync dos dois sistemas externos lado a lado.
 * Primeiro ícone = Iddas, segundo = ClickMassa. Tooltip nativo (`title`)
 * explica qual é qual.
 */
export default function SyncBadge({ iddas, clickmassa }: SyncBadgeProps) {
  const i = ICON[iddas];
  const cm = ICON[clickmassa];

  return (
    <span className="inline-flex items-center gap-1.5 font-body text-sm">
      <span className={i.color} title={`Iddas: ${i.label}`} aria-label={`Iddas: ${i.label}`}>
        {i.char}
      </span>
      <span
        className={cm.color}
        title={`ClickMassa: ${cm.label}`}
        aria-label={`ClickMassa: ${cm.label}`}
      >
        {cm.char}
      </span>
    </span>
  );
}
