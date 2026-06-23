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

/**
 * URL do perfil do contato no painel humano do ClickMassa (botão WhatsApp da
 * ficha). O HOST vem da env `NEXT_PUBLIC_CLICKMASSA_PANEL_URL` (NEXT_PUBLIC: é só
 * link aberto no navegador, sem credencial — NÃO confundir com a URL da API do
 * CM que o sync usa). Rota confirmada: hash routing `/#/contact/{id}/perfil`.
 * Devolve `null` se faltar o host (env não setada) ou o id do contato no CM.
 */
export function clickmassaContactUrl(clickmassaContactId: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_CLICKMASSA_PANEL_URL;
  if (!base || !clickmassaContactId) return null;
  return `${base.replace(/\/+$/, "")}/#/contact/${encodeURIComponent(clickmassaContactId)}/perfil`;
}

/**
 * URL do registro da pessoa no painel humano do Iddas. INATIVA por ora: o host
 * (`NEXT_PUBLIC_IDDAS_PANEL_URL`) e o path do registro ainda não foram
 * confirmados (trava de permissão no perfil). NÃO chutamos domínio nem rota —
 * enquanto a env não existir, devolve `null` e o botão "Abrir no Iddas" fica
 * desabilitado. Quando confirmado, ligar setando a env + o path real aqui.
 */
export function iddasPessoaUrl(_iddasPessoaId: string | null): string | null {
  // const base = process.env.NEXT_PUBLIC_IDDAS_PANEL_URL;
  // if (!base || !iddasPessoaId) return null;
  // return `${base.replace(/\/+$/, "")}/<path-confirmado>/${encodeURIComponent(iddasPessoaId)}`;
  return null;
}
