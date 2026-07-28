"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/primitives/Modal";
import { useToast } from "@/components/ui/primitives/Toast";
import {
  ESTADO_BADGE,
  TIPO_LABELS,
  TIPOS_OPTIONS,
  type Campanha,
  type CampanhaConteudo,
  type CampanhaTipo,
  type Exclusoes,
  type PublicoTipo,
} from "@/lib/campanhas/types";
import {
  conteudoDe,
  montarEmailHtml,
  preflight,
  preflightPassou,
  type PreflightItem,
} from "@/lib/campanhas/conteudo";
import type { GrupoComContagens } from "@/lib/grupos/types";
import {
  contarPublicoAction,
  dispararAction,
  enviarTesteAction,
  salvarConteudoAction,
  salvarPublicoAction,
  uploadImagemAction,
} from "../actions";

/**
 * Editor de campanha em três passos, numa rota só.
 *
 * O que é DELIBERADAMENTE do servidor e não daqui:
 *  • o `conteudo_hash` — a tela nunca calcula nem manda hash, manda conteúdo;
 *  • o rebaixamento pra rascunho quando o conteúdo muda depois do teste (C4);
 *  • o gate final de envio (E7/E8) — o preflight desenhado aqui é o MESMO
 *    módulo puro que roda lá, mas quem decide é o servidor;
 *  • a recontagem do público no instante do envio (E3).
 *
 * O preview usa a MESMA função de montagem do e-mail real (`montarEmailHtml`),
 * então o que aparece aqui é o que sai — incluindo o rodapé travado.
 */

const PASSOS = [
  { n: 1, titulo: "Conteúdo" },
  { n: 2, titulo: "Destinatários" },
  { n: 3, titulo: "Revisão" },
] as const;

const campo =
  "w-full px-3 py-2 min-h-10 border border-border-strong rounded-md font-body text-sm text-dark bg-white focus-ring";
const rotulo = "text-gold uppercase tracking-widest text-xs font-body block mb-1";
const botao =
  "h-9.5 px-4 rounded-md border border-border-strong bg-white font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short";
const botaoPrimario =
  "h-9.5 px-5 rounded-md bg-navy text-white font-body text-sm font-semibold hover:bg-primary-hover focus-ring transition-colors duration-short disabled:bg-surface-selected disabled:text-text-disabled disabled:cursor-not-allowed";

export default function EditorClient({
  campanha,
  imagemUrl,
  grupos,
  destinosTeste,
  enderecoRodape,
}: {
  campanha: Campanha;
  imagemUrl: string | null;
  grupos: GrupoComContagens[];
  destinosTeste: string[];
  enderecoRodape: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [salvando, setSalvando] = useState(false);

  // ── Passo 1 ─────────────────────────────────────────────────────
  const [nomeInterno, setNomeInterno] = useState(campanha.nomeInterno);
  const [tipo, setTipo] = useState<CampanhaTipo>(campanha.tipo);
  const [conteudo, setConteudo] = useState<CampanhaConteudo>(conteudoDe(campanha));
  const [urlImagem, setUrlImagem] = useState<string | null>(imagemUrl);
  const [subindoImagem, setSubindoImagem] = useState(false);
  const [preview, setPreview] = useState<"desktop" | "celular">("desktop");

  // ── Passo 2 ─────────────────────────────────────────────────────
  const [publicoTipo, setPublicoTipo] = useState<PublicoTipo>(campanha.publicoTipo);
  const [grupoId, setGrupoId] = useState<string | null>(campanha.grupoId);
  const [contagem, setContagem] = useState<{
    total: number;
    exclusoes: Exclusoes;
    totalGrupo: number | null;
  } | null>(null);

  // ── Passo 3 ─────────────────────────────────────────────────────
  const [destinos, setDestinos] = useState<string[]>(destinosTeste.slice(0, 1));
  const [testando, setTestando] = useState(false);
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [dataAgenda, setDataAgenda] = useState("");
  const [horaAgenda, setHoraAgenda] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [contagemFinal, setContagemFinal] = useState<number | null>(null);
  const [verEmail, setVerEmail] = useState(false);

  const setCampo = <K extends keyof CampanhaConteudo>(k: K, v: CampanhaConteudo[K]) =>
    setConteudo((c) => ({ ...c, [k]: v }));

  const html = useMemo(
    () =>
      montarEmailHtml(conteudo, {
        imagemUrl: urlImagem,
        enderecoRodape: enderecoRodape ?? undefined,
      }),
    [conteudo, urlImagem, enderecoRodape],
  );

  const itensPreflight: PreflightItem[] = useMemo(
    () => preflight(conteudo, html),
    [conteudo, html],
  );
  const preflightVerde = preflightPassou(itensPreflight);

  // Espelho local do estado: salvar conteúdo pode REBAIXAR pra rascunho no
  // servidor (C4), e a tela precisa refletir isso sem recarregar tudo.
  const [estado, setEstado] = useState(campanha.estado);
  const testeValido = estado === "testada" || estado === "agendada";
  const podeEnviar = preflightVerde && testeValido;

  /**
   * Contagem ao vivo do público. Roda em EVENT HANDLER (troca de passo, troca
   * de público), nunca em efeito: a contagem é consequência de uma ação da
   * operadora, não sincronização com sistema externo.
   *
   * Isto aqui é informação. O número que VALE é recontado no servidor no
   * instante do envio (E3) e aparece de novo no modal de confirmação.
   */
  const recontar = useCallback(async (tipoPublico: PublicoTipo, idGrupo: string | null) => {
    const r = await contarPublicoAction(tipoPublico, idGrupo);
    setContagem(r);
  }, []);

  /** Troca de passo. Chegou em destinatários ou revisão? Reconta. */
  const irPara = (n: 1 | 2 | 3) => {
    setPasso(n);
    if (n !== 1) void recontar(publicoTipo, grupoId);
  };

  // ── Salvar ──────────────────────────────────────────────────────
  const salvarRascunho = async (avancarPara?: 1 | 2 | 3) => {
    setSalvando(true);
    const r = await salvarConteudoAction(campanha.id, conteudo, { nomeInterno, tipo });
    setSalvando(false);

    if (!r.success) {
      toast.erro(r.error ?? "Não foi possível salvar.");
      return false;
    }
    if (r.estado) setEstado(r.estado as typeof estado);

    // O servidor rebaixou? A operadora precisa saber POR QUE o botão de envio
    // travou — senão ela acha que é bug.
    if (estado !== "rascunho" && r.estado === "rascunho") {
      toast.info("O conteúdo mudou depois do teste. Faça um novo envio de teste.");
    } else {
      toast.sucesso("Rascunho salvo.");
    }

    router.refresh();
    if (avancarPara) irPara(avancarPara);
    return true;
  };

  const salvarPublico = async () => {
    if (publicoTipo === "grupo" && !grupoId) {
      toast.erro("Escolha o grupo que vai receber.");
      return false;
    }
    setSalvando(true);
    const r = await salvarPublicoAction(campanha.id, publicoTipo, grupoId);
    setSalvando(false);
    if (!r.success) {
      toast.erro(r.error ?? "Não foi possível salvar o público.");
      return false;
    }
    router.refresh();
    return true;
  };

  const subirImagem = async (file: File) => {
    setSubindoImagem(true);
    const fd = new FormData();
    fd.set("imagem", file);
    const r = await uploadImagemAction(campanha.id, fd);
    setSubindoImagem(false);

    if (!r.success) {
      toast.erro(r.error ?? "Não foi possível subir a imagem.");
      return;
    }
    setCampo("imagemPath", r.path ?? null);
    setUrlImagem(r.url ?? null);
    toast.sucesso("Imagem no ar. Não esqueça da descrição.");
  };

  const enviarTeste = async () => {
    if (destinos.length === 0) {
      toast.erro("Escolha pra quem mandar o teste.");
      return;
    }
    // Salva antes: testar conteúdo diferente do que está gravado é o jeito
    // clássico de sair com um e-mail que ninguém revisou.
    const salvou = await salvarRascunho();
    if (!salvou) return;

    setTestando(true);
    const r = await enviarTesteAction(campanha.id, destinos);
    setTestando(false);

    if (!r.success) {
      toast.erro(r.error ?? "Não foi possível enviar o teste.");
      return;
    }
    setEstado("testada");
    toast.sucesso("Teste enviado. Confira a caixa de entrada.");
    router.refresh();
  };

  const abrirConfirmacao = async () => {
    // Reconta AGORA (E3): o número da confirmação é o do instante do envio,
    // não o da hora em que a operadora escolheu o público.
    const r = await contarPublicoAction(publicoTipo, grupoId);
    setContagemFinal(r?.total ?? null);
    setConfirmando(true);
  };

  const disparar = async () => {
    const agendamento = quando === "agendar" ? { data: dataAgenda, hora: horaAgenda } : null;

    const r = await dispararAction(campanha.id, agendamento);
    if (!r.success) return r.error ?? "Não foi possível disparar.";

    if (r.modoSeguro) {
      toast.info(
        `Modo de segurança ligado: nada foi pro público real (${r.totalReal}). Foi só pros endereços de teste.`,
      );
    } else {
      toast.sucesso(
        agendamento ? "Campanha agendada." : `Campanha enviada pra ${r.enviados} pessoas.`,
      );
    }
    router.push("/admin/campanhas");
    return null;
  };

  const badge = ESTADO_BADGE[estado];
  const grupoAtual = grupos.find((g) => g.id === grupoId) ?? null;

  return (
    <div>
      <Link
        href="/admin/campanhas"
        className="inline-block font-body text-sm text-text-muted hover:text-gold transition-colors duration-short mb-6"
      >
        ← Todas as campanhas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-navy">{nomeInterno || "Sem nome"}</h1>
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-body text-xs ${badge.classe}`}
            data-testid="campanha-estado"
          >
            <span aria-hidden="true">{badge.icone}</span>
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => salvarRascunho()}
          disabled={salvando}
          data-testid="salvar-rascunho"
          className={botao}
        >
          {salvando ? "Salvando…" : "Salvar rascunho"}
        </button>
      </div>

      {/* ── Passos ─────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 mb-8" aria-label="Passos da campanha">
        {PASSOS.map((p) => (
          <button
            key={p.n}
            type="button"
            onClick={() => irPara(p.n)}
            aria-current={passo === p.n ? "step" : undefined}
            data-testid={`passo-${p.n}`}
            className={`h-9.5 px-4 rounded-md font-body text-sm focus-ring transition-colors duration-short ${
              passo === p.n
                ? "bg-navy text-white font-semibold"
                : "bg-white border border-border-strong text-navy hover:bg-surface-selected"
            }`}
          >
            {p.n}. {p.titulo}
          </button>
        ))}
      </nav>

      {/* ══ PASSO 1 · CONTEÚDO ═════════════════════════════════ */}
      {passo === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          <div className="space-y-4 bg-white border border-border-soft rounded-modal p-6">
            <div>
              <label className={rotulo} htmlFor="c-tipo">
                Tipo
              </label>
              <div className="flex flex-wrap gap-4" id="c-tipo" role="radiogroup" aria-label="Tipo">
                {TIPOS_OPTIONS.map((t) => (
                  <label key={t} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo"
                      value={t}
                      checked={tipo === t}
                      onChange={() => setTipo(t)}
                      className="accent-gold focus-ring"
                      data-testid={`tipo-${t}`}
                    />
                    <span className="font-body text-sm text-dark">{TIPO_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <Campo label="Nome interno (só você vê)" id="c-nome">
              <input
                id="c-nome"
                type="text"
                value={nomeInterno}
                onChange={(e) => setNomeInterno(e.target.value)}
                className={campo}
                data-testid="c-nome"
              />
            </Campo>

            <Campo label="Assunto do e-mail" id="c-assunto">
              <input
                id="c-assunto"
                type="text"
                value={conteudo.assunto ?? ""}
                onChange={(e) => setCampo("assunto", e.target.value)}
                className={campo}
                data-testid="c-assunto"
              />
            </Campo>

            <Campo label="Título" id="c-titulo">
              <input
                id="c-titulo"
                type="text"
                value={conteudo.titulo ?? ""}
                onChange={(e) => setCampo("titulo", e.target.value)}
                className={campo}
              />
            </Campo>

            <Campo label="Introdução" id="c-intro">
              <textarea
                id="c-intro"
                rows={2}
                value={conteudo.intro ?? ""}
                onChange={(e) => setCampo("intro", e.target.value)}
                className={campo}
              />
            </Campo>

            <Campo label="Corpo" id="c-corpo">
              <textarea
                id="c-corpo"
                rows={8}
                value={conteudo.corpo ?? ""}
                onChange={(e) => setCampo("corpo", e.target.value)}
                className={campo}
                data-testid="c-corpo"
              />
              <p className="font-body text-xs text-text-muted mt-1">
                Linha em branco separa parágrafo.
              </p>
            </Campo>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Texto do botão" id="c-cta-texto">
                <input
                  id="c-cta-texto"
                  type="text"
                  value={conteudo.ctaTexto ?? ""}
                  onChange={(e) => setCampo("ctaTexto", e.target.value)}
                  className={campo}
                />
              </Campo>
              <Campo label="Link do botão" id="c-cta-link">
                <input
                  id="c-cta-link"
                  type="url"
                  placeholder="https://"
                  value={conteudo.ctaLink ?? ""}
                  onChange={(e) => setCampo("ctaLink", e.target.value)}
                  className={campo}
                  data-testid="c-cta-link"
                />
              </Campo>
            </div>

            <Campo label="Nota de rodapé (opcional)" id="c-nota">
              <input
                id="c-nota"
                type="text"
                value={conteudo.notaRodape ?? ""}
                onChange={(e) => setCampo("notaRodape", e.target.value)}
                className={campo}
              />
            </Campo>

            {/* ── Imagem ─────────────────────────────────────── */}
            <div className="pt-2 border-t border-border-soft space-y-3">
              <label className={rotulo} htmlFor="c-imagem">
                Imagem (JPG ou PNG, até 2 MB)
              </label>
              <input
                id="c-imagem"
                type="file"
                accept="image/jpeg,image/png"
                disabled={subindoImagem}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirImagem(f);
                  e.target.value = "";
                }}
                className="font-body text-sm"
                data-testid="c-imagem"
              />
              {subindoImagem && <p className="font-body text-sm text-text-muted">Subindo…</p>}
              {urlImagem && (
                <Campo label="Descrição da imagem (obrigatória)" id="c-alt">
                  <input
                    id="c-alt"
                    type="text"
                    value={conteudo.imagemAlt ?? ""}
                    onChange={(e) => setCampo("imagemAlt", e.target.value)}
                    className={campo}
                    data-testid="c-imagem-alt"
                  />
                  <p className="font-body text-xs text-text-muted mt-1">
                    Boa parte das pessoas lê o e-mail com as imagens bloqueadas.
                  </p>
                </Campo>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => salvarRascunho(2)}
                disabled={salvando}
                className={botaoPrimario}
                data-testid="ir-passo-2"
              >
                Salvar e ir pros destinatários
              </button>
            </div>
          </div>

          {/* ── Preview ao vivo ─────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={rotulo}>Como vai ficar</span>
              <div className="ml-auto flex gap-1">
                {(["desktop", "celular"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPreview(m)}
                    className={`h-8 px-3 rounded-sm font-body text-xs focus-ring ${
                      preview === m
                        ? "bg-surface-selected text-navy font-semibold"
                        : "text-text-muted hover:bg-surface-app"
                    }`}
                  >
                    {m === "desktop" ? "Computador" : "Celular"}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={`border border-border-soft rounded-modal overflow-hidden bg-surface-app mx-auto ${
                preview === "celular" ? "max-w-95" : "w-full"
              }`}
            >
              <iframe
                title="Pré-visualização do e-mail"
                srcDoc={html}
                className="w-full h-[70vh] bg-white"
                data-testid="preview-email"
              />
            </div>
            <p className="font-body text-xs text-text-muted">
              O rodapé com endereço, motivo do recebimento e link de descadastro é fixo e vai em
              todo envio.
            </p>
          </div>
        </div>
      )}

      {/* ══ PASSO 2 · DESTINATÁRIOS ════════════════════════════ */}
      {passo === 2 && (
        <div className="max-w-2xl space-y-6 bg-white border border-border-soft rounded-modal p-6">
          <div role="radiogroup" aria-label="Quem recebe" className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="publico"
                checked={publicoTipo === "todos_elegiveis"}
                onChange={() => {
                  setPublicoTipo("todos_elegiveis");
                  setGrupoId(null);
                  void recontar("todos_elegiveis", null);
                }}
                className="mt-1 accent-gold focus-ring"
                data-testid="publico-todos"
              />
              <span>
                <span className="font-body text-sm text-dark block">Todos os elegíveis</span>
                <span className="font-body text-xs text-text-muted">
                  Todo mundo com e-mail válido que não pediu pra sair.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="publico"
                checked={publicoTipo === "grupo"}
                onChange={() => {
                  setPublicoTipo("grupo");
                  void recontar("grupo", grupoId);
                }}
                className="mt-1 accent-gold focus-ring"
                data-testid="publico-grupo"
              />
              <span>
                <span className="font-body text-sm text-dark block">Um grupo</span>
                <span className="font-body text-xs text-text-muted">
                  Só quem você escolheu a dedo pro grupo.
                </span>
              </span>
            </label>
          </div>

          {publicoTipo === "grupo" && (
            <Campo label="Grupo" id="c-grupo">
              <select
                id="c-grupo"
                value={grupoId ?? ""}
                onChange={(e) => {
                  const proximo = e.target.value || null;
                  setGrupoId(proximo);
                  void recontar("grupo", proximo);
                }}
                className={campo}
                data-testid="c-grupo"
              >
                <option value="">Escolha o grupo…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome} — {g.elegiveis} de {g.membros} receberiam
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <div className="rounded-md bg-surface-app p-5" data-testid="contagem-publico">
            <p className="font-display text-3xl text-navy tabular-nums">{contagem?.total ?? "—"}</p>
            <p className="font-body text-sm text-text-muted">
              {contagem?.total === 1 ? "pessoa recebe" : "pessoas recebem"} esta campanha hoje
              {grupoAtual ? ` (grupo ${grupoAtual.nome})` : ""}.
            </p>

            {contagem && (
              <ul className="mt-4 space-y-1 font-body text-sm text-text-muted">
                <li className="text-xs uppercase tracking-widest text-gold mb-1">
                  Quem ficou de fora
                </li>
                <li>
                  {contagem.exclusoes.semEmail} sem e-mail cadastrado
                  {publicoTipo === "grupo" ? " (nunca entram na conta do grupo)" : ""}
                </li>
                <li>{contagem.exclusoes.descadastrado} pediram pra não receber</li>
                <li>{contagem.exclusoes.invalido} com e-mail que voltou</li>
                {contagem.exclusoes.inativo > 0 && <li>{contagem.exclusoes.inativo} arquivados</li>}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => irPara(1)} className={botao}>
              ← Voltar pro conteúdo
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await salvarPublico()) irPara(3);
              }}
              disabled={salvando}
              className={botaoPrimario}
              data-testid="ir-passo-3"
            >
              Salvar e revisar
            </button>
          </div>
        </div>
      )}

      {/* ══ PASSO 3 · REVISÃO ══════════════════════════════════ */}
      {passo === 3 && (
        <div className="max-w-3xl space-y-6">
          {/* Resumo */}
          <section className="bg-white border border-border-soft rounded-modal p-6 space-y-3">
            <h2 className="font-display text-xl text-navy">Resumo</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-body text-sm">
              <Linha rotuloTexto="Tipo" valor={TIPO_LABELS[tipo]} />
              <Linha rotuloTexto="Assunto" valor={conteudo.assunto || "—"} />
              <Linha
                rotuloTexto="Quem recebe"
                valor={
                  publicoTipo === "grupo"
                    ? `Grupo ${grupoAtual?.nome ?? "—"}`
                    : "Todos os elegíveis"
                }
              />
              <Linha
                rotuloTexto="Quantas pessoas"
                valor={contagem ? String(contagem.total) : "—"}
              />
              <Linha rotuloTexto="Imagem" valor={urlImagem ? "sim" : "não"} />
              <Linha
                rotuloTexto="Botão"
                valor={conteudo.ctaTexto ? `${conteudo.ctaTexto} → ${conteudo.ctaLink}` : "—"}
              />
            </dl>
            <button type="button" onClick={() => setVerEmail(true)} className={botao}>
              Ver o e-mail inteiro
            </button>
          </section>

          {/* Preflight */}
          <section className="bg-white border border-border-soft rounded-modal p-6">
            <h2 className="font-display text-xl text-navy mb-3">Checagens</h2>
            <ul className="space-y-2" data-testid="preflight">
              {itensPreflight.map((i) => (
                <li key={i.chave} className="flex items-start gap-3 font-body text-sm">
                  <span
                    aria-hidden="true"
                    className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      i.ok
                        ? "bg-success-bg text-green border border-success-border"
                        : "bg-feedback-error-bg text-feedback-error-fg"
                    }`}
                  >
                    {i.ok ? "✓" : "!"}
                  </span>
                  <span>
                    <span className={i.ok ? "text-dark" : "text-navy font-semibold"}>
                      {i.label}
                    </span>
                    {!i.ok && i.comoResolver && (
                      <span className="block text-text-muted text-xs">{i.comoResolver}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Teste */}
          <section className="bg-white border border-border-soft rounded-modal p-6 space-y-3">
            <h2 className="font-display text-xl text-navy">Envio de teste</h2>
            <p className="font-body text-sm text-text-muted">
              O envio real só libera depois de um teste do conteúdo ATUAL. Mudou alguma coisa
              depois? Precisa testar de novo.
            </p>
            <div className="space-y-2">
              {destinosTeste.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={destinos.includes(d)}
                    onChange={() =>
                      setDestinos((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                      )
                    }
                    className="accent-gold focus-ring"
                  />
                  <span className="font-body text-sm text-dark">{d}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={enviarTeste}
              disabled={testando || salvando}
              className={botao}
              data-testid="enviar-teste"
            >
              {testando ? "Enviando…" : "Enviar teste"}
            </button>
            {campanha.testadoEm && (
              <p className="font-body text-xs text-text-muted">
                Último teste para: {campanha.testadoPara}
              </p>
            )}
          </section>

          {/* Envio */}
          <section className="bg-white border border-border-soft rounded-modal p-6 space-y-4">
            <h2 className="font-display text-xl text-navy">Envio</h2>

            <div role="radiogroup" aria-label="Quando enviar" className="flex flex-wrap gap-6">
              {(["agora", "agendar"] as const).map((q) => (
                <label key={q} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="quando"
                    checked={quando === q}
                    onChange={() => setQuando(q)}
                    className="accent-gold focus-ring"
                    data-testid={`quando-${q}`}
                  />
                  <span className="font-body text-sm text-dark">
                    {q === "agora" ? "Enviar agora" : "Agendar"}
                  </span>
                </label>
              ))}
            </div>

            {quando === "agendar" && (
              <div className="flex flex-wrap gap-4">
                <Campo label="Data" id="c-data">
                  <input
                    id="c-data"
                    type="date"
                    value={dataAgenda}
                    onChange={(e) => setDataAgenda(e.target.value)}
                    className={campo}
                    data-testid="c-data"
                  />
                </Campo>
                <Campo label="Hora" id="c-hora">
                  <input
                    id="c-hora"
                    type="time"
                    value={horaAgenda}
                    onChange={(e) => setHoraAgenda(e.target.value)}
                    className={campo}
                    data-testid="c-hora"
                  />
                </Campo>
                <p className="font-body text-xs text-text-muted self-end pb-2">
                  Horário de Brasília.
                </p>
              </div>
            )}

            {!podeEnviar && (
              <p className="font-body text-sm text-navy" data-testid="envio-travado">
                {!preflightVerde
                  ? "Resolva as checagens acima antes de enviar."
                  : "Faça o envio de teste do conteúdo atual antes de enviar."}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => irPara(2)} className={botao}>
                ← Voltar pros destinatários
              </button>
              <button
                type="button"
                onClick={abrirConfirmacao}
                disabled={!podeEnviar}
                className={botaoPrimario}
                data-testid="botao-enviar"
              >
                {quando === "agendar" ? "Agendar envio" : "Enviar agora"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Confirmação final (recontagem no instante) ──────────── */}
      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        variant="destrutiva"
        titulo={quando === "agendar" ? "Confirmar o agendamento?" : "Enviar agora?"}
        descricao={
          contagemFinal === null
            ? "Não consegui recontar quem recebe. Tente de novo."
            : `Recontando agora: ${contagemFinal} ${
                contagemFinal === 1 ? "pessoa vai receber" : "pessoas vão receber"
              }. Depois de sair, não tem como voltar atrás.`
        }
        primarioLabel={quando === "agendar" ? "Agendar" : "Enviar"}
        onConfirmar={disparar}
        data-testid="modal-confirmar-envio"
      />

      {/* ── Ver o e-mail (variante de conteúdo grande) ──────────── */}
      <Modal
        open={verEmail}
        onClose={() => setVerEmail(false)}
        variant="conteudo"
        titulo="Pré-visualizar e-mail"
        data-testid="modal-ver-email"
      >
        <iframe
          title="E-mail montado"
          srcDoc={html}
          className="w-full h-150 bg-white rounded-md border border-border-soft"
        />
      </Modal>
    </div>
  );
}

function Campo({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={rotulo} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Linha({ rotuloTexto, valor }: { rotuloTexto: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-gold">{rotuloTexto}</dt>
      <dd className="text-dark break-words">{valor}</dd>
    </div>
  );
}
