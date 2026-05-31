type DividerTone = "light" | "dark";

type DividerProps = {
  className?: string;
  /** Tom da linha conforme o fundo. Default: "light". */
  tone?: DividerTone;
};

/**
 * Divider
 *
 * Responsabilidade única: linha divisória sutil entre blocos de conteúdo.
 * Renderiza como <hr> (semântica). Só borda sutil, sem cor sólida.
 *
 * Sem margem externa — quem chama decide o espaçamento via className.
 */
const TONE: Record<DividerTone, string> = {
  light: "border-white/10", // sobre fundo escuro
  dark: "border-dark/10", // sobre fundo claro
};

export default function Divider({ className = "", tone = "light" }: DividerProps) {
  return <hr className={`border-t ${TONE[tone]} ${className}`.trim()} />;
}
