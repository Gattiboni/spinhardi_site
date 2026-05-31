import Link from "next/link";

type ServiceCardProps = {
  /** Número do item na lista (ex: "01", "02"). */
  number: string;
  /** Nome do serviço/viagem (ex: "Itália sob medida"). */
  title: string;
  /** Descrição curta opcional, exibida abaixo do título. */
  description?: string;
  /** Destino do link. */
  href: string;
  className?: string;
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
 */
export default function ServiceCard({
  number,
  title,
  description,
  href,
  className = "",
}: ServiceCardProps) {
  return (
    <Link
      href={href}
      className={`group flex items-baseline gap-6 border-b border-dark/10 py-6 transition-colors duration-medium ease-smooth ${className}`.trim()}
    >
      <span className="w-8 shrink-0 font-body text-sm text-gold/70 transition-colors duration-medium ease-smooth group-hover:text-gold">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-2xl text-dark transition-colors duration-medium ease-smooth group-hover:text-gold md:text-3xl">
          {title}
        </h3>
        {description && <p className="mt-1 font-body text-sm text-dark/60">{description}</p>}
      </div>
    </Link>
  );
}
