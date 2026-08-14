"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  atualizarTarefa,
  buscarContatosParaVinculo,
  confirmarCheckin,
  criarTarefa,
  desfazerCheckin,
  ehResponsavelValido,
  excluirTarefa,
  getJornadasParaVinculo,
  reagendarTarefa,
  setTarefaConcluida,
  tarefaExiste,
} from "@/lib/calendario";
import { ehDataISOValida } from "@/lib/calendario/datas";
import { TIPOS_TAREFA } from "@/lib/calendario/types";

/**
 * Escritas do calendário — o ÚNICO escritor de `tarefas` e `calendar_checkins`.
 *
 * Toda action revalida e valida do zero no servidor. Validar de novo aqui não é
 * paranoia decorativa: o cliente manda o payload, e um payload adulterado pela
 * rede não pode criar tarefa sem título, com data inexistente (31/02) ou
 * apontando pra um responsável que não existe — ou que existe e não está
 * aprovado, o que devolveria acesso a quem já foi desligado.
 *
 * `revalidatePath("/admin/calendario")` cobre as três visões: o range vive na
 * query string, e revalidar o path invalida a rota inteira.
 */

export type ActionResult = {
  success: boolean;
  error?: string;
};

const TITULO_MAX = 200;

/** Formato de UUID — evita mandar lixo pro Postgres e receber 22P02 de volta. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TarefaInput = {
  titulo: string;
  data: string;
  /** `HH:MM:SS` ou `null` pra dia inteiro. */
  hora: string | null;
  tipo: number | null;
  descricao: string | null;
  responsavelId: string;
  contactId: string | null;
  jornadaId: string | null;
};

type Validado = {
  titulo: string;
  data: string;
  hora: string | null;
  tipo: number | null;
  descricao: string | null;
  responsavelId: string;
  contactId: string | null;
  jornadaId: string | null;
};

/** Validação compartilhada por criar e editar. String = erro pro usuário. */
async function validarTarefa(input: TarefaInput): Promise<Validado | string> {
  const titulo = typeof input.titulo === "string" ? input.titulo.trim() : "";
  if (!titulo) return "O título é obrigatório.";
  if (titulo.length > TITULO_MAX) return `O título passa de ${TITULO_MAX} caracteres.`;

  if (!ehDataISOValida(input.data)) return "Data inválida.";

  const hora = input.hora ?? null;
  if (hora !== null && !/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) return "Hora inválida.";

  const tipo = input.tipo ?? null;
  if (tipo !== null && !(tipo in TIPOS_TAREFA)) return "Tipo de tarefa inválido.";

  if (typeof input.responsavelId !== "string" || !UUID.test(input.responsavelId)) {
    return "Escolha um responsável.";
  }
  if (!(await ehResponsavelValido(input.responsavelId))) {
    return "O responsável escolhido não é um usuário aprovado.";
  }

  const contactId = input.contactId ?? null;
  if (contactId !== null && !UUID.test(contactId)) return "Contato inválido.";

  const jornadaId = input.jornadaId ?? null;
  if (jornadaId !== null && !UUID.test(jornadaId)) return "Jornada inválida.";

  const descricao = input.descricao?.trim() ? input.descricao.trim() : null;

  return {
    titulo,
    data: input.data,
    hora,
    tipo,
    descricao,
    responsavelId: input.responsavelId,
    contactId,
    jornadaId,
  };
}

function revalidar(): void {
  revalidatePath("/admin/calendario");
}

// ─────────────────────────────────────────────────────────────────
// Tarefas
// ─────────────────────────────────────────────────────────────────

/** Cria uma tarefa local. `created_by` é sempre a sessão, nunca o payload. */
export async function criarTarefaAction(input: TarefaInput): Promise<ActionResult> {
  try {
    const sessao = await requireSession();

    const validado = await validarTarefa(input);
    if (typeof validado === "string") return { success: false, error: validado };

    // Quem não é admin só cria pra si. Deixar um editor atribuir tarefa a outra
    // pessoa criaria um registro que ele mesmo não veria depois (C5: não-admin
    // enxerga só as próprias) — escrever no escuro.
    if (sessao.role !== "admin" && validado.responsavelId !== sessao.id) {
      return { success: false, error: "Você só pode criar tarefas pra você." };
    }

    await criarTarefa({ ...validado, criadoPor: sessao.id });
    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[criarTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível criar a tarefa. Tente de novo." };
  }
}

export async function editarTarefaAction(id: string, input: TarefaInput): Promise<ActionResult> {
  try {
    const sessao = await requireSession();
    if (!UUID.test(id)) return { success: false, error: "Tarefa inválida." };

    const validado = await validarTarefa(input);
    if (typeof validado === "string") return { success: false, error: validado };

    if (sessao.role !== "admin" && validado.responsavelId !== sessao.id) {
      return { success: false, error: "Você só pode manter a tarefa com você." };
    }
    if (!(await tarefaExiste(id))) {
      return { success: false, error: "Essa tarefa não existe mais." };
    }

    await atualizarTarefa(id, validado);
    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[editarTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível salvar a tarefa. Tente de novo." };
  }
}

/** Conclui ou reabre. A UI é otimista; o erro daqui reverte o risco na tela. */
export async function concluirTarefaAction(id: string, concluida: boolean): Promise<ActionResult> {
  try {
    const sessao = await requireSession();
    if (!UUID.test(id)) return { success: false, error: "Tarefa inválida." };
    if (typeof concluida !== "boolean") return { success: false, error: "Estado inválido." };

    await setTarefaConcluida(id, concluida, sessao.id);
    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[concluirTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível atualizar a tarefa." };
  }
}

/**
 * Reagenda por arrasto. A MESMA action serve ao "Desfazer" do toast, chamada de
 * volta com a data anterior — desfazer aqui é reagendar pro lugar de origem, não
 * um caminho de escrita à parte.
 */
export async function reagendarTarefaAction(id: string, data: string): Promise<ActionResult> {
  try {
    await requireSession();
    if (!UUID.test(id)) return { success: false, error: "Tarefa inválida." };
    if (!ehDataISOValida(data)) return { success: false, error: "Data inválida." };

    await reagendarTarefa(id, data);
    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[reagendarTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível reagendar." };
  }
}

/** Exclusão definitiva — a confirmação é do Modal destrutivo, na UI. */
export async function excluirTarefaAction(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    if (!UUID.test(id)) return { success: false, error: "Tarefa inválida." };

    await excluirTarefa(id);
    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[excluirTarefaAction] erro:", err);
    return { success: false, error: "Não foi possível excluir a tarefa." };
  }
}

// ─────────────────────────────────────────────────────────────────
// Vínculos do formulário completo (leitura, sob sessão)
// ─────────────────────────────────────────────────────────────────

/** Autocomplete de contato do formulário. Exige sessão como qualquer outra action. */
export async function buscarContatosAction(termo: string): Promise<{ id: string; nome: string }[]> {
  try {
    await requireSession();
    if (typeof termo !== "string") return [];
    return await buscarContatosParaVinculo(termo);
  } catch (err) {
    console.error("[buscarContatosAction] erro:", err);
    return [];
  }
}

/** Jornadas abertas do contato escolhido, pro segundo select do formulário. */
export async function jornadasDoContatoAction(
  contactId: string,
): Promise<{ id: string; titulo: string }[]> {
  try {
    await requireSession();
    if (!UUID.test(contactId)) return [];
    return await getJornadasParaVinculo(contactId);
  } catch (err) {
    console.error("[jornadasDoContatoAction] erro:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Check-in (C3)
// ─────────────────────────────────────────────────────────────────

/**
 * Confirma ou desfaz o check-in de um voo.
 *
 * `vooBronzeId` é texto (id do Iddas), não uuid — a chave de `calendar_checkins`
 * é o id da bronze. Check-in não tem responsável: é do time, concluível por
 * qualquer aprovado, com a autoria registrada em `concluido_por`.
 */
export async function setCheckinAction(
  vooBronzeId: string,
  concluido: boolean,
): Promise<ActionResult> {
  try {
    const sessao = await requireSession();

    if (typeof vooBronzeId !== "string" || !/^[\w-]{1,64}$/.test(vooBronzeId)) {
      return { success: false, error: "Voo inválido." };
    }
    if (typeof concluido !== "boolean") return { success: false, error: "Estado inválido." };

    if (concluido) await confirmarCheckin(vooBronzeId, sessao.id);
    else await desfazerCheckin(vooBronzeId);

    revalidar();
    return { success: true };
  } catch (err) {
    console.error("[setCheckinAction] erro:", err);
    return { success: false, error: "Não foi possível atualizar o check-in." };
  }
}
