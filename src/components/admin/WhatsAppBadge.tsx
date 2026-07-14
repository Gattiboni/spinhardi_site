type WhatsAppBadgeProps = {
  temWhatsapp: boolean;
};

/**
 * Indicador de qualidade `tem_whatsapp` (U1.2 do contrato de dados).
 *
 * Pós-U1 mais da metade dos contatos entra SEM telefone (LID do ClickMassa,
 * pessoas do Iddas), então marcamos os DOIS estados — não só a exceção. Usa o
 * mesmo glifo 💬 que o resto do back-office associa a WhatsApp (botão, timeline),
 * de propósito diferente do ✓/✗ do SyncBadge pra nunca confundir com status de
 * sync. Presença = glifo vivo; ausência = apagado (grayscale + risco). Sem cor
 * nova. Lê num piscar: colorido tem, cinza não tem.
 */
export default function WhatsAppBadge({ temWhatsapp }: WhatsAppBadgeProps) {
  return temWhatsapp ? (
    <span
      className="text-sm leading-none"
      title="Tem WhatsApp"
      aria-label="Tem WhatsApp"
    >
      💬
    </span>
  ) : (
    <span
      className="text-sm leading-none grayscale opacity-40 line-through"
      title="Sem WhatsApp"
      aria-label="Sem WhatsApp"
    >
      💬
    </span>
  );
}
