"use server";

import type {
  DestinoTipo,
  OrcamentoEstimado,
  PrazoIdeal,
  PerfilViajante,
} from "@/lib/contacts/types";

export type ContactFormData = {
  // Sobre você
  name: string;
  whatsapp: string;
  email?: string;

  // Sobre a viagem
  destinoTipo: DestinoTipo;
  destinoTexto?: string;
  prazoIdeal: PrazoIdeal;
  dataIda?: string;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;

  // Sobre o perfil
  perfilViajante: PerfilViajante;
  orcamentoEstimado: OrcamentoEstimado;

  // Observações
  observacao?: string;
};

export type ContactFormResult = {
  success: boolean;
  error?: string;
};

/**
 * Recebe os campos enriquecidos do formulário do site.
 *
 * MOCK na Fase 1 (Lote B): só loga + simula sucesso (não persiste).
 * No Lote C: cria contact no Supabase com `origem: "site_contato"` e dispara
 * iddas.createSolicitacao + clickmassa.createTicket em Promise.allSettled,
 * atualizando os campos de sync. O contact é criado ANTES das chamadas
 * externas — zero perda de lead.
 */
export async function submitContact(data: ContactFormData): Promise<ContactFormResult> {
  // Simula latência
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock — Lote B só loga
  console.log("[contact submission - mock]", {
    timestamp: new Date().toISOString(),
    ...data,
  });

  // Lote C: aqui cria contact no Supabase + chama iddas.createSolicitacao +
  //         clickmassa.createTicket em Promise.allSettled
  console.log(
    "[email mock] would notify equipe@spinhardi.com.br + send WhatsApp greeting via ClickMassa",
  );

  return { success: true };
}
