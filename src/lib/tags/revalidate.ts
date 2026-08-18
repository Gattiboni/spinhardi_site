import "server-only";
import { revalidatePath } from "next/cache";

/**
 * As telas que leem o CATÁLOGO de tags (T6).
 *
 * Antes só `/admin/configuracoes` era revalidada pelo CRUD, então uma tag
 * renomeada continuava com o nome velho na ficha, na lista e no funil até
 * alguém dar F5. A lista mora aqui, num lugar só: tela nova que passe a ler
 * catálogo entra nesta função e todas as actions herdam.
 *
 * `/admin/contatos/[id]` usa o padrão de rota + `"page"` porque a mudança é de
 * VOCABULÁRIO, não de um contato específico — não há id pra montar caminho
 * literal. As actions que mexem em UM contato continuam revalidando o caminho
 * literal daquele contato, como sempre fizeram.
 *
 * Módulo separado (e não export do `./actions`) de propósito: num arquivo
 * `"use server"` todo export vira endpoint de action, e isto é um helper de
 * servidor, não uma ação que o cliente possa disparar.
 */
export function revalidarCatalogoDeTags(): void {
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/contatos");
  revalidatePath("/admin/contatos/[id]", "page");
  revalidatePath("/admin/jornadas");
}
