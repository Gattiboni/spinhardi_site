"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import {
  normalizarSlug,
  ehErroDeUnicidade,
  mensagemSlugEmUso,
  HEX_TAG_RE,
} from "@/lib/tags/shared";
import { revalidarCatalogoDeTags } from "@/lib/tags/revalidate";
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

// "Indicação de Cliente" → "indicacao-de-cliente". A normalização vive em
// `lib/tags/shared` (T3): era a mesma regra escrita duas vezes, uma aqui e uma
// lá, e o cliente adivinhava o que este arquivo ia gravar. Agora é uma só, e
// serve tanto `tags` quanto `capture_origins`.
const slugify = normalizarSlug;

function validateName(name: string): string | null {
  if (name.trim().length < 2) return "Informe um nome com ao menos 2 caracteres.";
  return null;
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
    if (ehErroDeUnicidade(error.message)) {
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

/**
 * CRUD completo do catálogo, admin (T2). É esta action que tem `grupo` e cor
 * livre; a criação no ponto de uso (ficha, lista, funil) é a `criarTagInline`
 * de `lib/tags/actions`, que exige só sessão e resolve a cor pela paleta.
 */
export async function createTag(input: TagInput): Promise<ActionResult> {
  await requireRole("admin");

  const invalid = validateName(input.name);
  if (invalid) return { success: false, error: invalid };
  if (!HEX_TAG_RE.test(input.cor)) return { success: false, error: "Cor inválida (use #RRGGBB)." };

  const slug = slugify(input.name);
  if (!slug) return { success: false, error: "Use ao menos uma letra ou número no nome da tag." };

  const row: TagInsertRow = {
    name: input.name.trim(),
    slug,
    cor: input.cor,
    grupo: toNullable(input.grupo),
    is_active: input.is_active,
  };

  const { error } = await supabaseAdmin().from("tags").insert(row);

  if (error) {
    // O UNIQUE de `tags` é em SLUG (o banco não tem unique em `name`): dizer
    // "esse nome já existe" mandava procurar um nome idêntico que não existe —
    // "Lua de Mel" e "Lua-de-Mel" são nomes diferentes e o mesmo slug (T7).
    if (ehErroDeUnicidade(error.message)) {
      return { success: false, error: mensagemSlugEmUso(slug) };
    }
    return { success: false, error: "Não foi possível criar a tag." };
  }

  revalidarCatalogoDeTags();
  return { success: true };
}

export async function updateTag(id: string, fields: Partial<TagInput>): Promise<ActionResult> {
  await requireRole("admin");

  if (fields.name !== undefined) {
    const invalid = validateName(fields.name);
    if (invalid) return { success: false, error: invalid };
  }
  if (fields.cor !== undefined && !HEX_TAG_RE.test(fields.cor)) {
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

  // Renomear/recolorir muda o VOCABULÁRIO: sem as quatro telas, a tag seguia
  // com o nome velho na ficha, na lista e no funil até alguém dar F5 (T6).
  revalidarCatalogoDeTags();
  return { success: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const { error } = await supabaseAdmin().from("tags").delete().eq("id", id);

  if (error) return { success: false, error: "Não foi possível excluir a tag." };

  // Sem cascata, por decisão (T3): os slugs já gravados viram órfãos e seguem
  // aparecendo em cinza, com ✕ pra sair. A revalidação é o que faz eles
  // aparecerem como órfãos na hora, em vez de continuarem coloridos.
  revalidarCatalogoDeTags();
  return { success: true };
}
