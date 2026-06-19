"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import {
  registrarNegocio,
  registrarLancamento,
} from "@/app/admin/(painel)/contatos/[id]/actions";
import type { LancamentoTipo } from "@/lib/financeiro/types";

/**
 * Entrada manual de financeiro no detalhe do contato (E4).
 *
 * Duas abas sobre o mesmo card: "Negócio" grava na silver `negocios` (grão
 * venda), "Receita/Despesa" grava em `lancamentos`. Os rótulos aqui são livres,
 * mas os valores caem exatamente nas colunas que o gold gerencial soma.
 */

type Aba = "negocio" | "lancamento";

const cardTitleClass = "font-display text-xl text-navy mb-2 pb-3 border-b border-dark/10";
const inputClass =
  "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";
const labelClass = "text-gold uppercase tracking-widest text-xs font-body mb-2 block";

/** "" → null; senão Number. Mantém null pros campos numéricos opcionais. */
function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function FinanceiroForm({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("negocio");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  // Negócio
  const [venda, setVenda] = useState("");
  const [custo, setCusto] = useState("");
  const [dataNegocio, setDataNegocio] = useState("");
  const [situacao, setSituacao] = useState("");
  const [observacao, setObservacao] = useState("");

  // Lançamento
  const [tipo, setTipo] = useState<LancamentoTipo>("receita");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [dataLanc, setDataLanc] = useState("");
  const [descricao, setDescricao] = useState("");

  const resetNegocio = () => {
    setVenda("");
    setCusto("");
    setDataNegocio("");
    setSituacao("");
    setObservacao("");
  };

  const resetLancamento = () => {
    setCategoria("");
    setValor("");
    setDataLanc("");
    setDescricao("");
  };

  const handleNegocio = async () => {
    setSaving(true);
    setFeedback(null);

    const vendaN = numOrNull(venda);
    const custoN = numOrNull(custo);
    // Lucro e percentual derivados quando dá — gravam nas colunas que o gold soma.
    const lucro = vendaN !== null && custoN !== null ? vendaN - custoN : null;
    const percentualLucro =
      lucro !== null && vendaN !== null && vendaN !== 0
        ? Number(((lucro / vendaN) * 100).toFixed(2))
        : null;

    const result = await registrarNegocio(contactId, {
      venda: vendaN,
      custo: custoN,
      lucro,
      percentualLucro,
      data: strOrNull(dataNegocio),
      situacao: strOrNull(situacao),
      observacao: strOrNull(observacao),
    });

    setSaving(false);
    if (result.success) {
      setFeedback({ type: "ok", text: "Negócio registrado." });
      resetNegocio();
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível registrar." });
    }
  };

  const handleLancamento = async () => {
    const valorN = numOrNull(valor);
    if (valorN === null) {
      setFeedback({ type: "erro", text: "Informe o valor do lançamento." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const result = await registrarLancamento(contactId, {
      tipo,
      categoria: strOrNull(categoria),
      valor: valorN,
      data: strOrNull(dataLanc),
      descricao: strOrNull(descricao),
    });

    setSaving(false);
    if (result.success) {
      setFeedback({ type: "ok", text: "Lançamento registrado." });
      resetLancamento();
      router.refresh();
    } else {
      setFeedback({ type: "erro", text: result.error ?? "Não foi possível registrar." });
    }
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-md font-body text-sm transition-colors duration-short ${
      active ? "bg-gold text-dark" : "bg-dark/5 text-dark/60 hover:text-dark"
    }`;

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <h2 className={cardTitleClass}>Financeiro</h2>

      <div className="flex items-center gap-2 mt-5 mb-6">
        <button
          type="button"
          onClick={() => {
            setAba("negocio");
            setFeedback(null);
          }}
          className={tabClass(aba === "negocio")}
        >
          Negócio (venda)
        </button>
        <button
          type="button"
          onClick={() => {
            setAba("lancamento");
            setFeedback(null);
          }}
          className={tabClass(aba === "lancamento")}
        >
          Receita / Despesa
        </button>
      </div>

      {aba === "negocio" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="venda" className={labelClass}>
              Venda (R$)
            </label>
            <input
              id="venda"
              type="number"
              step="0.01"
              min="0"
              value={venda}
              onChange={(e) => setVenda(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label htmlFor="custo" className={labelClass}>
              Custo (R$)
            </label>
            <input
              id="custo"
              type="number"
              step="0.01"
              min="0"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label htmlFor="dataNegocio" className={labelClass}>
              Data
            </label>
            <input
              id="dataNegocio"
              type="date"
              value={dataNegocio}
              onChange={(e) => setDataNegocio(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label htmlFor="situacao" className={labelClass}>
              Situação
            </label>
            <input
              id="situacao"
              type="text"
              placeholder="ex: confirmada, em aberto"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="observacao" className={labelClass}>
              Observação
            </label>
            <textarea
              id="observacao"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className={`${inputClass} w-full resize-none`}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-4">
            <Button variant="primary" size="md" onClick={handleNegocio} disabled={saving}>
              {saving ? "Salvando..." : "Registrar negócio"}
            </Button>
            {feedback && (
              <span
                className={`font-body text-sm ${feedback.type === "ok" ? "text-green-700" : "text-red-600"}`}
              >
                {feedback.text}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="tipo" className={labelClass}>
              Tipo
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as LancamentoTipo)}
              className={`${inputClass} w-full`}
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>
          <div>
            <label htmlFor="valor" className={labelClass}>
              Valor (R$) *
            </label>
            <input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label htmlFor="categoria" className={labelClass}>
              Categoria
            </label>
            <input
              id="categoria"
              type="text"
              placeholder="ex: comissão, taxa, reembolso"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label htmlFor="dataLanc" className={labelClass}>
              Data
            </label>
            <input
              id="dataLanc"
              type="date"
              value={dataLanc}
              onChange={(e) => setDataLanc(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="descricao" className={labelClass}>
              Descrição
            </label>
            <textarea
              id="descricao"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={`${inputClass} w-full resize-none`}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-4">
            <Button variant="primary" size="md" onClick={handleLancamento} disabled={saving}>
              {saving ? "Salvando..." : "Registrar lançamento"}
            </Button>
            {feedback && (
              <span
                className={`font-body text-sm ${feedback.type === "ok" ? "text-green-700" : "text-red-600"}`}
              >
                {feedback.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
