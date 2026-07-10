"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Post, PostCategory, CATEGORIES } from "@/lib/blog/types";
import { savePostAction, deletePostAction } from "@/lib/blog/actions";

type PostFormProps = {
  /** Se fornecido, é edição; se ausente, é criação. */
  initialPost?: Post;
};

/** Qual ação está em voo — dá a cada botão seu próprio loading e evita submit
 *  duplo. `null` = nada rodando. */
type PendingAction = "draft" | "publish" | "delete" | null;

export default function PostForm({ initialPost }: PostFormProps) {
  const router = useRouter();
  // `error` = banner geral (colisão de slug, falha de rede). `fieldErrors` =
  // erros colados no campo (ex.: excerpt vazio). Mesmo padrão do ContactForm.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingAction>(null);
  const busy = pending !== null;
  const postId = initialPost?.id;

  const [values, setValues] = useState({
    title: initialPost?.title ?? "",
    slug: initialPost?.slug ?? "",
    category: (initialPost?.category ?? "Destinos") as PostCategory,
    excerpt: initialPost?.excerpt ?? "",
    body: initialPost?.body ?? "",
    seoTitle: initialPost?.seoTitle ?? "",
    seoDescription: initialPost?.seoDescription ?? "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Digitou no campo que estava com erro? Limpa o erro dele (feedback vivo).
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const submit = async (publish: boolean) => {
    setError(null);
    setFieldErrors({});
    setPending(publish ? "publish" : "draft");
    try {
      const result = await savePostAction({ id: postId, input: values, publish });
      if (result.ok) {
        // A action já revalidou `/admin/blog`; navega limpo (sem `router.refresh`,
        // que travava a transition). Mantém o loading até desmontar.
        router.push("/admin/blog");
        return;
      }
      if (result.field) {
        setFieldErrors({ [result.field]: result.error });
        document.getElementById(result.field)?.focus();
      } else {
        setError(result.error);
      }
      setPending(null);
    } catch {
      setError("Algo deu errado ao salvar. Tente novamente.");
      setPending(null);
    }
  };

  const handleDelete = async () => {
    if (!postId) return;
    if (!confirm("Excluir este post? Rascunho e versão publicada são removidos. Não dá pra desfazer.")) {
      return;
    }
    setError(null);
    setPending("delete");
    try {
      const result = await deletePostAction(postId);
      if (result.ok) {
        router.push("/admin/blog");
        return;
      }
      setError(result.error);
      setPending(null);
    } catch {
      setError("Algo deu errado ao excluir. Tente novamente.");
      setPending(null);
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short disabled:opacity-60";

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
            disabled={busy}
            aria-invalid={!!fieldErrors.title}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
            className={`${inputClass}${fieldErrors.title ? " ring-2 ring-red-400" : ""}`}
          />
          {fieldErrors.title && (
            <p id="title-error" className="mt-2 font-body text-sm text-red-700">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug{" "}
            <span className="text-dark/50 font-normal">(deixe em branco para gerar do título)</span>
          </label>
          <input
            type="text"
            id="slug"
            name="slug"
            value={values.slug}
            onChange={handleChange}
            disabled={busy}
            placeholder="ex.: meu-post"
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
            disabled={busy}
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
            disabled={busy}
            aria-invalid={!!fieldErrors.excerpt}
            aria-describedby={fieldErrors.excerpt ? "excerpt-error" : undefined}
            className={`${inputClass} resize-none${fieldErrors.excerpt ? " ring-2 ring-red-400" : ""}`}
          />
          {fieldErrors.excerpt && (
            <p id="excerpt-error" className="mt-2 font-body text-sm text-red-700">
              {fieldErrors.excerpt}
            </p>
          )}
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
            disabled={busy}
            aria-invalid={!!fieldErrors.body}
            aria-describedby={fieldErrors.body ? "body-error" : undefined}
            className={`${inputClass} resize-y font-mono text-sm${fieldErrors.body ? " ring-2 ring-red-400" : ""}`}
          />
          {fieldErrors.body && (
            <p id="body-error" className="mt-2 font-body text-sm text-red-700">
              {fieldErrors.body}
            </p>
          )}
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
            disabled={busy}
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
            disabled={busy}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 px-4 py-3 rounded-md bg-red-50 border border-red-200 font-body text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end items-center gap-3 mt-8 pt-8 border-t border-dark/10">
        {postId && (
          <Button
            variant="ghost"
            size="md"
            onClick={handleDelete}
            disabled={busy}
            className="mr-auto text-red-600 hover:text-red-700"
          >
            {pending === "delete" ? "Excluindo…" : "Excluir"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.push("/admin/blog")}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button variant="secondary" size="md" onClick={() => submit(false)} disabled={busy}>
          {pending === "draft" ? "Salvando…" : "Salvar como rascunho"}
        </Button>
        <Button variant="primary" size="md" onClick={() => submit(true)} disabled={busy}>
          {pending === "publish" ? "Publicando…" : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
