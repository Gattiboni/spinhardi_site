import type { ReactNode } from "react";

type SectionSpacing = "sm" | "md" | "lg";

type SectionProps = {
  children: ReactNode;
  className?: string;
  /** Espaçamento vertical padronizado. Default: "md". */
  spacing?: SectionSpacing;
};

/**
 * Section
 *
 * Responsabilidade única: aplicar espaçamento vertical padronizado entre
 * blocos da página. Renderiza como <section> (semântica/SEO).
 *
 * NÃO aplica padding horizontal — isso é responsabilidade do Container
 * aninhado dentro.
 */
const SPACING: Record<SectionSpacing, string> = {
  sm: "py-12", // ~48px — seções compactas
  md: "py-20", // ~80px — padrão
  lg: "py-32", // ~128px — seções de destaque (hero, depoimentos)
};

export default function Section({ children, className = "", spacing = "md" }: SectionProps) {
  return <section className={`${SPACING[spacing]} ${className}`.trim()}>{children}</section>;
}
