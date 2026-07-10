# Studio Sanity — Spinhardi

Fonte **versionada** do schema Sanity do projeto `wtc1swpj` (dataset `production`).

## O que e / por que existe

O schema em producao foi originalmente criado por um Studio hospedado a partir de
template, sem fonte sob nosso controle. Esta pasta da **dono, versao e deploy
reproduzivel** ao schema.

Ninguem usa este Studio como editor de conteudo — a escrita dos posts acontece
pelo **back-office do site**. A pasta existe apenas para que o schema tenha
codigo-fonte e possa ser deployado via CLI.

Por isso o `sanity.config.ts` tem `plugins: []` (sem `@sanity/vision`, sem
`structureTool`). Se algum dia for preciso rodar o Studio localmente como editor,
adicione `structureTool()` de `sanity/structure` aos plugins.

## Schema

- **post** — replica o schema vivo (`title`, `slug`, `author`, `mainImage`,
  `categories`, `publishedAt`, `body`) e **adiciona** `excerpt`, `seoTitle`,
  `seoDescription`, `ogImage`.
- **author** — `name`, `slug`, `image`, `bio` (replica exata).
- **category** — `title`, `description` (replica exata).

> `title` e `slug` do post sao obrigatorios. Os demais campos sao opcionais — a
> validacao final acontece na borda (back-office), mesmo padrao do form de contato.

## Deploy do schema

```bash
cd studio
npm install
npx sanity login        # so na primeira vez / se a sessao expirou
npx sanity schema deploy
```

`sanity schema deploy` publica **apenas o schema** (manifest) no dataset. E o unico
comando de deploy que deve ser rodado aqui.

### NAO rodar

- `npx sanity deploy` — isso faz deploy de **hosting do Studio** (a UI web). Nao e
  o objetivo desta pasta e nao deve ser executado.
