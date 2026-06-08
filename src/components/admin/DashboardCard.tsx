import Link from "next/link";

type DashboardCardTone = "default" | "warning";

type DashboardCardProps = {
  /** Rótulo do card (ex: "Novos contatos"). */
  title: string;
  /** Valor principal exibido (número ou string). */
  value: number | string;
  /** Se presente, torna o card inteiro clicável. */
  href?: string;
  /** "warning" destaca pendências (ex: pendentes de sync). Default "default". */
  tone?: DashboardCardTone;
  /** Texto auxiliar opcional abaixo do valor. */
  hint?: string;
};

/**
 * Card de métrica do dashboard.
 *
 * Reutilizável: recebe título + valor e, opcionalmente, vira link.
 * `tone="warning"` muda a cor do valor pra sinalizar algo que precisa de
 * atenção (ex: contatos com sync pendente/falho).
 */
export default function DashboardCard({
  title,
  value,
  href,
  tone = "default",
  hint,
}: DashboardCardProps) {
  const valueColor = tone === "warning" && value !== 0 ? "text-red-600" : "text-navy";

  const inner = (
    <>
      <p className="font-body text-sm text-dark/60 mb-3">{title}</p>
      <p className={`font-display text-4xl ${valueColor}`}>{value}</p>
      {hint && <p className="font-body text-xs text-dark/50 mt-2">{hint}</p>}
    </>
  );

  const baseClass = "block bg-white border border-dark/10 rounded-md p-6 min-h-[120px]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} hover:border-gold hover:shadow-sm transition-all duration-short`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
