# Architecture

Sefaria Translation Studio is a Next.js App Router app. The UI is a client component in `src/app/page.tsx`. Server routes under `src/app/api/` proxy Sefaria and call the LLM so API keys and upstream requests stay off the browser (except an optional key in `localStorage` for Settings).

## Modules

| Module | Location | Role |
|--------|----------|------|
| `parseRef` | `src/lib/parse-ref.ts` | Turn a Sefaria URL or raw Ref into a normalized Ref and index title |
| `SefariaClient` | `src/lib/sefaria-client.ts` | Read-only Sefaria API (`v3/texts`, versions, translations, shape) |
| `IndexOutline` | `src/lib/index-outline.ts` | Walk a book’s section tree via `next` and optional `shape` child counts |
| `DraftEngine` | `src/lib/draft-engine.ts` | Build the XML context pack and call OpenAI or Anthropic |
| `VersionFileStore` | `src/lib/version-file-store.ts` | Read/write local Version JSON and CSV export |

## API routes

- `GET /api/sefaria` — proxy to `www.sefaria.org/api/…`
- `POST /api/draft` — generate a Draft from Source + context pack
- `GET|POST /api/version-file` — load or append to a local Version file
- `GET /api/outline` — section tree for book mode
- `GET|POST /api/glossary` — read or extend the hand-maintained glossary

## Local data

Version files live at `data/versions/{IndexTitle}__{lang}.json` (gitignored). Each save appends segments in Sefaria import shape. CSV download uses the same metadata rows Sefaria expects plus `Ref,text`.

LLM provider, model, and API key come from `.env.local` or the in-app Settings panel.

## Further reading

- Domain terms: [context.md](context.md)
- Product decisions: [adr/](adr/)
- Background research: [research/](research/)
