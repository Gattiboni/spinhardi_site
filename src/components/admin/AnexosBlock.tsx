"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAnexoAction,
  removeAnexoAction,
  getAnexoUrlAction,
} from "@/lib/anexos/actions";
import {
  type Anexo,
  type AnexoOwner,
  ANEXO_ICON,
  ANEXO_ACCEPT,
  anexoKind,
  formatTamanho,
} from "@/lib/anexos/types";

/**
 * AnexosBlock — bloco de anexos reutilizável (detalhe da jornada e ficha do
 * contato). Recebe o `owner` (jornada xor contato) e a lista já carregada no
 * server. Upload e remoção passam por Server Actions (service role); a abertura
 * gera uma URL ASSINADA efêmera — o bucket é privado, nunca há URL pública.
 */
export default function AnexosBlock({
  owner,
  anexos,
}: {
  owner: AnexoOwner;
  anexos: Anexo[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const result = await uploadAnexoAction(owner, fd);
      if (inputRef.current) inputRef.current.value = "";
      if (result.success) {
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível subir o arquivo.");
      }
    });
  };

  const handleAbrir = async (id: string) => {
    setErro(null);
    setBusyId(id);
    // Abre a aba ANTES do await: navegadores bloqueiam window.open pós-promise.
    const win = window.open("", "_blank", "noopener,noreferrer");
    const result = await getAnexoUrlAction(id);
    setBusyId(null);
    if (result.success && result.url) {
      if (win) win.location.href = result.url;
      else window.location.assign(result.url);
    } else {
      if (win) win.close();
      setErro(result.error ?? "Não foi possível abrir o anexo.");
    }
  };

  const handleRemover = (id: string) => {
    if (!confirm("Remover este anexo? Não dá pra desfazer.")) return;
    setErro(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await removeAnexoAction(owner, id);
      setBusyId(null);
      if (result.success) {
        router.refresh();
      } else {
        setErro(result.error ?? "Não foi possível remover o anexo.");
      }
    });
  };

  return (
    <div className="bg-white border border-dark/10 rounded-md p-6 mt-6">
      <div className="flex items-center justify-between gap-4 mb-2 pb-3 border-b border-dark/10">
        <h2 className="font-display text-xl text-navy">Anexos</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-2 font-body text-sm font-medium px-4 py-2 rounded-md border-2 border-gold text-gold hover:bg-gold hover:text-dark disabled:opacity-50 transition-colors duration-medium"
        >
          {pending ? "Enviando..." : "+ Anexar arquivo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ANEXO_ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {erro && <p className="font-body text-sm text-red-600 mt-3">{erro}</p>}

      <p className="font-body text-xs text-dark/40 mt-3">
        PDF, Word, Excel ou imagem (JPG/PNG).
      </p>

      {anexos.length === 0 ? (
        <p className="font-body text-sm text-dark/50 mt-4">Nenhum anexo ainda.</p>
      ) : (
        <ul className="divide-y divide-dark/5 mt-4">
          {anexos.map((a) => {
            const busy = busyId === a.id;
            return (
              <li key={a.id} className="py-3 flex items-center gap-3">
                <span className="text-xl shrink-0" aria-hidden="true">
                  {ANEXO_ICON[anexoKind(a.nomeArquivo)]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-dark truncate">{a.nomeArquivo}</p>
                  {a.tamanhoBytes != null && (
                    <p className="font-body text-xs text-dark/50 mt-0.5">
                      {formatTamanho(a.tamanhoBytes)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAbrir(a.id)}
                  disabled={busy}
                  className="font-body text-xs px-2 py-1 rounded border border-dark/15 text-dark/70 hover:border-gold hover:text-gold disabled:opacity-40 transition-colors duration-short"
                >
                  {busy ? "..." : "Abrir"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemover(a.id)}
                  disabled={busy}
                  className="font-body text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors duration-short"
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
