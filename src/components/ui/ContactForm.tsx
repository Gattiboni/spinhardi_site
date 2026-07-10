"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import { submitContact, type ContactFormData } from "@/app/(public)/contato/actions";
import { whatsappValidationError } from "@/lib/contacts/phone";
import {
  DESTINOS_OPTIONS,
  PRAZOS_OPTIONS,
  PERFIS_OPTIONS,
  ORCAMENTOS_OPTIONS,
  DESTINO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
  ORCAMENTO_LABELS,
} from "@/lib/contacts/types";

// Estado do form + o honeypot `website` (isca anti-bot, não faz parte do
// ContactFormData). Humano nunca vê nem preenche; bot que preenche é barrado no
// servidor.
type FormState = ContactFormData & { website: string };

/**
 * Máscara de conveniência do WhatsApp: formata enquanto digita, ex.:
 * "(11) 98765-4321". É SÓ apresentação — a fonte da verdade é a normalização
 * canônica do servidor (phone.ts), que re-normaliza o que for enviado. Por isso
 * a máscara pode ser tolerante (aceita colar "+55 ..." e tira o 55).
 */
function formatWhatsappInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  // Colou com DDI? Tira o 55 (mesma regra da normalização canônica).
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }
  d = d.slice(0, 11); // teto: DDD (2) + celular (9)
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ContactForm() {
  const [values, setValues] = useState<FormState>({
    name: "",
    whatsapp: "",
    email: "",
    destinoTipo: "indefinido",
    destinoTexto: "",
    prazoIdeal: "flexivel",
    dataIda: "",
    passageirosAdultos: 1,
    passageirosCriancas: 0,
    passageirosBebes: 0,
    perfilViajante: "outro",
    orcamentoEstimado: "nao_informado",
    observacao: "",
    website: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // `error` = erro geral (banner no topo, ex.: falha de rede/persistência).
  // `fieldErrors` = erros de validação colados no campo (whatsapp, email, ...).
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const nextValue =
      name === "whatsapp"
        ? formatWhatsappInput(value)
        : type === "number"
          ? Number(value)
          : value;

    setValues((prev) => ({ ...prev, [name]: nextValue }));

    // Digitou no campo que estava com erro? Limpa o erro dele (feedback vivo).
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  // Feedback imediato: valida o WhatsApp no blur reusando a MESMA normalização/
  // mensagem do servidor (phone.ts é TS puro, sem server-only). Só cola erro se o
  // campo tiver conteúdo — não incomoda um campo ainda-não-tocado (o "required" é
  // do submit/servidor). Servidor continua a fonte da verdade.
  const handleWhatsappBlur = () => {
    const trimmed = values.whatsapp.trim();
    if (!trimmed) return;
    const err = whatsappValidationError(trimmed);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next.whatsapp = err;
      else delete next.whatsapp;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Cortesia de UX: barra o WhatsApp claramente inválido/incompleto antes de ir
    // à rede (nada é gravado). Mesma normalização/mensagem do servidor, que segue
    // revalidando quando o client deixa passar.
    const whatsappErr = whatsappValidationError(values.whatsapp.trim());
    if (whatsappErr) {
      setFieldErrors({ whatsapp: whatsappErr });
      document.getElementById("whatsapp")?.focus();
      return;
    }

    setLoading(true);

    try {
      const result = await submitContact(values);
      if (result.success) {
        setSubmitted(true);
      } else {
        const msg = result.error || "Algo deu errado. Tente novamente.";
        // Erro de validação de um campo específico → cola no campo e foca nele.
        // Erro geral (sem `field`) → banner no topo. Assim TODO erro do servidor
        // aparece no form, sem exceção.
        if (result.field) {
          setFieldErrors({ [result.field]: msg });
          document.getElementById(result.field)?.focus();
        } else {
          setError(msg);
        }
      }
    } catch {
      setError("Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
        <div className="font-display text-5xl text-gold mb-4">✓</div>
        <h3 className="font-display text-3xl text-navy mb-4 leading-tight">Pedido recebido.</h3>
        <p className="font-body text-base text-dark/80 leading-relaxed mb-8">
          Em breve a gente entra em contato pra conversar sobre sua viagem. Se preferir falar agora,
          é só chamar no WhatsApp.
        </p>
        <CTAWhatsApp variant="primary" size="md" label="Abrir WhatsApp →" />
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-short";
  const labelClass = "block font-body text-sm font-medium text-dark mb-2";
  const groupClass = "space-y-5";
  const groupHeaderClass = "text-gold uppercase tracking-widest text-xs font-body mb-6";
  const fieldErrorClass = "mt-2 font-body text-sm text-red-700";
  // Anel vermelho no campo em erro (não conflita com a cor da borda do inputClass).
  const errRing = (field: string) => (fieldErrors[field] ? " ring-2 ring-red-400" : "");

  return (
    // noValidate: a validação nativa do browser fica DESLIGADA de propósito — a
    // fonte da verdade é a validação/normalização server-side, e ela precisa
    // rodar SEMPRE. Sem isso, o balão nativo (ex.: type=email) interceptava o
    // submit e o erro do servidor (ex.: WhatsApp) nunca chegava a renderizar.
    <form onSubmit={handleSubmit} className="space-y-10" noValidate>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Honeypot anti-bot: invisível pra humano (jogado pra fora da tela, sem
          type=hidden pra enganar bots que ignoram campos escondidos). Se vier
          preenchido, o servidor descarta o envio em silêncio. tabIndex/-1 +
          autoComplete off pra teclado e gerenciador de senhas não tocarem. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}
      >
        <label htmlFor="website">Deixe este campo em branco</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={values.website}
          onChange={handleChange}
        />
      </div>

      {/* Grupo 1 - Sobre você */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Sobre você</h3>

        <div>
          <label htmlFor="name" className={labelClass}>
            Nome *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            disabled={loading}
            placeholder="Seu nome"
            autoComplete="name"
            value={values.name}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            className={`${inputClass}${errRing("name")}`}
          />
          {fieldErrors.name && (
            <p id="name-error" className={fieldErrorClass}>
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp *
          </label>
          <input
            type="tel"
            id="whatsapp"
            name="whatsapp"
            required
            disabled={loading}
            placeholder="(11) 98765-4321"
            inputMode="tel"
            autoComplete="tel"
            value={values.whatsapp}
            onChange={handleChange}
            onBlur={handleWhatsappBlur}
            aria-invalid={!!fieldErrors.whatsapp}
            aria-describedby={fieldErrors.whatsapp ? "whatsapp-error" : undefined}
            className={`${inputClass}${errRing("whatsapp")}`}
          />
          {fieldErrors.whatsapp && (
            <p id="whatsapp-error" className={fieldErrorClass}>
              {fieldErrors.whatsapp}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            E-mail
          </label>
          <input
            type="email"
            id="email"
            name="email"
            disabled={loading}
            placeholder="seu.email@exemplo.com"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={`${inputClass}${errRing("email")}`}
          />
          {fieldErrors.email && (
            <p id="email-error" className={fieldErrorClass}>
              {fieldErrors.email}
            </p>
          )}
        </div>
      </div>

      {/* Grupo 2 - Sobre a viagem */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Sobre a viagem</h3>

        <div>
          <label htmlFor="destinoTipo" className={labelClass}>
            Para onde você quer ir? *
          </label>
          <select
            id="destinoTipo"
            name="destinoTipo"
            required
            disabled={loading}
            value={values.destinoTipo}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            {DESTINOS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DESTINO_LABELS[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="destinoTexto" className={labelClass}>
            Pode contar mais sobre o destino?
          </label>
          <textarea
            id="destinoTexto"
            name="destinoTexto"
            rows={2}
            disabled={loading}
            placeholder="Cidades, regiões, ou referências que você tem em mente"
            value={values.destinoTexto}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.destinoTexto}
            aria-describedby={fieldErrors.destinoTexto ? "destinoTexto-error" : undefined}
            className={`${inputClass} resize-none${errRing("destinoTexto")}`}
          />
          {fieldErrors.destinoTexto && (
            <p id="destinoTexto-error" className={fieldErrorClass}>
              {fieldErrors.destinoTexto}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="prazoIdeal" className={labelClass}>
            Quando você quer viajar? *
          </label>
          <select
            id="prazoIdeal"
            name="prazoIdeal"
            required
            disabled={loading}
            value={values.prazoIdeal}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            {PRAZOS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRAZO_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dataIda" className={labelClass}>
            Se tiver data fixa, qual?
          </label>
          <input
            type="date"
            id="dataIda"
            name="dataIda"
            disabled={loading}
            value={values.dataIda}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.dataIda}
            aria-describedby={fieldErrors.dataIda ? "dataIda-error" : undefined}
            className={`${inputClass}${errRing("dataIda")}`}
          />
          {fieldErrors.dataIda && (
            <p id="dataIda-error" className={fieldErrorClass}>
              {fieldErrors.dataIda}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Quantas pessoas vão viajar?</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="passageirosAdultos"
                className="font-body text-xs text-dark/60 mb-1 block"
              >
                Adultos
              </label>
              <input
                type="number"
                id="passageirosAdultos"
                name="passageirosAdultos"
                min={1}
                disabled={loading}
                value={values.passageirosAdultos}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="passageirosCriancas"
                className="font-body text-xs text-dark/60 mb-1 block"
              >
                Crianças
              </label>
              <input
                type="number"
                id="passageirosCriancas"
                name="passageirosCriancas"
                min={0}
                disabled={loading}
                value={values.passageirosCriancas}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="passageirosBebes"
                className="font-body text-xs text-dark/60 mb-1 block"
              >
                Bebês
              </label>
              <input
                type="number"
                id="passageirosBebes"
                name="passageirosBebes"
                min={0}
                disabled={loading}
                value={values.passageirosBebes}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grupo 3 - Sobre o perfil */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Sobre o perfil da viagem</h3>

        <div>
          <label htmlFor="perfilViajante" className={labelClass}>
            Qual o perfil dessa viagem? *
          </label>
          <select
            id="perfilViajante"
            name="perfilViajante"
            required
            disabled={loading}
            value={values.perfilViajante}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            {PERFIS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PERFIL_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="orcamentoEstimado" className={labelClass}>
            Faixa de orçamento que tem em mente? *
          </label>
          <select
            id="orcamentoEstimado"
            name="orcamentoEstimado"
            required
            disabled={loading}
            value={values.orcamentoEstimado}
            onChange={handleChange}
            className={`${inputClass} bg-white`}
          >
            {ORCAMENTOS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {ORCAMENTO_LABELS[o]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grupo 4 - Observações */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Quer compartilhar algo mais?</h3>

        <div>
          <textarea
            id="observacao"
            name="observacao"
            rows={5}
            disabled={loading}
            placeholder="Conta um pouco mais sobre o que tem em mente. Quanto mais a gente souber, melhor a conversa fica."
            value={values.observacao}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.observacao}
            aria-describedby={fieldErrors.observacao ? "observacao-error" : undefined}
            className={`${inputClass} resize-none${errRing("observacao")}`}
          />
          {fieldErrors.observacao && (
            <p id="observacao-error" className={fieldErrorClass}>
              {fieldErrors.observacao}
            </p>
          )}
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" size="lg" disabled={loading}>
          {loading ? "Enviando..." : "Enviar pedido de cotação"}
        </Button>
        <p className="mt-4 font-body text-sm text-dark/60">
          Também pode chamar direto no WhatsApp.
        </p>
      </div>
    </form>
  );
}
