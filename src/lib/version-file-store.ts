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

const DEFAULT_METADATA_BASE = {
  language: "en",
  versionSource: "https://github.com/user/sefaria-studio",
  license: "CC0",
} as const;

function buildVersionTitle(actualLanguage: string): string {
  return `Sefaria Translation Studio [${actualLanguage}]`;
}

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

  private filePath(indexTitle: string, actualLanguage: string): string {
    return join(
      this.dataDir,
      `${sanitizeFilename(indexTitle)}__${sanitizeFilename(actualLanguage)}.json`,
    );
  }

  async save(
    indexTitle: string,
    ref: string,
    drafts: string | string[],
    actualLanguage: string,
  ): Promise<void> {
    let data = await this.load(indexTitle, actualLanguage);
    if (!data) {
      data = {
        indexTitle,
        ...DEFAULT_METADATA_BASE,
        versionTitle: buildVersionTitle(actualLanguage),
        actualLanguage,
        segments: {},
      };
    }
    if (!(ref in data.segments)) {
      data.segments[ref] = drafts;
    }
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(
      this.filePath(indexTitle, actualLanguage),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }

  async load(
    indexTitle: string,
    actualLanguage: string,
  ): Promise<VersionFileData | null> {
    try {
      const content = await readFile(
        this.filePath(indexTitle, actualLanguage),
        "utf-8",
      );
      return JSON.parse(content) as VersionFileData;
    } catch {
      return null;
    }
  }

  async exportCSV(indexTitle: string, actualLanguage: string): Promise<string> {
    const data = await this.load(indexTitle, actualLanguage);
    if (!data) return "";

    const versionTitle = buildVersionTitle(actualLanguage);
    const rows: string[][] = [
      ["Index Title", data.indexTitle],
      ["Version Title", versionTitle],
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
