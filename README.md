# Sefaria Translation Studio

Independent, open proof of concept for **human-reviewed, AI-assisted translation** of Sefaria texts.

This app is **powered by Sefaria’s public API and data model**. It does **not** write to Sefaria’s library or content pipeline. Drafts stay on your machine until a human exports a Version file and hands it off.

Built in response to Sefaria Developer Outreach’s invitation to experiment in the open: a documented workflow that content and product teams can inspect, not a replacement for human translators.

## What it does

1. Paste a Sefaria URL or Ref (`Genesis 1:1`, `https://www.sefaria.org.il/Berakhot.2a.3`).
2. Detect a **Gap**: no translation yet in the chosen target language at that segment.
3. Show **Source** (Hebrew/Aramaic/Yiddish, RTL) beside **Helper** (English by default) and an editable **Draft**.
4. Generate a draft with a configurable LLM. If English exists, the model translates from English and checks names/terms against the original.
5. Save locally as a Sefaria-shaped **Version file** (JSON + CSV export), one file per index and language.
6. Work at three grains: **Segment**, **Chapter/section**, or **Book** (section tree).

Nothing is published automatically. A draft in the Version file is still a draft until a fluent human reviews it.

## Target languages (v1)

French, Spanish, German, Italian, Portuguese. Glossary matching is French-only for now.

Drafts are intended **CC0** so they can be donated if Sefaria’s licensing allows.

## Requirements

- Node.js 20+
- An OpenAI or Anthropic API key (entered in Settings or `.env.local`)

## Run locally

```bash
cp .env.local.example .env.local
# put your LLM_API_KEY in .env.local, or paste it in Settings
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

## Architecture

| Module | Role |
|---|---|
| `parseRef` | URL / raw Ref → Sefaria Ref |
| `SefariaClient` | Read-only Sefaria API (`v3/texts`, versions, shape) |
| `IndexOutline` | Book → section tree via section-level `next` + `shape` |
| `DraftEngine` | XML context pack + LLM call |
| `VersionFileStore` | Local JSON + CSV in Sefaria import layout |

API routes (`/api/sefaria`, `/api/draft`, `/api/version-file`, `/api/outline`) run on the Next.js server. The browser never talks to Sefaria or the LLM directly (except storing the optional API key in `localStorage` for Settings).

Version files: `data/versions/{IndexTitle}__{lang}.json`. CSV download matches Sefaria’s bulk-import metadata rows plus `Ref,text`.

Docs: [architecture](docs/architecture.md), [domain terms](docs/context.md), [decisions](docs/adr/), [research](docs/research/).

## What this is not

- Not a path into production Sefaria.
- Not unreviewed machine translation for the library.
- Not a multi-user review product (no accounts, no approval states).

## Handoff to Sefaria

When a chapter is human-reviewed:

1. Download the CSV from the app.
2. Include source edition, methodology, and that every segment was edited by a human.
3. Send to `developers@sefaria.org` / follow current import guidance.

[Powered by Sefaria](https://developers.sefaria.org/docs/powered-by-sefaria) · [API docs](https://developers.sefaria.org/) · [submission form](https://sefaria.formstack.com/forms/powered_by_sefaria_submission_form)

## License

- Application code: [MIT](LICENSE)
- Generated drafts: CC0 (disclaimed to the extent legally possible)

Sefaria texts remain under their own licenses (see each Version on Sefaria). Respect those licenses; this tool only reads public API responses.
