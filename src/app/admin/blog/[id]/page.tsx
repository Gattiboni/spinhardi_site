import { getPostBySlug } from "@/lib/blog";
import { notFound } from "next/navigation";
import PostForm from "@/components/admin/PostForm";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostBySlug(id);
  return {
    title: post ? `Editar: ${post.title} · Admin` : "Post não encontrado",
  };
}

export default async function EditarPost({ params }: Props) {
  const { id } = await params;
  const post = await getPostBySlug(id);
  if (!post) notFound();

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Editar post</h1>
      <PostForm initialPost={post} />
    </div>
  );
}
