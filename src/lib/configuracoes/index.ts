import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToCaptureOrigin, rowToTag, type CaptureOriginRow, type TagRow } from "./mappers";
import type { CaptureOrigin, Tag } from "./types";

/**
 * Leitura das Configurações via service role (`supabaseAdmin`). As páginas que
 * consomem são admin-only, então o gate é feito na página/Server Action; aqui é
 * só acesso a dados.
 */

export async function getCaptureOrigins(): Promise<CaptureOrigin[]> {
  const { data, error } = await supabaseAdmin().from("capture_origins").select("*").order("name");

  if (error) throw new Error(`Erro ao buscar origens de captação: ${error.message}`);

  return (data as CaptureOriginRow[]).map(rowToCaptureOrigin);
}

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabaseAdmin().from("tags").select("*").order("name");

  if (error) throw new Error(`Erro ao buscar tags: ${error.message}`);

  return (data as TagRow[]).map(rowToTag);
}
