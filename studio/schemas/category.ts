import { defineField, defineType } from "sanity";

/**
 * Categoria do blog.
 *
 * REPLICA exatamente o schema ja deployado (title, description). Nao renomear:
 * ha documentos de categoria vivos no dataset, e o front casa a categoria pelo
 * `title` contra a uniao canonica PostCategory
 * ("Destinos" | "Bastidores" | "Dicas de Viagem" | "Historia da Agencia").
 */
export default defineType({
  name: "category",
  title: "Categoria",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titulo",
      type: "string",
      description: "Nome da categoria. Deve casar com a uniao PostCategory do front para ser reconhecida.",
    }),
    defineField({
      name: "description",
      title: "Descricao",
      type: "text",
      description: "Descricao da categoria.",
      rows: 3,
    }),
  ],
});
