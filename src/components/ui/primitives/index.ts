/**
 * Primitivos da folha de componentes v1 (Toast, Modal, Tabela de dados, Toggle).
 *
 * Ponto único de import pras telas novas. As telas EXISTENTES (contatos, blog)
 * não usam nada daqui — a migração delas é lote futuro, por decisão explícita.
 *
 * Cor, sombra e movimento vivem em `src/app/globals.css` (bloco "TOKENS DOS
 * PRIMITIVOS"). Nenhum componente aqui escreve hex literal: quando o token
 * funcional de erro (D1) for aprovado, a troca é lá, em três linhas.
 */
export { default as ToastProvider, useToast } from "./Toast";
export type { ToastVariant, ToastInput, ToastAction } from "./Toast";

export { default as Modal } from "./Modal";
export type { ModalVariant, ModalProps, ConfirmResult } from "./Modal";

export { default as DataTable } from "./DataTable";
export type { Column, BulkAction, FiltroChip, SortDir, DataTableProps } from "./DataTable";

export { default as Toggle } from "./Toggle";
export type { ToggleProps } from "./Toggle";
