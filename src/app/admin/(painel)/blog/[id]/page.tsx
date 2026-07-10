import { getAdminPostBySlug } from "@/lib/blog";
import { notFound } from "next/navigation";
import PostForm from "@/components/admin/PostForm";
import type { Metadata } from "next";

type Props = {
  // O segmento `[id]` carrega, na prática, o slug do post (as rotas do admin
  // linkam por slug). Carrega o draft se existir, senão o publicado.
  params: Promise<{ id: string }>;
};

// Leitura via write client (enxerga drafts): sempre fresco, sem cache estático.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getAdminPostBySlug(id);
  return {
    title: post ? `Editar: ${post.title} · Admin` : "Post não encontrado",
  };
}

export default async function EditarPost({ params }: Props) {
  const { id } = await params;
  const post = await getAdminPostBySlug(id);
  if (!post) notFound();

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Editar post</h1>
      <PostForm initialPost={post} />
    </div>
  );
}
