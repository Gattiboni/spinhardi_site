"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import CTAWhatsApp from "@/components/ui/CTAWhatsApp";
import { submitContact, type ContactFormData } from "@/app/(public)/contato/actions";

const DESTINOS = [
  { value: "italia", label: "Itália" },
  { value: "europa", label: "Europa em geral" },
  { value: "cruzeiro", label: "Cruzeiro" },
  { value: "america-do-sul", label: "América do Sul" },
  { value: "outro", label: "Outro destino" },
  { value: "ajuda", label: "Ainda não sei, quero ajuda" },
];

export default function ContactForm() {
  const [values, setValues] = useState<ContactFormData>({
    nome: "",
    whatsapp: "",
    destino: "",
    mensagem: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await submitContact(values);
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error || "Algo deu errado. Tente novamente.");
      }
    } catch {
      setError("Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Estado de sucesso — substitui o form
  if (submitted) {
    return (
      <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
        <div className="font-display text-5xl text-gold mb-4">✓</div>
        <h3 className="font-display text-3xl text-navy mb-4 leading-tight">Mensagem recebida.</h3>
        <p className="font-body text-base text-dark/80 leading-relaxed mb-8">
          Em breve a gente entra em contato. Se preferir falar agora, é só chamar no WhatsApp.
        </p>
        <CTAWhatsApp variant="primary" size="md" label="Abrir WhatsApp →" />
      </div>
    );
  }

  // Form padrão
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mensagem de erro (se houver) */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Nome */}
      <div>
        <label htmlFor="nome" className="block font-body text-sm font-medium text-dark mb-2">
          Nome
        </label>
        <input
          type="text"
          id="nome"
          name="nome"
          required
          disabled={loading}
          placeholder="Seu nome"
          value={values.nome}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-short"
        />
      </div>

      {/* WhatsApp */}
      <div>
        <label htmlFor="whatsapp" className="block font-body text-sm font-medium text-dark mb-2">
          WhatsApp
        </label>
        <input
          type="tel"
          id="whatsapp"
          name="whatsapp"
          required
          disabled={loading}
          placeholder="+55 19 99776-1226"
          value={values.whatsapp}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-short"
        />
      </div>

      {/* Destino (select) */}
      <div>
        <label htmlFor="destino" className="block font-body text-sm font-medium text-dark mb-2">
          Destino de interesse
        </label>
        <select
          id="destino"
          name="destino"
          required
          disabled={loading}
          value={values.destino}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-short"
        >
          <option value="" disabled>
            Selecione um destino
          </option>
          {DESTINOS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mensagem (textarea) */}
      <div>
        <label htmlFor="mensagem" className="block font-body text-sm font-medium text-dark mb-2">
          O que você tem em mente?
        </label>
        <textarea
          id="mensagem"
          name="mensagem"
          rows={6}
          required
          disabled={loading}
          placeholder="Me conte um pouco sobre a viagem que você está pensando. Período, quem vai, se tem alguma preferência. Sem compromisso, é só para a gente entender melhor."
          value={values.mensagem}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-short resize-none"
        />
      </div>

      {/* Submit */}
      <div>
        <Button type="submit" variant="primary" size="lg" disabled={loading}>
          {loading ? "Enviando..." : "Enviar mensagem"}
        </Button>
        <p className="mt-4 font-body text-sm text-dark/60">
          Também pode chamar direto no WhatsApp.
        </p>
      </div>
    </form>
  );
}
