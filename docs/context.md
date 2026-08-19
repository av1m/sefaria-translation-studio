# Domain terms

Vocabulary used in the app and in this repo when talking about Sefaria data.

## Ref

A Sefaria citation for a span of text (e.g. `Mishnah Peah 8:1`, `Berakhot 3a:5`). Users paste a Sefaria URL or type a Ref directly.

## Segment

The smallest addressable unit of an Index: a mishnah, a Talmud line, a single Rashi comment, etc.

## Comment

One item in the list of texts at the same Ref (e.g. three Rashi comments on `Genesis 1:1`). A Ref with *N* comments produces *N* Drafts, in the same order.

## Section

The parent unit of Segments (chapter, daf, etc.). The app can work on one Ref, a whole Section, or an entire Index.

## Index

A book in the Sefaria library with one shared structure across all its Versions (e.g. `Mishnah Peah`, `Berakhot`).

## Draft

Target-language text produced for a Comment or single-block Segment, not yet human-reviewed. Editing in the app before saving to the Version file does not count as review.

## Version file

A local file in Sefaria import format (JSON or CSV), one per Index and target language, updated as the user saves Refs.

## Primary

The Version used as Source for a Ref. Default: the one Sefaria marks as source (`isPrimary`), usually Hebrew, Aramaic, or Yiddish. The user can pick another from a collapsed selector.

## Source

The Ref’s text in the Primary language. This is what gets translated, not a Helper.

## Helper

Another Version of the same Ref in a different language, shown for reference only (“do not translate”). English is on by default when present; other languages are optional toggles.

## Gap

This Segment has no target-language text on Sefaria yet. Gap is checked at Ref grain: a partially translated Index can still have Gaps elsewhere.

## Context pack

Optional material sent with the Source to the LLM: previous Segments, Helpers, glossary hits for this Ref, and translator notes. Each piece has its own toggle; all default on (glossary omitted when empty).

## Glossary

Hand-maintained source-term → French mappings, filtered to terms that appear in the current Ref. French-only in v1.
