"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword, type UpdatePasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-8 py-4 text-lg font-body font-medium text-dark transition-colors duration-medium hover:bg-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Salvando..." : "Salvar nova senha"}
    </button>
  );
}

const inputClass =
  "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

export default function RedefinirSenhaForm() {
  const [state, formAction] = useActionState<UpdatePasswordState, FormData>(updatePassword, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm font-body">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block font-body text-sm font-medium text-dark mb-2">
          Nova senha
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block font-body text-sm font-medium text-dark mb-2">
          Confirmar nova senha
        </label>
        <input
          type="password"
          id="confirm"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <SubmitButton />
    </form>
  );
}
