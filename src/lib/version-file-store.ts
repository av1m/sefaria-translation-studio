import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface VersionFileData {
  indexTitle: string;
  versionTitle: string;
  language: string;
  actualLanguage: string;
  versionSource: string;
  license: string;
  segments: Record<string, string | string[]>;
}

const DEFAULT_METADATA = {
  versionTitle: "Studio de traduction Sefaria [fr]",
  language: "en",
  actualLanguage: "fr",
  versionSource: "https://github.com/user/sefaria-studio",
  license: "CC0",
} as const;

function sanitizeFilename(title: string): string {
  return title.replace(/[\/\\:*?"<>|]/g, "_");
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export class VersionFileStore {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? join(process.cwd(), "data", "versions");
  }

  private filePath(indexTitle: string): string {
    return join(this.dataDir, `${sanitizeFilename(indexTitle)}.json`);
  }

  async save(indexTitle: string, ref: string, drafts: string | string[]): Promise<void> {
    let data = await this.load(indexTitle);
    if (!data) {
      data = { indexTitle, ...DEFAULT_METADATA, segments: {} };
    }
    if (!(ref in data.segments)) {
      data.segments[ref] = drafts;
    }
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.filePath(indexTitle), JSON.stringify(data, null, 2), "utf-8");
  }

  async load(indexTitle: string): Promise<VersionFileData | null> {
    try {
      const content = await readFile(this.filePath(indexTitle), "utf-8");
      return JSON.parse(content) as VersionFileData;
    } catch {
      return null;
    }
  }

  async exportCSV(indexTitle: string): Promise<string> {
    const data = await this.load(indexTitle);
    if (!data) return "";

    const rows: string[][] = [
      ["Index Title", data.indexTitle],
      ["Version Title", data.versionTitle],
      ["Language", data.language],
      ["Version Source", data.versionSource],
      ["Version Notes", ""],
    ];

    for (const [ref, text] of Object.entries(data.segments)) {
      if (Array.isArray(text)) {
        text.forEach((t, i) => {
          rows.push([`${ref}:${i + 1}`, t]);
        });
      } else {
        rows.push([ref, text]);
      }
    }

    return rows.map((row) => row.map(escapeCSVField).join(",")).join("\n");
  }
}
