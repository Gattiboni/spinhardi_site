"use server";

import { refreshPipelineStepsCache } from "@/lib/integrations/clickmassa/pipeline-steps-cache";
import { revalidatePath } from "next/cache";

// Retorna void para ser compativel com <form action={...}> do Next.js App Router.
export async function forceRefreshPipelineStepsAction(): Promise<void> {
  await refreshPipelineStepsCache();
  revalidatePath("/admin/funil");
}
