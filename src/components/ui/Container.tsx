import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  /** Elemento HTML renderizado — flexibilidade semântica sem duplicar o componente. */
  as?: "div" | "section" | "article" | "main";
};

/**
 * Container
 *
 * Responsabilidade única: limitar a largura máxima do conteúdo e aplicar
 * padding horizontal responsivo. Centraliza horizontalmente.
 *
 * Medidas extraídas de docs/refs/referencias_design.md (seção 3):
 * px-4 mobile → px-12 desktop (≈48px), max-w-7xl (1280px).
 */
export default function Container({ children, className = "", as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={`mx-auto w-full max-w-7xl px-4 lg:px-12 ${className}`.trim()}>{children}</Tag>
  );
}
