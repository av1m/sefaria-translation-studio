export interface SefariaVersion {
  versionTitle: string;
  language: string;
  actualLanguage: string;
  isPrimary?: boolean;
  isSource?: boolean;
  license?: string;
  text: string | string[];
}

export interface SefariaTextsResponse {
  ref: string;
  indexTitle: string;
  versions: SefariaVersion[];
  next?: string;
  prev?: string;
}

interface SefariaClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = "https://www.sefaria.org";

export class SefariaClient {
  private baseUrl: string;
  private fetch: typeof globalThis.fetch;

  constructor(options: SefariaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async getTexts(ref: string): Promise<SefariaTextsResponse> {
    const encoded = encodeURIComponent(ref);
    const url = `${this.baseUrl}/api/v3/texts/${encoded}?version=english|all&version=hebrew|all&version=french|all`;
    const data = await this.fetchJson(url);
    return {
      ref: data.ref,
      indexTitle: data.indexTitle,
      versions: (data.versions ?? []).map(mapVersion),
      next: data.next ?? undefined,
      prev: data.prev ?? undefined,
    };
  }

  async getVersions(indexTitle: string): Promise<SefariaVersion[]> {
    const encoded = encodeURIComponent(indexTitle);
    const url = `${this.baseUrl}/api/texts/versions/${encoded}`;
    const data: unknown[] = await this.fetchJson(url);
    return data.map(mapVersion);
  }

  async getTranslations(lang: string): Promise<string[]> {
    const url = `${this.baseUrl}/api/texts/translations/${encodeURIComponent(lang)}`;
    const data = await this.fetchJson(url);
    return extractTitles(data);
  }

  async isGap(ref: string): Promise<boolean> {
    const { versions } = await this.getTexts(ref);
    return !versions.some(
      (v) => v.actualLanguage === "fr" && hasContent(v.text),
    );
  }

  async getShape(indexTitle: string): Promise<unknown> {
    const encoded = encodeURIComponent(indexTitle);
    const url = `${this.baseUrl}/api/shape/${encoded}`;
    return this.fetchJson(url);
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await this.fetch(url);
    if (!res.ok) {
      throw new Error(`Sefaria API error: ${res.status} for ${url}`);
    }
    return res.json();
  }
}

function mapVersion(raw: any): SefariaVersion {
  return {
    versionTitle: raw.versionTitle ?? "",
    language: raw.language ?? "",
    actualLanguage: raw.actualLanguage ?? "",
    isPrimary: raw.isPrimary ?? false,
    isSource: raw.isSource ?? false,
    license: raw.license,
    text: raw.text ?? "",
  };
}

function hasContent(text: string | string[]): boolean {
  if (Array.isArray(text)) {
    return text.some((t) => t.length > 0);
  }
  return typeof text === "string" && text.length > 0;
}

function extractTitles(data: any): string[] {
  const titles: string[] = [];
  if (data && typeof data === "object") {
    for (const category of Object.values(data)) {
      if (category && typeof category === "object") {
        for (const items of Object.values(category as Record<string, any>)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item?.title) titles.push(item.title);
            }
          }
        }
      }
    }
  }
  return titles;
}
