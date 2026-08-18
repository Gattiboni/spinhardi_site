"use server";

import { requireSession } from "@/lib/auth/session";
import { criarTagInterna } from "./index";
import { revalidarCatalogoDeTags } from "./revalidate";
import type { TagInterna } from "./shared";

/**
 * Server actions de TAG que qualquer superfície chama.
 *
 * Mora em `lib/` (padrão já usado por `lib/anexos/actions.ts` e
 * `lib/blog/actions.ts`) porque tem TRÊS chamadores em rotas diferentes — ficha
 * do contato, lista de contatos e kanban de jornadas. Pendurar num
 * `app/**\/actions.ts` faria duas telas importarem da pasta de uma terceira, que
 * é como a lista acabou importando de `configuracoes/actions` no lote CAMP.
 *
 * PERMISSÃO (T2): criar tag é `requireSession()` — qualquer aprovado, admin ou
 * editor. A action de Configurações (`createTag`) segue exigindo admin e segue
 * sendo a dona do CRUD completo (grupo, cor livre, editar, excluir); esta aqui
 * cobre só o gesto operacional de "preciso desta tag agora".
 *
 * Não dá pra reusar `createTag` pra isso por dois motivos duros: ela exige
 * `admin`, e `requireRole` REDIRECIONA em vez de devolver erro — chamada de um
 * Client Component, um editor não veria mensagem nenhuma, veria a tela pular
 * pro `/admin`.
 */

export type CriarTagResult = { success: boolean; error?: string; tag?: TagInterna };

/**
 * Cria a tag e devolve ela (T3). `cor` ausente → cor da paleta.
 *
 * Revalida as quatro telas que mostram catálogo de tag (T6). O chamador não
 * depende disso pra aplicar a tag recém-criada — ela volta na resposta — mas
 * depende pra que a próxima navegação já a veja no catálogo.
 */
export async function criarTagInline(entrada: {
  name: string;
  cor?: string | null;
}): Promise<CriarTagResult> {
  try {
    await requireSession();

    const resultado = await criarTagInterna(entrada);
    if (!resultado.ok) return { success: false, error: resultado.erro };

    revalidarCatalogoDeTags();
    return { success: true, tag: resultado.tag };
  } catch (err) {
    console.error("[criarTagInline] erro ao criar tag:", err);
    return { success: false, error: "Não foi possível criar a tag. Tente de novo." };
  }
}
