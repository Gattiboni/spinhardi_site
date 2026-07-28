"use client";

import Link from "next/link";
import { formatDateTimeShort } from "@/lib/utils/date";
import {
  ORIGEM_STATUS_LABELS,
  STATUS_EMAIL_BADGE,
  type EmailMarketingOrigem,
  type EmailMarketingStatus,
} from "@/lib/campanhas/types";
import type { Grupo } from "@/lib/grupos/types";

/**
 * Bloco de e-mail marketing da ficha: status atual + de quais grupos a pessoa
 * participa + histórico por campanha.
 *
 * O histórico é DERIVADO (V6): vem de `campanha_destinatarios` cruzado com
 * `campanha_eventos`. Nenhum contador em coluna — `emails_abertos` e
 * `campanhas_ativas` morreram neste lote.
 *
 * A frase do status explica o que o sistema já fez, em português de gente: a
 * operadora precisa saber se a pessoa recebe ou não e por quê, sem abrir doc.
 */

export type HistoricoEmail = {
  campanhaId: string;
  campanhaNome: string;
  enviadoEm: string;
  recebeu: boolean;
  abriu: boolean;
  clicou: boolean;
};

export default function EmailMarketingCard({
  status,
  statusEm,
  statusOrigem,
  grupos,
  historico,
}: {
  status: EmailMarketingStatus;
  statusEm: string | null;
  statusOrigem: EmailMarketingOrigem | null;
  grupos: Grupo[];
  historico: HistoricoEmail[];
}) {
  const badge = STATUS_EMAIL_BADGE[status];

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6 space-y-6">
      <h2 className="font-display text-xl text-navy pb-3 border-b border-dark/10">
        E-mail marketing
      </h2>

      {/* Status */}
      <section className="space-y-2" data-testid="email-marketing-status">
        <span
          className={`inline-flex items-center h-7 px-3 rounded-full font-body text-xs ${badge.classe}`}
        >
          {badge.label}
        </span>
        <p className="font-body text-sm text-dark/60">{badge.explicacao}</p>
        {statusEm && (
          <p className="font-body text-xs text-dark/40">
            Desde {formatDateTimeShort(statusEm, { comAno: true })}
            {statusOrigem ? ` · por ${ORIGEM_STATUS_LABELS[statusOrigem]}` : ""}
          </p>
        )}
      </section>

      {/* Grupos */}
      <section>
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">Grupos</p>
        <div className="flex flex-wrap items-center gap-2" data-testid="ficha-grupos">
          {grupos.length === 0 ? (
            <span className="font-body text-sm text-dark/40">Não está em nenhum grupo.</span>
          ) : (
            grupos.map((g) => (
              <Link
                key={g.id}
                href={`/admin/campanhas/grupos/${g.id}`}
                className="inline-flex items-center h-6 px-2.5 rounded-full border border-navy/30 font-body text-xs text-navy hover:bg-navy/5 transition-colors duration-short"
              >
                {g.nome}
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Histórico */}
      <section>
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-2">
          Campanhas que recebeu
        </p>
        {historico.length === 0 ? (
          <span className="font-body text-sm text-dark/40">Ainda não entrou em nenhum envio.</span>
        ) : (
          <ul className="divide-y divide-dark/5" data-testid="ficha-historico-email">
            {historico.map((h) => (
              <li key={h.campanhaId} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href={`/admin/campanhas/${h.campanhaId}/resultados`}
                  className="font-body text-sm text-dark hover:text-gold transition-colors duration-short"
                >
                  {h.campanhaNome}
                </Link>
                <span className="font-body text-xs text-dark/40">
                  {formatDateTimeShort(h.enviadoEm, { comAno: true })}
                </span>
                <span className="font-body text-xs text-dark/60 ml-auto">
                  {[
                    h.recebeu ? "recebeu" : "não consta entrega",
                    h.abriu ? "abriu" : null,
                    h.clicou ? "clicou" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
