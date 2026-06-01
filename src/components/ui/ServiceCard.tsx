import Link from "next/link";

/** Tom conforme o fundo da seção. light = fundo claro, dark = fundo navy. */
type ServiceCardTone = "light" | "dark";

type ServiceCardProps = {
  /** Número do item na lista (ex: "01", "02"). */
  number: string;
  /** Nome do serviço/viagem (ex: "Itália sob medida"). */
  title: string;
  /** Descrição curta opcional, exibida abaixo do título. */
  description?: string;
  /** Destino do link. */
  href: string;
  /** Tom conforme o fundo. Default: "light" (fundo claro). */
  tone?: ServiceCardTone;
  className?: string;
};

/**
 * Classes que variam por tom. Só mudam as cores base de borda, título e
 * descrição — o hover (número e título → gold) é idêntico nos dois tons.
 */
const TONE: Record<ServiceCardTone, { border: string; title: string; description: string }> = {
  light: {
    border: "border-dark/10",
    title: "text-dark",
    description: "text-dark/60",
  },
  dark: {
    border: "border-white/10",
    title: "text-white",
    description: "text-white/70",
  },
};

/**
 * ServiceCard
 *
 * Item de lista numerada de serviços/viagens, baseado na seção 4 da
 * referencias_design.md (grade numerada estilo buchwalder-linder).
 *
 * Layout: número à esquerda em gold, título grande à direita em Fraunces,
 * descrição opcional abaixo. Empilhados, formam uma lista separada por
 * border-bottom sutil. No hover, número satura e título vira gold.
 *
 * A prop `tone` adapta as cores base ao fundo da seção (claro ou navy) sem
 * mudar o comportamento de hover.
 */
export default function ServiceCard({
  number,
  title,
  description,
  href,
  tone = "light",
  className = "",
}: ServiceCardProps) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className={`group flex items-baseline gap-6 border-b ${t.border} py-6 transition-colors duration-medium ease-smooth ${className}`.trim()}
    >
      <span className="w-8 shrink-0 font-body text-sm text-gold/70 transition-colors duration-medium ease-smooth group-hover:text-gold">
        {number}
      </span>
      <div className="min-w-0">
        <h3
          className={`font-display text-2xl ${t.title} transition-colors duration-medium ease-smooth group-hover:text-gold md:text-3xl`}
        >
          {title}
        </h3>
        {description && <p className={`mt-1 font-body text-sm ${t.description}`}>{description}</p>}
      </div>
    </Link>
  );
}
