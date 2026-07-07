"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { requestReset, type RequestResetState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-8 py-4 text-lg font-body font-medium text-dark transition-colors duration-medium hover:bg-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Enviando..." : "Enviar link de redefinição"}
    </button>
  );
}

const inputClass =
  "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

export default function EsqueciSenhaPage() {
  const [state, formAction] = useActionState<RequestResetState, FormData>(requestReset, null);
  const success = state && "success" in state;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>

        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
          {success ? (
            <>
              <h1 className="font-display text-3xl text-navy mb-3 leading-tight">
                Verifique seu e-mail
              </h1>
              <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
                Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
                O link vale por tempo limitado — use assim que chegar.
              </p>
              <Link href="/admin/login" className="font-body text-sm text-gold hover:underline">
                ← Voltar pro login
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-navy mb-3 leading-tight">
                Esqueceu a senha?
              </h1>
              <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
                Informe seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>

              <form action={formAction} className="space-y-6">
                {state && "error" in state && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm font-body">
                    {state.error}
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
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="seu.email@exemplo.com"
                    className={inputClass}
                  />
                </div>

                <SubmitButton />
              </form>

              <p className="mt-8 text-center font-body text-sm text-dark/60">
                Lembrou a senha?{" "}
                <Link href="/admin/login" className="text-gold hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
