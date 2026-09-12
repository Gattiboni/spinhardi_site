/**
 * Navegação do site — fonte única de verdade dos links.
 *
 * Consumido pelo Header, pelo MobileMenu e pelo Footer para evitar duplicação
 * da lista de rotas. A ordem segue o mapa de copies aprovado pela Amanda.
 */

export type NavLink = {
  /** Rota interna (Next <Link>). */
  href: string;
  /** Rótulo exibido. */
  label: string;
};

/**
 * Links principais de navegação — Header e Mobile Menu.
 * Ordem aprovada: Sobre · Viagens · Destinos · Blog · Contato.
 */
export const NAV_LINKS: NavLink[] = [
  { href: "/sobre", label: "Sobre" },
  { href: "/viagens", label: "Viagens" },
  { href: "/destinos", label: "Destinos" },
  { href: "/blog", label: "Blog" },
  { href: "/contato", label: "Contato" },
];

/**
 * Coluna "Páginas" do Footer — inclui Home além dos links principais.
 */
export const FOOTER_PAGE_LINKS: NavLink[] = [{ href: "/", label: "Home" }, ...NAV_LINKS];

/**
 * Coluna "Serviços" do Footer — um link por produto, apontando para a subpágina.
 */
export const FOOTER_SERVICE_LINKS: NavLink[] = [
  { href: "/viagens/pacotes", label: "Pacotes e Serviços Avulsos" },
  { href: "/viagens/sob-medida", label: "Viagem Sob Medida" },
];

/**
 * Links legais — rodapé inferior do Footer, ao lado do copyright.
 *
 * Fica FORA de `FOOTER_PAGE_LINKS`, do `NAV_LINKS` e do MobileMenu de propósito:
 * é link de referência (rodapé inferior), não item de navegação. Declarado como
 * lista porque o próximo (termos de uso) entra aqui sem tocar o Footer.
 */
export const FOOTER_LEGAL_LINKS: NavLink[] = [
  { href: "/politica-de-privacidade", label: "Política de privacidade" },
];
