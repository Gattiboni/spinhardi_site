type TestimonialCardProps = {
  /** Texto do depoimento. */
  quote: string;
  /** Nome de quem fala. */
  author: string;
  /** Contexto opcional (ex: "Cliente Itália · Mar/2026"). */
  context?: string;
  className?: string;
};

/**
 * TestimonialCard
 *
 * Depoimento de cliente. Renderiza como <blockquote> (semântica).
 * Border-left em gold, aspas decorativas em Fraunces com opacidade reduzida,
 * quote em Fraunces italic com line-height generoso, autor e contexto abaixo.
 *
 * Background bg-white por default (pensado para aparecer sobre fundo escuro ou
 * neutro). Quem consome decide o fundo da seção ao redor.
 */
export default function TestimonialCard({
  quote,
  author,
  context,
  className = "",
}: TestimonialCardProps) {
  return (
    <blockquote
      className={`relative border-l-4 border-gold bg-white p-8 lg:p-12 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-4 select-none font-display text-7xl leading-none text-gold/20 lg:left-10"
      >
        &ldquo;
      </span>
      <p className="relative mt-6 font-display text-xl italic leading-relaxed text-dark lg:text-2xl">
        {quote}
      </p>
      <footer className="mt-6">
        <p className="font-body font-semibold text-dark">{author}</p>
        {context && <p className="mt-1 font-body text-sm text-dark/60">{context}</p>}
      </footer>
    </blockquote>
  );
}
