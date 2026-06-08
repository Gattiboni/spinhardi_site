import Link from "next/link";
import Button from "@/components/ui/Button";
import { getPosts } from "@/lib/blog";
import { formatDate } from "@/lib/utils/date";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts · Admin",
};

export default async function AdminBlogList() {
  const posts = await getPosts(); // todos, inclusive rascunhos

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
                  <Link
                    href={`/admin/blog/${post.slug}`}
                    className="text-gold hover:underline font-body text-sm"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
