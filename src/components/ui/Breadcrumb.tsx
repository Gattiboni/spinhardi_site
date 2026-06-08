import Link from "next/link";

export type BreadcrumbLevel = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  levels: BreadcrumbLevel[];
  className?: string;
};

/**
 * Breadcrumb de navegação.
 *
 * Recebe um array de níveis. Itens com `href` viram links clicáveis,
 * itens sem `href` viram texto puro (último nível = página atual).
 *
 * Convenção: o primeiro nível é sempre "Home" com href="/".
 * O último nível é sempre a página atual (sem href).
 *
 * Exemplo:
 *   <Breadcrumb levels={[
 *     { label: "Home", href: "/" },
 *     { label: "Viagens", href: "/viagens" },
 *     { label: "Pacotes e Roteiros" },
 *   ]} />
 */
export default function Breadcrumb({ levels, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`font-body text-sm text-dark/50 ${className}`.trim()}>
      {levels.map((level, index) => {
        const isLast = index === levels.length - 1;
        return (
          <span key={`${level.label}-${index}`}>
            {level.href && !isLast ? (
              <Link href={level.href} className="hover:text-gold transition-colors duration-short">
                {level.label}
              </Link>
            ) : (
              <span>{level.label}</span>
            )}
            {!isLast && <span className="mx-2">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
