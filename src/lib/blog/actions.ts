"use server";

import { createPost, updatePost, deletePost } from "@/lib/blog";
import type { PostInput, SaveResult } from "@/lib/blog/types";

/**
 * Server actions do admin do blog — a fronteira RPC que o `PostForm` (client
 * component) chama. Como o arquivo é `"use server"`, o Next nunca o inclui no
 * bundle do cliente, então importar o grafo server-only de `@/lib/blog` aqui é
 * seguro. As actions capturam erros e devolvem um resultado serializável pro
 * form exibir (ex.: colisão de slug), em vez de estourar.
 */

export async function savePostAction(args: {
  id?: string;
  input: PostInput;
  publish: boolean;
}): Promise<SaveResult> {
  // Campos obrigatórios DE VERDADE: o `*`/`required` da UI é decorativo — o submit
  // é via onClick, não via <form>, então a validação nativa do browser nunca
  // dispara. O servidor é a fonte da verdade. Ordem = ordem do form (title, então
  // excerpt, então body); devolve o primeiro que falhar pro form focar nele.
  if (!args.input.title.trim()) {
    return { ok: false, error: "O título é obrigatório.", field: "title" };
  }
  if (!args.input.excerpt.trim()) {
    // Além de resumo, é o fallback da meta description pública (ver
    // `generateMetadata` do post).
    return {
      ok: false,
      error: "O resumo é obrigatório — ele vira a descrição do post nas buscas e redes.",
      field: "excerpt",
    };
  }
  if (!args.input.body.trim()) {
    return { ok: false, error: "O conteúdo do post é obrigatório.", field: "body" };
  }

  try {
    const res = args.id
      ? await updatePost(args.id, args.input, { publish: args.publish })
      : await createPost(args.input, { publish: args.publish });
    return { ok: true, slug: res.slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar o post." };
  }
}

export async function deletePostAction(id: string): Promise<SaveResult> {
  try {
    await deletePost(id);
    return { ok: true, slug: "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao excluir o post." };
  }
}
