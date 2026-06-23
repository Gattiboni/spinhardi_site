/**
 * Mapper bronze → silver para contacts.
 *
 * Sem `import "server-only"`. Pode ser importado por scripts CLI.
 * Só preenche campos `clickmassa_*` + defaults para NOT NULL CHECK.
 *
 * D072: `estagio` saiu do contato (migrou pra `jornadas`). O mapper NÃO seta mais
 * `estagio` — a coluna em contacts será dropada por último (ver report). Importar
 * um contato NÃO cria jornada; isso é por outro caminho.
 */

import type { BronzeClickMassaContactRow } from "../bronze-types";

/**
 * Subset de campos do INSERT em `contacts` que o mapper popula.
 * Inclui os campos NOT NULL sem default DB que o mapper precisa fornecer.
 * Campos com default DB (created_at, status, nacionalidade, etc.) são omitidos.
 */
export interface SilverContactInsert {
  // Identificação — obrigatórios, sem default DB
  name: string;
  whatsapp: string;
  email: string | null;

  // Campos NOT NULL CHECK sem default DB — mapper fornece valores fixos
  origem: "importado";
  destino_tipo: "indefinido";
  orcamento_estimado: "nao_informado";
  prazo_ideal: "flexivel";
  perfil_viajante: "outro";

  // ClickMassa — todos os campos clickmassa_* da tabela contacts
  clickmassa_contact_id: string; // source_id como string
  clickmassa_ticket_ids: string[]; // vazio no backfill (sem acesso a tickets via API)
  clickmassa_tags_id: number[]; // IDs de tags; contact.tags vem vazio no embed atual
  clickmassa_oportunidade_id: string | null;
  clickmassa_pipeline_step: string | null; // pipelineStepId como string
  clickmassa_ultimo_sync: string; // ISO datetime
  clickmassa_sync_status: "synced";
  clickmassa_sync_error: string | null;
}

/**
 * Mapeia um contato bronze para o patch de silver contacts.
 *
 * @param bronzeContact - Linha bronze do contact embedado na Opportunity
 * @param opts.clickmassaOportunidadeId - ID da Opportunity (string) para setar no contato
 * @param opts.clickmassaPipelineStep - pipelineStepId como string
 */
export function mapBronzeContactToSilverUpdate(
  bronzeContact: BronzeClickMassaContactRow,
  opts?: {
    clickmassaOportunidadeId?: string | null;
    clickmassaPipelineStep?: string | null;
  },
): Partial<SilverContactInsert> {
  return {
    name: resolveContactName(bronzeContact),
    whatsapp: bronzeContact.number,
    email: bronzeContact.email ?? null,

    // Defaults obrigatórios para INSERT de contatos importados do ClickMassa
    origem: "importado",
    destino_tipo: "indefinido",
    orcamento_estimado: "nao_informado",
    prazo_ideal: "flexivel",
    perfil_viajante: "outro",

    clickmassa_contact_id: String(bronzeContact.source_id),
    clickmassa_ticket_ids: [],
    // contact.tags no embed é array de objetos; IDs não resolvidos aqui.
    // Será populado quando mapearmos tags separadamente (DDL bronze_tags primeiro).
    clickmassa_tags_id: [],
    clickmassa_oportunidade_id: opts?.clickmassaOportunidadeId ?? null,
    clickmassa_pipeline_step: opts?.clickmassaPipelineStep ?? null,
    clickmassa_ultimo_sync: bronzeContact.ingested_at,
    clickmassa_sync_status: "synced",
    clickmassa_sync_error: null,
  };
}

/**
 * Resolve o nome de exibição de um contato.
 *
 * No ClickMassa, `contact.name` é o número de telefone quando o contato foi criado
 * automaticamente via sendMessage sem cadastro prévio. `pushname` vem do WhatsApp
 * após o contato enviar pelo menos uma mensagem.
 */
function resolveContactName(contact: BronzeClickMassaContactRow): string {
  const name = contact.name.trim();
  const number = contact.number.trim();

  const nameIsPhone = name === number || /^\d+$/.test(name);
  if (!nameIsPhone) return name;

  const pushname = contact.pushname?.trim() ?? "";
  if (pushname && pushname !== number && !/^\d+$/.test(pushname)) {
    return pushname;
  }

  // Sem nome real disponível — retorna como está (número de telefone)
  return name;
}
