import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import type { Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * Sessão do usuário logado, ou `null`.
 *
 * Lê o usuário autenticado pelos cookies (`supabaseServer`) e cruza com o
 * `user_profiles` via service role — RLS bloquearia um usuário `pending` de ler
 * o próprio status, então o bypass é necessário aqui. Só retorna sessão para
 * quem está `approved` (pending/rejected ⇒ `null`).
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, email, name, status, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  if (profile.status !== "approved") return null;
  if (profile.role !== "admin" && profile.role !== "editor") return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
  };
}

/** Exige sessão aprovada; senão redireciona pro login. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Exige sessão aprovada com um dos roles permitidos; senão joga pro home admin. */
export async function requireRole(role: Role | Role[]): Promise<SessionUser> {
  const session = await requireSession();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.role)) redirect("/admin");
  return session;
}
