"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import type { CaptureOrigin, Tag } from "@/lib/configuracoes/types";
import {
  createCaptureOrigin,
  updateCaptureOrigin,
  deleteCaptureOrigin,
  createTag,
  updateTag,
  deleteTag,
} from "./actions";

const inputClass =
  "px-3 py-2 border border-dark/20 rounded-md font-body text-sm text-dark focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-short";

const DEFAULT_TAG_COLOR = "#B89D5A";

// ─────────────────────────────────────────────────────────────────
// Primitivos compartilhados
// ─────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 font-body text-sm text-dark/70"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-short ${
          checked ? "bg-gold" : "bg-dark/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-short ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-dark/10 rounded-md p-6">
      <h2 className="font-display text-xl text-navy mb-1">{title}</h2>
      <p className="font-body text-sm text-dark/50 mb-4">{description}</p>
      {children}
    </section>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "muted" | "gold" }) {
  const cls = tone === "gold" ? "bg-gold/10 text-gold" : "bg-dark/10 text-dark/50";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-body ${cls}`}>
      {children}
    </span>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return <span className="w-full font-body text-xs text-red-700">{message}</span>;
}

// ─────────────────────────────────────────────────────────────────
// Origens de captação
// ─────────────────────────────────────────────────────────────────

function OriginRow({ origin, onChanged }: { origin: CaptureOrigin; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(origin.name);
  const [descricao, setDescricao] = useState(origin.descricao ?? "");
  const [isActive, setIsActive] = useState(origin.is_active);
  const [campanhaAtiva, setCampanhaAtiva] = useState(origin.campanha_ativa);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName(origin.name);
    setDescricao(origin.descricao ?? "");
    setIsActive(origin.is_active);
    setCampanhaAtiva(origin.campanha_ativa);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateCaptureOrigin(origin.id, {
        name,
        descricao,
        is_active: isActive,
        campanha_ativa: campanhaAtiva,
      });
      if (res.success) {
        setEditing(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao salvar.");
      }
    });
  };

  const remove = () => {
    if (!confirm(`Excluir a origem "${origin.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCaptureOrigin(origin.id);
      if (res.success) onChanged();
      else setError(res.error ?? "Erro ao excluir.");
    });
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3 border-b border-dark/5 last:border-0">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className={inputClass}
        />
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <Toggle checked={isActive} onChange={setIsActive} label="Ativa" />
          <Toggle checked={campanhaAtiva} onChange={setCampanhaAtiva} label="Campanha ativa" />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="font-body text-sm text-green-700 hover:underline disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                reset();
              }}
              className="font-body text-sm text-dark/50 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
        <ErrorLine message={error} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 border-b border-dark/5 last:border-0 font-body text-sm">
      <span className="text-dark font-medium">{origin.name}</span>
      <span className="text-dark/30 text-xs">{origin.slug}</span>
      {!origin.is_active && <Badge tone="muted">Inativa</Badge>}
      {origin.campanha_ativa && <Badge tone="gold">Campanha</Badge>}
      {origin.descricao && <span className="w-full text-dark/50 text-xs">{origin.descricao}</span>}
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-gold hover:underline"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

function OriginAddForm({ onChanged }: { onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setDescricao("");
    setIsActive(true);
    setCampanhaAtiva(false);
    setError(null);
  };

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCaptureOrigin({
        name,
        descricao,
        is_active: isActive,
        campanha_ativa: campanhaAtiva,
      });
      if (res.success) {
        reset();
        setAdding(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao criar.");
      }
    });
  };

  if (!adding) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
        + Nova origem
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome"
        autoFocus
        className={inputClass}
      />
      <input
        type="text"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Toggle checked={isActive} onChange={setIsActive} label="Ativa" />
        <Toggle checked={campanhaAtiva} onChange={setCampanhaAtiva} label="Campanha ativa" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={create} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              reset();
            }}
            className="font-body text-sm text-dark/50 hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────

function TagRow({ tag, onChanged }: { tag: Tag; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [cor, setCor] = useState(tag.cor);
  const [grupo, setGrupo] = useState(tag.grupo ?? "");
  const [isActive, setIsActive] = useState(tag.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName(tag.name);
    setCor(tag.cor);
    setGrupo(tag.grupo ?? "");
    setIsActive(tag.is_active);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateTag(tag.id, { name, cor, grupo, is_active: isActive });
      if (res.success) {
        setEditing(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao salvar.");
      }
    });
  };

  const remove = () => {
    if (!confirm(`Excluir a tag "${tag.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTag(tag.id);
      if (res.success) onChanged();
      else setError(res.error ?? "Erro ao excluir.");
    });
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3 border-b border-dark/5 last:border-0">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-dark/20"
            aria-label="Cor"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className={`${inputClass} flex-1 min-w-32`}
          />
        </div>
        <input
          type="text"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          placeholder="Grupo (opcional)"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <Toggle checked={isActive} onChange={setIsActive} label="Ativa" />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="font-body text-sm text-green-700 hover:underline disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                reset();
              }}
              className="font-body text-sm text-dark/50 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
        <ErrorLine message={error} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 border-b border-dark/5 last:border-0 font-body text-sm">
      <span
        className="h-4 w-4 shrink-0 rounded-full border border-dark/10"
        style={{ backgroundColor: tag.cor }}
        aria-hidden="true"
      />
      <span className="text-dark font-medium">{tag.name}</span>
      <span className="text-dark/30 text-xs">{tag.slug}</span>
      {tag.grupo && <Badge tone="muted">{tag.grupo}</Badge>}
      {!tag.is_active && <Badge tone="muted">Inativa</Badge>}
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-gold hover:underline"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

function TagAddForm({ onChanged }: { onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [cor, setCor] = useState(DEFAULT_TAG_COLOR);
  const [grupo, setGrupo] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setCor(DEFAULT_TAG_COLOR);
    setGrupo("");
    setIsActive(true);
    setError(null);
  };

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await createTag({ name, cor, grupo, is_active: isActive });
      if (res.success) {
        reset();
        setAdding(false);
        onChanged();
      } else {
        setError(res.error ?? "Erro ao criar.");
      }
    });
  };

  if (!adding) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
        + Nova tag
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-dark/20"
          aria-label="Cor"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          autoFocus
          className={`${inputClass} flex-1 min-w-32`}
        />
      </div>
      <input
        type="text"
        value={grupo}
        onChange={(e) => setGrupo(e.target.value)}
        placeholder="Grupo (opcional)"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Toggle checked={isActive} onChange={setIsActive} label="Ativa" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={create} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              reset();
            }}
            className="font-body text-sm text-dark/50 hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────

export default function ConfiguracoesClient({
  origins,
  tags,
}: {
  origins: CaptureOrigin[];
  tags: Tag[];
}) {
  const router = useRouter();
  const onChanged = () => router.refresh();

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-8">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Origens de Captação"
          description="De onde os contatos chegam (site, WhatsApp, indicação...)."
        >
          {origins.length > 0 ? (
            <ul className="mb-5">
              {origins.map((origin) => (
                <OriginRow key={origin.id} origin={origin} onChanged={onChanged} />
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-dark/40 mb-5">Nenhuma origem cadastrada ainda.</p>
          )}
          <OriginAddForm onChanged={onChanged} />
        </Card>

        <Card title="Tags" description="Etiquetas livres pra classificar contatos.">
          {tags.length > 0 ? (
            <ul className="mb-5">
              {tags.map((tag) => (
                <TagRow key={tag.id} tag={tag} onChanged={onChanged} />
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-dark/40 mb-5">Nenhuma tag cadastrada ainda.</p>
          )}
          <TagAddForm onChanged={onChanged} />
        </Card>
      </div>
    </div>
  );
}
