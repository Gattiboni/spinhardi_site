"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { createManualContact } from "@/app/admin/contatos/novo/actions";
import {
  type DestinoTipo,
  type PrazoIdeal,
  type PerfilViajante,
  type OrcamentoEstimado,
  DESTINOS_OPTIONS,
  PRAZOS_OPTIONS,
  PERFIS_OPTIONS,
  ORCAMENTOS_OPTIONS,
  DESTINO_LABELS,
  PRAZO_LABELS,
  PERFIL_LABELS,
  ORCAMENTO_LABELS,
} from "@/lib/contacts/types";

type AdminContactFormState = {
  name: string;
  whatsapp: string;
  email: string;
  destinoTipo: DestinoTipo;
  destinoTexto: string;
  prazoIdeal: PrazoIdeal;
  dataIda: string;
  passageirosAdultos: number;
  passageirosCriancas: number;
  passageirosBebes: number;
  perfilViajante: PerfilViajante;
  orcamentoEstimado: OrcamentoEstimado;
  observacao: string;
};

/**
 * Form de criação manual de contato (back office).
 *
 * Mesmos campos do form do site, mas com botão "Salvar contato".
 * Na Fase 1 (Lote B) o submit mostra alert — no Lote C cria contact com
 * `origem: "manual"` (sem chamar Iddas/ClickMassa) e volta pra lista.
 */
export default function AdminContactForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<AdminContactFormState>({
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
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setValues({
      ...values,
      [name]: type === "number" ? Number(value) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await createManualContact(values);
    if (result.success) {
      router.push("/admin/contatos");
    } else {
      setError(result.error ?? "Não foi possível salvar o contato. Tente novamente.");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-dark/20 rounded-md font-body text-base text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";
  const labelClass = "block font-body text-sm font-medium text-dark mb-2";
  const groupClass = "space-y-5";
  const groupHeaderClass = "text-gold uppercase tracking-widest text-xs font-body mb-6";

  return (
    <form onSubmit={handleSubmit} className="space-y-10 max-w-2xl">
      {/* Grupo 1 - Sobre o contato */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Sobre o contato</h3>

        <div>
          <label htmlFor="name" className={labelClass}>
            Nome *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="Nome do contato"
            value={values.name}
            onChange={handleChange}
            className={inputClass}
          />
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
            placeholder="+55 11 99876-5432"
            value={values.whatsapp}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            E-mail
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="email@exemplo.com"
            value={values.email}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      {/* Grupo 2 - Sobre a viagem */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Sobre a viagem</h3>

        <div>
          <label htmlFor="destinoTipo" className={labelClass}>
            Destino *
          </label>
          <select
            id="destinoTipo"
            name="destinoTipo"
            required
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
            Detalhes do destino
          </label>
          <textarea
            id="destinoTexto"
            name="destinoTexto"
            rows={2}
            placeholder="Cidades, regiões, referências"
            value={values.destinoTexto}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="prazoIdeal" className={labelClass}>
            Prazo *
          </label>
          <select
            id="prazoIdeal"
            name="prazoIdeal"
            required
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
            Data de ida (se houver)
          </label>
          <input
            type="date"
            id="dataIda"
            name="dataIda"
            value={values.dataIda}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Passageiros</label>
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
                value={values.passageirosBebes}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grupo 3 - Perfil */}
      <div className={groupClass}>
        <h3 className={groupHeaderClass}>Perfil da viagem</h3>

        <div>
          <label htmlFor="perfilViajante" className={labelClass}>
            Perfil *
          </label>
          <select
            id="perfilViajante"
            name="perfilViajante"
            required
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
            Orçamento estimado *
          </label>
          <select
            id="orcamentoEstimado"
            name="orcamentoEstimado"
            required
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
        <h3 className={groupHeaderClass}>Observações internas</h3>
        <textarea
          id="observacao"
          name="observacao"
          rows={4}
          placeholder="Contexto do cadastro manual, como o contato chegou, etc."
          value={values.observacao}
          onChange={handleChange}
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" size="lg" disabled={saving}>
          {saving ? "Salvando..." : "Salvar contato"}
        </Button>
        <button
          type="button"
          onClick={() => router.push("/admin/contatos")}
          className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
