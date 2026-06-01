import { buttonStyles, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { buildWhatsAppURL, WHATSAPP_DEFAULT_MESSAGE } from "@/lib/whatsapp/constants";

type CTAWhatsAppProps = {
  /** Aparência, reaproveitada do Button. Default: "primary". */
  variant?: ButtonVariant;
  /** Tamanho, reaproveitado do Button. Default: "md". */
  size?: ButtonSize;
  /** Texto do botão. Default: "Vamos conversar" (copy aprovado). */
  label?: string;
  /** Mensagem pré-preenchida na conversa. Default: WHATSAPP_DEFAULT_MESSAGE. */
  message?: string;
  /** Classes adicionais. */
  className?: string;
};

/**
 * CTAWhatsApp
 *
 * Link estilizado que abre a conversa direto no WhatsApp da Spinhardi.
 *
 * É um `<a>` (navegação externa), não um `<button>` — por isso reaproveita o
 * estilo do Button via `buttonStyles()` em vez do componente Button em si.
 * Abre em nova aba com `rel="noopener noreferrer"` por segurança.
 *
 * Server Component: a URL é montada no servidor a partir das constantes do
 * projeto; não há estado nem interatividade que exija "use client".
 */
export default function CTAWhatsApp({
  variant = "primary",
  size = "md",
  label = "Vamos conversar",
  message = WHATSAPP_DEFAULT_MESSAGE,
  className = "",
}: CTAWhatsAppProps) {
  return (
    <a
      href={buildWhatsAppURL(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonStyles(variant, size, className)}
    >
      {label}
    </a>
  );
}
