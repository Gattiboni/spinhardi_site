import { getContactStats } from "@/lib/contacts";
import { iddas } from "@/lib/integrations/iddas";
import { clickmassa } from "@/lib/integrations/clickmassa";
import { getPosts } from "@/lib/blog";
import DashboardClient from "./DashboardClient";

export default async function AdminDashboard() {
  const [contactStats, iddasStats, clickmassaStats, posts] = await Promise.all([
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
    />
  );
}
