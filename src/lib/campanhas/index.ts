import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { calcularConteudoHash } from "./hash";
import {
  rowToCampanha,
  rowToDestinatario,
  rowToEvento,
  campanhaPatchToRow,
  type CampanhaRow,
  type DestinatarioRow,
  type EventoRow,
} from "./mappers";
import type {
  Campanha,
  CampanhaConteudo,
  CampanhaDestinatario,
  CampanhaEvento,
  CampanhaTipo,
  PublicoTipo,
} from "./types";

/**
 * Acesso a campanhas — Supabase via `supabaseAdmin()` (service role, server-only).
 * Mesmo padrão de `lib/contacts`: leitura em Server Components, escrita em
 * Server Actions, tudo passando por aqui.
 *
 * TRÊS TRAVAS DE SERVIDOR moram neste arquivo, não na tela:
 *  1. `enviada` é terminal (C5): nenhuma escrita de conteúdo/público passa.
 *  2. Salvar conteúdo RECALCULA o hash e, se ele divergir do `testado_hash`,
 *     rebaixa o estado pra `rascunho` (C4).
 *  3. Destinatários e eventos são append-only (V1/E4): não existe update nem
 *     delete neles em lugar nenhum deste módulo.
 *
 * AUDITORIA (E6). Sem tabela nova: as linhas de auditoria vão em
 * `campanha_eventos` com `tipo` no namespace `auditoria.*` e o detalhe em
 * `raw_payload`. Cabe porque a tabela já é append-only, já é escopada por
 * campanha e o agregador de métricas só conta os tipos `email.*` — auditoria
 * entra e fica fora da conta por construção, sem filtro extra.
 */

const COLS = "*";
export const BUCKET_CAMPANHAS = "campanhas";

// ─────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────

export async function getCampanhas(): Promise<Campanha[]> {
  const { data, error } = await supabaseAdmin()
    .from("campanhas")
    .select(COLS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Erro ao buscar campanhas: ${error.message}`);
  return ((data as CampanhaRow[]) ?? []).map(rowToCampanha);
}

export async function getCampanhaById(id: string): Promise<Campanha | null> {
  const { data, error } = await supabaseAdmin()
    .from("campanhas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar campanha ${id}: ${error.message}`);
  return data ? rowToCampanha(data as CampanhaRow) : null;
}

export async function getDestinatarios(campanhaId: string): Promise<CampanhaDestinatario[]> {
  const { data, error } = await supabaseAdmin()
    .from("campanha_destinatarios")
    .select("*")
    .eq("campanha_id", campanhaId)
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao buscar destinatários: ${error.message}`);
  return ((data as DestinatarioRow[]) ?? []).map(rowToDestinatario);
}

export async function getEventosDaCampanha(campanhaId: string): Promise<CampanhaEvento[]> {
  const { data, error } = await supabaseAdmin()
    .from("campanha_eventos")
    .select("*")
    .eq("campanha_id", campanhaId)
    .order("ocorrido_em", { ascending: true });

  if (error) throw new Error(`Erro ao buscar eventos: ${error.message}`);
  return ((data as EventoRow[]) ?? []).map(rowToEvento);
}

/**
 * Histórico de e-mail marketing de UM contato (bloco da ficha). Cruza os
 * destinatários congelados com os eventos daquele contato — as duas tabelas do
 * V6, sem contador em coluna.
 */
export async function getHistoricoEmailDoContato(contactId: string): Promise<
  {
    campanhaId: string;
    campanhaNome: string;
    enviadoEm: string;
    recebeu: boolean;
    abriu: boolean;
    clicou: boolean;
  }[]
> {
  const sb = supabaseAdmin();

  const { data: dests, error: e1 } = await sb
    .from("campanha_destinatarios")
    .select("campanha_id, enviado_em, campanhas(nome_interno)")
    .eq("contact_id", contactId)
    .order("enviado_em", { ascending: false });

  if (e1) throw new Error(`Erro ao buscar histórico de e-mail: ${e1.message}`);
  const linhas = (dests ?? []) as unknown as {
    campanha_id: string;
    enviado_em: string;
    campanhas: { nome_interno: string } | null;
  }[];
  if (linhas.length === 0) return [];

  const { data: evs, error: e2 } = await sb
    .from("campanha_eventos")
    .select("campanha_id, tipo")
    .eq("contact_id", contactId);

  if (e2) throw new Error(`Erro ao buscar eventos do contato: ${e2.message}`);
  const eventos = (evs ?? []) as { campanha_id: string | null; tipo: string }[];

  const tem = (campanhaId: string, tipo: string) =>
    eventos.some((e) => e.campanha_id === campanhaId && e.tipo === tipo);

  return linhas.map((l) => ({
    campanhaId: l.campanha_id,
    campanhaNome: l.campanhas?.nome_interno ?? "(campanha removida)",
    enviadoEm: l.enviado_em,
    recebeu: tem(l.campanha_id, "email.delivered"),
    abriu: tem(l.campanha_id, "email.opened"),
    clicou: tem(l.campanha_id, "email.clicked"),
  }));
}

// ─────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────

export async function criarCampanha(input: {
  nomeInterno: string;
  tipo: CampanhaTipo;
  criadoPor: string | null;
}): Promise<Campanha> {
  const { data, error } = await supabaseAdmin()
    .from("campanhas")
    .insert({
      nome_interno: input.nomeInterno,
      tipo: input.tipo,
      estado: "rascunho",
      publico_tipo: "todos_elegiveis",
      criado_por: input.criadoPor,
    })
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao criar campanha: ${error.message}`);
  return rowToCampanha(data as CampanhaRow);
}

/** Campanha enviada é imutável (C5). Erro tipado pras actions distinguirem. */
export class CampanhaImutavelError extends Error {
  constructor() {
    super("Esta campanha já foi enviada. O conteúdo não pode mais mudar.");
    this.name = "CampanhaImutavelError";
  }
}

/**
 * Salva conteúdo, recalcula o hash e aplica C4: se o hash mudou em relação ao
 * `testado_hash`, o estado volta pra `rascunho` — inclusive quando a campanha
 * estava `agendada`. É aqui, no servidor, e não na tela.
 */
export async function salvarConteudo(
  id: string,
  conteudo: CampanhaConteudo,
  extras?: { nomeInterno?: string; tipo?: CampanhaTipo },
): Promise<Campanha> {
  const atual = await getCampanhaById(id);
  if (!atual) throw new Error("Campanha não encontrada.");
  if (atual.estado === "enviada") throw new CampanhaImutavelError();

  const hash = calcularConteudoHash(conteudo);
  const continuaTestada = atual.testadoHash !== null && atual.testadoHash === hash;

  const patch: Partial<Campanha> = {
    ...conteudo,
    conteudoHash: hash,
    // Testado ainda vale? Mantém o estado. Não vale? Rebaixa pra rascunho e
    // limpa o agendamento — agendada com conteúdo trocado é a pior combinação.
    estado: continuaTestada ? atual.estado : "rascunho",
    ...(continuaTestada ? {} : { agendadoPara: null }),
    ...(extras?.nomeInterno !== undefined ? { nomeInterno: extras.nomeInterno } : {}),
    ...(extras?.tipo !== undefined ? { tipo: extras.tipo } : {}),
  };

  return atualizar(id, patch);
}

/** Público (C3). Também recusa campanha enviada. */
export async function salvarPublico(
  id: string,
  publicoTipo: PublicoTipo,
  grupoId: string | null,
): Promise<Campanha> {
  const atual = await getCampanhaById(id);
  if (!atual) throw new Error("Campanha não encontrada.");
  if (atual.estado === "enviada") throw new CampanhaImutavelError();

  // Coerência público↔grupo (o CHECK do banco cobra, aqui a mensagem é legível).
  if (publicoTipo === "grupo" && !grupoId) {
    throw new Error("Escolha o grupo que vai receber.");
  }

  return atualizar(id, {
    publicoTipo,
    grupoId: publicoTipo === "grupo" ? grupoId : null,
  });
}

/** Marca o teste feito (E8): grava hash testado, quando e pra quem. */
export async function marcarTestada(id: string, para: string[], hash: string): Promise<Campanha> {
  return atualizar(id, {
    estado: "testada",
    testadoEm: new Date().toISOString(),
    testadoHash: hash,
    testadoPara: para.join(", "),
  });
}

export async function atualizar(id: string, patch: Partial<Campanha>): Promise<Campanha> {
  const { data, error } = await supabaseAdmin()
    .from("campanhas")
    .update(campanhaPatchToRow(patch))
    .eq("id", id)
    .select(COLS)
    .single();

  if (error) throw new Error(`Erro ao salvar campanha ${id}: ${error.message}`);
  return rowToCampanha(data as CampanhaRow);
}

/**
 * Congelamento (E4): grava os destinatários. Append-only, `upsert` com
 * `ignoreDuplicates` pra reentrada não duplicar (a unique é campanha_id+email).
 * Nunca UPDATE, nunca DELETE.
 */
export async function congelarDestinatarios(
  campanhaId: string,
  pessoas: { contactId: string | null; email: string; nome: string }[],
): Promise<number> {
  if (pessoas.length === 0) return 0;

  const { data, error } = await supabaseAdmin()
    .from("campanha_destinatarios")
    .upsert(
      pessoas.map((p) => ({
        campanha_id: campanhaId,
        contact_id: p.contactId,
        email: p.email,
        nome: p.nome,
      })),
      { onConflict: "campanha_id,email", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`Erro ao congelar destinatários: ${error.message}`);
  return ((data as { id: string }[]) ?? []).length;
}

/**
 * Linha de auditoria (E6). Vai em `campanha_eventos` no namespace `auditoria.*`
 * — ver docblock do módulo. Best-effort: falha de auditoria não derruba o
 * envio, mas grita no log.
 */
export async function auditar(
  campanhaId: string,
  evento: string,
  detalhe: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("campanha_eventos")
      .insert({
        campanha_id: campanhaId,
        tipo: `auditoria.${evento}`,
        ocorrido_em: new Date().toISOString(),
        raw_payload: detalhe,
      });
    if (error) throw error;
  } catch (err) {
    console.error("[campanhas.auditar] não foi possível gravar a auditoria:", err);
  }
}

/** Linhas de auditoria de uma campanha, mais recentes primeiro. */
export async function getAuditoria(campanhaId: string): Promise<CampanhaEvento[]> {
  const { data, error } = await supabaseAdmin()
    .from("campanha_eventos")
    .select("*")
    .eq("campanha_id", campanhaId)
    .like("tipo", "auditoria.%")
    .order("ocorrido_em", { ascending: false });

  if (error) throw new Error(`Erro ao buscar auditoria: ${error.message}`);
  return ((data as EventoRow[]) ?? []).map(rowToEvento);
}

// ─────────────────────────────────────────────────────────────────
// Imagem — bucket PÚBLICO `campanhas` (I1)
// ─────────────────────────────────────────────────────────────────

/** O bucket `campanhas` não existe ainda em produção — criação é do Alan. */
export class BucketAusenteError extends Error {
  constructor() {
    super(
      "O espaço de imagens de campanha ainda não foi criado no servidor. " +
        "Fale com o suporte técnico antes de subir a imagem.",
    );
    this.name = "BucketAusenteError";
  }
}

const TIPOS_IMAGEM = ["image/jpeg", "image/png"] as const;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — e-mail não aguenta mais que isso

export function validarImagem(file: File): string | null {
  if (!TIPOS_IMAGEM.includes(file.type as (typeof TIPOS_IMAGEM)[number])) {
    return "Use uma imagem JPG ou PNG.";
  }
  if (file.size > MAX_BYTES) return "A imagem precisa ter no máximo 2 MB.";
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

/**
 * Sobe a imagem no bucket PÚBLICO. Público por motivo físico (I1): URL assinada
 * expira e o e-mail vive na caixa da pessoa pra sempre.
 *
 * Append-only (I4): o path leva um uuid, então trocar a imagem SOBE outra e
 * deixa a anterior no lugar. Nada é apagado — apagar quebraria o e-mail de quem
 * já recebeu.
 */
export async function uploadImagemCampanha(campanhaId: string, file: File): Promise<string> {
  const invalido = validarImagem(file);
  if (invalido) throw new Error(invalido);

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${campanhaId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_CAMPANHAS)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    if (/bucket not found/i.test(error.message)) throw new BucketAusenteError();
    throw new Error(`Erro ao subir a imagem: ${error.message}`);
  }
  return path;
}

/** URL pública e permanente da imagem. `null` quando a campanha não tem uma. */
export function urlImagemCampanha(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabaseAdmin().storage.from(BUCKET_CAMPANHAS).getPublicUrl(path);
  return data.publicUrl;
}
