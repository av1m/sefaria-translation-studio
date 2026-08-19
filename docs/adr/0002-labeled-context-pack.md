# Labeled context pack, togglable helpers

## Context

Draft quality depends on neighbors, English parallel text, glossary, and notes — but dumping extra languages into the prompt without labels tends to leak neighbor text into the Draft or dilute attention on the Source.

## Decision

The LLM translates only the Source block. Everything else (1–2 previous Segments, English Helper, glossary for this Ref, notes) is optional context with explicit XML roles and `do_not_translate` markers. Other language Versions are Helpers the user turns on; they are not stacked by default.

## Why

Unlabeled concatenation and multiple parallels are a common failure mode for LLMs on this task. See [research/llm-translation-context.md](../research/llm-translation-context.md) for the literature review.
