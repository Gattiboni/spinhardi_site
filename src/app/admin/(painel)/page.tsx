import { getContactStats } from "@/lib/contacts";
import { iddas } from "@/lib/integrations/iddas";
import { clickmassa } from "@/lib/integrations/clickmassa";
import { getPosts } from "@/lib/blog";
import { requireSession } from "@/lib/auth/session";
import DashboardClient from "./DashboardClient";

// Leitura ao vivo do Supabase a cada request (sem prerender de snapshot vazio).
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [session, contactStats, iddasStats, clickmassaStats, posts] = await Promise.all([
    requireSession(),
    getContactStats(),
    iddas.getStats(),
    clickmassa.getStats(),
    getPosts({ status: "publicado" }),
  ]);

  return (
    <DashboardClient
      contactStats={contactStats}
      iddasStats={iddasStats}
      clickmassaStats={clickmassaStats}
      postsCount={posts.length}
      userName={session.name}
    />
  );
}
