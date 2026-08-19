import { describe, it, expect } from "vitest";
import { parseRef } from "../parse-ref";

describe("parseRef", () => {
  it("parses sefaria.org URL with query params (Talmud)", () => {
    const result = parseRef(
      "https://www.sefaria.org/Berakhot.3a.5?lang=he&with=all"
    );
    expect(result).toEqual({
      ref: "Berakhot 3a:5",
      indexTitle: "Berakhot",
    });
  });

  it("parses sefaria.org.il URL with underscores", () => {
    const result = parseRef(
      "https://www.sefaria.org.il/Mishnah_Peah.8.1?lang=he"
    );
    expect(result).toEqual({
      ref: "Mishnah Peah 8:1",
      indexTitle: "Mishnah Peah",
    });
  });

  it("accepts raw Ref string", () => {
    const result = parseRef("Rashi on Genesis 1:1");
    expect(result).toEqual({
      ref: "Rashi on Genesis 1:1",
      indexTitle: "Rashi on Genesis",
    });
  });

  it("parses commentary URL with underscores", () => {
    const result = parseRef(
      "https://www.sefaria.org/Rashi_on_Genesis.1.1"
    );
    expect(result).toEqual({
      ref: "Rashi on Genesis 1:1",
      indexTitle: "Rashi on Genesis",
    });
  });

  it("handles trailing slash", () => {
    const result = parseRef(
      "https://www.sefaria.org/Berakhot.3a.5/"
    );
    expect(result).toEqual({
      ref: "Berakhot 3a:5",
      indexTitle: "Berakhot",
    });
  });

  it("handles fragment", () => {
    const result = parseRef(
      "https://www.sefaria.org/Berakhot.3a.5#hash"
    );
    expect(result).toEqual({
      ref: "Berakhot 3a:5",
      indexTitle: "Berakhot",
    });
  });

  it("handles URL-encoded characters", () => {
    const result = parseRef(
      "https://www.sefaria.org/Mishnah%20Peah.8.1"
    );
    expect(result).toEqual({
      ref: "Mishnah Peah 8:1",
      indexTitle: "Mishnah Peah",
    });
  });

  it("trims whitespace from raw Ref", () => {
    const result = parseRef("  Berakhot 3a:5  ");
    expect(result).toEqual({
      ref: "Berakhot 3a:5",
      indexTitle: "Berakhot",
    });
  });

  it("handles Talmud range ref from URL", () => {
    const result = parseRef(
      "https://www.sefaria.org/Berakhot.2a"
    );
    expect(result).toEqual({
      ref: "Berakhot 2a",
      indexTitle: "Berakhot",
    });
  });
});
