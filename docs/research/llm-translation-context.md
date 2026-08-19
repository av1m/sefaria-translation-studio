# Does extra context help or hurt LLM translation of a single literary/religious segment?

**Question.** When translating one Sefaria Ref to French from Hebrew/Aramaic (with optional English already available), does injecting extra context help or hurt? Evaluated separately: (1) neighboring segments, (2) parallel translations in other languages, (3) a terminology glossary, (4) a free-form translator “notes” field.

**Short answer.** Extra context helps **when it is labeled as non-source and kept small**. It hurts when it competes with the current source (unlabeled concatenation, extra full-text languages, English used as the *source* rather than a helper). For this project: Hebrew/Aramaic is the source; English is a labeled helper; previous 1–2 source segments as labeled context; glossary yes; extra languages (German, etc.) no; next-segment context only if explicitly tagged “do not translate.”

---

## 1. Neighboring segments (previous / next)

### What document-level NMT actually found

**Context is useful, but only for sparse discourse phenomena, and more is not better.**

Tiedemann and Scherrer (2017) showed that concatenating the previous sentence to the current one, with a sentence-break marker, lets a standard NMT model resolve some cross-sentence reference without architecture changes. Models “learn to distinguish information coming from different segments.” Evidence was encouraging but partly anecdotal. [Neural Machine Translation with Extended Context](https://aclanthology.org/W17-4811/) (DiscoMT 2017).

Agrawal, Turchi, and Negri (2018) added **next** (source) sentences as well as previous ones. They found that looking ahead plus looking behind beat previous-only context, especially for cataphora and gender agreement. They also warned that very long inputs hurt (citing Koehn and Knowles 2017) and that jointly decoding previous *target* text is “more prone to error propagation” as the window grows. [Contextual Handling in Neural Machine Translation: Look behind, ahead and on both sides](https://aclanthology.org/2018.eamt-main.1/) (EAMT 2018).

Kim, Tran, and Ney (2019) is the important counterweight. On general (not pronoun-targeted) test sets, **most BLEU gains from document-level models were not interpretable as using linguistic context** — they looked more like regularization from extra parameters. **Very long context (e.g. ten consecutive sentences) was not helpful.** A minimal encoding of context was enough. Concatenation also “worsens a fundamental problem of NMT: translating long inputs.” [When and Why is Document-level Context Useful in Neural Machine Translation?](https://aclanthology.org/D19-6503/) (DiscoMT 2019).

Castilho and colleagues measured how much context *humans* need. Over 33% of sentences needed more than the sentence itself to translate or evaluate; of those, 23% needed more than two previous sentences. Ambiguity, terminology, and gender agreement were the main issues; **needed span differed by domain** (reviews vs subtitles vs literature). So 1–2 previous sentences is the usual sweet spot, not a guarantee. [How Much Context Span is Enough?](https://aclanthology.org/2022.lrec-1.323.pdf) (LREC 2022); earlier span study: Castilho et al. 2020, LREC.

Miculicich et al. (2018) showed hierarchical attention over previous source *and* previous target translations improves lexical cohesion and pronouns — but that is a custom NMT architecture, not an LLM prompt. [Document-Level NMT with Hierarchical Attention Networks](https://ar5iv.labs.arxiv.org/html/1809.01576) (EMNLP 2018).

### The contamination / over-smoothing worry is real

Lupo, Dinarelli, and Besacier (2022) state the mechanism: concatenation “makes learning harder … by distracting attention.” Discourse phenomena that actually need context are **sparse**; most tokens should be translated from the current sentence alone. Their “context discounting” down-weights loss on context tokens so the model focuses on the current sentence. Vanilla concatenation trains the model to translate the whole window, then you *throw away* the context translation at inference — which is exactly the leakage pattern. [Focused Concatenation for Context-Aware NMT](https://aclanthology.org/2022.wmt-1.77/) (WMT 2022).

Sun, Wang, et al. (2023) call the same pattern **quality saturation**: performance does not keep growing as context size grows; Transformer quality declines on long concatenated inputs (also Liu et al. 2020; Bao et al. 2021). Distant context can leak as accumulated noise. [Document Flattening](https://aclanthology.org/2023.eacl-main.33.pdf) (EACL 2023).

Li, Liu, et al. (2024) make the LLM-specific version of this: decoder-only LLMs adapted by concatenating neighbors **treat inter-sentence and intra-sentence context with equal priority**, even though the current sentence “inherently contains richer parallel semantic information.” Naive concatenation can **hurt BLEU/COMET** on some directions even when discourse metrics improve. They argue the current sentence must be prioritized. [DeMPT](https://arxiv.org/html/2402.15200) (2024).

Tiedemann and Scherrer already distinguished two setups: concatenate previous source and translate **only the current** sentence (2-to-1) vs concatenate and translate **both** (2-to-2). Without an explicit “translate only this” instruction, models tend toward 2-to-2 — i.e. they translate the neighbors too. That is next/previous-segment leakage.

### What LLM literary-translation papers say

Karpinska and Iyyer (2023) is the closest primary study: GPT-3.5 translating literary paragraphs across 18 language pairs, evaluated by professional translators (~350 hours).

- Translating the **whole paragraph at once (PARA)** beat sentence-by-sentence with no context (SENT) at 71.67% human preference, with fewer mistranslations, grammar errors, and inconsistencies.
- Sentence-by-sentence **with the rest of the paragraph as tagged context (PARA_SENT)** was worse than PARA (PARA preferred 66.67%). PARA_SENT left ~22% more words untranslated and **occasionally repeated sentences**.
- PARA still **omits content** more than SENT; critical errors persist; a human translator remains necessary.
- They tagged the sentence to translate with XML-like markers inside the paragraph.

Source: [Large Language Models Effectively Leverage Document-level Context for Literary Translation, but Critical Errors Persist](https://aclanthology.org/2023.wmt-1.41/) (WMT 2023); [arXiv:2304.03245](https://arxiv.org/abs/2304.03245).

Wang, Lyu, et al. (2023) compared ChatGPT document prompts. Sentence-by-sentence in one chat (so previous turns are context), vs concatenating several sentences in one turn, with or without `[]` sentence-boundary tags. All three worked; concatenating **without** boundary tags scored best on most automatic metrics, but ChatGPT **sometimes forgot the boundary tags and merged sentences**. Human eval favored GPT-4 over commercial MT on coherence even when d-BLEU did not. ChatGPT was **unstable**: omissions and copying. [Document-Level Machine Translation with Large Language Models](https://aclanthology.org/2023.emnlp-main.1036/) (EMNLP 2023); [arXiv:2304.02210](https://arxiv.org/abs/2304.02210).

Wu, Ma, et al. (2024) fine-tuned LLMs with **three preceding sentence pairs** as context. Using previously generated translations as context (REUSE) caused **error propagation and high off-target (wrong-language) rates**; regenerating context (REGEN) reduced that at extra cost. [Adapting Large Language Models for Document-Level Machine Translation](https://arxiv.org/html/2401.06468v3) (2024).

On the exact domain (Hebrew–Aramaic Talmud → Italian), Bellandi et al. (2025) found TM-style **similar already-translated pairs** in the prompt beat a bare LLM on 79% of 300 segments (SacreBLEU 11.1 → 35.8). That is *retrieved parallel examples*, not unlabeled neighboring verses. Prompt: role + labeled `SOURCE=` / `TARGET=` pairs + “Write only the translation of {segment}.” [Experiments on the Use of LLMs for the Translation of the Babylonian Talmud](https://aiucd2025.dlls.univr.it/assets/pdf/papers/58.pdf).

### Official MT product behavior

DeepL’s `context` parameter is designed as **surrounding content that is not translated**. Official docs: use it for ambiguous words, gender, short snippets; **do not** put instructions, glossary rules, or “translate with a friendly tone” there — that “does not work reliably.” Context is “like showing a human translator the paragraphs before and after.” Characters in `context` are not billed and are not emitted. Each `text` item is translated independently and does **not** share context with other items in the same request. [How to Use the Context Parameter](https://developers.deepl.com/docs/learning-how-tos/examples-and-guides/how-to-use-context-parameter); [Translate API](https://developers.deepl.com/api-reference/translate/request-translation.md).

Google Cloud Translation Advanced similarly treats glossary and document context as first-class, separate from the string being translated. [Creating and using glossaries](https://docs.cloud.google.com/translate/docs/advanced/glossary).

### Verdict on neighbors

| Input | Effect | Condition |
| --- | --- | --- |
| 1 previous **source** sentence, labeled “context, do not translate” | Helps pronouns, gender, cohesion | Default yes |
| 2 previous source sentences | Helps a minority of literary cases | Optional; diminishing returns |
| Previous **target** (already approved French) | Helps terminology consistency | Yes if it exists; risk of error propagation if it was a prior LLM draft (Wu et al. 2024) |
| Next source sentence, unlabeled | Risk of translating it into the current output | Do not dump unlabeled |
| Next source sentence, labeled “upcoming, do not translate” | Can help cataphora (Agrawal 2018) | Optional, low priority |
| Whole paragraph / many verses concatenated as if they were the source | Helps if you *want* a multi-verse translation (Karpinska PARA); hurts if you need one Ref | Do not, for single-Ref Studio |

---

## 2. Parallel translations in other languages (multi-source / English pivot)

### Multi-source NMT: triangulation can help — in trained systems

Kay’s “triangulation” idea: a second translation of the same sentence reduces ambiguity (e.g. English *bank* + German *Flussufer* → French *rive*). Zoph and Knight (2016) trained P(English | French, German) on trilingual data and got up to **+4.8 BLEU** over a strong single-source attention baseline. **Two copies of the same French input gave no gain.** Gains were **larger when the two sources were more distant** (FR+DE → EN beat EN+FR → DE). This is a custom multi-encoder, not a prompt. [Multi-Source Neural Translation](https://aclanthology.org/N16-1004.pdf) (NAACL 2016).

Dabre, Chu, and Kurohashi (2017) simply concatenated the same sentence in several languages into one long source (“Hello Bonjour Namaskar…”) and trained ordinary NMT. Up to +4 BLEU with 2 sources, +6 with 5, in their settings. They used **no language delimiters** and hoped the model would infer boundaries — that is acceptable for a model trained on that format, not a recommendation for an off-the-shelf LLM. [Enabling Multi-Source NMT By Concatenating Source Sentences In Multiple Languages](https://aclanthology.org/2017.mtsummit-papers.8.pdf) (MT Summit 2017).

Garmash and Monz (2016) ensembled separate FR→EN and DE→EN systems; a **gating network** that weights experts per decoding step beat uniform mixing. Complementary errors across language pairs is the linguistic justification. [Ensemble Learning for Multi-Source NMT](https://aclanthology.org/C16-1133.pdf) (COLING 2016).

Och and Ney (2001) already did statistical multi-source MT. The whole line of work assumes **aligned translations of the same sentence**, not neighbors, and systems **trained** to combine them.

### English as pivot vs translating from the source

Pivot (source → English → target) is the classic fallback when direct parallel data is scarce. Utiyama and Isahara (2007) compared pivot methods for phrase-based SMT. Zhang, Williams, Titov, and Sennrich (2020) found that in massively multilingual NMT, **off-target translation** (output in the wrong language) is the main failure of zero-shot pairs; their improved multilingual models approached conventional **pivot-based** quality. [Improving Massively Multilingual NMT and Zero-Shot Translation](https://aclanthology.org/2020.acl-main.148/) (ACL 2020).

Yang, Ma, et al. (2023) report average **off-target rates of 29%** on 90 zero-shot directions (up to 95% on some pairs) when the target-language signal is weak, and a correlation with lexical similarity between languages. [On the Off-Target Problem of Zero-Shot Multilingual NMT](https://aclanthology.org/2023.findings-acl.608.pdf).

For **LLMs translating literature**, Karpinska and Iyyer (2023) explicitly tried a non-English→non-English setup with English as pivot (source + English translation in the prompt). **“After manual evaluation … we found no significant benefit in using English as the pivot. Consequently, we directly translated paragraphs into the target language.”** (footnote 13 / §H). That is the most relevant literary-LLM result: English as a second full text did not help GPT-3.

Using English as the *only* source (ignore Hebrew) is a different, worse failure: pivot translation is repeatedly associated with style flattening, lost markedness, and inherited pivot errors (translation-studies literature, e.g. quality loss in pivot subtitling; see also the discussion in [Investigating the Impact of Different Pivot Languages](https://aclanthology.org/2022.amta-wetpr.3.pdf), AMTA 2022). For Sefaria this is acute: the English of Rashi, Bavli, etc. is often **interpretive / expanded**, not a literal stand-in for the Hebrew/Aramaic. Pivoting through it would translate the English commentary, not the source.

### Mixing extra languages in an LLM prompt

There is no strong primary paper showing that dumping German+English+Hebrew into a GPT-style prompt improves French. The closest positive evidence is trained multi-source NMT (above). The closest negative evidence:

- Off-target / language confusion when the target-language instruction is weak (Zhang et al. 2020; Yang et al. 2023).
- Wu et al. 2024: document-level LLM decoding with reused context raised **off-target rates**.
- Google AI prompting docs: mixed-language inputs need **explicit language labels** and a hard “respond only in {target}” constraint; Gemma users report mixed-script output even with strict target-language prompts ([Gemma mixed-language reports](https://discuss.ai.google.dev/t/query-on-mixed-language-outputs-in-the-google-gemma-3n-4b-it-model/108252)).
- Gemini Live API: if the model must respond in a non-English language, official advice is an imperative: `RESPOND IN {OUTPUT_LANGUAGE}. YOU MUST RESPOND UNMISTAKABLY IN {OUTPUT_LANGUAGE}.` [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices).

**Verdict.** Do **not** treat extra full-text languages as free quality. One high-quality helper (English, labeled as reference, not source) is the only extra language worth the contamination risk. German/French-from-elsewhere of the same verse is a research extra, not a default.

---

## 3. Glossary / constrained terms

**This is the most reliable extra context of the four.** Industry MT and LLM papers agree: a small, relevant term list beats another parallel language.

### LLM prompting (soft constraints)

Ghazvininejad, Gonen, and Zettlemoyer (2023) append dictionary hints to the prompt:

> Translate the following sentence to English: \<source\>  
> In this context, the word X means Y …

DiPMT improved low-resource and out-of-domain MT; higher dictionary coverage helped; not every hint is used, so this is **soft** control. They cap hints (they drop extras when a word has >3 senses). [Dictionary-based Phrase-level Prompting of LLMs for MT](https://arxiv.org/abs/2302.07856) (arXiv 2302.07856).

Moslem, Haque, Kelleher, and Way (2023) compared zero-shot vs glossary vs fuzzy TM matches with GPT-3.5 on TICO-19 (including **EN→FR**). Glossary terms in the prompt improved quality in zero-shot **across all five language pairs**. Human eval (EN-AR, EN-ES, EN-FR): glossary raised term adherence. Fuzzy TM matches helped more than random few-shot. They used **at most 5–10 terms that actually occur in the source**, not a dump of the whole glossary. Prompt pattern: labeled language names (`English:` / `French:`) plus a term list. [Adaptive Machine Translation with Large Language Models](https://aclanthology.org/2023.eamt-1.22/) (EAMT 2023); [arXiv:2301.13294](https://arxiv.org/abs/2301.13294).

Bogoychev, Chen, et al. (2023) compared constrained decoding vs LLM prompting for WMT23 terminology: hard constraints **guarantee** the term but “often result in less fluent output, especially for morphologically rich languages”; LLM prompting rewrites the glossary as natural text (following Ghazvininejad). French is morphologically richer than English — soft prompt constraints are the right default for an LLM, not finite-state forced decoding. [Terminology-Aware Translation with Constrained Decoding and LLM Prompting](https://aclanthology.org/2023.wmt-1.80.pdf) (WMT 2023).

Hasler et al. (2018) and Post and Vilar (2018) are the classic NMT constrained-decoding papers: terminology can be forced, at a fluency cost. [NMT Decoding with Terminology Constraints](https://aclanthology.org/N18-2081.pdf); [Fast Lexically Constrained Decoding](https://aclanthology.org/N18-1119.pdf).

### Official MT products

- **Google Cloud Translation**: glossaries are a first-class API object; Translation LLM supports a **contextual glossary** flag so terms are applied with sentence context rather than blind replace. [Creating and using glossaries](https://docs.cloud.google.com/translate/docs/advanced/glossary).
- **DeepL**: glossaries are for “exact translations for specific terms”; `custom_instructions` are for tone; `context` is for surrounding text. They **separate** these on purpose. [Customization overview](https://developers.deepl.com/docs/customize/overview); [Glossaries](https://developers.deepl.com/docs/customize/glossaries-in-the-real-world).

### Verdict vs extra languages

A glossary is a **many-to-one mapping the user already approved**. A German translation of the same verse is a **competing full hypothesis** the model may copy, mix, or over-smooth toward. Glossary wins on reliability. Filter to terms that appear in *this* source segment (Moslem; Ghazvininejad).

---

## 4. Free-form translator “notes”

This is specification / style instruction, not extra source text.

Kayano and Sugawara (2025, WMT) argue professional translation is specification-driven (ISO 17100 / ISO 11669; Skopos). LLM outputs **guided by explicit specs** (purpose, audience, style, constraints) beat unguided LLM and, in their IR-text study, even official human translations on human preference — while they warn prompts must “prevent hallucination and over-generation.” [Specification-Aware Machine Translation and Evaluation for Purpose Alignment](https://aclanthology.org/2025.wmt-1.7/) (WMT 2025).

DeepL’s official split: notes that are **rules** belong in `custom_instructions` (max 10 × 300 characters in the API); notes that are **surrounding document text** belong in `context`; notes that are **term mappings** belong in a glossary. Mixing them into `context` is unsupported. [DeepL context guide](https://developers.deepl.com/docs/learning-how-tos/examples-and-guides/how-to-use-context-parameter); [Translate API `custom_instructions`](https://developers.deepl.com/api-reference/translate/request-translation.md).

Anthropic: XML tags so the model can tell instructions from documents; “wrapping each type of content in its own tag reduces misinterpretation.” [Claude 4 prompt best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices).

Gemini: “Use consistent structure. Employ clear delimiters … XML-style tags … Place essential behavioral constraints … in the System Instruction.” For long context, put data first and the task last. [Gemini prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies).

**Verdict.** A short notes field **helps** if it is imperative and scoped (“use *tu*; keep divine names as *l’Éternel*; do not expand midrash”). A long essay of commentary **hurts** if it looks like another source the model might translate or quote. Cap length; put it in `<notes>`, not inside `<source>`.

---

## 5. Combinations and the “confusion” worry

The user’s fear (extra languages + neighbors confuse the model) is supported in this form:

1. **Unlabeled concatenation** equalizes attention across current sentence, neighbors, and other-language strings (DeMPT 2024; Lupo 2022; Kim 2019).
2. **Multiple full texts of the same meaning** can triangulate in a *trained* multi-source NMT system (Zoph & Knight 2016) but showed **no significant literary-LLM gain** for English-as-pivot (Karpinska 2023).
3. **Wrong-language output** rises when target-language signal is weak or when generated context is reused (Zhang 2020; Wu 2024).
4. **Next-segment leakage** is the 2-to-2 problem: if neighbors are not marked “do not translate,” models translate them or merge them (Tiedemann 2017; Wang 2023 boundary-tag forgetting; Karpinska PARA_SENT repetition).
5. **Glossary + TM examples** stack well (Moslem 2023; Talmud TM+LLM 2025). Glossary + unlabeled German+neighbors is the combination most likely to over-smooth.

Safe stack for one Ref: **source + labeled English helper + 1 previous source segment + filtered glossary + short notes.**  
Unsafe stack: **Hebrew + English + German + prev + next, all as undifferentiated text.**

---

## 6. Practical prompt recommendations (LLM, not custom NMT)

### How much neighbor context

- Default: **one previous source segment** (the prior verse/comment in the same work), tagged as context, not translated.
- Optional: a second previous segment, or the previous **approved French** of this work (not an unreviewed LLM draft).
- Next segment: off by default. If on, tag as `<upcoming do_not_translate="true">`. Useful mainly when the current segment has a cataphor (“this is what he meant:”) that is resolved in the next comment.
- Do not send a whole chapter unless the user asked to translate that range (Karpinska PARA is for translating the paragraph itself).

### English: helper, not source

- Always translate **from Hebrew/Aramaic**.
- If English exists, include it as `<reference xml:lang="en">` with an instruction: “Use this to resolve ambiguity; do not translate the English; if English expands or interprets beyond the source, follow the source.”
- Do not pivot (Hebrew→English→French) as a two-step pipeline unless the model cannot read the source at all.
- Do not add German/Yiddish/etc. by default.

### How to label languages so they don’t mix

Follow Anthropic/Gemini delimiter practice and Moslem’s `English:` / `French:` labels:

- Name languages in the instruction **and** on every block (`xml:lang` or an explicit header).
- System constraint: output **only** French for this segment; no Hebrew, no English, no preamble.
- Gemini-style imperative if mixing still happens: respond unmistakably in French.
- Prefill / stop sequences: start the assistant with `French:` or `<translation xml:lang="fr">` so continuation stays in-language (Anthropic prefill pattern).

### Next-segment leakage

Mitigations that follow from the papers and vendor docs:

1. Separate tags: `<source>` vs `<context>` vs `<upcoming>`.
2. Explicit: “Translate only `<source>`. Context is for disambiguation and must not appear in the output.”
3. Ask for a single segment, not a list.
4. After generation, reject output that contains distinctive n-grams from the next source verse (cheap leakage check).
5. Prefer previous context over next (Agrawal’s cataphora gain is smaller than the leakage risk for verse-by-verse Studio).

---

## Recommendation for Studio

Studio translates **one Sefaria Ref to French**. Sources: Hebrew/Aramaic plus optional English. User concern: neighbors + extra languages will confuse the model.

### Do

- Treat **Hebrew/Aramaic as the only source**.
- Include **English of the same Ref** when present, labeled as a reference/helper, never as the text to render.
- Include **at most 1–2 previous source segments** (same Index), labeled context, not translated. Prefer previous over next.
- If a previous **human-approved** French exists for this work, include that one segment for cohesion.
- Inject a **filtered glossary** (only terms that match this source), as `source_term → french_term` lines.
- Include a **short notes** field as instructions (tone, divine names, *tu/vous*, “do not expand”).
- Use XML (or equivalent) delimiters; demand French-only output of the current Ref.

### Don’t

- Don’t concatenate prev/current/next as one source string.
- Don’t add extra full-text languages (German, etc.) of the same segment.
- Don’t translate from English while merely “checking” the Hebrew.
- Don’t dump the whole glossary or a long commentary into the prompt.
- Don’t feed unreviewed LLM French back in as context (error propagation / off-target).
- Don’t ask the model to translate the next verse “for context.”

### Default prompt recipe

```text
SYSTEM:
You are translating a single segment of a Jewish source text into French.
Translate ONLY the contents of <source>. Output only the French translation,
with no preamble, no quotation of the source, and no other languages.

Rules:
- <source> is authoritative (Hebrew or Aramaic).
- <reference> is an existing English rendering of the SAME segment. Use it to
  resolve ambiguity. Do not translate the English. If it interprets or expands
  beyond <source>, follow <source>.
- <context> and <upcoming> are neighboring segments. Use them only for
  pronouns, gender, deixis, and lexical consistency. Do not translate them
  and do not leak their content into the output.
- <glossary> terms that appear in <source> must be used in the French.
- <notes> are translator constraints (style, names, register). Obey them.
- Do not add midrash, explanation, or missing words that are not implied by <source>.

USER:
<task>Translate <source> into French.</task>

<notes>
{{notes or "Literary/religious register; keep proper names in their established French forms."}}
</notes>

<glossary>
{{term_he}} → {{term_fr}}
…
</glossary>

<context xml:lang="he" role="previous" do_not_translate="true">
{{previous source segment or omit}}
</context>

<source xml:lang="he" ref="{{sefaria_ref}}">
{{hebrew_or_aramaic}}
</source>

<reference xml:lang="en" role="helper" do_not_translate="true">
{{english of the same ref or omit this block}}
</reference>

<upcoming xml:lang="he" role="next" do_not_translate="true">
{{omit by default}}
</upcoming>
```

Assistant prefill (optional): `<translation xml:lang="fr">`

**Omit by default:** extra languages; next segment; more than two previous segments; unapproved model French; glossary rows that do not match this source.

**If quality is still weak:** add 1–3 TM-style few-shot pairs (same work, already approved French), labeled `SOURCE`/`TARGET`, as in the Talmud CAT experiment — not more languages.
