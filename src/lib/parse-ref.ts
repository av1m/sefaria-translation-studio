export interface ParsedRef {
  ref: string;
  indexTitle: string;
}

const SEFARIA_URL_RE =
  /^https?:\/\/(?:www\.)?sefaria\.org(?:\.il)?\//;

const TALMUD_DAF_RE = /^\d+[ab]$/;

export function parseRef(input: string): ParsedRef {
  let raw: string;

  if (SEFARIA_URL_RE.test(input)) {
    const url = new URL(input);
    raw = decodeURIComponent(url.pathname.slice(1)); // strip leading /
    raw = raw.replace(/\/+$/, ""); // trailing slashes
  } else {
    raw = input.trim();
  }

  raw = raw.replace(/_/g, " ");

  const ref = normalizeDots(raw);
  const indexTitle = extractIndexTitle(ref);

  return { ref, indexTitle };
}

function normalizeDots(raw: string): string {
  if (!raw.includes(".")) return raw;

  const parts = raw.split(".");
  const titleParts: string[] = [];
  const sectionParts: string[] = [];
  let inSections = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!inSections && !isSection(part)) {
      titleParts.push(part);
    } else {
      inSections = true;
      sectionParts.push(part);
    }
  }

  if (sectionParts.length === 0) return titleParts.join(" ");

  // For Talmud: daf like "3a" is combined with subsequent segment via colon
  // For non-Talmud: sections are joined with colons
  const title = titleParts.join(" ");
  const sections = sectionParts.join(":");

  return `${title} ${sections}`;
}

function isSection(part: string): boolean {
  if (/^\d+$/.test(part)) return true;
  if (TALMUD_DAF_RE.test(part)) return true;
  return false;
}

function extractIndexTitle(ref: string): string {
  return ref.replace(/[\s]+[\d:ab]+$/i, "").replace(/[\s]+[\d:ab]+$/i, "");
}
