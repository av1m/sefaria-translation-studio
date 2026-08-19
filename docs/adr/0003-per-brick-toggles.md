# Per-brick context toggles

## Context

Translators need to compare Drafts with different context (neighbors off, glossary off, etc.) without retyping the Ref each time.

## Decision

The context pack is not one switch. Previous Segments, each Helper language, glossary, and notes each have their own toggle. Defaults are on (English Helper when available; glossary only when it has terms for this Ref).

## Why

A single on/off would force an all-or-nothing choice and make A/B comparison awkward. Defaults on avoid making users re-enable “normal” context on every URL.
