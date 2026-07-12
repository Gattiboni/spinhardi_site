import Link from "next/link";
import Image from "next/image";

type BlogCardProps = {
  /** Slug para o link /blog/[slug]. */
  slug: string;
  /** Título do post. */
  title: string;
  /** Categoria (ex: "Destinos", "Bastidores"). */
  category: string;
  /** Data já formatada (ex: "12 Jan 2026"). */
  date: string;
  /** Resumo curto (até ~2 linhas). */
  excerpt: string;
  /** URL da imagem. Vazio ou `null` renderiza um placeholder neutro. */
  thumbnail: string | null;
  /** Texto alternativo da capa. `null`/ausente → `alt=""` (imagem decorativa);
   *  nunca cai pro título, que faria o leitor de tela repetir a mesma frase. */
  thumbnailAlt?: string | null;
  className?: string;
};

/**
 * BlogCard
 *
 * Card de listagem de posts, baseado na seção 6 da referencias_design.md.
 * Layout vertical: imagem 16:9 em cima (com hover scale contido), conteúdo
 * abaixo. Sem borda, sem sombra — só espaçamento e tipografia.
 *
 * Quando `thumbnail` é vazio, renderiza um placeholder (bg-dark/10) — útil
 * enquanto não há imagem real. Com URL, usa next/image (requer remotePatterns
 * configurado para URLs externas).
 */
export default function BlogCard({
  slug,
  title,
  category,
  date,
  excerpt,
  thumbnail,
  thumbnailAlt,
  className = "",
}: BlogCardProps) {
  return (
    <article className={className}>
      <Link href={`/blog/${slug}`} className="group flex flex-col gap-3">
        <div className="relative aspect-video overflow-hidden rounded bg-dark/10">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={thumbnailAlt ?? ""}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-long ease-smooth group-hover:scale-105"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full bg-dark/10 transition-transform duration-long ease-smooth group-hover:scale-105"
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-body text-xs font-semibold uppercase tracking-widest text-gold">
            {category}
          </span>
          <h3 className="font-display text-2xl leading-tight text-dark">{title}</h3>
          <span className="font-body text-xs text-dark/60">{date}</span>
          <p className="line-clamp-2 font-body text-sm text-dark/80">{excerpt}</p>
        </div>
      </Link>
    </article>
  );
}
