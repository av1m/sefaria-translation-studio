export interface ContextPack {
  previousSegments?: string[];
  helpers?: { lang: string; text: string | string[] }[];
  glossary?: { source: string; french: string }[];
  notes?: string;
}

export interface DraftRequest {
  ref: string;
  source: string | string[];
  original?: string | string[];
  contextPack: ContextPack;
  targetLanguage: string; // actualLanguage (e.g. "fr", "es", ...)
  llmConfig: {
    provider: string;
    model: string;
    apiKey: string;
  };
}

export interface DraftResult {
  ref: string;
  drafts: string[];
}

export interface LlmMessage {
  system: string;
  user: string;
}

export type LlmCaller = (
  messages: LlmMessage,
  config: DraftRequest["llmConfig"],
) => Promise<string>;

const TARGET_LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

function getTargetLanguageName(actualLanguage: string): string {
  return TARGET_LANGUAGE_NAMES[actualLanguage] ?? actualLanguage;
}

function buildSystemPrompt(opts: {
  targetLanguageName: string;
  includeGlossaryRule: boolean;
}): string {
  const { targetLanguageName, includeGlossaryRule } = opts;
  return `You are translating a single segment of a Jewish source text into ${targetLanguageName}.
Translate ONLY the contents of <source>. Output only the ${targetLanguageName} translation,
with no preamble, no quotation of the source, and no other languages.

Rules:
- <source> is the text to translate. It may be English (a scholarly rendering)
  or Hebrew/Aramaic (the original).
- When <source> is English, translate it faithfully into ${targetLanguageName}. Use <original>
  (the Hebrew/Aramaic) to verify transliterations, proper nouns, and technical
  terms, but follow the English structure and meaning.
- When <source> is Hebrew/Aramaic, use <reference> (English) to resolve
  ambiguity. If <reference> interprets or expands beyond <source>, follow <source>.
- <context> and <upcoming> are neighboring segments. Use them only for
  pronouns, gender, deixis, and lexical consistency. Do not translate them
  and do not leak their content into the output.
${includeGlossaryRule ? `- <glossary> terms that appear in <source> must be used in the ${targetLanguageName}.` : ""}
- <notes> are translator constraints (style, names, register). Obey them.
- Do not add midrash, explanation, or missing words that are not implied by <source>.
- Reproduce HTML markup (bold, italic) from the source. NEVER invent new HTML tags.`;
}

export function assemblePrompt(
  source: string,
  contextPack: ContextPack,
  ref: string,
  original?: string,
  targetLanguage: string = "fr",
): LlmMessage {
  const parts: string[] = [];
  const sourceLang = original ? "en" : "he";
  const targetLanguageName = getTargetLanguageName(targetLanguage);
  const includeGlossaryRule =
    !!contextPack.glossary && contextPack.glossary.length > 0;

  parts.push(
    `<task>Translate <source> into ${targetLanguageName}.</task>`,
  );

  if (contextPack.notes) {
    parts.push(`\n<notes>\n${contextPack.notes}\n</notes>`);
  }

  if (contextPack.glossary && contextPack.glossary.length > 0) {
    const lines = contextPack.glossary
      .map((g) => `${g.source} → ${g.french}`)
      .join("\n");
    parts.push(`\n<glossary>\n${lines}\n</glossary>`);
  }

  if (contextPack.previousSegments && contextPack.previousSegments.length > 0) {
    const prev = contextPack.previousSegments.join("\n");
    parts.push(
      `\n<context xml:lang="he" role="previous" do_not_translate="true">\n${prev}\n</context>`,
    );
  }

  parts.push(
    `\n<source xml:lang="${sourceLang}" ref="${ref}">\n${source}\n</source>`,
  );

  if (original) {
    parts.push(
      `\n<original xml:lang="he" role="verify" do_not_translate="true">\n${original}\n</original>`,
    );
  }

  if (contextPack.helpers && contextPack.helpers.length > 0) {
    for (const helper of contextPack.helpers) {
      if (original && helper.lang === "en") continue;
      const text = Array.isArray(helper.text)
        ? helper.text.join("\n")
        : helper.text;
      parts.push(
        `\n<reference xml:lang="${helper.lang}" role="helper" do_not_translate="true">\n${text}\n</reference>`,
      );
    }
  }

  const system = buildSystemPrompt({
    targetLanguageName,
    includeGlossaryRule,
  });

  return { system, user: parts.join("\n") };
}

export const defaultLlmCaller: LlmCaller = async (messages, config) => {
  if (config.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
    });
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (config.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: messages.system,
        messages: [{ role: "user", content: messages.user }],
      }),
    });
    const data = await res.json();
    return data.content[0].text;
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
};

export async function generateDraft(
  request: DraftRequest,
  llmCaller: LlmCaller = defaultLlmCaller,
): Promise<DraftResult> {
  const sources = Array.isArray(request.source)
    ? request.source
    : [request.source];
  const originals = request.original
    ? Array.isArray(request.original)
      ? request.original
      : [request.original]
    : undefined;

  const drafts: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const prompt = assemblePrompt(
      sources[i],
      request.contextPack,
      request.ref,
      originals?.[i],
      request.targetLanguage,
    );
    const result = await llmCaller(prompt, request.llmConfig);
    drafts.push(result);
  }

  return { ref: request.ref, drafts };
}
