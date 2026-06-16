"use client";

import { useState } from "react";
import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import BlogCard from "@/components/ui/BlogCard";
import { Post, CATEGORIES, PostCategory } from "@/lib/blog/types";
import { formatDate } from "@/lib/utils/date";

type FilterValue = PostCategory | "Todos";
const FILTERS: FilterValue[] = ["Todos", ...CATEGORIES];

export default function BlogClient({ posts }: { posts: Post[] }) {
  const [active, setActive] = useState<FilterValue>("Todos");

  const filteredPosts = active === "Todos" ? posts : posts.filter((p) => p.category === active);

  return (
    <>
      {/* Bloco 2 - Filtros */}
      <Section spacing="md" className="bg-white">
        <Container>
          <div className="flex flex-wrap gap-3 lg:gap-4">
            {FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                className={`rounded-full border px-5 py-2.5 font-body text-sm uppercase tracking-widest transition-all duration-short ${
                  active === cat
                    ? "bg-gold text-white border-gold"
                    : "border-dark/20 text-dark/60 hover:border-gold"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Container>
      </Section>

      {/* Bloco 3 - Grid de posts */}
      <Section spacing="lg" className="bg-white">
        <Container>
          {filteredPosts.length === 0 ? (
            <p className="font-body text-dark/60 text-center py-12">
              {posts.length === 0
                ? "Em breve, novos conteúdos por aqui."
                : "Nenhum post nesta categoria ainda."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
              {filteredPosts.map((post) => (
                <BlogCard
                  key={post.slug}
                  slug={post.slug}
                  title={post.title}
                  excerpt={post.excerpt}
                  category={post.category}
                  date={formatDate(post.date)}
                  thumbnail={post.thumbnail}
                  className="transition-transform duration-medium hover:-translate-y-1"
                />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
