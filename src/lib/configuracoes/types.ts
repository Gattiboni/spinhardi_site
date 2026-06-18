/**
 * Tipos de domínio das Configurações (origens de captação e tags).
 *
 * Naming misto (convenção do projeto): campos como `is_active`, `campanha_ativa`,
 * `descricao`, `grupo` e `cor` ficam em snake_case/PT também no TS — não são
 * traduzidos pra inglês nem pra camelCase. A tradução DB↔TS explícita
 * (padrão D029) vive em `./mappers`.
 */

export type CaptureOrigin = {
  id: string;
  name: string;
  slug: string;
  descricao: string | null;
  is_active: boolean;
  campanha_ativa: boolean;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
  cor: string;
  grupo: string | null;
  is_active: boolean;
};
