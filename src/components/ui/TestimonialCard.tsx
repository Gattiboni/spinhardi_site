/** Tom conforme o fundo da seção. light = fundo claro, dark = fundo navy. */
type TestimonialCardTone = "light" | "dark";

type TestimonialCardProps = {
  /** Texto do depoimento. */
  quote: string;
  /** Nome de quem fala. */
  author: string;
  /** Contexto opcional (ex: "Cliente Itália · Mar/2026"). Omitido, não renderiza a linha. */
  context?: string;
  /** Tom conforme o fundo. Default: "light" (fundo claro). */
  tone?: TestimonialCardTone;
  className?: string;
};

/**
 * Classes que variam por tom. A border-l gold e as aspas decorativas são
 * idênticas nos dois tons — só mudam fundo e cores de texto.
 */
const TONE: Record<
  TestimonialCardTone,
  { card: string; quote: string; author: string; context: string }
> = {
  light: {
    card: "bg-white",
    quote: "text-dark",
    author: "text-dark",
    context: "text-dark/60",
  },
  dark: {
    card: "bg-white/5",
    quote: "text-white",
    author: "text-white",
    context: "text-white/60",
  },
};

/**
 * TestimonialCard
 *
 * Depoimento de cliente. Renderiza como <blockquote> (semântica).
 * Border-left em gold, aspas decorativas em Fraunces com opacidade reduzida,
 * quote em Fraunces italic com line-height generoso, autor e contexto abaixo.
 *
 * A prop `tone` adapta fundo e cores de texto ao fundo da seção: "light" para
 * fundo claro (bg-white), "dark" para fundo navy (bg-white/5 sutil). O contexto
 * é opcional — quando omitido, a linha não é renderizada.
 */
export default function TestimonialCard({
  quote,
  author,
  context,
  tone = "light",
  className = "",
}: TestimonialCardProps) {
  const t = TONE[tone];
  return (
    <blockquote
      className={`relative border-l-4 border-gold ${t.card} p-8 lg:p-12 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-4 select-none font-display text-7xl leading-none text-gold/20 lg:left-10"
      >
        &ldquo;
      </span>
      <p
        className={`relative mt-6 font-display text-xl italic leading-relaxed ${t.quote} lg:text-2xl`}
      >
        {quote}
      </p>
      <footer className="mt-6">
        <p className={`font-body font-semibold ${t.author}`}>{author}</p>
        {context && <p className={`mt-1 font-body text-sm ${t.context}`}>{context}</p>}
      </footer>
    </blockquote>
  );
}
