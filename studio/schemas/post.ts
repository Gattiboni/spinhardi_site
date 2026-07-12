import { defineField, defineType } from "sanity";

/**
 * Post do blog.
 *
 * Os campos title, slug, author, mainImage, categories, publishedAt e body
 * REPLICAM exatamente o schema ja deployado (nomes e tipos nao mudam — existem
 * documentos vivos que dependem deles). Os campos excerpt, seoTitle,
 * seoDescription e ogImage sao NOVOS (adicionados neste lote B0).
 */
export default defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titulo",
      type: "string",
      description: "Titulo do post. Obrigatorio.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description: "Identificador na URL (ex.: /blog/meu-post). Obrigatorio, gerado a partir do titulo.",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "author",
      title: "Autor",
      type: "reference",
      description: "Referencia ao documento de autor que assina o post.",
      to: [{ type: "author" }],
    }),
    defineField({
      name: "mainImage",
      title: "Imagem principal",
      type: "image",
      description: "Imagem de capa do post, exibida no topo e no card da listagem.",
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: "alt",
          title: "Texto alternativo",
          type: "string",
          description:
            "Descreve a imagem em uma frase, pra quem usa leitor de tela e pro Google. Ex: 'Vista da Toscana ao por do sol'.",
        }),
      ],
    }),
    defineField({
      name: "categories",
      title: "Categorias",
      type: "array",
      description: "Categorias do post. O front mapeia pela categoria cujo title casa com a uniao canonica.",
      of: [{ type: "reference", to: [{ type: "category" }] }],
    }),
    defineField({
      name: "publishedAt",
      title: "Publicado em",
      type: "datetime",
      description: "Data e hora de publicacao do post.",
    }),
    defineField({
      name: "excerpt",
      title: "Resumo",
      type: "text",
      description: "Resumo curto do post (usado em cards, listagens e como fallback de meta description). Campo novo.",
      rows: 3,
    }),
    defineField({
      name: "body",
      title: "Conteudo",
      type: "array",
      description: "Corpo do post em Portable Text (rich text).",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "seoTitle",
      title: "SEO — Titulo",
      type: "string",
      description: "Titulo para mecanismos de busca e compartilhamento (<title>/og:title). Se vazio, usa o titulo do post. Campo novo.",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO — Descricao",
      type: "text",
      description: "Meta description para busca e compartilhamento. Se vazio, usa o resumo. Campo novo.",
      rows: 3,
    }),
    defineField({
      name: "ogImage",
      title: "SEO — Imagem de compartilhamento (OG)",
      type: "image",
      description: "Imagem exibida ao compartilhar o link em redes sociais (og:image). Se vazio, usa a imagem principal. Campo novo.",
      options: {
        hotspot: true,
      },
    }),
  ],
  preview: {
    select: {
      title: "title",
      author: "author.name",
      media: "mainImage",
    },
    prepare(selection) {
      const { author } = selection;
      return { ...selection, subtitle: author && `por ${author}` };
    },
  },
});
