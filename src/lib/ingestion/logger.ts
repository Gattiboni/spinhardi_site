import type { Logger } from "./types";

/**
 * Logger console que reproduz EXATAMENTE as linhas dos scripts de backfill.
 *
 * @param prefix  "[backfill]" (ClickMassa) ou "[backfill-iddas]" (Iddas)
 * @param verbose se false, `verbose()` não emite nada
 */
export function createConsoleLogger(prefix: string, verbose: boolean): Logger {
  return {
    raw(msg: string): void {
      console.log(msg);
    },
    log(msg: string): void {
      console.log(`${prefix} ${msg}`);
    },
    verbose(msg: string): void {
      if (verbose) console.log(`  [verbose] ${msg}`);
    },
    sep(label: string): void {
      console.log(`\n${"─".repeat(60)}`);
      console.log(`  ${label}`);
      console.log("─".repeat(60));
    },
  };
}

/** Logger que descarta tudo. Para rotas/sync que não querem poluir stdout. */
export const silentLogger: Logger = {
  raw(): void {},
  log(): void {},
  verbose(): void {},
  sep(): void {},
};
