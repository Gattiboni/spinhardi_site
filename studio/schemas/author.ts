import { defineField, defineType } from "sanity";

/**
 * Autor do blog.
 *
 * REPLICA exatamente o schema ja deployado (name, slug, image, bio). Nao
 * renomear: ha documentos de autor vivos no dataset.
 */
export default defineType({
  name: "author",
  title: "Autor",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Nome",
      type: "string",
      description: "Nome do autor.",
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description: "Identificador na URL do autor.",
      options: {
        source: "name",
        maxLength: 96,
      },
    }),
    defineField({
      name: "image",
      title: "Foto",
      type: "image",
      description: "Foto/avatar do autor.",
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "array",
      description: "Biografia do autor em rich text (Portable Text).",
      of: [{ type: "block" }],
    }),
  ],
  preview: {
    select: {
      title: "name",
      media: "image",
    },
  },
});
