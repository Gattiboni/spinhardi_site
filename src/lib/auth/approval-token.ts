import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * Tokens de aprovação de acesso (JWT assinado com HMAC).
 *
 * `jose` em vez de `jsonwebtoken` por funcionar no edge/Node runtime do Next 16.
 * O segredo (`APPROVAL_HMAC_SECRET`) é exclusivo deste fluxo — separado das
 * outras chaves. Expiração de 7 dias dá margem confortável pro Alan agir.
 *
 * Não há tabela de tokens consumidos: o próprio `status` do `user_profiles`
 * serve de proteção. Um novo clique no mesmo link sobrescreve a decisão (o Alan
 * pode rever depois no painel), o que é aceitável pra escala atual.
 */
export type ApprovalAction = "admin" | "editor" | "reject";

export type ApprovalPayload = {
  user_id: string;
  action: ApprovalAction;
};

function secret() {
  return new TextEncoder().encode(process.env.APPROVAL_HMAC_SECRET!);
}

export async function signApprovalToken(userId: string, action: ApprovalAction): Promise<string> {
  return new SignJWT({ user_id: userId, action })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

/** Valida assinatura + expiração. Retorna o payload tipado, ou `null` se inválido. */
export async function verifyApprovalToken(token: string): Promise<ApprovalPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.user_id;
    const action = payload.action;
    if (typeof userId !== "string") return null;
    if (action !== "admin" && action !== "editor" && action !== "reject") return null;
    return { user_id: userId, action };
  } catch {
    return null;
  }
}
