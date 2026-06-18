"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import DashboardCard from "@/components/admin/DashboardCard";

type ContactStats = {
  novosHoje: number;
  followUpHoje: number;
  pendentesSync: number;
  capturasMes: number;
  emNegociacao: number;
  fechadosMes: number;
};

type IddasStats = {
  orcamentosMes: number;
  vendasMes: number;
  ticketMedio: number;
};

type ClickmassaStats = {
  ticketsAbertos: number;
  oportunidadesAtivas: number;
};

type DashboardClientProps = {
  contactStats: ContactStats;
  iddasStats: IddasStats;
  clickmassaStats: ClickmassaStats;
  postsCount: number;
  userName: string;
};

function saudacaoPorHora(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function dataFormatada(date: Date): string {
  const texto = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default function DashboardClient({
  contactStats,
  iddasStats,
  clickmassaStats,
  postsCount,
  userName,
}: DashboardClientProps) {
  // Saudação e data dependem da hora local — calculadas após o mount pra evitar
  // mismatch de hidratação. O nome vem por prop (sessão real, lado servidor).
  const [saudacao, setSaudacao] = useState("Olá");
  const [hoje, setHoje] = useState("");
  const nome = userName.split(" ")[0];

  useEffect(() => {
    // Deferido num microtask pra não chamar setState de forma síncrona no corpo
    // do efeito (regra set-state-in-effect / evita cascading renders).
    const agora = new Date();
    const saud = saudacaoPorHora(agora.getHours());
    const data = dataFormatada(agora);
    Promise.resolve().then(() => {
      setSaudacao(saud);
      setHoje(data);
    });
  }, []);

  return (
    <div>
      {/* Cabeçalho com saudação dinâmica */}
      <header className="mb-10">
        <h1 className="font-display text-3xl text-navy capitalize">
          {saudacao}
          {nome ? `, ${nome}` : ""}
        </h1>
        {hoje && <p className="font-body text-dark/60 mt-1">{hoje}</p>}
      </header>

      {/* HOJE */}
      <section className="mb-10">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-4">Hoje</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard
            title="Novos contatos"
            value={contactStats.novosHoje}
            href="/admin/contatos"
          />
          <DashboardCard
            title="A fazer follow-up"
            value={contactStats.followUpHoje}
            href="/admin/contatos"
          />
          <DashboardCard
            title="Pendentes de sync"
            value={contactStats.pendentesSync}
            tone="warning"
            href="/admin/contatos"
            hint={
              contactStats.pendentesSync === 0
                ? "Tudo sincronizado"
                : "Contatos com sync pendente ou com falha"
            }
          />
        </div>
      </section>

      {/* ESTE MÊS */}
      <section className="mb-10">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-4">Este mês</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard
            title="Capturas totais"
            value={contactStats.capturasMes}
            href="/admin/contatos"
          />
          <DashboardCard
            title="Em negociação"
            value={contactStats.emNegociacao}
            href="/admin/contatos"
          />
          <DashboardCard title="Fechados" value={contactStats.fechadosMes} href="/admin/contatos" />
        </div>
      </section>

      {/* PANORAMA — indicadores espelhados dos sistemas operacionais + blog */}
      <section className="mb-10">
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-4">Panorama</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardCard
            title="Orçamentos no Iddas (mês)"
            value={iddasStats.orcamentosMes}
            hint={`Ticket médio ${moedaBRL.format(iddasStats.ticketMedio)}`}
          />
          <DashboardCard title="Vendas no Iddas (mês)" value={iddasStats.vendasMes} />
          <DashboardCard
            title="Tickets abertos (ClickMassa)"
            value={clickmassaStats.ticketsAbertos}
            hint={`${clickmassaStats.oportunidadesAtivas} oportunidades ativas`}
          />
          <DashboardCard title="Posts publicados" value={postsCount} href="/admin/blog" />
        </div>
      </section>

      {/* ATALHOS */}
      <section>
        <p className="text-gold uppercase tracking-widest text-xs font-body mb-4">Atalhos</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/contatos">
            <Button variant="primary" size="md">
              📥 Ver contatos
            </Button>
          </Link>
          <Link href="/admin/blog/novo">
            <Button variant="secondary" size="md">
              📝 Novo post
            </Button>
          </Link>
          <Link href="/admin/configuracoes">
            <Button variant="secondary" size="md">
              ⚙ Configurações
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
