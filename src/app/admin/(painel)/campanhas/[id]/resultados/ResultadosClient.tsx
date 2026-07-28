"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/primitives/Modal";
import { formatDateTimeShort } from "@/lib/utils/date";
import { taxa } from "@/lib/campanhas/metricas-shared";
import {
  ESTADO_BADGE,
  TIPO_LABELS,
  type Campanha,
  type CampanhaMetricas,
} from "@/lib/campanhas/types";

/**
 * Resultados de uma campanha enviada.
 *
 * Toda métrica é DERIVADA (V6) e todo percentual vem com DENOMINADOR explícito
 * e com a contagem crua ao lado. "62% de abertura" sem dizer 62% de quê é o
 * jeito mais fácil de tomar decisão errada — e o denominador de abertura é
 * ENTREGUES, não enviados.
 */
export default function ResultadosClient({
  campanha,
  metricas,
  totalDestinatarios,
  html,
}: {
  campanha: Campanha;
  metricas: CampanhaMetricas;
  totalDestinatarios: number;
  html: string;
}) {
  const [verEmail, setVerEmail] = useState(false);
  const badge = ESTADO_BADGE[campanha.estado];

  const kpis = [
    {
      titulo: "Entregues",
      valor: metricas.entregues,
      de: metricas.destinatarios,
      deTexto: "dos enviados",
    },
    {
      titulo: "Abriram",
      valor: metricas.abertos,
      de: metricas.entregues,
      deTexto: "dos entregues",
    },
    {
      titulo: "Clicaram",
      valor: metricas.cliques,
      de: metricas.entregues,
      deTexto: "dos entregues",
    },
  ];

  const problemas = [
    {
      quantos: metricas.bouncesHard,
      frase:
        "com e-mail que não existe mais. O sistema já parou de mandar pra essas pessoas — conserte o endereço na ficha pra voltar a enviar.",
    },
    {
      quantos: metricas.reclamacoes,
      frase:
        "marcaram como spam. O sistema já tirou essas pessoas da lista, e isso não se desfaz por aqui.",
    },
    {
      quantos: metricas.descadastros,
      frase: "pediram pra sair. O sistema já tirou da lista.",
    },
    {
      quantos: metricas.bouncesSoft,
      frase:
        "tiveram um problema temporário (caixa cheia, servidor fora). Ninguém foi tirado da lista por isso.",
    },
    {
      quantos: metricas.falhas,
      frase: "não saíram por falha no provedor.",
    },
  ].filter((p) => p.quantos > 0);

  return (
    <div>
      <Link
        href="/admin/campanhas"
        className="inline-block font-body text-sm text-text-muted hover:text-gold transition-colors duration-short mb-6"
      >
        ← Todas as campanhas
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="font-display text-3xl text-navy">{campanha.nomeInterno}</h1>
        <span
          className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-body text-xs ${badge.classe}`}
        >
          <span aria-hidden="true">{badge.icone}</span>
          {badge.label}
        </span>
      </div>
      <p className="font-body text-sm text-text-muted mb-8">
        {TIPO_LABELS[campanha.tipo]}
        {campanha.enviadoEm
          ? ` · saiu em ${formatDateTimeShort(campanha.enviadoEm, { comAno: true })}`
          : ""}
        {` · assunto: ${campanha.assunto ?? "—"}`}
      </p>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-testid="kpis">
        {kpis.map((k) => {
          const pct = taxa(k.valor, k.de);
          return (
            <div key={k.titulo} className="bg-white border border-border-soft rounded-modal p-6">
              <p className="font-body text-sm text-text-muted mb-2">{k.titulo}</p>
              <p className="font-display text-4xl text-navy tabular-nums">
                {pct === null ? "—" : `${pct.toFixed(0)}%`}
              </p>
              <p className="font-body text-sm text-text-muted mt-2 tabular-nums">
                {k.valor} de {k.de} {k.deTexto}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-border-soft rounded-modal p-6 mb-8">
        <p className="font-body text-sm text-text-muted">
          <strong className="text-navy tabular-nums">{totalDestinatarios}</strong>{" "}
          {totalDestinatarios === 1 ? "pessoa entrou" : "pessoas entraram"} nesta campanha. A lista
          foi congelada no momento do envio: mudar o contato depois não muda o que foi enviado.
        </p>
      </div>

      {/* ── Pra ficar de olho ───────────────────────────────────── */}
      <section className="bg-white border border-border-soft rounded-modal p-6 mb-8">
        <h2 className="font-display text-xl text-navy mb-3">Pra ficar de olho</h2>
        {problemas.length === 0 ? (
          <p className="font-body text-sm text-text-muted">
            Nenhum retorno, reclamação ou descadastro nesta campanha.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="problemas">
            {problemas.map((p) => (
              <li key={p.frase} className="font-body text-sm text-dark">
                <strong className="tabular-nums">{p.quantos}</strong>{" "}
                <span className="text-text-muted">{p.frase}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => setVerEmail(true)}
        data-testid="ver-email-enviado"
        className="h-9.5 px-4 rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short"
      >
        Ver o e-mail como foi enviado
      </button>

      <Modal
        open={verEmail}
        onClose={() => setVerEmail(false)}
        variant="conteudo"
        titulo="O e-mail como foi enviado"
        data-testid="modal-email-enviado"
      >
        <iframe
          title="E-mail enviado"
          srcDoc={html}
          className="w-full h-150 bg-white rounded-md border border-border-soft"
        />
      </Modal>
    </div>
  );
}
