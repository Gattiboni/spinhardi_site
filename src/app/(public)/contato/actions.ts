"use server";

import { after } from "next/server";
import {
  createContact,
  updateContact,
  addInteraction,
  getContactById,
  findExistingContact,
} from "@/lib/contacts";
import {
  draftContactFromForm,
  buildJornadaTituloFromForm,
  buildFormSubmissionPayload,
  isPlaceholderName,
  type ContactFormInput,
} from "@/lib/contacts/from-form";
import { validateSiteContact } from "@/lib/contacts/validation";
import { createJornadaManual, getJornadasDoContato } from "@/lib/jornadas";
import { sendContactNotification } from "@/lib/email/resend";
import { syncContactFlow } from "@/lib/integrations/clickmassa";
import { syncResultToContactPatch } from "@/lib/contacts/clickmassa-mapper";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Contact } from "@/lib/contacts/types";
import type { SyncContactResult } from "@/lib/integrations/clickmassa";

// Mesmos campos coletados pelo formulário do site (shape compartilhado com o
// cadastro manual). Mantido como `ContactFormData` pra não mudar o consumidor.
export type ContactFormData = ContactFormInput;

// Payload que chega do site: os campos do form + o honeypot anti-bot (`website`),
// que é um campo isca invisível pra humano. Fica fora de `ContactFormData` pra
// não vazar pro shape compartilhado com o cadastro manual.
export type SubmitContactPayload = ContactFormData & { website?: string };

export type ContactFormResult = {
  success: boolean;
  error?: string;
  // Campo do form ao qual o erro pertence (quando é erro de validação de um campo
  // específico). O ContactForm usa isso pra colar a mensagem no campo certo — o
  // erro do WhatsApp aparece no WhatsApp, o de e-mail no e-mail, etc.
  field?: string;
};

// Monta descricao humano-legivel para a interaction sync_clickmassa. Sucesso
// terminal do fluxo = mensagem de boas-vindas enviada (a perna de oportunidade
// saiu no Lote 2), então sobram só os dois desfechos.
function buildSyncDescricao(result: SyncContactResult): string {
  switch (result.status) {
    case "message_sent":
      return "Mensagem de boas-vindas enviada no WhatsApp via ClickMassa.";
    case "failed":
      return `Falha na sincronização com ClickMassa: ${result.error ?? "sem detalhes"}`;
  }
}

/**
 * Captura do formulário do site.
 *
 * Fluxo (o contato é salvo/resolvido ANTES de tudo — zero perda de lead):
 *  1. Honeypot: `website` preenchido → bot. Finge sucesso e não grava nada.
 *  2. Validação server-side (nome/WhatsApp obrigatórios, e-mail e caps).
 *  3. Dedup por telefone/e-mail: reusa o contato existente ou cria um novo.
 *  4. Rename de placeholder (só reincidente com nome placeholder) + registra a
 *     interação `form_submission` carregando o payload COMPLETO do form.
 *  5. Cria a jornada no funil (`origem_dado: "site"`), SÍNCRONO — com a regra de
 *     re-submit (não duplica jornada "primeiro contato" de site já aberta).
 *  6. Notifica o time por e-mail (best-effort).
 *  7. SÓ pra contato novo: agenda a sync ClickMassa (boas-vindas no WhatsApp) via
 *     `after()`, que roda depois da resposta e grava o desfecho terminal
 *     (`synced`/`failed`). Contato reincidente não recebe boas-vindas de novo.
 */
export async function submitContact(data: SubmitContactPayload): Promise<ContactFormResult> {
  // 1. Honeypot — se a isca veio preenchida, é bot: responde sucesso sem gravar
  // nada (nenhuma mensagem de erro que ensine o bot a contornar).
  if (data.website && data.website.trim() !== "") {
    return { success: true };
  }

  // 2. Validação server-side. Falha legítima vira erro amigável no form, já
  // marcado com o campo (`field`) pra renderizar colado no input certo.
  const valid = validateSiteContact(data);
  if (!valid.ok) {
    return { success: false, error: valid.error, field: valid.field };
  }

  // 3. Resolve o contato: reusa um existente (dedup por telefone/e-mail) ou cria
  // um novo. Se o dedup falhar, degrada pra "cria novo" (não perde o lead).
  let contact: Contact;
  let contatoNovo: boolean;
  try {
    let existing: Contact | null = null;
    try {
      const match = await findExistingContact({ whatsapp: data.whatsapp, email: data.email });
      existing = match ? await getContactById(match.id) : null;
    } catch (dedupErr) {
      console.error("[submitContact] dedup falhou, seguindo como contato novo:", dedupErr);
      existing = null;
    }

    if (existing) {
      contact = existing;
      contatoNovo = false;
    } else {
      const draft = draftContactFromForm(data, { origem: "site_contato", hadInteraction: true });
      contact = await createContact(draft);
      contatoNovo = true;
    }
  } catch (err) {
    console.error("[submitContact] erro ao resolver/criar contato:", err);
    return { success: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }

  // 4a. Rename de placeholder — SÓ reincidente. Se o contato existente tem nome
  // placeholder (vazio, ou só dígitos batendo com o whatsapp — importados tipo
  // "5511983340447"), adota o nome real digitado no form. Nome com qualquer letra
  // é real e NUNCA é sobrescrito. O rename é auditado na interaction abaixo
  // (nome anterior + novo) — nada de mutação silenciosa.
  let rename: { de: string; para: string } | null = null;
  if (!contatoNovo) {
    const novoNome = data.name.trim();
    if (novoNome && novoNome !== contact.name && isPlaceholderName(contact.name, contact.whatsapp)) {
      rename = { de: contact.name, para: novoNome };
      try {
        await updateContact(contact.id, { name: novoNome });
        contact = { ...contact, name: novoNome };
      } catch (renameErr) {
        console.error("[submitContact] falha ao renomear contato placeholder:", renameErr);
        rename = null; // não registra rename que não persistiu
      }
    }
  }

  // 4b. Interação form_submission — carrega o payload COMPLETO do form no metadata
  // (mesmo shape pros dois caminhos: novo e reincidente), pra ficha exibir quem
  // escreveu e o que pediu. Contato já salvo; uma falha aqui não faz o cliente
  // reenviar (evita duplicar). Loga e segue.
  try {
    const formSubmission = buildFormSubmissionPayload(data);
    const baseDescricao = contatoNovo
      ? "Captura via site (formulário de contato)"
      : "Nova captura via site (contato já existente)";
    const descricao = rename
      ? `${baseDescricao} — nome atualizado de "${rename.de.trim() || "(vazio)"}" para "${rename.para}".`
      : baseDescricao;
    await addInteraction(contact.id, {
      tipo: "form_submission",
      descricao,
      metadata: {
        origem: "site_contato",
        destino: data.destinoTipo,
        formSubmission,
        ...(rename ? { rename } : {}),
      },
      criadoPor: "sistema",
    });
  } catch (err) {
    console.error("[submitContact] contato resolvido, mas falhou ao registrar a interação:", err);
  }

  // 5. Jornada no funil — SÍNCRONO (write rápido de banco, nunca fire-and-forget).
  // Regra de re-submit: se o contato já tem jornada aberta em "primeiro contato"
  // de origem "site", não cria uma segunda (só a interação acima registra o novo
  // toque). Contato novo sempre cria. Falha aqui não perde o lead: loga e segue.
  try {
    let criarJornada = true;
    if (!contatoNovo) {
      const { abertas } = await getJornadasDoContato(contact.id);
      const jaTemJornadaSite = abertas.some(
        (j) => j.estagio === "primeiro contato" && j.origemDado === "site",
      );
      criarJornada = !jaTemJornadaSite;
    }
    if (criarJornada) {
      await createJornadaManual(contact.id, {
        tituloJornada: buildJornadaTituloFromForm(data),
        origemDado: "site",
      });
    }
  } catch (err) {
    console.error("[submitContact] contato salvo, mas falhou ao criar a jornada:", err);
  }

  // 6. Notificação por e-mail é best-effort: o contato já está salvo (fonte de
  // verdade). Se o Resend falhar (chave inválida, rede, etc.), loga e segue —
  // o usuário recebe sucesso do mesmo jeito.
  try {
    await sendContactNotification(contact);
  } catch (err) {
    console.error("[submitContact] contato salvo, mas falhou ao enviar e-mail (Resend):", err);
  }

  // 7. Sync ClickMassa — SÓ pra contato novo. Agendada com `after()` (Next 16, API
  // estável importada de "next/server"): a action responde rápido e o bloco
  // (sendMessage → write-back → interaction) roda registrado no runtime, DEPOIS da
  // resposta — sobrevive porque o runtime aguarda (waitUntil na Vercel), sem o
  // `void` flutuante que morria. Reincidente não é re-sincronizado (não re-manda
  // boas-vindas). Todo desfecho persiste estado terminal (synced/failed) + interaction:
  // `pending` (gravado no INSERT) é só transitório até aqui, nunca terminal.
  if (contatoNovo) {
    const contactId = contact.id;
    after(async () => {
      try {
        const result = await syncContactFlow({
          id: contactId,
          name: contact.name,
          phone: contact.whatsapp,
          email: contact.email,
        });
        // Write-back honesto: sucesso grava 'synced' + IDs + ultimo_sync; falha
        // grava 'failed' + sync_error. Nunca fica 'pending' aqui.
        const patch = syncResultToContactPatch(result);
        const { error: updateError } = await supabaseAdmin()
          .from("contacts")
          .update(patch)
          .eq("id", contactId);
        if (updateError) {
          console.error("[submitContact] falha no UPDATE ClickMassa:", updateError);
        }

        // Interaction sync_clickmassa (schema: tipo = 'sync_clickmassa'). Falha aqui
        // não deve mascarar o desfecho já persistido acima — só loga.
        try {
          await addInteraction(contactId, {
            tipo: "sync_clickmassa",
            descricao: buildSyncDescricao(result),
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
        // Última defesa: só se algo INESPERADO estourar (syncContactFlow já captura
        // as falhas de API e devolve status 'failed', sem lançar). Persiste 'failed'
        // + erro + interaction quando alcançável — nunca só console.error.
        console.error("[submitContact] erro inesperado na sync ClickMassa:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        try {
          const { error: updateError } = await supabaseAdmin()
            .from("contacts")
            .update({
              clickmassa_sync_status: "failed",
              clickmassa_sync_error: `[failed]: ${errorMsg}`,
              clickmassa_ultimo_sync: new Date().toISOString(),
            })
            .eq("id", contactId);
          if (updateError) {
            console.error("[submitContact] falha ao persistir status failed:", updateError);
          }
          await addInteraction(contactId, {
            tipo: "sync_clickmassa",
            descricao: `Falha inesperada na sincronização com ClickMassa: ${errorMsg}`,
            metadata: { error: errorMsg, syncedAt: new Date().toISOString() },
            criadoPor: "sistema",
          });
        } catch (persistErr) {
          console.error("[submitContact] não foi possível persistir a falha da sync ClickMassa:", persistErr);
        }
      }
    });
  }

  return { success: true };
}
