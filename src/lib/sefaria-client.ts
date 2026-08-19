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
  sectionRef?: string;
  sectionNames?: string[];
  addressTypes?: string[];
  firstAvailableSectionRef?: string;
}

interface SefariaClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = "https://www.sefaria.org";

const LANGUAGE_FAMILIES: Record<string, string> = {
  fr: "french",
  es: "spanish",
  de: "german",
  it: "italian",
  pt: "portuguese",
};

export class SefariaClient {
  private baseUrl: string;
  private fetch: typeof globalThis.fetch;

  constructor(options: SefariaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async getTexts(
    ref: string,
    targetLanguageActual?: string,
  ): Promise<SefariaTextsResponse> {
    const encoded = encodeURIComponent(ref);
    const actualLanguage = targetLanguageActual ?? "fr";
    const translationFamily = LANGUAGE_FAMILIES[actualLanguage] ?? actualLanguage;
    const url = `${this.baseUrl}/api/v3/texts/${encoded}?version=english|all&version=hebrew|all&version=${translationFamily}|all`;
    const data = await this.fetchJson(url);
    return {
      ref: data.ref,
      indexTitle: data.indexTitle,
      versions: (data.versions ?? []).map(mapVersion),
      next: data.next ?? undefined,
      prev: data.prev ?? undefined,
      sectionRef: data.sectionRef ?? undefined,
      sectionNames: Array.isArray(data.sectionNames)
        ? data.sectionNames
        : undefined,
      addressTypes: Array.isArray(data.addressTypes)
        ? data.addressTypes
        : undefined,
      firstAvailableSectionRef: data.firstAvailableSectionRef ?? undefined,
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

  async isGap(ref: string, targetLanguageActual: string = "fr"): Promise<boolean> {
    const { versions } = await this.getTexts(ref, targetLanguageActual);
    return !versions.some(
      (v) => v.actualLanguage === targetLanguageActual && hasContent(v.text),
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
