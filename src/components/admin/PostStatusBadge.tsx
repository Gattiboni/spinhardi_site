/**
 * Badge de status do post (publicado/rascunho). Extraído do markup que já vivia
 * inline na lista do admin, pra ser o MESMO componente na lista e no form — a
 * pessoa vê o mesmo selo nos dois lugares.
 */
export default function PostStatusBadge({ status }: { status: "publicado" | "rascunho" }) {
  const classes =
    status === "publicado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs uppercase tracking-widest ${classes}`}
    >
      {status}
    </span>
  );
}
