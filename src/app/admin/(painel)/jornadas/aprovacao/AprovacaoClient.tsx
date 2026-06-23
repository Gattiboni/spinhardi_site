"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ESTAGIOS_OPTIONS, ESTAGIO_LABELS, type EstagioFunil } from "@/lib/contacts/types";
import type { JornadaComContato } from "@/lib/jornadas/types";
import { aprovarJornadaAction } from "../actions";

const brl = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

function LinhaPendente({ jornada }: { jornada: JornadaComContato }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [estagio, setEstagio] = useState<EstagioFunil>(jornada.estagio);
  const [erro, setErro] = useState<string | null>(null);

  const handleAprovar = () => {
    setErro(null);
    startTransition(async () => {
      const result = await aprovarJornadaAction(jornada.id, estagio);
      if (result.success) {
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível aprovar.");
      }
    });
  };

  const inputClass =
    "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

  return (
    <div className="bg-white border border-dark/10 rounded-md p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-body font-medium text-sm text-dark truncate">
          {jornada.tituloJornada ?? "Atendimento sem título"}
        </p>
        <p className="font-body text-xs text-dark/50 mt-0.5 truncate">
          {jornada.contactId ? (
            <Link
              href={`/admin/contatos/${jornada.contactId}`}
              className="hover:text-gold transition-colors duration-short"
            >
              {jornada.contatoNome ?? "(contato sem nome)"}
            </Link>
          ) : (
            (jornada.contatoNome ?? "(sem contato vinculado)")
          )}
          {" · "}
          {brl(jornada.valor)}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <label className="sr-only" htmlFor={`estagio-${jornada.id}`}>
          Estágio sugerido
        </label>
        <select
          id={`estagio-${jornada.id}`}
          value={estagio}
          onChange={(e) => setEstagio(e.target.value as EstagioFunil)}
          disabled={pending}
          className={inputClass}
        >
          {ESTAGIOS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ESTAGIO_LABELS[s]}
            </option>
          ))}
        </select>

        <Button variant="primary" size="sm" onClick={handleAprovar} disabled={pending}>
          {pending ? "Aprovando..." : "Aprovar"}
        </Button>
      </div>

      {erro && <span className="font-body text-sm text-red-600">{erro}</span>}
    </div>
  );
}

export default function AprovacaoClient({ pendentes }: { pendentes: JornadaComContato[] }) {
  if (pendentes.length === 0) {
    return (
      <div className="bg-white border border-dark/10 rounded-md p-12 text-center">
        <p className="font-body text-dark/60">Nenhuma jornada pendente de aprovação.</p>
        <p className="font-body text-sm text-dark/40 mt-2">
          Quando o sync passar a gerar jornadas, elas aparecem aqui pra você confirmar o estágio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendentes.map((j) => (
        <LinhaPendente key={j.id} jornada={j} />
      ))}
    </div>
  );
}
