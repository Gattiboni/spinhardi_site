"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Post, CATEGORIES } from "@/lib/blog/types";

type PostFormProps = {
  /** Se fornecido, é edição; se ausente, é criação. */
  initialPost?: Post;
};

export default function PostForm({ initialPost }: PostFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: initialPost?.title ?? "",
    slug: initialPost?.slug ?? "",
    category: initialPost?.category ?? "Destinos",
    excerpt: initialPost?.excerpt ?? "",
    body: initialPost?.body ?? "",
    thumbnail: initialPost?.thumbnail ?? "",
    seoTitle: initialPost?.seoTitle ?? "",
    seoDescription: initialPost?.seoDescription ?? "",
    status: initialPost?.status ?? "rascunho",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  // CRUD desativado na Fase 1.4 — implementação real virá com Sanity (Fase 3).
  const handleSave = () => {
    alert(
      "Implementação completa virá com Sanity (Fase 3). Por enquanto, posts são gerenciados via mock.",
    );
  };

  const inputClass =
    "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  const labelClass = "block font-body text-sm font-medium text-dark mb-2";

  return (
    <div className="bg-white rounded-md border border-dark/10 p-8">
      <div className="space-y-6">
        <div>
          <label htmlFor="title" className={labelClass}>
            Título *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            value={values.title}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug *
          </label>
          <input
            type="text"
            id="slug"
            name="slug"
            required
            value={values.slug}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Categoria *
          </label>
          <select
            id="category"
            name="category"
            required
            value={values.category}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="excerpt" className={labelClass}>
            Excerpt *
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={3}
            required
            value={values.excerpt}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="body" className={labelClass}>
            Body *{" "}
            <span className="text-dark/50 font-normal">
              (use # para h2, ## para h3, parágrafos separados por linha em branco)
            </span>
          </label>
          <textarea
            id="body"
            name="body"
            rows={12}
            required
            value={values.body}
            onChange={handleChange}
            className={`${inputClass} resize-y font-mono text-sm`}
          />
        </div>

        <div>
          <label htmlFor="thumbnail" className={labelClass}>
            Thumbnail{" "}
            <span className="text-dark/50 font-normal">
              (URL — upload virá na Fase 3 com Sanity)
            </span>
          </label>
          <input
            type="text"
            id="thumbnail"
            name="thumbnail"
            value={values.thumbnail ?? ""}
            onChange={handleChange}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="seoTitle" className={labelClass}>
            SEO Title
          </label>
          <input
            type="text"
            id="seoTitle"
            name="seoTitle"
            value={values.seoTitle}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="seoDescription" className={labelClass}>
            SEO Description
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={2}
            value={values.seoDescription}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            value={values.status}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-8 border-t border-dark/10">
        <Button variant="ghost" size="md" onClick={() => router.push("/admin/blog")}>
          Cancelar
        </Button>
        <Button variant="secondary" size="md" onClick={handleSave}>
          Salvar como rascunho
        </Button>
        <Button variant="primary" size="md" onClick={handleSave}>
          Publicar
        </Button>
      </div>
    </div>
  );
}
