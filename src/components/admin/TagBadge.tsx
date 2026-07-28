"use client";

/**
 * Badge de tag. Serve as DUAS origens com aparências distinguíveis, porque a
 * folha de contrato exige que a operadora saiba de onde a tag veio sem ler
 * legenda (T8):
 *
 *  • ClickMassa — pastilha PREENCHIDA com a cor do catálogo do CM.
 *  • interna    — pastilha VAZADA (contorno), cor do catálogo interno.
 *
 * Cor de origem é dado de terceiro (o CM escolhe a dele, a operadora escolhe a
 * dela), então ela entra por `style` inline mesmo — não dá pra tokenizar cor
 * que vem do banco. O resto (raio, altura, tipografia) vem das classes.
 *
 * Tag interna ÓRFÃ (slug gravado cuja tag saiu do catálogo) é exibida
 * normalmente, em cinza, e nunca some da ficha (T6).
 */

const BASE =
  "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-body text-xs whitespace-nowrap";

export function TagClickMassaBadge({ nome, cor }: { nome: string; cor: string | null }) {
  const fundo = cor?.trim() || "#5A667D";
  return (
    <span
      className={`${BASE} text-white`}
      style={{ backgroundColor: fundo }}
      title={`Tag do ClickMassa: ${nome}`}
    >
      {nome}
    </span>
  );
}

export function TagInternaBadge({
  nome,
  cor,
  orfao = false,
  onRemover,
}: {
  nome: string;
  cor: string | null;
  orfao?: boolean;
  onRemover?: () => void;
}) {
  const tinta = orfao ? "#7F889A" : cor?.trim() || "#1A2B4A";
  return (
    <span
      className={`${BASE} border bg-surface`}
      style={{ color: tinta, borderColor: tinta }}
      title={orfao ? `${nome} — esta tag não está mais no catálogo` : `Tag interna: ${nome}`}
    >
      {nome}
      {orfao && <span aria-hidden="true">·</span>}
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Tirar a tag ${nome}`}
          className="ml-0.5 leading-none hover:opacity-60 focus-ring rounded-full"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </span>
  );
}

/** "3 não reconhecidas" — ids órfãos do CM contados, nunca renderizados crus. */
export function TagsOrfasCm({ quantas }: { quantas: number }) {
  if (quantas <= 0) return null;
  return (
    <span
      className={`${BASE} bg-surface-selected text-text-muted`}
      title="Tags do ClickMassa que não estão no catálogo"
    >
      {quantas} não {quantas === 1 ? "reconhecida" : "reconhecidas"}
    </span>
  );
}
