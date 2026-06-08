"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const result = await auth.signIn(email);
      if (result.success) {
        setMessage(result.message);
      } else {
        setError("Não foi possível enviar o link. Tente novamente.");
      }
    } catch {
      setError("Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>

        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
          <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Acesso ao painel</h1>
          <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
            Insira seu e-mail e enviaremos um link de acesso seguro.
          </p>

          {message ? (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="font-body text-sm text-green-800 leading-relaxed">{message}</p>
              {isDev && (
                <Link
                  href="/admin/login/verificar"
                  className="mt-4 inline-block font-body text-sm text-gold hover:underline"
                >
                  → Simular clique no link (modo dev)
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm font-body">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block font-body text-sm font-medium text-dark mb-2"
                >
                  E-mail
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 transition-all duration-short"
                />
              </div>

              <Button type="submit" variant="primary" size="lg" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de acesso"}
              </Button>
            </form>
          )}

          {isDev && !message && (
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="font-body text-xs uppercase tracking-widest text-yellow-800 mb-2">
                ⚠ Modo de desenvolvimento
              </p>
              <p className="font-body text-sm text-yellow-900 leading-relaxed">
                Em dev, qualquer e-mail funciona. Após enviar, vá pra{" "}
                <code className="px-1 bg-yellow-100 rounded text-xs">/admin/login/verificar</code>{" "}
                pra simular o clique.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
