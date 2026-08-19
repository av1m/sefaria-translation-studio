import { describe, it, expect, beforeEach } from "vitest";
import { SefariaClient } from "../sefaria-client";

import rashiFixture from "./fixtures/texts-rashi-genesis-1-1.json";
import genesisFixture from "./fixtures/texts-genesis-1-1.json";
import versionsFixture from "./fixtures/versions-rashi-on-genesis.json";
import translationsFixture from "./fixtures/translations-fr.json";

function mockFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => body,
        } as Response;
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }) as typeof fetch;
}

describe("SefariaClient", () => {
  let client: SefariaClient;

  beforeEach(() => {
    const fetcher = mockFetch({
      "/api/v3/texts/Rashi%20on%20Genesis%201%3A1": rashiFixture,
      "/api/v3/texts/Genesis%201%3A1": genesisFixture,
      "/api/texts/versions/Rashi%20on%20Genesis": versionsFixture,
      "/api/texts/translations/fr": translationsFixture,
      "/api/shape/Rashi%20on%20Genesis": { depth: 3, lengths: [50, 1072, 2017] },
    });
    client = new SefariaClient({
      baseUrl: "https://www.sefaria.org",
      fetch: fetcher,
    });
  });

  describe("getTexts", () => {
    it("returns multi-Comment text array for Rashi", async () => {
      const result = await client.getTexts("Rashi on Genesis 1:1");
      expect(result.ref).toBe("Rashi on Genesis 1:1");
      expect(result.indexTitle).toBe("Rashi on Genesis");
      expect(result.versions.length).toBeGreaterThanOrEqual(2);

      const heVersion = result.versions.find(
        (v) => v.actualLanguage === "he" && v.isPrimary,
      );
      expect(heVersion).toBeDefined();
      expect(Array.isArray(heVersion!.text)).toBe(true);
      expect((heVersion!.text as string[]).length).toBe(3);
    });

    it("returns single text string for Genesis 1:1", async () => {
      const result = await client.getTexts("Genesis 1:1");
      expect(result.ref).toBe("Genesis 1:1");
      expect(result.indexTitle).toBe("Genesis");

      const heVersion = result.versions.find(
        (v) => v.actualLanguage === "he",
      );
      expect(heVersion).toBeDefined();
      expect(typeof heVersion!.text).toBe("string");
      expect(result.sectionNames).toEqual(["Chapter", "Verse"]);
    });
  });

  describe("isGap", () => {
    it("returns true for Rashi on Genesis 1:1 (no French)", async () => {
      const gap = await client.isGap("Rashi on Genesis 1:1");
      expect(gap).toBe(true);
    });

    it("returns false for Genesis 1:1 (has French)", async () => {
      const gap = await client.isGap("Genesis 1:1");
      expect(gap).toBe(false);
    });
  });

  describe("getVersions", () => {
    it("returns version metadata array", async () => {
      const versions = await client.getVersions("Rashi on Genesis");
      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBe(4);
      expect(versions[0].versionTitle).toBeDefined();
      expect(versions[0].actualLanguage).toBeDefined();
    });
  });

  describe("getTranslations", () => {
    it("returns flat list of titles with French", async () => {
      const titles = await client.getTranslations("fr");
      expect(Array.isArray(titles)).toBe(true);
      expect(titles).toContain("Genesis");
      expect(titles).toContain("Exodus");
      expect(titles).toContain("Joshua");
      expect(titles).toContain("Mishnah Berakhot");
    });
  });

  describe("Primary identification", () => {
    it("identifies Primary via isPrimary flag", async () => {
      const result = await client.getTexts("Rashi on Genesis 1:1");
      const primaries = result.versions.filter((v) => v.isPrimary);
      expect(primaries.length).toBeGreaterThanOrEqual(1);
      expect(primaries[0].isSource).toBe(true);
    });
  });

  describe("getShape", () => {
    it("returns shape data", async () => {
      const shape = await client.getShape("Rashi on Genesis");
      expect(shape).toHaveProperty("depth");
      expect(shape).toHaveProperty("lengths");
    });
  });
});
