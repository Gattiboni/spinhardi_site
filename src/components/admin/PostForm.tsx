"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Button, { buttonStyles } from "@/components/ui/Button";
import PostStatusBadge from "@/components/admin/PostStatusBadge";
import {
  Post,
  PostCategory,
  CATEGORIES,
  IMAGE_ALLOWED_TYPES,
  IMAGE_MAX_BYTES,
} from "@/lib/blog/types";
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
  // `success` = confirmação da ação ("Post publicado." / "Rascunho salvo."), perto
  // dos botões. Some ao mexer em qualquer campo. Publish e rascunho NÃO navegam
  // mais (o form fica montado), então basta estado local — sem flash, sem storage.
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const busy = pending !== null;

  // `postId` é ESTADO: começa do post carregado (edição) e passa a existir depois
  // do 1º save de um post novo — é o que faz o 2º save ser UPDATE, não CREATE (sem
  // ele, salvar 2x um post novo criaria dois posts).
  const [postId, setPostId] = useState<string | undefined>(initialPost?.id);

  const [values, setValues] = useState({
    title: initialPost?.title ?? "",
    slug: initialPost?.slug ?? "",
    category: (initialPost?.category ?? "Destinos") as PostCategory,
    excerpt: initialPost?.excerpt ?? "",
    body: initialPost?.body ?? "",
    seoTitle: initialPost?.seoTitle ?? "",
    seoDescription: initialPost?.seoDescription ?? "",
    // Conteúdo serializável da capa (o arquivo em si vive à parte, ver abaixo).
    imageAlt: initialPost?.thumbnailAlt ?? "",
    removeImage: false,
  });

  // O `File` NÃO entra em `values` (não é serializável e não casa com o padrão
  // de `handleChange`). Ele e o preview local vivem em estado próprio. O upload
  // só acontece ao salvar/publicar (dentro da action) — não na seleção — pra não
  // criar asset órfão se a Nina abandonar o post.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // O objectURL do preview é criado no handler de seleção; este efeito só o
  // REVOGA (quando troca ou no unmount), sem setState no corpo — assim não
  // dispara renders em cascata.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // O que mostrar: arquivo novo (blob) tem prioridade; senão a capa do Sanity
  // (a menos que a Nina tenha marcado remover). Sem nenhum → sem preview.
  const displayUrl =
    previewUrl ?? (values.removeImage ? null : initialPost?.thumbnail ?? null);
  const hasImage = !!displayUrl;

  // Estado do botão "Ver no site". Só a versão PUBLICADA tem página pública, e o
  // alvo é o `publishedSlug` (não o de exibição, que pode ser o do draft). Seed
  // do servidor; atualizado do RETORNO da action ao publicar (sem refetch, sem
  // router.refresh) pra funcionar sem F5 mesmo com o slug recém-criado.
  const [viewSlug, setViewSlug] = useState<string | null>(initialPost?.publishedSlug ?? null);
  const [isPublished, setIsPublished] = useState(initialPost?.status === "publicado");
  const [hasPendingDraft, setHasPendingDraft] = useState(initialPost?.hasPendingDraft ?? false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Mexeu em algo → a confirmação anterior já não descreve o estado atual.
    if (success) setSuccess(null);
    // Digitou no campo que estava com erro? Limpa o erro dele (feedback vivo).
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  /** Zera só o erro de um campo (usado nos handlers de imagem, que não passam
   *  pelo `handleChange` genérico). */
  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (success) setSuccess(null);

    // Validação client-side (formato + tamanho), erro inline no campo de imagem.
    // O servidor revalida — isto é só pra Nina não esperar um upload que vai falhar.
    if (!(IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, image: "Formato inválido. Envie JPG, PNG ou WebP." }));
      e.target.value = "";
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setFieldErrors((prev) => ({ ...prev, image: "A imagem passa de 4 MB. Escolha um arquivo menor." }));
      e.target.value = "";
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    // Escolher arquivo cancela um "remover" pendente (o arquivo novo vence).
    setValues((prev) => ({ ...prev, removeImage: false }));
    clearFieldError("image");
  };

  const handleChangeImage = () => fileInputRef.current?.click();

  const handleRemoveImage = () => {
    if (success) setSuccess(null);
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // `removeImage: true` só faz efeito real quando havia capa existente; num post
    // sem capa é inócuo. Limpa o alt junto (sem imagem, não há o que descrever).
    setValues((prev) => ({ ...prev, removeImage: true, imageAlt: "" }));
    clearFieldError("image");
    clearFieldError("imageAlt");
  };

  const submit = async (publish: boolean) => {
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    setPending(publish ? "publish" : "draft");
    try {
      // Só o arquivo vai por fora, em FormData; o resto (incl. imageAlt/removeImage)
      // segue tipado no `input`.
      let imageForm: FormData | undefined;
      if (imageFile) {
        imageForm = new FormData();
        imageForm.append("image", imageFile);
      }
      const result = await savePostAction({ id: postId, input: values, publish }, imageForm);
      if (result.ok) {
        // Nem publish nem rascunho navegam: o form fica montado e vira o editor do
        // post agora salvo. Guarda o `id` base (pro próximo save ser UPDATE) e fixa
        // o slug canônico no campo (idempotência + o campo passa a refletir a URL).
        setPostId(result.id);
        setValues((prev) => ({ ...prev, slug: result.slug }));
        if (publish) {
          // Publicado agora: badge → PUBLICADO e "Ver no site" já funciona, tudo do
          // RETORNO da action (sem refetch). Sem rascunho pendente (acabou de ir ao ar).
          setViewSlug(result.slug);
          setIsPublished(true);
          setHasPendingDraft(false);
          setSuccess("Post publicado.");
        } else {
          // Rascunho não muda se existe versão publicada; se existe, agora há um
          // rascunho por cima dela (pendente).
          setHasPendingDraft(isPublished);
          setSuccess("Rascunho salvo.");
        }
        // Corrige a URL na barra (post novo estava em /novo) SEM desmontar o form
        // nem disparar navegação do Next — o Next sincroniza o `usePathname` (doc
        // oficial). F5 passa a abrir /admin/blog/{slug}; "voltar" leva à lista.
        window.history.replaceState(null, "", `/admin/blog/${result.slug}`);
        setPending(null);
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
    <>
      {/* Título dirigido por estado (não pela rota): depois de salvar um post novo
          o form fica montado, então "Novo post" viraria mentira. `postId` (estado)
          existe assim que o post é salvo → "Editar post". */}
      <h1 className="font-display text-3xl text-navy mb-8">
        {postId ? "Editar post" : "Novo post"}
      </h1>

      <div className="bg-white rounded-md border border-dark/10 p-8">
        {/* Barra do topo: "Ver no site" (só a versão publicada tem página pública).
          Rascunho nunca publicado → desabilitado, com o porquê no title. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-dark/10 pb-6">
        <div className="max-w-md space-y-2">
          {/* Status atual do post, mesmo selo da lista. `isPublished` é estado local:
              muda pra PUBLICADO na hora ao publicar, sem F5. Post novo ainda não salvo
              (sem `postId` e não publicado) não tem status → sem badge. */}
          {(isPublished || postId) && (
            <PostStatusBadge status={isPublished ? "publicado" : "rascunho"} />
          )}
          {isPublished && hasPendingDraft && (
            <p className="font-body text-sm text-dark/60">
              Você está vendo a versão publicada. Suas alterações só aparecem depois de publicar.
            </p>
          )}
        </div>
        {isPublished && viewSlug ? (
          <a
            href={`/blog/${viewSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles("secondary", "sm")}
          >
            Ver no site
          </a>
        ) : (
          <span title="Publique o post para vê-lo no site." className="inline-block">
            <Button variant="secondary" size="sm" disabled>
              Ver no site
            </Button>
          </span>
        )}
      </div>

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
          <label htmlFor="image" className={labelClass}>
            Imagem de capa{" "}
            <span className="text-dark/50 font-normal">(obrigatória para publicar)</span>
          </label>

          {/* Input nativo escondido — cru ele não passa pra usuária. Fica `sr-only`
              (não `hidden`) pra continuar focável quando o erro manda o foco pra cá.
              Os botões abaixo é que disparam a seleção. */}
          <input
            ref={fileInputRef}
            type="file"
            id="image"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={busy}
            aria-invalid={!!fieldErrors.image}
            aria-describedby={fieldErrors.image ? "image-error" : undefined}
            className="sr-only"
          />

          {hasImage ? (
            <div className="space-y-3">
              <div
                className={`relative aspect-video w-full max-w-md overflow-hidden rounded-md border border-dark/10 bg-dark/5${
                  fieldErrors.image ? " ring-2 ring-red-400" : ""
                }`}
              >
                {/* Preview local (blob) e capa do Sanity num só caminho; `img` cru
                    evita o otimizador do next/image com blob: URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayUrl!}
                  alt="Pré-visualização da capa"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" onClick={handleChangeImage} disabled={busy}>
                  Trocar imagem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={busy}
                  className="text-red-600 hover:text-red-700"
                >
                  Remover imagem
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="md" onClick={handleChangeImage} disabled={busy}>
              Escolher imagem
            </Button>
          )}

          {fieldErrors.image && (
            <p id="image-error" className="mt-2 font-body text-sm text-red-700">
              {fieldErrors.image}
            </p>
          )}
          <p className="mt-2 font-body text-xs text-dark/50">
            JPG, PNG ou WebP, até 4 MB.
          </p>

          {hasImage && (
            <div className="mt-4">
              <label htmlFor="imageAlt" className={labelClass}>
                Texto alternativo *
              </label>
              <input
                type="text"
                id="imageAlt"
                name="imageAlt"
                value={values.imageAlt}
                onChange={handleChange}
                disabled={busy}
                placeholder="ex.: Vista da Toscana ao pôr do sol"
                aria-invalid={!!fieldErrors.imageAlt}
                aria-describedby={fieldErrors.imageAlt ? "imageAlt-error" : "imageAlt-help"}
                className={`${inputClass}${fieldErrors.imageAlt ? " ring-2 ring-red-400" : ""}`}
              />
              {fieldErrors.imageAlt ? (
                <p id="imageAlt-error" className="mt-2 font-body text-sm text-red-700">
                  {fieldErrors.imageAlt}
                </p>
              ) : (
                <p id="imageAlt-help" className="mt-2 font-body text-xs text-dark/50">
                  Descreva a imagem em uma frase — é o que o leitor de tela lê e o que o Google usa
                  pra entender a foto.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="excerpt" className={labelClass}>
            Resumo *
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
            Conteúdo *{" "}
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
            SEO — Título
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
            SEO — Descrição
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

      {success && !error && (
        <p
          role="status"
          className="mt-6 px-4 py-3 rounded-md bg-green-50 border border-green-200 font-body text-sm text-green-700"
        >
          {success}
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
        {/* Publicado e sem rascunho pendente → não há o que publicar; republicar
            seria no-op confuso. Desabilita com o porquê no title, mesmo padrão do
            "Ver no site" desabilitado. */}
        {isPublished && !hasPendingDraft ? (
          <span title="Não há alterações para publicar." className="inline-block">
            <Button variant="primary" size="md" disabled>
              Publicar
            </Button>
          </span>
        ) : (
          <Button variant="primary" size="md" onClick={() => submit(true)} disabled={busy}>
            {pending === "publish" ? "Publicando…" : "Publicar"}
          </Button>
        )}
        </div>
      </div>
    </>
  );
}
