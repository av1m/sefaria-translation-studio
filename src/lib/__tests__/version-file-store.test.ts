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
    await store.save("Genesis", "Genesis 1:1", "In the beginning");
    const data = await store.load("Genesis");
    expect(data).not.toBeNull();
    expect(data!.segments["Genesis 1:1"]).toBe("In the beginning");
    expect(data!.indexTitle).toBe("Genesis");
  });

  it("save + load with multi-Comment ref preserves array order", async () => {
    const drafts = ["Comment 1", "Comment 2", "Comment 3"];
    await store.save("Rashi on Genesis", "Rashi on Genesis 1:1", drafts);
    const data = await store.load("Rashi on Genesis");
    expect(data!.segments["Rashi on Genesis 1:1"]).toEqual(drafts);
  });

  it("save does NOT overwrite other refs", async () => {
    await store.save("Genesis", "Genesis 1:1", "First");
    await store.save("Genesis", "Genesis 1:2", "Second");
    const data = await store.load("Genesis");
    expect(data!.segments["Genesis 1:1"]).toBe("First");
    expect(data!.segments["Genesis 1:2"]).toBe("Second");
  });

  it("save same ref twice does NOT overwrite the first", async () => {
    await store.save("Genesis", "Genesis 1:1", "Original");
    await store.save("Genesis", "Genesis 1:1", "Replacement");
    const data = await store.load("Genesis");
    expect(data!.segments["Genesis 1:1"]).toBe("Original");
  });

  it("exportCSV produces correct Sefaria format", async () => {
    await store.save("Genesis", "Genesis 1:1", "Au commencement");
    await store.save("Genesis", "Genesis 1:2", "La terre était");
    const csv = await store.exportCSV("Genesis");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Index Title,Genesis");
    expect(lines[1]).toContain("Version Title,Studio de traduction Sefaria [fr]");
    expect(lines[2]).toBe("Language,en");
    expect(lines[4]).toBe("Version Notes,");
    expect(lines[5]).toBe("Genesis 1:1,Au commencement");
    expect(lines[6]).toBe("Genesis 1:2,La terre était");
  });

  it("exportCSV multi-Comment uses sub-Ref numbering", async () => {
    await store.save("Rashi on Genesis", "Rashi on Genesis 1:1", ["A", "B", "C"]);
    const csv = await store.exportCSV("Rashi on Genesis");
    const lines = csv.split("\n");
    expect(lines[5]).toBe("Rashi on Genesis 1:1:1,A");
    expect(lines[6]).toBe("Rashi on Genesis 1:1:2,B");
    expect(lines[7]).toBe("Rashi on Genesis 1:1:3,C");
  });

  it("load non-existent index returns null", async () => {
    const data = await store.load("Nonexistent");
    expect(data).toBeNull();
  });

  it("sanitizes special chars in filenames", async () => {
    await store.save("Rashi on Genesis/Exodus", "Ref 1", "text");
    const data = await store.load("Rashi on Genesis/Exodus");
    expect(data).not.toBeNull();
    expect(data!.indexTitle).toBe("Rashi on Genesis/Exodus");
  });
});
