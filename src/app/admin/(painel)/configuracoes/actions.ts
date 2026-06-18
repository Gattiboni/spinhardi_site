"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import type {
  CaptureOriginInsertRow,
  CaptureOriginUpdateRow,
  TagInsertRow,
  TagUpdateRow,
} from "@/lib/configuracoes/mappers";

export type ActionResult = { success: boolean; error?: string };

export type CaptureOriginInput = {
  name: string;
  descricao: string | null;
  is_active: boolean;
  campanha_ativa: boolean;
};

export type TagInput = {
  name: string;
  cor: string;
  grupo: string | null;
  is_active: boolean;
};

/** "Indicação de Cliente" → "indicacao-de-cliente". */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateName(name: string): string | null {
  if (name.trim().length < 2) return "Informe um nome com ao menos 2 caracteres.";
  return null;
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key|unique/i.test(message);
}

// Campo de texto nullable: string vazia/espacos viram null.
function toNullable(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─────────────────────────────────────────────────────────────────
// Origens de captação
// ─────────────────────────────────────────────────────────────────

export async function createCaptureOrigin(input: CaptureOriginInput): Promise<ActionResult> {
  await requireRole("admin");

  const invalid = validateName(input.name);
  if (invalid) return { success: false, error: invalid };

  const row: CaptureOriginInsertRow = {
    name: input.name.trim(),
    slug: slugify(input.name),
    descricao: toNullable(input.descricao),
    is_active: input.is_active,
    campanha_ativa: input.campanha_ativa,
  };

  const { error } = await supabaseAdmin().from("capture_origins").insert(row);

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { success: false, error: "Já existe uma origem com esse nome." };
    }
    return { success: false, error: "Não foi possível criar a origem." };
  }

  revalidatePath("/admin/configuracoes");
  return { success: true };
}

export async function updateCaptureOrigin(
  id: string,
  fields: Partial<CaptureOriginInput>,
): Promise<ActionResult> {
  await requireRole("admin");

  if (fields.name !== undefined) {
    const invalid = validateName(fields.name);
    if (invalid) return { success: false, error: invalid };
  }

  // Slug fica estável no rename (não regenera) pra não quebrar referências.
  const row: CaptureOriginUpdateRow = {};
  if (fields.name !== undefined) row.name = fields.name.trim();
  if (fields.descricao !== undefined) row.descricao = toNullable(fields.descricao);
  if (fields.is_active !== undefined) row.is_active = fields.is_active;
  if (fields.campanha_ativa !== undefined) row.campanha_ativa = fields.campanha_ativa;

  const { error } = await supabaseAdmin().from("capture_origins").update(row).eq("id", id);

  if (error) return { success: false, error: "Não foi possível salvar a origem." };

  revalidatePath("/admin/configuracoes");
  return { success: true };
}

export async function deleteCaptureOrigin(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const { error } = await supabaseAdmin().from("capture_origins").delete().eq("id", id);

  if (error) return { success: false, error: "Não foi possível excluir a origem." };

  revalidatePath("/admin/configuracoes");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────

export async function createTag(input: TagInput): Promise<ActionResult> {
  await requireRole("admin");

  const invalid = validateName(input.name);
  if (invalid) return { success: false, error: invalid };
  if (!HEX_RE.test(input.cor)) return { success: false, error: "Cor inválida (use #RRGGBB)." };

  const row: TagInsertRow = {
    name: input.name.trim(),
    slug: slugify(input.name),
    cor: input.cor,
    grupo: toNullable(input.grupo),
    is_active: input.is_active,
  };

  const { error } = await supabaseAdmin().from("tags").insert(row);

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { success: false, error: "Já existe uma tag com esse nome." };
    }
    return { success: false, error: "Não foi possível criar a tag." };
  }

  revalidatePath("/admin/configuracoes");
  return { success: true };
}

export async function updateTag(id: string, fields: Partial<TagInput>): Promise<ActionResult> {
  await requireRole("admin");

  if (fields.name !== undefined) {
    const invalid = validateName(fields.name);
    if (invalid) return { success: false, error: invalid };
  }
  if (fields.cor !== undefined && !HEX_RE.test(fields.cor)) {
    return { success: false, error: "Cor inválida (use #RRGGBB)." };
  }

  // Slug fica estável no rename.
  const row: TagUpdateRow = {};
  if (fields.name !== undefined) row.name = fields.name.trim();
  if (fields.cor !== undefined) row.cor = fields.cor;
  if (fields.grupo !== undefined) row.grupo = toNullable(fields.grupo);
  if (fields.is_active !== undefined) row.is_active = fields.is_active;

  const { error } = await supabaseAdmin().from("tags").update(row).eq("id", id);

  if (error) return { success: false, error: "Não foi possível salvar a tag." };

  revalidatePath("/admin/configuracoes");
  return { success: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const { error } = await supabaseAdmin().from("tags").delete().eq("id", id);

  if (error) return { success: false, error: "Não foi possível excluir a tag." };

  revalidatePath("/admin/configuracoes");
  return { success: true };
}
