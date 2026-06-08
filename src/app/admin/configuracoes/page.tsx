"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { ORIGEM_LABELS, type CaptureOrigin } from "@/lib/contacts/types";

const LOTE_C_ALERT = "Implementação completa virá no Lote C";

function notImplemented(acao: string) {
  alert(`${acao}.\n\n${LOTE_C_ALERT}.`);
}

const ORIGENS_CONFIG: { slug: CaptureOrigin; descricao: string }[] = [
  { slug: "site_contato", descricao: "Site - Formulário de Contato" },
  { slug: "google_ads", descricao: "Campanhas Google Ads" },
  { slug: "instagram", descricao: "Bio/posts Instagram" },
  { slug: "indicacao", descricao: "Indicação de cliente" },
  { slug: "manual", descricao: "Cadastro manual" },
];

const TAGS_SISTEMA = [
  "italia_2026",
  "lua_de_mel",
  "familia",
  "patagonia",
  "vip",
  "cruzeiro",
  "indicacao_patricia",
  "alta_temporada",
];

const MSG_PADRAO =
  "Oi {nome}! Recebemos sua solicitação para {destino}. Em breve falo com você por aqui. 😊";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-dark/10 rounded-md p-6">
      <h2 className="font-display text-xl text-navy mb-4 pb-3 border-b border-dark/10">{title}</h2>
      {children}
    </section>
  );
}

function StatusLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-body text-sm">
      <span className="text-dark/60">{label}</span>
      <span className="text-dark text-right">{value}</span>
    </div>
  );
}

export default function AdminConfiguracoes() {
  const [msgPadrao, setMsgPadrao] = useState(MSG_PADRAO);

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Integração Iddas */}
        <Card title="Integração Iddas">
          <div className="space-y-2 mb-5">
            <StatusLinha label="Status" value="✓ Conectado" />
            <StatusLinha label="URL" value="https://apiagencia.iddas.com.br" />
            <StatusLinha
              label="Link de Solicitação público"
              value="agencia.iddas.com.br/.../link/X"
            />
            <StatusLinha label="Última sync" value="08/06/2026 09h24" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notImplemented("Testar conexão com o Iddas")}
          >
            Testar conexão
          </Button>
        </Card>

        {/* Integração ClickMassa */}
        <Card title="Integração ClickMassa">
          <div className="space-y-2 mb-5">
            <StatusLinha label="Status" value="✓ Conectado" />
            <StatusLinha label="Modelo" value="WABA (Meta oficial)" />
            <StatusLinha label="Sessão WhatsApp" value="✓ Online" />
            <StatusLinha label="apiId" value="xxx" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notImplemented("Testar conexão com o ClickMassa")}
          >
            Testar conexão
          </Button>
        </Card>

        {/* Origens de captura */}
        <Card title="Origens de captura">
          <ul className="space-y-2 mb-5">
            {ORIGENS_CONFIG.map((o) => (
              <li key={o.slug} className="flex items-center gap-3 font-body text-sm">
                <span className="text-green-600">✓</span>
                <span className="text-dark font-medium w-28 shrink-0">{o.slug}</span>
                <span className="text-dark/60">
                  {o.descricao} <span className="text-dark/30">({ORIGEM_LABELS[o.slug]})</span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notImplemented("Adicionar nova origem de captura")}
          >
            + Adicionar origem
          </Button>
        </Card>

        {/* Mensagem padrão WhatsApp */}
        <Card title="Mensagem padrão WhatsApp">
          <p className="font-body text-sm text-dark/60 mb-3">
            Enviada automaticamente após captura:
          </p>
          <textarea
            rows={3}
            value={msgPadrao}
            onChange={(e) => setMsgPadrao(e.target.value)}
            className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-sm text-dark focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short resize-none mb-2"
          />
          <p className="font-body text-xs text-dark/50 mb-4">
            Variáveis disponíveis: {"{nome}"}, {"{destino}"}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => notImplemented("Salvar mensagem padrão")}
          >
            Salvar
          </Button>
        </Card>

        {/* Tags do sistema */}
        <Card title="Tags do sistema">
          <div className="flex flex-wrap gap-2 mb-5">
            {TAGS_SISTEMA.map((t) => (
              <span
                key={t}
                className="inline-block px-3 py-1 rounded-full text-xs font-body bg-gold/10 text-gold"
              >
                {t}
              </span>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => notImplemented("Criar nova tag")}>
            + Nova tag
          </Button>
        </Card>
      </div>
    </div>
  );
}
