# Gap at Ref grain, not Index grain

## Context

Sefaria can have a French (or other) Version for an Index while many Segments inside it are still empty. The Studio should only refuse to draft when **this** Segment already has target-language text on Sefaria.

## Decision

Treat a Gap at **Ref** grain: block drafting only if the current Segment already has the chosen target language. Allow work on other Segments in the same Index.

## Why

Refusing at Index grain would stop translation of Berakhot or the Mishnah as soon as any `[fr]` Version exists, even when most Segments are still untranslated.
