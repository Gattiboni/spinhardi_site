import Link from "next/link";
import DestinoFotoCarrossel from "@/components/ui/DestinoFotoCarrossel";
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
const TONE: Record<DestinoCardTone, { card: string; title: string; description: string }> = {
  light: {
    card: "border-dark/10 bg-white hover:border-gold/30 hover:shadow-lg",
    title: "text-navy",
    description: "text-dark/70",
  },
  dark: {
    card: "border-white/10 bg-white/5 hover:border-gold/30 hover:bg-white/10",
    title: "text-white",
    description: "text-white/70",
  },
};

/**
 * DestinoCard
 *
 * Card de destino: carrossel de fotos no topo (quando há fotos) e bloco de
 * texto embaixo, que é o link pra `/destinos/<slug>`. Usado em dois lugares com
 * o mesmo componente — seção da home (tone "dark", fundo navy) e índice
 * `/destinos` (tone "light", fundo branco). Um card, dois lugares.
 *
 * --- POR QUE O CARD DEIXOU DE SER UM <Link> INTEIRO (parte 2 do lote) ---
 * O carrossel tem botões (setas, pontos e o próprio slide, que abre o
 * lightbox), e `<button>` dentro de `<a>` é HTML inválido: o navegador quebra a
 * árvore e o comportamento de clique fica indefinido. Então o card virou um
 * `<article>` e só o BLOCO DE TEXTO é `<Link>`. O hover continua valendo pro
 * card inteiro porque o `group` está no `<article>` — passar o mouse sobre a
 * foto ainda doura o título e a borda, como antes.
 *
 * --- POR QUE Destino SEM FOTO NÃO GANHA PLACEHOLDER ---
 * O `DestinoFotoCarrossel` retorna `null` com `fotos: []` (Itália). O card fica
 * só com o texto, alinhado ao TOPO, e o `h-full` + `flex-col` faz ele ter a
 * mesma altura dos vizinhos no grid. Nada de bloco cinza nem "fotos em breve":
 * é a regra do D102 (foto só real) aplicada ao card.
 *
 * Por que componente novo e não `ServiceCard`: o ServiceCard é um item de LISTA
 * numerada (número gold à esquerda, border-bottom, empilhado), e o contrato pede
 * um GRID 1/2/4 sem número. O card grande de `/viagens` (foto + número + título)
 * é inline na página, não é componente. Nenhum dos dois cabe sem gambiarra.
 */
export default function DestinoCard({ destino, tone = "light", className = "" }: DestinoCardProps) {
  const t = TONE[tone];
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-md border ${t.card} transition-all duration-medium ease-smooth ${className}`.trim()}
    >
      <DestinoFotoCarrossel fotos={destino.fotos} destinoNome={destino.nome} tone={tone} />
      <Link
        href={`/destinos/${destino.slug}`}
        className="flex flex-1 flex-col p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset lg:p-8"
      >
        <h3
          className={`mb-3 font-display text-2xl leading-tight ${t.title} transition-colors duration-medium ease-smooth group-hover:text-gold`}
        >
          {destino.cardTitulo}
        </h3>
        <p className={`font-body text-sm leading-relaxed ${t.description}`}>{destino.cardApoio}</p>
      </Link>
    </article>
  );
}
