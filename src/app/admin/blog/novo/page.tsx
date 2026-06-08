import PostForm from "@/components/admin/PostForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novo post · Admin",
};

export default function NovoPost() {
  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Novo post</h1>
      <PostForm />
    </div>
  );
}
