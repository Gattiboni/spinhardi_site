import Link from "next/link";
import { SpinhardiImage } from "@/components/ui/SpinhardiImage";
import type { Destino } from "@/content/destinos";

/** Tom conforme o fundo da seção. light = fundo claro, dark = fundo navy. */
type DestinoCardTone = "light" | "dark";

type DestinoCardProps = {
  destino: Destino;
  /** Tom conforme o fundo. Default: "light" (fundo claro). */
  tone?: DestinoCardTone;
  className?: string;
};

/**
 * Classes que variam por tom. Só mudam borda, fundo e cores de texto — o hover
 * (borda e título → gold) é idêntico nos dois tons, no padrão do ServiceCard.
 */
const TONE: Record<
  DestinoCardTone,
  { card: string; title: string; description: string; imageBorder: string }
> = {
  light: {
    card: "border-dark/10 bg-white hover:border-gold/30 hover:shadow-lg",
    title: "text-navy",
    description: "text-dark/70",
    imageBorder: "border-dark/10",
  },
  dark: {
    card: "border-white/10 bg-white/5 hover:border-gold/30 hover:bg-white/10",
    title: "text-white",
    description: "text-white/70",
    imageBorder: "border-white/10",
  },
};

/**
 * DestinoCard
 *
 * Card de destino: o card INTEIRO é um `<Link>` pra `/destinos/<slug>`. Usado em
 * dois lugares com o mesmo componente — seção da home (tone "dark", fundo navy)
 * e índice `/destinos` (tone "light", fundo branco). Um card, dois lugares.
 *
 * Por que componente novo e não `ServiceCard`: o ServiceCard é um item de LISTA
 * numerada (número gold à esquerda, border-bottom, empilhado), e o contrato pede
 * um GRID 1/2/4 sem número. O card grande de `/viagens` (foto + número + título)
 * é inline na página, não é componente. Nenhum dos dois cabe sem gambiarra.
 *
 * Visual: bloco com borda e hover no padrão dos cards de `/viagens` (borda sutil,
 * `rounded-md`, borda gold no hover, título vira gold). Com `imagem`, a foto
 * entra no topo em 4:3 via `SpinhardiImage` (lei do projeto pra imagem de
 * conteúdo). Sem `imagem`, é só texto: título em Fraunces, apoio em Montserrat.
 */
export default function DestinoCard({ destino, tone = "light", className = "" }: DestinoCardProps) {
  const t = TONE[tone];
  return (
    <Link
      href={`/destinos/${destino.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-md border ${t.card} transition-all duration-medium ease-smooth ${className}`.trim()}
    >
      {destino.imagem && (
        <SpinhardiImage
          src={`/images/${destino.imagem}`}
          alt={destino.nome}
          aspect="4/3"
          className={`border-b ${t.imageBorder}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      )}
      <div className="flex flex-1 flex-col p-6 lg:p-8">
        <h3
          className={`mb-3 font-display text-2xl leading-tight ${t.title} transition-colors duration-medium ease-smooth group-hover:text-gold`}
        >
          {destino.cardTitulo}
        </h3>
        <p className={`font-body text-sm leading-relaxed ${t.description}`}>{destino.cardApoio}</p>
      </div>
    </Link>
  );
}
