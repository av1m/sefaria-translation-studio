import { describe, it, expect } from "vitest";
import { SefariaClient } from "../sefaria-client";
import {
  buildOutline,
  childCountsFromShape,
  leafRef,
} from "../index-outline";

function chainFetch(
  indexTitle: string,
  sections: string[],
  sectionName: string,
  shape?: unknown,
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(
      typeof input === "string" ? input : input.toString(),
    );
    if (url.includes("/api/shape/")) {
      return {
        ok: true,
        status: 200,
        json: async () => shape ?? [],
      } as Response;
    }

    const textsMatch = url.match(/\/api\/v3\/texts\/([^?]+)/);
    const ref = textsMatch ? textsMatch[1] : "";

    let body: Record<string, unknown>;
    if (ref === indexTitle) {
      body = {
        ref: indexTitle,
        indexTitle,
        versions: [],
        next: sections[0],
        firstAvailableSectionRef: sections[0],
        sectionNames: [sectionName, "Line"],
        addressTypes: ["Integer"],
        sectionRef: indexTitle,
      };
    } else {
      const i = sections.indexOf(ref);
      body = {
        ref,
        indexTitle,
        versions: [],
        next: i >= 0 ? sections[i + 1] : undefined,
        sectionRef: ref,
        sectionNames: [sectionName, "Line"],
        firstAvailableSectionRef: ref,
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

function talmudDafs(lastDaf: number, lastSide: "a" | "b"): string[] {
  const refs: string[] = [];
  for (let n = 2; n <= lastDaf; n++) {
    refs.push(`Berakhot ${n}a`);
    if (n < lastDaf || lastSide === "b") refs.push(`Berakhot ${n}b`);
  }
  return refs;
}

describe("leafRef", () => {
  it("appends :n to the section ref", () => {
    expect(leafRef("Genesis 1", 1)).toBe("Genesis 1:1");
    expect(leafRef("Berakhot 2a", 3)).toBe("Berakhot 2a:3");
    expect(leafRef("Mishnah Berakhot 1", 5)).toBe("Mishnah Berakhot 1:5");
  });
});

describe("childCountsFromShape", () => {
  it("skips leading Talmud zeros", () => {
    expect(childCountsFromShape([{ chapters: [0, 0, 14, 19, 15] }])).toEqual([
      14, 19, 15,
    ]);
  });

  it("keeps Tanakh chapter lengths", () => {
    expect(childCountsFromShape([{ chapters: [31, 25, 24] }])).toEqual([
      31, 25, 24,
    ]);
  });
});

describe("buildOutline", () => {
  it("Genesis: 50 nodes, first / mid / last", async () => {
    const sections = Array.from({ length: 50 }, (_, i) => `Genesis ${i + 1}`);
    const shape = [{ chapters: sections.map((_, i) => 10 + (i % 5)) }];
    const client = new SefariaClient({
      fetch: chainFetch("Genesis", sections, "Chapter", shape),
    });
    const outline = await buildOutline("Genesis", client);
    expect(outline.indexTitle).toBe("Genesis");
    expect(outline.sectionName).toBe("Chapter");
    expect(outline.nodes).toHaveLength(50);
    expect(outline.nodes[0].ref).toBe("Genesis 1");
    expect(outline.nodes[0].label).toBe("Chapter 1");
    expect(outline.nodes[24].ref).toBe("Genesis 25");
    expect(outline.nodes[49].ref).toBe("Genesis 50");
    expect(outline.nodes[0].childCount).toBe(10);
    expect(outline.nodes.every((n) => n.ref !== "Genesis 127")).toBe(true);
  });

  it("Mishnah Berakhot: 9 nodes, last is chapter 9", async () => {
    const sections = Array.from(
      { length: 9 },
      (_, i) => `Mishnah Berakhot ${i + 1}`,
    );
    const shape = [{ chapters: [5, 8, 6, 7, 5, 8, 5, 8, 5] }];
    const client = new SefariaClient({
      fetch: chainFetch("Mishnah Berakhot", sections, "Chapter", shape),
    });
    const outline = await buildOutline("Mishnah Berakhot", client);
    expect(outline.nodes).toHaveLength(9);
    expect(outline.nodes[0].ref).toBe("Mishnah Berakhot 1");
    expect(outline.nodes[4].ref).toBe("Mishnah Berakhot 5");
    expect(outline.nodes[8].ref).toBe("Mishnah Berakhot 9");
    expect(outline.nodes[8].childCount).toBe(5);
  });

  it("Berakhot: first 2a, includes 33b, last 64a, never 127", async () => {
    const sections = talmudDafs(64, "a");
    const counts = sections.map((_, i) => 10 + (i % 7));
    const shape = [{ chapters: [0, 0, ...counts] }];
    const client = new SefariaClient({
      fetch: chainFetch("Berakhot", sections, "Daf", shape),
    });
    const outline = await buildOutline("Berakhot", client);
    expect(outline.sectionName).toBe("Daf");
    expect(outline.nodes[0].ref).toBe("Berakhot 2a");
    expect(outline.nodes.some((n) => n.ref === "Berakhot 33b")).toBe(true);
    expect(outline.nodes.at(-1)?.ref).toBe("Berakhot 64a");
    expect(outline.nodes.some((n) => n.ref === "Berakhot 127")).toBe(false);
    expect(outline.nodes.some((n) => n.ref === "Berakhot 64b")).toBe(false);
    expect(outline.nodes[0].childCount).toBe(counts[0]);
    expect(outline.nodes).toHaveLength(sections.length);
  });

  it("stops on a cycle", async () => {
    const client = new SefariaClient({
      fetch: chainFetch("Genesis", ["Genesis 1"], "Chapter"),
    });
    const outline = await buildOutline("Genesis", client);
    expect(outline.nodes).toHaveLength(1);
  });
});
