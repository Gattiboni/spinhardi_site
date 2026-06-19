/**
 * URLs do PAINEL HUMANO de cada sistema externo (deep-link "Abrir na origem").
 *
 * ATENÇÃO: estes são os painéis web onde a equipe abre o contato/pessoa — NÃO
 * são as APIs (a doc da API do Iddas é `apiagencia.iddas.com.br`, máquina; o
 * painel humano é outro endereço, ainda não confirmado no repo nem na doc).
 *
 * Enquanto o template estiver VAZIO, `buildPanelUrl` devolve `null` e o botão
 * "Abrir na origem" fica desabilitado (tooltip "configurar URL do painel").
 * NÃO invente URL nem chute rota — preencha aqui quando o endereço for confirmado.
 *
 * Formato do template: use o marcador `{external_id}`, ex:
 *   clickmassa: "https://app.clickmassa.com.br/contacts/{external_id}"
 *   iddas:      "https://painel.iddas.com.br/pessoa/{external_id}"
 */
export const PANEL_URLS: Record<string, string> = {
  clickmassa: "",
  iddas: "",
};

/**
 * Monta o deep-link do painel a partir do `provider` + `external_id` do vínculo.
 * Devolve `null` se o template não estiver configurado ou faltar o `external_id`.
 */
export function buildPanelUrl(
  provider: string,
  externalId: string | null,
): string | null {
  const template = PANEL_URLS[provider];
  if (!template || !externalId) return null;
  return template.replace("{external_id}", encodeURIComponent(externalId));
}
