import { describe, it, expect, beforeEach } from "vitest";
import {
  assemblePrompt,
  generateDraft,
  LlmCaller,
  DraftRequest,
} from "../draft-engine";

const stubCaller: LlmCaller = async (messages) => {
  (stubCaller as any).lastMessages = messages;
  (stubCaller as any).callCount = ((stubCaller as any).callCount || 0) + 1;
  return "Traduction française";
};

function lastPrompt() {
  return (stubCaller as any).lastMessages as { system: string; user: string };
}

function resetStub() {
  (stubCaller as any).callCount = 0;
  (stubCaller as any).lastMessages = undefined;
}

const baseLlmConfig = { provider: "openai", model: "gpt-4o", apiKey: "sk-test" };

describe("assemblePrompt", () => {
  it("single source includes <source> with Hebrew text", () => {
    const { user } = assemblePrompt("בראשית ברא", {}, "Genesis.1.1");
    expect(user).toContain("<source xml:lang=\"he\" ref=\"Genesis.1.1\">");
    expect(user).toContain("בראשית ברא");
  });

  it("includes <reference> block for English helper", () => {
    const { user } = assemblePrompt("בראשית", {
      helpers: [{ lang: "en", text: "In the beginning" }],
    }, "Genesis.1.1");
    expect(user).toContain('<reference xml:lang="en" role="helper" do_not_translate="true">');
    expect(user).toContain("In the beginning");
  });

  it("omits <reference> when helpers undefined", () => {
    const { user } = assemblePrompt("בראשית", {}, "Genesis.1.1");
    expect(user).not.toContain("<reference");
  });

  it("includes <context> for previous segments", () => {
    const { user } = assemblePrompt("בראשית", {
      previousSegments: ["וַיְהִי עֶרֶב"],
    }, "Genesis.1.1");
    expect(user).toContain('<context xml:lang="he" role="previous" do_not_translate="true">');
    expect(user).toContain("וַיְהִי עֶרֶב");
  });

  it("omits <context> when no previous segments", () => {
    const { user } = assemblePrompt("בראשית", {}, "Genesis.1.1");
    expect(user).not.toContain("<context");
  });

  it("includes <glossary> with matching terms", () => {
    const { user } = assemblePrompt("בראשית", {
      glossary: [{ source: "בראשית", french: "Au commencement" }],
    }, "Genesis.1.1");
    expect(user).toContain("<glossary>");
    expect(user).toContain("בראשית → Au commencement");
  });

  it("omits <glossary> when empty", () => {
    const { user } = assemblePrompt("בראשית", { glossary: [] }, "Genesis.1.1");
    expect(user).not.toContain("<glossary>");
  });

  it("includes <notes> when provided", () => {
    const { user } = assemblePrompt("בראשית", {
      notes: "Use vous form",
    }, "Genesis.1.1");
    expect(user).toContain("<notes>");
    expect(user).toContain("Use vous form");
  });

  it("omits <notes> when empty", () => {
    const { user } = assemblePrompt("בראשית", {}, "Genesis.1.1");
    expect(user).not.toContain("<notes>");
  });

  it("system prompt mentions reproducing HTML tags", () => {
    const { system } = assemblePrompt("בראשית", {}, "Genesis.1.1");
    expect(system).toContain("HTML");
    expect(system).toMatch(/[Rr]eproduce.*HTML/);
  });

  it("ref appears in source block attribute", () => {
    const { user } = assemblePrompt("בראשית", {}, "Rashi.Genesis.1.1.1");
    expect(user).toContain('ref="Rashi.Genesis.1.1.1"');
  });
});

describe("generateDraft", () => {
  beforeEach(resetStub);

  it("returns 1 draft for single source", async () => {
    const req: DraftRequest = {
      ref: "Genesis.1.1",
      source: "בראשית ברא",
      contextPack: {},
      targetLanguage: "fr",
      llmConfig: baseLlmConfig,
    };
    const result = await generateDraft(req, stubCaller);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]).toBe("Traduction française");
    expect(result.ref).toBe("Genesis.1.1");
  });

  it("handles multi-comment with 3 sources", async () => {
    const req: DraftRequest = {
      ref: "Rashi.Genesis.1.1",
      source: ["comment1", "comment2", "comment3"],
      contextPack: {},
      targetLanguage: "fr",
      llmConfig: baseLlmConfig,
    };
    const result = await generateDraft(req, stubCaller);
    expect(result.drafts).toHaveLength(3);
    expect((stubCaller as any).callCount).toBe(3);
  });
});
