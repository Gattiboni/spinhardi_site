"use client";

import { useState } from "react";
import ToastProvider, { useToast } from "@/components/ui/primitives/Toast";
import Modal, { type ModalVariant } from "@/components/ui/primitives/Modal";
import DataTable, { type Column } from "@/components/ui/primitives/DataTable";
import Toggle from "@/components/ui/primitives/Toggle";

/** Linha de exemplo da tabela — só pra exercitar os estados do primitivo. */
type Linha = {
  id: string;
  contato: string;
  jornada: string;
  estagio: string;
  orcamento: number | null;
};

const LINHAS: Linha[] = [
  {
    id: "2317",
    contato: "Contato #2317",
    jornada: "Lua de mel — Itália",
    estagio: "Proposta aceita",
    orcamento: 42800,
  },
  {
    id: "2298",
    contato: "Contato #2298",
    jornada: "Família — Orlando",
    estagio: "Aguardando retorno",
    orcamento: 28150,
  },
  {
    id: "2274",
    contato: "Contato #2274",
    jornada: "Grupo — Chile e Argentina",
    estagio: "Orçamento enviado",
    orcamento: 96400,
  },
  {
    id: "2251",
    contato: "Contato #2251",
    jornada: "Réveillon — Portugal",
    estagio: "Primeiro contato",
    orcamento: null,
  },
  {
    id: "2240",
    contato: "Contato #2240",
    jornada: "Lua de mel — Maldivas",
    estagio: "Perdido",
    orcamento: 71900,
  },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const COLUNAS: Column<Linha>[] = [
  { key: "contato", header: "Contato", render: (r) => r.contato, sortValue: (r) => r.contato },
  {
    key: "jornada",
    header: "Jornada",
    render: (r) => r.jornada,
    sortValue: (r) => r.jornada,
    escondidaNoMobile: true,
  },
  { key: "estagio", header: "Estágio", render: (r) => r.estagio, escondidaNoMobile: true },
  {
    key: "orcamento",
    header: "Orçamento",
    numerica: true,
    sortValue: (r) => r.orcamento ?? -1,
    // Ausência é travessão, nunca "R$ 0,00" (folha, "Números").
    render: (r) => (r.orcamento == null ? "—" : brl.format(r.orcamento)),
  },
];

export default function PrimitivosShowcase() {
  return (
    <ToastProvider>
      <Conteudo />
    </ToastProvider>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-navy border-b border-border-soft pb-2">{titulo}</h2>
      {children}
    </section>
  );
}

const botao =
  "h-9.5 px-4 rounded-md border border-border-strong bg-surface font-body text-sm text-navy hover:bg-surface-selected focus-ring transition-colors duration-short";

function Conteudo() {
  const t = useToast();
  const [modal, setModal] = useState<ModalVariant | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [comErro, setComErro] = useState(false);
  const [semLinhas, setSemLinhas] = useState(false);
  const [comFiltro, setComFiltro] = useState(false);
  const [tog1, setTog1] = useState(true);

  return (
    <div className="min-h-screen bg-surface-app p-8 lg:p-12 space-y-12 max-w-6xl mx-auto">
      <header className="space-y-2">
        <p className="font-body text-xs uppercase tracking-widest text-gold">
          Spinhardi · back-office
        </p>
        <h1 className="font-display text-3xl text-navy">Folha de primitivos v1</h1>
        <p className="font-body text-sm text-text-muted max-w-2xl">
          Toast, Modal, Tabela de dados e Toggle. Três variantes de toast (a de
          &ldquo;atenção&rdquo; foi cortada em D8) e erro sem vermelho por inversão de peso (D1).
        </p>
      </header>

      <Bloco titulo="01 · Toast">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={botao}
            data-testid="demo-toast-sucesso"
            onClick={() => t.sucesso("Campanha salva como rascunho.")}
          >
            sucesso · 4s
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-toast-info"
            onClick={() => t.info("O sync do ClickMassa roda de hora em hora.")}
          >
            informação · 5s
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-toast-erro"
            onClick={() => t.erro("Não foi possível salvar. Tente de novo.")}
          >
            erro · persiste
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-toast-acao"
            onClick={() =>
              t.sucesso("Tag removida de 3 contatos.", [
                { label: "Desfazer", onClick: () => t.info("Desfeito.") },
              ])
            }
          >
            sucesso + ação · 8s
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-toast-empilha"
            onClick={() => {
              t.info("Primeiro.");
              t.sucesso("Segundo.");
              t.info("Terceiro.");
              t.info("Quarto — empurra o mais antigo.");
            }}
          >
            empilhado (teto 3)
          </button>
        </div>
        <p className="font-body text-xs text-text-muted">
          Passe o mouse por cima pra pausar; ao sair, a contagem reinicia do zero (D6).
        </p>
      </Bloco>

      <Bloco titulo="02 · Modal">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={botao}
            data-testid="demo-modal-a"
            onClick={() => setModal("confirmacao")}
          >
            (a) confirmação simples
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-modal-b"
            onClick={() => setModal("destrutiva")}
          >
            (b) destrutiva
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-modal-b1"
            onClick={() => setModal("confirmacao-digitada")}
          >
            (b·1) confirmação digitada
          </button>
          <button
            type="button"
            className={botao}
            data-testid="demo-modal-c"
            onClick={() => setModal("conteudo")}
          >
            (c) conteúdo grande
          </button>
        </div>

        <Modal
          open={modal === "confirmacao"}
          onClose={() => setModal(null)}
          variant="confirmacao"
          titulo="Cancelar o agendamento?"
          descricao="A campanha volta pro estado testada e você pode reagendar depois."
          primarioLabel="Cancelar agendamento"
          onConfirmar={() => {
            t.sucesso("Agendamento cancelado.");
            return null;
          }}
          cancelarLabel="Voltar"
          data-testid="modal-a"
        />

        <Modal
          open={modal === "destrutiva"}
          onClose={() => setModal(null)}
          variant="destrutiva"
          titulo="Remover a tag dos selecionados?"
          descricao="Isso tira a tag de 3 contatos. As outras tags deles ficam como estão."
          primarioLabel="Remover tag"
          /* Devolver string mostra a faixa de erro sem fechar o modal. */
          onConfirmar={() => "Falhou de propósito — é assim que a faixa de erro aparece."}
          data-testid="modal-b"
        />

        <Modal
          open={modal === "confirmacao-digitada"}
          onClose={() => setModal(null)}
          variant="confirmacao-digitada"
          titulo="Apagar este grupo?"
          descricao="O grupo some e os contatos continuam onde estão. Isso não tem como desfazer."
          primarioLabel="Apagar grupo"
          palavraConfirmacao="APAGAR"
          onConfirmar={() => {
            t.sucesso("Grupo apagado.");
            return null;
          }}
          data-testid="modal-b1"
        />

        <Modal
          open={modal === "conteudo"}
          onClose={() => setModal(null)}
          variant="conteudo"
          titulo="Pré-visualizar e-mail"
          data-testid="modal-c"
        >
          <div className="space-y-4 font-body text-sm text-dark">
            {Array.from({ length: 14 }).map((_, i) => (
              <p key={i} className="bg-surface p-4 rounded-md border border-border-soft">
                Parágrafo {i + 1} — só o corpo rola. Cabeçalho e rodapé ficam presos, com filete
                marcando o limite da área rolável.
              </p>
            ))}
          </div>
        </Modal>
      </Bloco>

      <Bloco titulo="03 · Tabela de dados">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={botao}
            onClick={() => {
              setCarregando((v) => !v);
              setComErro(false);
            }}
          >
            {carregando ? "parar carregamento" : "carregando (esqueleto)"}
          </button>
          <button
            type="button"
            className={botao}
            onClick={() => {
              setComErro((v) => !v);
              setCarregando(false);
            }}
          >
            {comErro ? "limpar erro" : "erro de carregamento"}
          </button>
          <button
            type="button"
            className={botao}
            onClick={() => {
              setSemLinhas((v) => !v);
              setComFiltro(false);
            }}
          >
            {semLinhas ? "voltar as linhas" : "vazio — base vazia"}
          </button>
          <button
            type="button"
            className={botao}
            onClick={() => {
              setComFiltro((v) => !v);
              setSemLinhas(true);
            }}
          >
            {comFiltro ? "limpar filtro" : "vazio — por filtro"}
          </button>
        </div>

        <DataTable<Linha>
          data-testid="demo-tabela"
          rows={semLinhas ? [] : LINHAS}
          rowId={(r) => r.id}
          columns={COLUNAS}
          carregando={carregando}
          erro={
            comErro
              ? {
                  mensagem: "Não foi possível carregar os contatos.",
                  onTentarDeNovo: () => setComErro(false),
                }
              : null
          }
          vazio={{
            titulo: "Nenhum contato ainda",
            descricao: "Assim que chegar o primeiro formulário do site, ele aparece aqui.",
          }}
          filtros={
            comFiltro
              ? {
                  totalBase: 312,
                  chips: [
                    { label: "Estágio: Proposta aceita", onRemover: () => setComFiltro(false) },
                    { label: "Últimos 7 dias", onRemover: () => setComFiltro(false) },
                  ],
                  onLimpar: () => {
                    setComFiltro(false);
                    setSemLinhas(false);
                  },
                }
              : undefined
          }
          selecao={{
            selecionados,
            onChange: setSelecionados,
            rotulo: ["contato", "contatos"],
            acoes: [
              {
                label: "Adicionar à campanha",
                onClick: (ids) => t.info(`${ids.length} pra campanha.`),
              },
              { label: "Remover tag", destrutiva: true, onClick: () => setModal("destrutiva") },
            ],
          }}
          aoAbrir={(r) => t.info(`Abriria ${r.contato}.`)}
          abrirLabel="Abrir"
          ordenacaoInicial={{ key: "contato", dir: "asc" }}
        />
      </Bloco>

      <Bloco titulo="04 · Toggle">
        <div className="bg-surface border border-border-soft rounded-modal divide-y divide-border-soft px-5">
          <Toggle
            checked={tog1}
            onChange={(v) => setTog1(v)}
            label="Avisar por e-mail quando chegar contato novo"
            auxiliar="Texto auxiliar opcional, abaixo do rótulo, nunca ao lado do controle."
            data-testid="demo-toggle-1"
          />
          <Toggle
            checked={false}
            onChange={() => {}}
            disabled
            label="Enviar campanha automaticamente após o teste"
            auxiliar="Disponível só depois que a campanha for testada."
            data-testid="demo-toggle-disabled"
          />
          <Toggle
            checked={false}
            onChange={() => {
              // Otimista com falha: volta ao estado anterior e o toast explica.
              setTimeout(() => t.erro("Não foi possível salvar a preferência."), 0);
              return false;
            }}
            label="Mostrar orçamentos arquivados na lista"
            data-testid="demo-toggle-revert"
          />
        </div>
        <p className="font-body text-xs text-text-muted">
          O terceiro é o caso &ldquo;erro ao salvar&rdquo;: muda na hora, volta em 140ms e o toast
          explica.
        </p>
      </Bloco>
    </div>
  );
}
