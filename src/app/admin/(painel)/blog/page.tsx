import Link from "next/link";
import Button, { buttonStyles } from "@/components/ui/Button";
import { getAdminPosts } from "@/lib/blog";
import { formatDate } from "@/lib/utils/date";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts · Admin",
};

// Escrita/leitura via write client: sempre fresco, sem cache estático.
export const dynamic = "force-dynamic";

export default async function AdminBlogList() {
  const posts = await getAdminPosts(); // rascunhos E publicados, com status real

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-navy">Posts</h1>
        <Link href="/admin/blog/novo">
          <Button variant="primary" size="md">
            + Novo post
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-md border border-dark/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark/10 bg-dark/5">
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Título
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Categoria
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Data
              </th>
              <th className="text-left px-6 py-4 font-body text-sm uppercase tracking-widest text-dark/60">
                Status
              </th>
              <th className="text-right px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.slug}
                className="border-b border-dark/5 last:border-0 hover:bg-dark/5 transition-colors duration-short"
              >
                <td className="px-6 py-4 font-body text-dark">
                  <Link
                    href={`/admin/blog/${post.slug}`}
                    className="hover:text-gold transition-colors duration-short"
                  >
                    {post.title}
                  </Link>
                </td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">{post.category}</td>
                <td className="px-6 py-4 font-body text-sm text-dark/60">
                  {formatDate(post.date)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs uppercase tracking-widest ${
                      post.status === "publicado"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {post.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-4">
                    {/* Só a versão PUBLICADA tem página pública (client roda
                        perspective: "published"). Rascunho nunca publicado →
                        botão desabilitado, não escondido, com o porquê no title. */}
                    {post.status === "publicado" && post.publishedSlug ? (
                      <a
                        href={`/blog/${post.publishedSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonStyles("ghost", "sm")}
                      >
                        Ver no site
                      </a>
                    ) : (
                      <span
                        title="Publique o post para vê-lo no site."
                        className="inline-block"
                      >
                        <Button variant="ghost" size="sm" disabled>
                          Ver no site
                        </Button>
                      </span>
                    )}
                    <Link
                      href={`/admin/blog/${post.slug}`}
                      className="text-gold hover:underline font-body text-sm"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
