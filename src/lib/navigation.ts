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
 * Ordem aprovada: Sobre · Viagens · Blog · Contato.
 */
export const NAV_LINKS: NavLink[] = [
  { href: "/sobre", label: "Sobre" },
  { href: "/viagens", label: "Viagens" },
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
