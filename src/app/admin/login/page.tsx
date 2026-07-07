"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { login, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-8 py-4 text-lg font-body font-medium text-dark transition-colors duration-medium hover:bg-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, null);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>

        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
          <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Acesso ao painel</h1>
          <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
            Entre com seu e-mail e senha.
          </p>

          <form action={formAction} className="space-y-6">
            {state?.error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm font-body">
                {state.error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block font-body text-sm font-medium text-dark mb-2">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                placeholder="seu.email@exemplo.com"
                className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-body text-sm font-medium text-dark mb-2"
              >
                Senha
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-6 text-center font-body text-sm">
            <Link href="/admin/esqueci-senha" className="text-gold hover:underline">
              Esqueci minha senha
            </Link>
          </p>

          <p className="mt-4 text-center font-body text-sm text-dark/60">
            Não tem acesso?{" "}
            <Link href="/admin/solicitar-acesso" className="text-gold hover:underline">
              Solicitar acesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
