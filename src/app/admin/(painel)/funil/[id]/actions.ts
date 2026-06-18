"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  updateOpportunity,
  updateOpportunityStatus,
  ClickMassaError,
} from "@/lib/integrations/clickmassa";

export type ActionResult = { success: true } | { error: string };

export async function updateOpportunityAction(
  opportunityId: number,
  formData: FormData,
): Promise<ActionResult> {
  await requireSession();

  const patch = {
    name: String(formData.get("name") ?? "").trim() || undefined,
    description: (formData.get("description") as string | null) ?? null,
    value:
      formData.get("value") !== ""
        ? Number(formData.get("value"))
        : undefined,
    expectedCloseDate:
      (formData.get("expectedCloseDate") as string | null) || null,
    pipelineStepId: formData.get("pipelineStepId")
      ? Number(formData.get("pipelineStepId"))
      : undefined,
    responsibleId:
      (formData.get("responsibleId") as string | null) || null,
  };

  try {
    await updateOpportunity(opportunityId, patch);
    revalidatePath("/admin/funil");
    revalidatePath(`/admin/funil/${opportunityId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ClickMassaError) {
      return { error: `${err.code}: ${err.message}` };
    }
    return { error: (err as Error).message ?? "Erro desconhecido" };
  }
}

export async function updateOpportunityStatusAction(
  opportunityId: number,
  status: "won" | "lost",
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();

  const gainOrLossReasonId =
    (formData.get("gainOrLossReasonId") as string | null) || undefined;
  const note = (formData.get("note") as string | null) || undefined;

  try {
    await updateOpportunityStatus(opportunityId, status, {
      // TODO G.2: mapear session.id (Supabase UUID) para ID do usuario no ClickMassa
      userId: session.id,
      gainOrLossReasonId,
      note,
    });
    revalidatePath("/admin/funil");
    revalidatePath(`/admin/funil/${opportunityId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ClickMassaError) {
      return { error: `${err.code}: ${err.message}` };
    }
    return { error: (err as Error).message ?? "Erro desconhecido" };
  }
}
