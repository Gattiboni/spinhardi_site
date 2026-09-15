/**
 * Decisões de PRODUTO do domínio de campanhas. Módulo puro (sem `server-only`):
 * tela e servidor importam daqui.
 *
 * Não é env de propósito. Env muda por painel, sem rastro; isto aqui muda com
 * decisão nova registrada e commit. Mesmo padrão de `lib/consent/config.ts` e
 * `lib/ingestion/config.ts`.
 */

/**
 * D105: open tracking DESLIGADO no domínio do Resend (click tracking ligado).
 * Sem pixel não chega `email.opened`, então abertura é "não medida", nunca
 * "0%". Clique continua medido normalmente.
 */
export const RASTREIO_ABERTURA: boolean = false;
