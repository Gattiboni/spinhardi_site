import { defineConfig } from "sanity";
import { schemaTypes } from "./schemas";

/**
 * Configuracao do workspace da Sanity.
 *
 * Este Studio NAO e usado como editor de conteudo (a escrita acontece pelo
 * back-office do site). Ele existe apenas para versionar e fazer deploy do
 * schema via `sanity schema deploy`. Por isso `plugins` fica vazio: nao ha
 * @sanity/vision nem structureTool. Se algum dia for preciso rodar o Studio
 * localmente como editor, adicione `structureTool()` de "sanity/structure".
 */
export default defineConfig({
  name: "default",
  title: "Spinhardi",

  projectId: "wtc1swpj",
  dataset: "production",

  plugins: [],

  schema: {
    types: schemaTypes,
  },
});
