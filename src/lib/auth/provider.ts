import type { Role } from "./roles";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AuthProvider = {
  signIn(email: string): Promise<{ success: boolean; message: string }>;
  signOut(): Promise<void>;
  getUser(): Promise<User | null>;
  verifySession(token?: string): Promise<User | null>;
};
