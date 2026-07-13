"use server";

import { createPost, updatePost, deletePost } from "@/lib/blog";
import {
  type PostInput,
  type SaveResult,
  IMAGE_ALLOWED_TYPES,
  IMAGE_MAX_BYTES,
} from "@/lib/blog/types";
import { FieldError } from "@/lib/blog/errors";
import { getSession } from "@/lib/auth/session";

/**
 * Server actions do admin do blog — a fronteira RPC que o `PostForm` (client
 * component) chama. Como o arquivo é `"use server"`, o Next nunca o inclui no
 * bundle do cliente, então importar o grafo server-only de `@/lib/blog` aqui é
 * seguro. As actions capturam erros e devolvem um resultado serializável pro
 * form exibir (ex.: colisão de slug), em vez de estourar.
 *
 * SEGURANÇA: toda action checa sessão + role NO SERVIDOR (`getSession` só
 * devolve usuário `approved` com role admin/editor). O `/admin` valida role no
 * client, mas isso é decorativo — a fonte da verdade é aqui, e sem esta checagem
 * qualquer requisição podia mandar 3MB pro nosso Sanity. Usamos `getSession`
 * (não `requireSession`, que faz `redirect()`): a action é RPC e devolve um erro
 * serializável, e um `redirect` dentro do try seria engolido pelo catch.
 */

/** Extrai o `File` do FormData (só o arquivo trafega por fora do `PostInput`).
 *  Campo vazio (nada selecionado) vira `null`. */
function readImageFile(imageForm?: FormData): File | null {
  const raw = imageForm?.get("image");
  return raw instanceof File && raw.size > 0 ? raw : null;
}

/** Roles que podem gerenciar posts. O `getSession` já restringe a admin/editor,
 *  mas repetimos a checagem AQUI, explícita e local: a garantia de segurança do
 *  blog não deve depender de um detalhe de outro módulo, e assim sobrevive a uma
 *  futura mudança no `getSession`. */
const CAN_MANAGE_POSTS = new Set(["admin", "editor"]);

export async function savePostAction(
  args: {
    id?: string;
    input: PostInput;
    publish: boolean;
  },
  imageForm?: FormData,
): Promise<SaveResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente para salvar." };
  }
  if (!CAN_MANAGE_POSTS.has(session.role)) {
    return { ok: false, error: "Você não tem permissão para gerenciar posts." };
  }

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

  // Validação do arquivo no servidor (de novo, sem confiar no client). O
  // `uploadImageAsset` revalida como guarda final do módulo; aqui falhamos antes
  // de tocar o Sanity, com erro inline no campo de imagem.
  const file = readImageFile(imageForm);
  if (file) {
    if (!(IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, error: "Formato inválido. Envie JPG, PNG ou WebP.", field: "image" };
    }
    if (file.size > IMAGE_MAX_BYTES) {
      return { ok: false, error: "A imagem passa de 3 MB. Escolha um arquivo menor.", field: "image" };
    }
  }

  const image = { file, alt: args.input.imageAlt, remove: !!args.input.removeImage };

  try {
    const res = args.id
      ? await updatePost(args.id, args.input, { publish: args.publish }, image)
      : await createPost(args.input, { publish: args.publish }, image);
    return { ok: true, id: res.id, slug: res.slug };
  } catch (err) {
    // Validação de imagem/alt no publish nasce em `@/lib/blog` (depende de ler o
    // doc atual) e sobe como FieldError — mapeia pro campo inline.
    if (err instanceof FieldError) {
      return { ok: false, error: err.message, field: err.field };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar o post." };
  }
}

export async function deletePostAction(id: string): Promise<SaveResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente para excluir." };
  }
  if (!CAN_MANAGE_POSTS.has(session.role)) {
    return { ok: false, error: "Você não tem permissão para gerenciar posts." };
  }
  try {
    await deletePost(id);
    return { ok: true, id, slug: "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao excluir o post." };
  }
}
