"use client";

import type { AuthProvider, User } from "./provider";
import type { Role } from "./roles";

const STORAGE_KEY = "spinhardi-admin-session";
const PENDING_EMAIL_KEY = "spinhardi-pending-email";
const ROLE_OVERRIDE_KEY = "spinhardi-admin-role-override";

function getSession(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    if (process.env.NODE_ENV === "development") {
      const override = localStorage.getItem(ROLE_OVERRIDE_KEY);
      if (override === "admin" || override === "editor") {
        return { ...user, role: override as Role };
      }
    }
    return user;
  } catch {
    return null;
  }
}

export const mockAuth: AuthProvider = {
  async signIn(email) {
    if (typeof window !== "undefined") {
      localStorage.setItem(PENDING_EMAIL_KEY, email);
    }
    return {
      success: true,
      message: `Link enviado pra ${email}. Em dev, abra /admin/login/verificar pra continuar.`,
    };
  },

  async signOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ROLE_OVERRIDE_KEY);
    }
  },

  async getUser() {
    return getSession();
  },

  async verifySession() {
    if (typeof window === "undefined") return null;

    // Idempotência: se já existe sessão, retorna ela direto.
    // Necessário pra sobreviver ao Strict Mode (useEffect invocado 2x em dev).
    const existingSessionRaw = localStorage.getItem(STORAGE_KEY);
    if (existingSessionRaw) {
      try {
        return JSON.parse(existingSessionRaw) as User;
      } catch {
        // sessão corrompida, segue pra recriar
      }
    }

    // Caminho normal: cria sessão a partir do pending-email.
    const email = localStorage.getItem(PENDING_EMAIL_KEY);
    if (!email) return null;

    const user: User = {
      id: `mock-${email}`,
      email,
      name: email.split("@")[0].replace(/\./g, " "),
      role: "admin",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    localStorage.removeItem(PENDING_EMAIL_KEY);
    return user;
  },
};

export function setRoleOverride(role: Role | null) {
  if (typeof window === "undefined") return;
  if (role === null) {
    localStorage.removeItem(ROLE_OVERRIDE_KEY);
  } else {
    localStorage.setItem(ROLE_OVERRIDE_KEY, role);
  }
}
