# Sefaria AI-assisted, human-reviewed translation workflow

Research for an **independent** open proof-of-concept (not inside Sefaria’s main content pipeline), per Developer Outreach guidance (Aug 2026).

## Verdict

Build a standalone open project that:

1. **Reads** texts via the public Sefaria API and/or [Sefaria-Export](https://github.com/Sefaria/Sefaria-Export).
2. **Drafts** French (etc.) segment-by-segment with an LLM, always with Hebrew/Aramaic + English when available.
3. **Requires human approval** for every segment before anything is considered “done.”
4. **Exports** in Sefaria’s Version / CSV shape for optional later handoff to content staff.
5. **Does not write** into Sefaria production automatically.
6. Ships in the open and can be listed on [Powered by Sefaria](https://developers.sefaria.org/docs/powered-by-sefaria).

That matches what Sefaria asked for: useful to product/content teams as a documented PoC, without touching their pipeline.

---

## A. Data model (Index / Version / Ref)

Sources: [Index and Versions](https://developers.sefaria.org/docs/index-and-versions), [Texts v3](https://developers.sefaria.org/reference/get-v3-texts), [Versions](https://developers.sefaria.org/reference/get-versions).

| Concept | Role |
|--------|------|
| **Index** | One book’s structure (`schema`), categories, metadata. Example: `Rashi on Genesis`. |
| **Version** | One edition/translation of that Index. Same structural shape; different `versionTitle` + text. |
| **Ref** | Citation string for a segment or range, e.g. `Rashi on Genesis 1:1`. Shared across all Versions of the Index. |

**Language conventions (critical for non-English):**

- Historical `language` field on Versions is often `en` for LTR translations and `he` for Hebrew source, **not** the ISO code of the translation.
- Real language is in `actualLanguage` (e.g. `fr`).
- Non-English `versionTitle` must end with a bracketed code: `[fr]`, `[pt]`, `[es]` ([help article](https://help.sefaria.org/hc/en-us/articles/18613654108572-How-to-Add-a-Translation-to-the-Sefaria-Library)).
- Example (live API, Genesis French): `Bible du Rabbinat 1899 [fr]` with `language: "en"`, `actualLanguage: "fr"`.

Commentaries often store **multiple comments per verse** as a list of strings under one Ref (e.g. `Rashi on Genesis 1:1` → 3 English comments + 3 Hebrew). Export/import must preserve list length and order.

---

## B. Reading data (no auth)

| Need | Endpoint / asset |
|------|------------------|
| One Ref + versions | `GET /api/v3/texts/{tref}` — [docs](https://developers.sefaria.org/reference/get-v3-texts) |
| All Versions metadata | `GET /api/texts/versions/{title}` |
| What’s already in language X | `GET /api/texts/translations/{lang}` e.g. `/fr` — [docs](https://developers.sefaria.org/reference/get-translations-lang) |
| Bulk offline corpus | Public GCS `gs://sefaria-export/` + [books.json](https://github.com/Sefaria/Sefaria-Export/blob/master/books.json) |

**Finding French gaps:** load `/api/texts/translations/fr` (~184 titles as of Aug 2026), then compare to desired Indexes. Live check: **no French** for any `Rashi on {Genesis…Deuteronomy}`, nor for major Genesis commentaries (Ramban, Ibn Ezra, Sforno, Or HaChaim, …). Tanakh, Mishnah, and much Bavli already have French.

---

## C. How translations enter Sefaria today

Sources: [How to Add a Translation](https://help.sefaria.org/hc/en-us/articles/18613654108572-How-to-Add-a-Translation-to-the-Sefaria-Library), [API wiki](https://github.com/Sefaria/Sefaria-Project/wiki/API-Documentation), [`sefaria/export.py`](https://github.com/Sefaria/Sefaria-Project/blob/master/sefaria/export.py), moderator tools in Sefaria-Project.

1. **Community UI** — per-segment “Add Translation” (account required). Non-English must be “Copied Text”; version title includes `[fr]`.
2. **Complete / large translation** — email `hello@sefaria.org` (or developers) with the package; staff coordinates import.
3. **Moderator CSV bulk import** — internal `/modtools` CSV upload (not public).
4. **Authenticated APIs** — `POST /api/texts/:ref` and `POST /api/texts/modify-bulk/:title` require an **apikey** (staff/local). Not for independent PoC write-path.

### CSV Version format (handoff target)

From `export_version_csv` / `_import_versions_from_csv` in `sefaria/export.py`:

**Single-version column layout:**

| Row | Column 0 | Column N (version) |
|-----|----------|--------------------|
| 0 | Index Title | e.g. `Rashi on Genesis` |
| 1 | Version Title | e.g. `… [fr]` |
| 2 | Language | historically `en` for LTR FR |
| 3 | Version Source | URL |
| 4 | Version Notes | free text |
| 5+ | segment Ref | segment text |

Multi-version CSVs use a header row starting with `Version Title` and one column per version.

`modify-bulk` payload shape: `{ versionTitle, language, text_map: { "Ref": "text", ... }, versionSource? }`.

Internal content-eng docs ([text-eng-docs](https://github.com/Sefaria/text-eng-docs)) describe deploy Version/Index tasks but `deployVersion.md` is currently a stub.

---

## D. Licensing & editorial constraints

- Sefaria prioritizes **human** translations; unreviewed MT should not be published as library content (your original email + their “independent PoC” reply).
- Community translations are typically CC0 / contributor-owned; many editions are Public Domain or CC-BY*. Prefer **Public Domain / clearly licensed** English + Hebrew sources for pilots so downstream licensing is clean.
- Label AI drafts as drafts; only human-approved text in export packages.
- Do not scrape locked commercial editions into a redistributable “new” translation without license clarity—use PD pairs (e.g. Silbermann Rashi EN + HE) where possible.

---

## E. Related Sefaria repos (cloned under `vendor/`)

| Repo | Relevance |
|------|-----------|
| [translation-plugin](https://github.com/Sefaria/translation-plugin) | Experimental web component: fetch Hebrew via v3 API → Google Translate → display with hallucination disclaimer. **On-the-fly MT UX, not a publishing pipeline.** Shows internal interest in AI translation display. |
| [powered-by](https://github.com/Sefaria/powered-by) | Dashboard of community projects (`GET /api/powered-by`). Submit via [Formstack](https://sefaria.formstack.com/forms/powered_by_sefaria_submission_form). |
| [Sefaria-Export](https://github.com/Sefaria/Sefaria-Export) | Authoritative offline dump; best for batch pilots. |
| [text-eng-docs](https://github.com/Sefaria/text-eng-docs) | How staff deploy Indexes/Versions. |
| [DictionaryResolver](https://github.com/Sefaria/DictionaryResolver) | LLM batch pipelines + checkpointing patterns (not translation, but good batch/ops reference). |
| [sefaria-mcp](https://github.com/Sefaria/sefaria-mcp) | MCP tools for reading texts / English translations—handy for tooling. |
| [LLM](https://github.com/Sefaria/LLM) / [AppliedAI](https://github.com/Sefaria/AppliedAI) | Research / Virtual Havruta RAG—study Q&A, not translation workflow. |

French-facing ecosystem already exists (e.g. HebrewProAI on Powered-by list)—your PoC is complementary: **production of reviewed translation Versions**, not another study chatbot.

---

## F. Recommended architecture (independent PoC)

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Sefaria API  │───▶│ Segment store   │───▶│ Draft engine     │───▶│ Review UI       │
│ + Export GCS │    │ (Ref, he, en,   │    │ (LLM + glossary │    │ (edit/approve/  │
└──────────────┘    │  fr*, status)   │    │  + term memory) │    │  history)       │
                    └─────────────────┘    └──────────────────┘    └────────┬────────┘
                                                                            │
                                                                            ▼
                                                                   ┌─────────────────┐
                                                                   │ Exporter        │
                                                                   │ CSV + JSON      │
                                                                   │ Version package │
                                                                   └─────────────────┘
```

**Deep modules (suggested seams):**

1. **`SefariaCorpus`** — `get_segments(index, versions[])` → normalized `{ref, he, en, …}`; hides v3 vs Export.
2. **`DraftTranslator`** — `(segment, glossary, context) → draft`; swap LLM providers behind one interface.
3. **`ReviewStore`** — draft / human / approved states + revision history + reviewer id + timestamps.
4. **`Glossary`** — names & Jewish terms (Rashi lemmas, divine names, place names); applied at draft + review.
5. **`SefariaExporter`** — approved segments → CSV / `text_map` JSON matching staff import tools.

**Hard rules:**

- Nothing auto-posts to `sefaria.org`.
- Approved ≠ published; handoff is a zip + README for content team.
- Preserve HTML sparingly or strip consistently (`return_format=text_only` for drafting; document policy for bold lemmas in Rashi).

**Product surface (MVP):**

- Web app: side-by-side HE | EN | FR draft, keyboard approve/edit, glossary panel.
- Progress: % approved, remaining by chapter/parasha.
- Export button → Sefaria-compatible package + provenance (model, prompt hash, reviewer, dates).

---

## G. Pilot text selection

**Strong first pilot: `Rashi on Genesis` (scoped to one parasha / chapter, not all ~2k comments).**

Why:

- **No French** on Sefaria today (API check Aug 2026).
- **Public Domain** English + Hebrew: Silbermann 1929–1934.
- Precedent for community non-EN Versions on same Index (`[pt]`, `[de]`, `[fi]`).
- High educational value for French readers; structure is familiar.

Sizing: ~2000 non-empty English comment segments across 50 chapters. Start with **Genesis ch. 1** or **Parashat Bereshit** only.

Alternatives: `Bereishit Rabbah` (has DE/PT, no FR; larger), or a short Musar work missing FR (verify license). Avoid re-translating Tanakh (already multiple FR Versions).

**Confirm with Sefaria** before scaling: preferred pilot Index, whether community Version vs staff import, and licensing of the finished FR text (CC0 vs CC-BY).

---

## H. Practical next steps (MVP)

1. **Repo skeleton** — open MIT/AGPL-compatible project; README states “Powered by Sefaria; not affiliated; no unreviewed MT published to Sefaria.”
2. **Ingest** — pull Silbermann HE+EN for `Rashi on Genesis 1` via API; normalize multi-comment Refs.
3. **Draft loop** — LLM prompt: Hebrew primary, English secondary, glossary forced terms, output one FR string per comment.
4. **Review UI** — approve/edit; store revisions.
5. **Exporter** — emit staff CSV + JSON `text_map`.
6. **Discord** — share PoC early in developer community; ask content team for feedback on format.
7. **Powered-by** — submit when there’s a public demo + GitHub.
8. **Handoff** — only after a fully human-reviewed chapter package, email developers/hello with export + methodology doc.

### Out of scope for MVP

- Writing to production Sefaria APIs.
- Full Chumash Rashi.
- Training a custom MT model.
- Replacing existing French Tanakh editions.

---

## Key live facts (Aug 2026)

- French library coverage: ~184 titles via `/api/texts/translations/fr`.
- Genesis FR exists (`Bible du Rabbinat 1899 [fr]`, Chouraqui, Zadoc Kahn, Cahen, …).
- `Rashi on Genesis` Versions include EN/HE/PT/FI/DE — **not FR**.
- Silbermann Rashi EN export: ~1997 text-bearing segments; HE merged ~2017.
- Developer docs hub: https://developers.sefaria.org/docs/welcome  
- Docs index for agents: https://developers.sefaria.org/llms.txt  

---

## Source index

- https://developers.sefaria.org/docs/index-and-versions  
- https://developers.sefaria.org/docs/powered-by-sefaria  
- https://developers.sefaria.org/reference/get-v3-texts  
- https://developers.sefaria.org/reference/get-translations-lang  
- https://help.sefaria.org/hc/en-us/articles/18613654108572-How-to-Add-a-Translation-to-the-Sefaria-Library  
- https://github.com/Sefaria/Sefaria-Export  
- https://github.com/Sefaria/Sefaria-Project/blob/master/sefaria/export.py  
- https://github.com/Sefaria/Sefaria-Project/wiki/API-Documentation  
- https://github.com/Sefaria/translation-plugin  
- https://github.com/Sefaria/powered-by  
- https://github.com/Sefaria/text-eng-docs  
- Live probes: `/api/texts/translations/fr`, `/api/texts/versions/Rashi%20on%20Genesis`, `/api/texts/versions/Genesis`
