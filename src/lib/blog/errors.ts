import type { PostInput } from "./types";

/** Chave de campo que um erro de validação pode apontar (mesmo domínio de
 *  `SaveResult.field`): qualquer campo do `PostInput` ou o campo de arquivo
 *  `"image"`, que vive fora do input. */
export type FieldErrorKey = keyof PostInput | "image";

/**
 * Erro de validação do servidor que carrega o campo culpado.
 *
 * A validação de title/excerpt/body roda na própria action (antes de tocar o
 * Sanity). Já a de imagem/alt no publish depende de LER o documento atual (a
 * capa pode já existir), então nasce dentro de `@/lib/blog` (`createPost`/
 * `updatePost`) e sobe como `FieldError`. A action captura e mapeia pro
 * `SaveResult` inline, em vez de virar um banner genérico.
 */
export class FieldError extends Error {
  field: FieldErrorKey;

  constructor(message: string, field: FieldErrorKey) {
    super(message);
    this.name = "FieldError";
    this.field = field;
  }
}
