import Image from "next/image";

type LogoVariant = "clara" | "escura" | "icone";

type LogoProps = {
  /**
   * Variante visual da logo. Default: "escura" (logo para fundo branco, o caso
   * mais comum em conteúdo).
   * - "clara": pássaro/SPINHARDI em gold + "Turismo" branco — usar sobre navy.
   * - "escura": SPINHARDI em navy + "Turismo" gold — usar sobre branco.
   * - "icone": apenas o pássaro — favicon e contextos compactos.
   */
  variant?: LogoVariant;
  /** Largura em px. Default depende da variante. */
  width?: number;
  /** Altura em px. Default depende da variante. */
  height?: number;
  /** Passa `priority` ao next/image para logos above-the-fold (ex.: Header). */
  priority?: boolean;
  /** Classes adicionais. */
  className?: string;
  /** Texto alternativo. Default depende da variante. */
  alt?: string;
};

/** Dimensões padrão por variante (clara/escura em 3:1; ícone quadrado). */
const DEFAULT_SIZE: Record<LogoVariant, { width: number; height: number }> = {
  clara: { width: 240, height: 80 },
  escura: { width: 240, height: 80 },
  icone: { width: 40, height: 40 },
};

/**
 * Logo
 *
 * Renderiza a logo da Spinhardi nas 3 variantes disponíveis em `public/logos/`.
 *
 * Usa `next/image` apontando para o SVG estático. Como o `src` termina em
 * ".svg", o Next 16 ativa `unoptimized` automaticamente (servimos o arquivo
 * como está, sem passar pelo otimizador) — por isso NÃO é necessário
 * `dangerouslyAllowSVG` no next.config. Mantemos `unoptimized` explícito para
 * documentar a intenção.
 *
 * Dívida técnica conhecida: os SVGs atuais embutem PNG (export raster do Canva),
 * então a logo pixeliza ao ser muito ampliada. A troca por SVG vetorial real
 * não exige mudança neste componente — apenas substituir os arquivos.
 *
 * Server Component: renderização pura, sem estado nem interatividade.
 */
export default function Logo({
  variant = "escura",
  width,
  height,
  priority = false,
  className,
  alt,
}: LogoProps) {
  const size = DEFAULT_SIZE[variant];
  // O ícone não comunica "Turismo" — alt mais curto quando isolado.
  const resolvedAlt = alt ?? (variant === "icone" ? "Spinhardi" : "Spinhardi Turismo");

  return (
    <Image
      src={`/logos/logo-${variant}.svg`}
      alt={resolvedAlt}
      width={width ?? size.width}
      height={height ?? size.height}
      priority={priority}
      className={className}
      unoptimized
    />
  );
}
