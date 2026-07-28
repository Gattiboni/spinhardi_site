import "server-only";
import { signApprovalToken } from "@/lib/auth/approval-token";
import { resendClient } from "./resend";

/**
 * E-mail de "nova solicitação de acesso" pro administrador.
 *
 * Gera 3 tokens assinados (admin/editor/reject) e monta 3 botões que apontam
 * pra `/admin/aprovar/[token]`. O Alan decide com um clique direto do e-mail.
 *
 * O client vem de `./resend` (singleton preguiçoso, mesmo padrão do motor de
 * campanhas) em vez de um `new Resend()` por chamada: não havia motivo pro
 * módulo divergir, e um client por solicitação só desperdiça.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.spinharditurismo.com.br";

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RenderArgs = {
  name: string;
  email: string;
  dataHora: string;
  adminToken: string;
  editorToken: string;
  rejectToken: string;
};

function renderApprovalEmailHTML({
  name,
  email,
  dataHora,
  adminToken,
  editorToken,
  rejectToken,
}: RenderArgs): string {
  const btn = (token: string, label: string, bg: string) =>
    `<a href="${SITE_URL}/admin/aprovar/${token}" style="display: inline-block; padding: 10px 16px; margin: 4px 8px 4px 0; background: ${bg}; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">${label}</a>`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #404040;">
      <h2 style="color: #3F5B30;">Nova solicitação de acesso</h2>
      <p><strong>Nome:</strong> ${escapeHTML(name)}</p>
      <p><strong>Email:</strong> ${escapeHTML(email)}</p>
      <p><strong>Data:</strong> ${escapeHTML(dataHora)}</p>

      <div style="margin: 32px 0; padding: 24px; background: #F5F5F0; border-radius: 8px;">
        <p style="margin: 0 0 16px 0;"><strong>Aprovar acesso:</strong></p>
        ${btn(adminToken, "Aprovar como Admin", "#3F5B30")}
        ${btn(editorToken, "Aprovar como Editor", "#B89D5A")}
        ${btn(rejectToken, "Rejeitar", "#888888")}
      </div>

      <p style="color: #888; font-size: 12px;">Os links acima são válidos por 7 dias. Você pode reverter a decisão depois acessando o painel admin.</p>
    </div>
  `;
}

export async function sendApprovalRequest({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const [adminToken, editorToken, rejectToken] = await Promise.all([
    signApprovalToken(userId, "admin"),
    signApprovalToken(userId, "editor"),
    signApprovalToken(userId, "reject"),
  ]);

  const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const html = renderApprovalEmailHTML({
    name,
    email,
    dataHora,
    adminToken,
    editorToken,
    rejectToken,
  });

  // `emails.send` devolve `{ data, error }` e não lança em falha de API — sem
  // ler `error`, "não avisei o Alan" era indistinguível de "avisei". Segue
  // best-effort (o chamador não quebra a solicitação), só que agora com log.
  const resultado = await resendClient().emails.send({
    from: `Spinhardi Turismo <${process.env.RESEND_FROM_EMAIL}>`,
    to: process.env.APPROVAL_NOTIFICATION_EMAIL!,
    subject: `[Spinhardi] Solicitação de acesso: ${name}`,
    html,
  });

  if (resultado.error) {
    console.error(
      `[email.approval-request] e-mail de aprovação RECUSADO pelo Resend: ${resultado.error.name} — ${resultado.error.message}`,
    );
  }

  return resultado;
}
