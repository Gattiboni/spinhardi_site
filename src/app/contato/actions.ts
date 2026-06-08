"use server";

export type ContactFormData = {
  nome: string;
  whatsapp: string;
  destino: string;
  mensagem: string;
};

export type ContactFormResult = {
  success: boolean;
  error?: string;
};

/**
 * Envia mensagem de contato.
 *
 * MOCK na Fase 1: console.log estruturado + simulação de latência.
 * Vira insert real no Supabase na Fase 1.11 (lote dedicado de SQL).
 * E-mail real (Resend) entra na Fase 3.
 */
export async function submitContact(data: ContactFormData): Promise<ContactFormResult> {
  // Simula latência de rede pra UX realista
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock — vira insert no Supabase na Fase 1.11
  console.log("[contact submission - mock]", {
    timestamp: new Date().toISOString(),
    ...data,
  });

  // Mock de e-mail — vira Resend real na Fase 3
  console.log("[email mock] would notify equipe@spinhardi.com.br");

  return { success: true };
}
