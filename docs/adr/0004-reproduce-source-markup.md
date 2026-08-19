# Reproduce Source markup in Drafts

## Context

Commentary text often uses HTML (e.g. `<b>` on a Rashi lemma). Readers expect the same structure in the Draft.

## Decision

Preserve HTML tags from the Source in the Draft. Do not add tags that were not in the Source. Enforced in the DraftEngine system prompt.

## Why

Stripping markup to plain text (`text_only`) loses the visual link between lemma and gloss. Letting the model invent tags would misrepresent the Source.
