"use server";

import { createContact, addInteraction } from "@/lib/contacts";
import { draftContactFromForm, type ContactFormInput } from "@/lib/contacts/from-form";
import { sendContactNotification } from "@/lib/email/resend";
import { syncContactFlow } from "@/lib/integrations/clickmassa";
import { syncResultToContactPatch } from "@/lib/contacts/clickmassa-mapper";
import { getCachedPipelineSteps } from "@/lib/integrations/clickmassa/pipeline-steps-cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Contact } from "@/lib/contacts/types";
import type { SyncContactResult } from "@/lib/integrations/clickmassa";

// Mesmos campos coletados pelo formulário do site (shape compartilhado com o
// cadastro manual). Mantido como `ContactFormData` pra não mudar o consumidor.
export type ContactFormData = ContactFormInput;

export type ContactFormResult = {
  success: boolean;
  error?: string;
};

// Monta descricao humano-legivel para a interaction sync_clickmassa.
// Le nome do stage do cache local para evitar chamada de API extra.
async function buildSyncDescricao(result: SyncContactResult): Promise<string> {
  switch (result.status) {
    case "opportunity_created": {
      let stageName = `step ${result.clickmassaPipelineStepId}`;
      if (result.clickmassaPipelineStepId !== null) {
        try {
          const steps = await getCachedPipelineSteps();
          const step = steps.find((s) => s.id === result.clickmassaPipelineStepId);
          if (step) stageName = step.name;
        } catch {
          // ignorar: stageName ja tem fallback
        }
      }
      return `Lead sincronizado com ClickMassa. Opp #${result.clickmassaOpportunityId} criada no stage "${stageName}".`;
    }
    case "message_sent":
      return "Mensagem WhatsApp enviada via ClickMassa. Oportunidade ainda nao criada.";
    case "blocked":
      return `Mensagem enviada, mas criacao da oportunidade bloqueada: ${result.error ?? "sem detalhes"}`;
    case "failed":
      return `Falha na sincronizacao: ${result.error ?? "sem detalhes"}`;
  }
}

/**
 * Captura do formulário do site.
 *
 * Cria o contato real no Supabase com `origem: "site_contato"` e registra uma
 * interação `form_submission`. O contato é salvo ANTES de qualquer outra coisa —
 * zero perda de lead (se a interação falhar, o contato já está salvo).
 *
 * Apos o insert, dispara sync ClickMassa fire-and-forget (boas-vindas WhatsApp
 * + oportunidade no funil). O resultado e gravado de volta no contato em
 * background. O usuario recebe sucesso imediato independente da sync.
 */
export async function submitContact(data: ContactFormData): Promise<ContactFormResult> {
  let contact: Contact;

  try {
    const draft = draftContactFromForm(data, { origem: "site_contato", hadInteraction: true });
    contact = await createContact(draft);
  } catch (err) {
    console.error("[submitContact] erro ao criar contato:", err);
    return { success: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }

  // Contato já salvo — uma falha aqui não deve fazer o cliente reenviar (evita
  // duplicar o lead). Loga e segue.
  try {
    await addInteraction(contact.id, {
      tipo: "form_submission",
      descricao: "Captura via site (formulário de contato)",
      metadata: { origem: "site_contato", destino: data.destinoTipo },
      criadoPor: "sistema",
    });
  } catch (err) {
    console.error("[submitContact] contato criado, mas falhou ao registrar a interação:", err);
  }

  // Notificação por e-mail é best-effort: o contato já está salvo (fonte de
  // verdade). Se o Resend falhar (chave inválida, rede, etc.), loga e segue —
  // o usuário recebe sucesso do mesmo jeito.
  try {
    await sendContactNotification(contact);
  } catch (err) {
    console.error("[submitContact] contato salvo, mas falhou ao enviar e-mail (Resend):", err);
  }

  // Sync ClickMassa fire-and-forget: envia boas-vindas no WhatsApp + cria
  // oportunidade no funil. Roda em background sem bloquear o response pro
  // usuario. Qualquer falha e logada; o form ja retornou sucesso.
  void (async () => {
    try {
      const result = await syncContactFlow({
        id: contact.id,
        name: contact.name,
        phone: contact.whatsapp,
        email: contact.email,
      });
      const patch = syncResultToContactPatch(result);
      const { error: updateError } = await supabaseAdmin()
        .from("contacts")
        .update(patch)
        .eq("id", contact.id);
      if (updateError) {
        console.error("[submitContact] falha no UPDATE ClickMassa:", updateError);
      }

      // Registra interaction sync_clickmassa (schema: tipo = 'sync_clickmassa')
      try {
        const descricao = await buildSyncDescricao(result);
        await addInteraction(contact.id, {
          tipo: "sync_clickmassa",
          descricao,
          metadata: {
            syncResult: result,
            syncedAt: new Date().toISOString(),
          },
          criadoPor: "sistema",
        });
      } catch (interactionErr) {
        console.error("[submitContact] contato atualizado, mas falhou ao registrar interaction sync_clickmassa:", interactionErr);
      }
    } catch (err) {
      console.error("[submitContact] erro na sync ClickMassa:", err);
    }
  })();

  return { success: true };
}
