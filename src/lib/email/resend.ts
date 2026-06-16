import "server-only";
import { Resend } from "resend";
import type { Contact } from "@/lib/contacts/types";
import {
  DESTINO_LABELS,
  ORCAMENTO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
} from "@/lib/contacts/types";

const resend = new Resend(process.env.RESEND_API_KEY!);

/** Escapa HTML em valores vindos do usuário (evita quebrar o template/markup). */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function destinoLabel(contact: Contact): string {
  return contact.destinoTexto?.trim() || DESTINO_LABELS[contact.destinoTipo];
}

/**
 * Notifica a Spinhardi de um novo contato capturado pelo site.
 *
 * `replyTo` forçado para `RESEND_TO_EMAIL` (decisão anti-forwarding): quando
 * alguém responder o e-mail, a resposta vai direto pro Gmail da Spinhardi, sem
 * depender de MX/forwarding do domínio.
 *
 * Best-effort: o chamador (action) envolve em try-catch e não bloqueia o
 * sucesso do formulário se isto falhar — o contato no banco é a fonte de verdade.
 */
export async function sendContactNotification(contact: Contact) {
  return resend.emails.send({
    from: `Spinhardi Turismo <${process.env.RESEND_FROM_EMAIL}>`,
    to: process.env.RESEND_TO_EMAIL!,
    replyTo: process.env.RESEND_TO_EMAIL!,
    subject: `Novo contato: ${contact.name} — ${destinoLabel(contact)}`,
    html: renderContactHTML(contact),
  });
}

function renderContactHTML(contact: Contact): string {
  const passageiros = `${contact.passageirosAdultos} adultos, ${contact.passageirosCriancas} crianças, ${contact.passageirosBebes} bebês`;
  const mensagem = contact.notasInternas?.trim();

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; max-width: 560px;">
      <h2 style="margin: 0 0 16px;">Novo contato pelo site</h2>
      <p><strong>Nome:</strong> ${esc(contact.name)}</p>
      <p><strong>WhatsApp:</strong> ${esc(contact.whatsapp)}</p>
      <p><strong>E-mail:</strong> ${esc(contact.email) || "—"}</p>
      <h3 style="margin: 24px 0 8px;">Viagem</h3>
      <p><strong>Destino:</strong> ${esc(destinoLabel(contact))}</p>
      <p><strong>Orçamento:</strong> ${ORCAMENTO_LABELS[contact.orcamentoEstimado]}</p>
      <p><strong>Prazo:</strong> ${PRAZO_LABELS[contact.prazoIdeal]}</p>
      <p><strong>Perfil:</strong> ${PERFIL_LABELS[contact.perfilViajante]}</p>
      <p><strong>Passageiros:</strong> ${passageiros}</p>
      ${mensagem ? `<h3 style="margin: 24px 0 8px;">Mensagem</h3><p>${esc(mensagem)}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px;">
        Capturado em ${new Date().toLocaleString("pt-BR")} via site
      </p>
    </div>
  `;
}
