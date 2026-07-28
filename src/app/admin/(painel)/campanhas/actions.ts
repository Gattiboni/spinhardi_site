"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  BucketAusenteError,
  CampanhaImutavelError,
  criarCampanha,
  getCampanhaById,
  salvarConteudo,
  salvarPublico,
  uploadImagemCampanha,
  urlImagemCampanha,
} from "@/lib/campanhas";
import {
  agendamentoParaIso,
  cancelarAgendamento,
  checarEnvio,
  dispararCampanha,
  enviarTesteDaCampanha,
} from "@/lib/campanhas/envio";
import { contarPublico } from "@/lib/campanhas/publico";
import { conteudoDe, montarEmailHtml, preflight } from "@/lib/campanhas/conteudo";
import { modoSeguroAtivo } from "@/lib/campanhas/modo-seguro";
import type { CampanhaConteudo, CampanhaTipo, Exclusoes, PublicoTipo } from "@/lib/campanhas/types";

/**
 * Server actions de campanha.
 *
 * TODAS as decisões duras vivem no lib e são recalculadas a partir da campanha
 * LIDA DO BANCO — nenhuma delas confia em hash, estado ou contagem vindos do
 * cliente. Payload adulterado pela rede não passa: é isso que faz os checks 3,
 * 4 e 5 do β serem provas de servidor, não de tela.
 */

export type ActionResult = { success: boolean; error?: string };

function revalidar(id?: string) {
  revalidatePath("/admin/campanhas");
  if (id) {
    revalidatePath(`/admin/campanhas/${id}`);
    revalidatePath(`/admin/campanhas/${id}/resultados`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Criação e edição
// ─────────────────────────────────────────────────────────────────

export async function criarCampanhaAction(
  nomeInterno: string,
  tipo: CampanhaTipo,
): Promise<ActionResult & { id?: string }> {
  try {
    const sessao = await requireRole("admin");

    const nome = nomeInterno.trim();
    if (nome.length < 2) return { success: false, error: "Dê um nome com ao menos 2 letras." };

    const campanha = await criarCampanha({ nomeInterno: nome, tipo, criadoPor: sessao.id });
    revalidar(campanha.id);
    return { success: true, id: campanha.id };
  } catch (err) {
    console.error("[criarCampanhaAction] erro:", err);
    return { success: false, error: "Não foi possível criar a campanha." };
  }
}

/**
 * Passo 1. Recalcula `conteudo_hash` NO SERVIDOR e, se ele divergir do
 * `testado_hash`, rebaixa a campanha pra rascunho (C4). Campanha enviada é
 * recusada (C5).
 */
export async function salvarConteudoAction(
  id: string,
  conteudo: CampanhaConteudo,
  extras: { nomeInterno?: string; tipo?: CampanhaTipo },
): Promise<ActionResult & { estado?: string }> {
  try {
    await requireRole("admin");
    const campanha = await salvarConteudo(id, conteudo, extras);
    revalidar(id);
    return { success: true, estado: campanha.estado };
  } catch (err) {
    if (err instanceof CampanhaImutavelError) {
      return { success: false, error: err.message };
    }
    console.error("[salvarConteudoAction] erro:", err);
    return { success: false, error: "Não foi possível salvar. Tente de novo." };
  }
}

/** Passo 2. */
export async function salvarPublicoAction(
  id: string,
  publicoTipo: PublicoTipo,
  grupoId: string | null,
): Promise<ActionResult> {
  try {
    await requireRole("admin");
    await salvarPublico(id, publicoTipo, grupoId);
    revalidar(id);
    return { success: true };
  } catch (err) {
    if (err instanceof CampanhaImutavelError) {
      return { success: false, error: err.message };
    }
    console.error("[salvarPublicoAction] erro:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Não foi possível salvar o público.",
    };
  }
}

/**
 * Upload da imagem. Bucket PÚBLICO `campanhas` (I1) — se ele ainda não existir
 * no servidor, a mensagem diz isso em português e o resto da campanha segue
 * funcionando sem imagem.
 */
export async function uploadImagemAction(
  id: string,
  formData: FormData,
): Promise<ActionResult & { path?: string; url?: string }> {
  try {
    await requireRole("admin");

    const campanha = await getCampanhaById(id);
    if (!campanha) return { success: false, error: "Campanha não encontrada." };
    if (campanha.estado === "enviada") {
      return { success: false, error: "Esta campanha já foi enviada." };
    }

    const file = formData.get("imagem");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Escolha um arquivo." };
    }

    const path = await uploadImagemCampanha(id, file);
    revalidar(id);
    return { success: true, path, url: urlImagemCampanha(path) ?? undefined };
  } catch (err) {
    if (err instanceof BucketAusenteError) {
      return { success: false, error: err.message };
    }
    console.error("[uploadImagemAction] erro:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Não foi possível subir a imagem.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Passo 2 — contagem ao vivo
// ─────────────────────────────────────────────────────────────────

export async function contarPublicoAction(
  publicoTipo: PublicoTipo,
  grupoId: string | null,
): Promise<{ total: number; exclusoes: Exclusoes; totalGrupo: number | null } | null> {
  try {
    await requireRole("admin");
    return await contarPublico(publicoTipo, grupoId);
  } catch (err) {
    console.error("[contarPublicoAction] erro:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Passo 3 — preflight, teste, envio
// ─────────────────────────────────────────────────────────────────

/**
 * Preflight sobre o e-mail montado NO SERVIDOR. A tela também roda o mesmo
 * módulo puro pra dar retorno imediato; esta é a versão que vale.
 */
export async function preflightAction(id: string) {
  await requireRole("admin");
  const campanha = await getCampanhaById(id);
  if (!campanha) return null;

  const conteudo = conteudoDe(campanha);
  const html = montarEmailHtml(conteudo, {
    imagemUrl: urlImagemCampanha(campanha.imagemPath),
    enderecoRodape: process.env.CAMPANHAS_ENDERECO_RODAPE,
  });

  const gate = await checarEnvio(campanha);
  return {
    itens: preflight(conteudo, html),
    podeEnviar: gate.ok,
    motivo: gate.ok ? null : gate.erro,
    modoSeguro: modoSeguroAtivo(),
  };
}

/**
 * Endereços oferecidos no envio de teste: os usuários APROVADOS do back-office
 * (Nina, Julia, quem mais existir) mais o operador logado. Lista fixa vinda do
 * banco, não campo livre — teste é pra dentro de casa.
 */
export async function destinosDeTesteAction(): Promise<string[]> {
  const sessao = await requireRole("admin");
  try {
    const { data } = await supabaseAdmin()
      .from("user_profiles")
      .select("email")
      .eq("status", "approved");

    const emails = ((data as { email: string }[]) ?? []).map((u) => u.email);
    return [...new Set([sessao.email, ...emails])].filter(Boolean);
  } catch (err) {
    console.error("[destinosDeTesteAction] erro:", err);
    return [sessao.email];
  }
}

export async function enviarTesteAction(id: string, destinos: string[]): Promise<ActionResult> {
  try {
    const sessao = await requireRole("admin");

    // O cliente só pode escolher DENTRO da lista fechada — nada de digitar
    // endereço arbitrário por payload adulterado.
    const permitidos = new Set(await destinosDeTesteAction());
    const filtrados = destinos.filter((d) => permitidos.has(d));
    if (filtrados.length === 0) {
      return { success: false, error: "Escolha ao menos um endereço da lista." };
    }

    const r = await enviarTesteDaCampanha(id, filtrados, sessao.email);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(id);
    return { success: true };
  } catch (err) {
    console.error("[enviarTesteAction] erro:", err);
    return { success: false, error: "Não foi possível enviar o teste." };
  }
}

/**
 * Envio ou agendamento. `agendamento` chega como `{data, hora}` do formulário,
 * sem fuso — assumido America/Sao_Paulo (ver `agendamentoParaIso`).
 */
export async function dispararAction(
  id: string,
  agendamento?: { data: string; hora: string } | null,
): Promise<ActionResult & { modoSeguro?: boolean; enviados?: number; totalReal?: number }> {
  try {
    const sessao = await requireRole("admin");

    let iso: string | null = null;
    if (agendamento?.data && agendamento?.hora) {
      iso = agendamentoParaIso(agendamento.data, agendamento.hora);
      if (Date.parse(iso) <= Date.now()) {
        return { success: false, error: "Escolha uma data e hora no futuro." };
      }
    }

    const r = await dispararCampanha(id, sessao.email, iso);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(id);
    return {
      success: true,
      modoSeguro: r.modoSeguro,
      enviados: r.enviados,
      totalReal: r.totalReal,
    };
  } catch (err) {
    console.error("[dispararAction] erro:", err);
    return { success: false, error: "Não foi possível disparar a campanha." };
  }
}

export async function cancelarAgendamentoAction(id: string): Promise<ActionResult> {
  try {
    const sessao = await requireRole("admin");
    const r = await cancelarAgendamento(id, sessao.email);
    if (!r.ok) return { success: false, error: r.erro };

    revalidar(id);
    return { success: true };
  } catch (err) {
    console.error("[cancelarAgendamentoAction] erro:", err);
    return { success: false, error: "Não foi possível cancelar o agendamento." };
  }
}
