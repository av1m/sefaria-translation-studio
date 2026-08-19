export interface ContextPack {
  previousSegments?: string[];
  helpers?: { lang: string; text: string | string[] }[];
  glossary?: { source: string; french: string }[];
  notes?: string;
}

export interface DraftRequest {
  ref: string;
  source: string | string[];
  contextPack: ContextPack;
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

const SYSTEM_PROMPT = `You are translating a single segment of a Jewish source text into French.
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
- Reproduce HTML markup (bold, italic) from the source. NEVER invent new HTML tags.`;

export function assemblePrompt(
  source: string,
  contextPack: ContextPack,
  ref: string,
): LlmMessage {
  const parts: string[] = [];

  parts.push(`<task>Translate <source> into French.</task>`);

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
    `\n<source xml:lang="he" ref="${ref}">\n${source}\n</source>`,
  );

  if (contextPack.helpers && contextPack.helpers.length > 0) {
    for (const helper of contextPack.helpers) {
      const text = Array.isArray(helper.text)
        ? helper.text.join("\n")
        : helper.text;
      parts.push(
        `\n<reference xml:lang="${helper.lang}" role="helper" do_not_translate="true">\n${text}\n</reference>`,
      );
    }
  }

  return { system: SYSTEM_PROMPT, user: parts.join("\n") };
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

  const drafts: string[] = [];
  for (const src of sources) {
    const prompt = assemblePrompt(src, request.contextPack, request.ref);
    const result = await llmCaller(prompt, request.llmConfig);
    drafts.push(result);
  }

  return { ref: request.ref, drafts };
}
