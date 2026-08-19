import { generateDraft } from "@/lib/draft-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ref, source, original, contextPack, llmConfig, targetLanguage } = body;

    if (!ref || !source) {
      return Response.json(
        { error: "Missing ref or source" },
        { status: 400 },
      );
    }

    const config = {
      provider: llmConfig?.provider || process.env.LLM_PROVIDER || "openai",
      model: llmConfig?.model || process.env.LLM_MODEL || "gpt-5.6-terra",
      apiKey: llmConfig?.apiKey || process.env.LLM_API_KEY || "",
    };

    if (!config.apiKey) {
      return Response.json(
        { error: "No LLM API key configured. Set LLM_API_KEY in .env.local" },
        { status: 500 },
      );
    }

    const result = await generateDraft({
      ref,
      source,
      original,
      contextPack: contextPack ?? {},
      targetLanguage: targetLanguage ?? "fr",
      llmConfig: config,
    });

    return Response.json({ drafts: result.drafts });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
