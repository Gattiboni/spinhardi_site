/**
 * URLs do PAINEL HUMANO de cada sistema externo (deep-link "abrir na origem").
 *
 * ATENÇÃO: estes são os painéis web onde a equipe abre o contato/pessoa — NÃO
 * são as APIs (a doc da API do Iddas é `apiagencia.iddas.com.br`, máquina; o
 * painel humano é outro endereço).
 *
 * Uma função por sistema, e cada uma é o PONTO ÚNICO DE ATIVAÇÃO do seu link
 * (D3 do contrato de ficha/docs/comunicação): quem consome só pergunta "tem
 * URL?" e, quando vem `null`, renderiza o botão desabilitado. Ligar um sistema é
 * uma edição AQUI, zero mudança de componente. NÃO invente domínio nem chute
 * rota — preencha quando o endereço for confirmado.
 */

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
 * URL do registro da pessoa no painel humano do Iddas. DORMENTE por ora (D3): o
 * host (`NEXT_PUBLIC_IDDAS_PANEL_URL`) e o path do registro ainda não foram
 * confirmados — depende de elevação do acesso dev no Iddas. Enquanto devolver
 * `null`, o botão "Ver no Iddas" da ficha renderiza desabilitado com o tooltip
 * "aguardando mudança de acesso dev".
 *
 * Pra ligar: descomentar as três linhas abaixo, pôr o path confirmado e setar a
 * env. Nenhum componente muda.
 */
export function iddasPessoaUrl(_iddasPessoaId: string | null): string | null {
  // const base = process.env.NEXT_PUBLIC_IDDAS_PANEL_URL;
  // if (!base || !iddasPessoaId) return null;
  // return `${base.replace(/\/+$/, "")}/<path-confirmado>/${encodeURIComponent(iddasPessoaId)}`;
  return null;
}
