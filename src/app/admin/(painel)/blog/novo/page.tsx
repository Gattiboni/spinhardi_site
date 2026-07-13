import PostForm from "@/components/admin/PostForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Novo post · Admin",
};

export default function NovoPost() {
  // O título ("Novo post" / "Editar post") é renderizado pelo PostForm, dirigido
  // por estado — depois de salvar, o form fica montado e o título se ajusta sozinho.
  return <PostForm />;
}
