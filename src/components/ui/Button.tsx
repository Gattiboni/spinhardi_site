import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Aparência semântica do botão. Default: "primary". */
  variant?: ButtonVariant;
  /** Tamanho (controla text-size e padding). Default: "md". */
  size?: ButtonSize;
  children: ReactNode;
};

/**
 * Button
 *
 * Botão semântico com 3 variantes (primary, secondary, ghost), 3 tamanhos e
 * estados interativos completos (hover, active, focus-visible, disabled).
 *
 * A variante "ghost" ignora o padding das sizes — mantém apenas o text-size e
 * usa padding próprio reduzido (decisão de design do Bloco 3).
 *
 * Cores e durações vêm dos tokens em globals.css (gold/dark/navy, duration-medium).
 */

const SIZE_TEXT: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const SIZE_PADDING: Record<ButtonSize, string> = {
  sm: "px-4 py-2",
  md: "px-6 py-3",
  lg: "px-8 py-4",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-gold text-dark hover:bg-gold/90 active:bg-gold/80",
  secondary: "border-2 border-gold text-gold hover:bg-gold hover:text-dark",
  // ghost traz padding próprio (px-0 py-1) — o padding da size é ignorado.
  ghost: "px-0 py-1 text-navy underline-offset-4 hover:underline",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-body font-medium " +
  "transition-colors duration-medium focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const padding = variant === "ghost" ? "" : SIZE_PADDING[size];
  const classes = `${BASE} ${SIZE_TEXT[size]} ${padding} ${VARIANT[variant]} ${className}`
    .replace(/\s+/g, " ")
    .trim();

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
