import "server-only";

/**
 * MODO SEGURO — ponto ÚNICO de interceptação do público antes de qualquer
 * chamada ao Resend.
 *
 * Com `CAMPANHAS_MODO_SEGURO=1` (default, inclusive em produção, até o Alan
 * decidir desligar) o pipeline resolve o público real, LOGA as contagens e
 * substitui o conjunto efetivamente espelhado/enviado por uma lista fixa de
 * e-mails de teste. Toda a máquina — hash, preflight, snapshot, broadcast,
 * webhook, métricas — roda de verdade por cima dessa lista.
 *
 * Nenhum contato real recebe nada. Desligar é trocar a env, não mexer no código.
 *
 * Os endereços de teste do próprio Resend (`delivered@resend.dev`,
 * `bounced@resend.dev`) provam entrega, bounce e o ciclo de webhook inteiro.
 */

const PADRAO_EMAILS_TESTE = ["delivered@resend.dev", "bounced@resend.dev"];

export type Publico = { contactId: string | null; email: string; nome: string }[];

export function modoSeguroAtivo(): boolean {
  // Default LIGADO: a ausência da env nunca pode significar "pode disparar".
  return (process.env.CAMPANHAS_MODO_SEGURO ?? "1") === "1";
}

/** Lista de teste da env, com os endereços do Resend como piso. */
export function emailsDeTeste(): string[] {
  const daEnv = (process.env.CAMPANHAS_EMAILS_TESTE ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const todos = [...PADRAO_EMAILS_TESTE, ...daEnv];
  return [...new Set(todos)];
}

/** Nome legível pro destinatário de teste (o snapshot exige `nome` não nulo). */
function nomeDeTeste(email: string): string {
  if (email === "delivered@resend.dev") return "Teste — entrega";
  if (email === "bounced@resend.dev") return "Teste — retorno (bounce)";
  return `Teste — ${email}`;
}

export type Interceptacao = {
  publico: Publico;
  ativo: boolean;
  /** Tamanho do público REAL, pra auditoria e pro log. */
  totalReal: number;
};

/**
 * Aplica (ou não) a interceptação. Chamada em UM lugar só — `envio.ts`, logo
 * depois de resolver o público e antes de espelhar contato no Resend.
 *
 * O log é gritante de propósito: quem lê o log da Vercel tem que enxergar num
 * relance que aquele disparo não foi pra base real.
 */
export function aplicarModoSeguro(publicoReal: Publico, campanhaId: string): Interceptacao {
  if (!modoSeguroAtivo()) {
    return { publico: publicoReal, ativo: false, totalReal: publicoReal.length };
  }

  const lista = emailsDeTeste();
  console.warn(
    `[campanhas] ############ MODO SEGURO ATIVO ############\n` +
      `[campanhas] campanha=${campanhaId}\n` +
      `[campanhas] público real: ${publicoReal.length} destinatário(s) — NENHUM será contatado\n` +
      `[campanhas] enviando para: [${lista.join(", ")}]\n` +
      `[campanhas] desligue com CAMPANHAS_MODO_SEGURO=0\n` +
      `[campanhas] ###########################################`,
  );

  return {
    // `contactId: null` de propósito: o destinatário de teste NÃO é contato do
    // CRM. Assim o snapshot congelado nunca aponta pra pessoa real e o webhook
    // não escreve status de e-mail marketing em ninguém por engano.
    publico: lista.map((email) => ({ contactId: null, email, nome: nomeDeTeste(email) })),
    ativo: true,
    totalReal: publicoReal.length,
  };
}
