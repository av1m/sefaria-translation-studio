import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VersionFileStore } from "../version-file-store";

describe("VersionFileStore", () => {
  let dir: string;
  let store: VersionFileStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "vfs-test-"));
    store = new VersionFileStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("save + load round-trip with single-text ref", async () => {
    await store.save("Genesis", "Genesis 1:1", "In the beginning", "fr");
    const data = await store.load("Genesis", "fr");
    expect(data).not.toBeNull();
    expect(data!.segments["Genesis 1:1"]).toBe("In the beginning");
    expect(data!.indexTitle).toBe("Genesis");
  });

  it("save + load with multi-Comment ref preserves array order", async () => {
    const drafts = ["Comment 1", "Comment 2", "Comment 3"];
    await store.save("Rashi on Genesis", "Rashi on Genesis 1:1", drafts, "fr");
    const data = await store.load("Rashi on Genesis", "fr");
    expect(data!.segments["Rashi on Genesis 1:1"]).toEqual(drafts);
  });

  it("save does NOT overwrite other refs", async () => {
    await store.save("Genesis", "Genesis 1:1", "First", "fr");
    await store.save("Genesis", "Genesis 1:2", "Second", "fr");
    const data = await store.load("Genesis", "fr");
    expect(data!.segments["Genesis 1:1"]).toBe("First");
    expect(data!.segments["Genesis 1:2"]).toBe("Second");
  });

  it("save same ref twice does NOT overwrite the first", async () => {
    await store.save("Genesis", "Genesis 1:1", "Original", "fr");
    await store.save("Genesis", "Genesis 1:1", "Replacement", "fr");
    const data = await store.load("Genesis", "fr");
    expect(data!.segments["Genesis 1:1"]).toBe("Original");
  });

  it("exportCSV produces correct Sefaria format", async () => {
    await store.save("Genesis", "Genesis 1:1", "Au commencement", "fr");
    await store.save("Genesis", "Genesis 1:2", "La terre était", "fr");
    const csv = await store.exportCSV("Genesis", "fr");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Index Title,Genesis");
    expect(lines[1]).toContain("Version Title,Sefaria Translation Studio [fr]");
    expect(lines[2]).toBe("Language,en");
    expect(lines[4]).toBe("Version Notes,");
    expect(lines[5]).toBe("Genesis 1:1,Au commencement");
    expect(lines[6]).toBe("Genesis 1:2,La terre était");
  });

  it("exportCSV multi-Comment uses sub-Ref numbering", async () => {
    await store.save(
      "Rashi on Genesis",
      "Rashi on Genesis 1:1",
      ["A", "B", "C"],
      "fr",
    );
    const csv = await store.exportCSV("Rashi on Genesis", "fr");
    const lines = csv.split("\n");
    expect(lines[5]).toBe("Rashi on Genesis 1:1:1,A");
    expect(lines[6]).toBe("Rashi on Genesis 1:1:2,B");
    expect(lines[7]).toBe("Rashi on Genesis 1:1:3,C");
  });

  it("load non-existent index returns null", async () => {
    const data = await store.load("Nonexistent", "fr");
    expect(data).toBeNull();
  });

  it("sanitizes special chars in filenames", async () => {
    await store.save("Rashi on Genesis/Exodus", "Ref 1", "text", "fr");
    const data = await store.load("Rashi on Genesis/Exodus", "fr");
    expect(data).not.toBeNull();
    expect(data!.indexTitle).toBe("Rashi on Genesis/Exodus");
  });
});
