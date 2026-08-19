"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { parseRef, type ParsedRef } from "@/lib/parse-ref";
import type { SefariaVersion } from "@/lib/sefaria-client";
import { leafRef, type IndexOutline } from "@/lib/index-outline";

interface LoadedRef {
  parsed: ParsedRef;
  versions: SefariaVersion[];
  primary: SefariaVersion;
  helper: SefariaVersion | null;
  allPrimaries: SefariaVersion[];
  next?: string;
}

type Glossary = Record<string, string>;

interface HelperLangToggle {
  lang: string;
  enabled: boolean;
  versions: SefariaVersion[];
}

interface ChapterItemState {
  ref: string;
  primary: SefariaVersion;
  helper: SefariaVersion | null;
  comments: string[];
  helperComments: string[];
  hasTargetTranslation: boolean;
  drafts: string[] | null;
  status: "idle" | "translating" | "translated" | "saving" | "saved" | "error";
  error?: string;
}

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
};

function isSourceLang(lang: string) {
  return ["he", "arc", "yi"].includes(lang);
}

type TargetLanguage = "fr" | "es" | "de" | "it" | "pt";

const TARGET_LANGUAGES: { actualLanguage: TargetLanguage; label: string }[] = [
  { actualLanguage: "fr", label: "French" },
  { actualLanguage: "es", label: "Spanish" },
  { actualLanguage: "de", label: "German" },
  { actualLanguage: "it", label: "Italian" },
  { actualLanguage: "pt", label: "Portuguese" },
];

const TARGET_LANGUAGE_FAMILIES: Record<TargetLanguage, string> = {
  fr: "french",
  es: "spanish",
  de: "german",
  it: "italian",
  pt: "portuguese",
};

const TARGET_LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

function getComments(v: SefariaVersion): string[] {
  return Array.isArray(v.text) ? v.text : [v.text];
}

function hasContent(text: string | string[]): boolean {
  if (Array.isArray(text)) return text.some((t) => t.length > 0);
  return typeof text === "string" && text.length > 0;
}

function Spinner() {
  return (
    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function TextPanel({
  title,
  segments,
  dir = "ltr",
  font = "font-sans",
  editable = false,
  onChange,
  badge,
}: {
  title: string;
  segments: string[];
  dir?: "ltr" | "rtl";
  font?: string;
  editable?: boolean;
  onChange?: (index: number, value: string) => void;
  badge?: React.ReactNode;
}) {
  const [raw, setRaw] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
        <h3 className="text-sm font-medium text-zinc-500">
          {title} {badge}
        </h3>
        <button
          onClick={() => setRaw((v) => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          {raw ? "HTML" : "Raw"}
        </button>
      </div>
      <div dir={dir} className={`p-4 space-y-3 ${font} text-base leading-relaxed text-zinc-900`}>
        {segments.map((s, i) => {
          if (raw) {
            return editable ? (
              <textarea
                key={i}
                value={s}
                onChange={(e) => onChange?.(i, e.target.value)}
                rows={Math.max(3, s.split("\n").length + 1)}
                className="w-full rounded border border-zinc-200 bg-zinc-50 p-3 text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              />
            ) : (
              <pre
                key={i}
                className="rounded bg-zinc-50 p-3 whitespace-pre-wrap text-xs font-mono break-all"
              >
                {s}
              </pre>
            );
          }

          // Default: HTML rendered view (including for editable drafts).
          return (
            <div
              key={i}
              className="rounded bg-zinc-50 p-3"
              dangerouslySetInnerHTML={{ __html: s }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            checked ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  );
}

function useLlmConfig() {
  const [llm, setLlm] = useState({
    provider: "openai",
    model: "gpt-5.6-terra",
    apiKey: "",
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem("llmConfig");
      if (saved) setLlm(JSON.parse(saved));
    } catch {}
  }, []);
  const updateLlm = (patch: Partial<typeof llm>) => {
    setLlm((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("llmConfig", JSON.stringify(next));
      return next;
    });
  };
  return { llm, updateLlm };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedRef | null>(null);

  const [drafting, setDrafting] = useState(false);
  const [drafts, setDrafts] = useState<string[] | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const { llm, updateLlm } = useLlmConfig();
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>("fr");

  const [prevSegToggle, setPrevSegToggle] = useState(true);
  const [glossaryToggle, setGlossaryToggle] = useState(true);
  const [notesToggle, setNotesToggle] = useState(true);
  const [helperLangs, setHelperLangs] = useState<HelperLangToggle[]>([]);

  const [notes, setNotes] = useState("");

  const [glossary, setGlossary] = useState<Glossary>({});
  const [newTermSource, setNewTermSource] = useState("");
  const [newTermFrench, setNewTermFrench] = useState("");

  const prevSegmentsCache = useRef<Record<string, string[]>>({});
  const debugSefariaRaw = useRef<any>(null);
  const debugLlmExchange = useRef<{ prompt: any; response: any } | null>(null);
  const [prevSegments, setPrevSegments] = useState<string[] | null>(null);

  const [settingsChanged, setSettingsChanged] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const [searchingGap, setSearchingGap] = useState(false);
  const [gapMessage, setGapMessage] = useState<string | null>(null);
  const [debugExportMessage, setDebugExportMessage] = useState<
    | null
    | {
        kind: "success" | "error";
        text: string;
      }
  >(null);

  const [mode, setMode] = useState<"single" | "chapter" | "book">("single");
  const [chapterInput, setChapterInput] = useState("");
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [chapterIndexTitle, setChapterIndexTitle] = useState("");
  const [chapterItems, setChapterItems] = useState<ChapterItemState[]>([]);
  const [batchTranslating, setBatchTranslating] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  const [bookInput, setBookInput] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [outline, setOutline] = useState<IndexOutline | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const [fetchedChildCounts, setFetchedChildCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    fetch("/api/glossary")
      .then((r) => r.json())
      .then(setGlossary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (targetLanguage !== "fr") setGlossaryToggle(false);
  }, [targetLanguage]);

  const markSettingsChanged = () => {
    if (drafts) setSettingsChanged(true);
  };

  const reset = () => {
    setError(null);
    setRefusal(null);
    setLoaded(null);
    setDrafts(null);
    setSaved(false);
    setPrevSegToggle(true);
    setGlossaryToggle(targetLanguage === "fr");
    setNotesToggle(true);
    setHelperLangs([]);
    setNotes("");
    setPrevSegments(null);
    setSettingsChanged(false);
    setGapMessage(null);
  };

  const fetchPrevSegments = useCallback(async (prevRef: string) => {
    if (prevSegmentsCache.current[prevRef]) {
      setPrevSegments(prevSegmentsCache.current[prevRef]);
      return;
    }
    try {
      const endpoint = `v3/texts/${encodeURIComponent(prevRef)}?version=hebrew|all`;
      const res = await fetch(
        `/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const versions = data.versions ?? [];
      const primary =
        versions.find(
          (v: any) =>
            isSourceLang(v.actualLanguage ?? "") &&
            (v.isPrimary || v.isSource),
        ) ?? versions.find((v: any) => isSourceLang(v.actualLanguage ?? ""));
      if (primary) {
        const texts = Array.isArray(primary.text)
          ? primary.text
          : [primary.text];
        prevSegmentsCache.current[prevRef] = texts;
        setPrevSegments(texts);
      }
    } catch {}
  }, []);

  const handleLoad = useCallback(async (override?: string) => {
    reset();
    const trimmed = (override ?? input).trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const parsed = parseRef(trimmed);
      const translationFamily = TARGET_LANGUAGE_FAMILIES[targetLanguage];
      const targetLanguageName = TARGET_LANGUAGE_NAMES[targetLanguage];
      const endpoint = `v3/texts/${encodeURIComponent(parsed.ref)}?version=english|all&version=hebrew|all&version=${translationFamily}|all`;
      const res = await fetch(
        `/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Sefaria error (${res.status})`);
      }
      const data = await res.json();
      debugSefariaRaw.current = data;

      const versions: SefariaVersion[] = (data.versions ?? []).map(
        (v: any) => ({
          versionTitle: v.versionTitle ?? "",
          language: v.language ?? "",
          actualLanguage: v.actualLanguage ?? "",
          isPrimary: v.isPrimary ?? false,
          isSource: v.isSource ?? false,
          license: v.license,
          text: v.text ?? "",
        }),
      );

      const hasTargetTranslation = versions.some(
        (v) => v.actualLanguage === targetLanguage && hasContent(v.text),
      );
      if (hasTargetTranslation) {
        setRefusal(
          `This Ref already has a ${targetLanguageName} translation on Sefaria. Paste another link.`,
        );
        setInput("");
        setLoading(false);
        return;
      }

      const primaries = versions.filter((v) => isSourceLang(v.actualLanguage));
      const primary =
        primaries.find((v) => v.isPrimary || v.isSource) ?? primaries[0];

      if (!primary) {
        throw new Error(
          "No source version (Hebrew/Aramaic/Yiddish) found for this Ref.",
        );
      }

      const helper =
        versions.find(
          (v) => v.actualLanguage === "en" && hasContent(v.text),
        ) ?? null;

      const langMap = new Map<string, SefariaVersion[]>();
      for (const v of versions) {
        if (
          isSourceLang(v.actualLanguage) ||
          v.actualLanguage === targetLanguage ||
          !hasContent(v.text)
        )
          continue;
        const existing = langMap.get(v.actualLanguage) ?? [];
        existing.push(v);
        langMap.set(v.actualLanguage, existing);
      }
      const langs: HelperLangToggle[] = Array.from(langMap.entries()).map(
        ([lang, vs]) => ({
          lang,
          enabled: lang === "en",
          versions: vs,
        }),
      );
      setHelperLangs(langs);

      setLoaded({
        parsed: { ...parsed, ref: data.ref ?? parsed.ref },
        versions,
        primary,
        helper,
        allPrimaries: primaries,
        next: data.next ?? undefined,
      });

      if (data.prev) {
        const prevRef =
          typeof data.prev === "string"
            ? data.prev
            : data.prev.ref ?? data.prev;
        fetchPrevSegments(String(prevRef));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [input, fetchPrevSegments, targetLanguage]);

  const handleSelectPrimary = (v: SefariaVersion) => {
    if (!loaded) return;
    setLoaded({ ...loaded, primary: v });
    setDrafts(null);
    setSaved(false);
  };

  const handleTranslate = async () => {
    if (!loaded) return;
    setDrafting(true);
    setSaved(false);
    setSettingsChanged(false);
    try {
      const comments = getComments(loaded.primary);
      const contextPack: any = {};

      if (prevSegToggle && prevSegments && prevSegments.length > 0) {
        contextPack.previousSegments = prevSegments;
      }

      const enabledHelpers = helperLangs.filter((h) => h.enabled);
      if (enabledHelpers.length > 0) {
        contextPack.helpers = enabledHelpers.map((h) => ({
          lang: h.lang,
          text: h.versions[0].text,
        }));
      }

      if (glossaryToggle && targetLanguage === "fr") {
        const srcText = comments.join(" ");
        const matched = Object.entries(glossary)
          .filter(([term]) => srcText.includes(term))
          .map(([source, french]) => ({ source, french }));
        if (matched.length > 0) {
          contextPack.glossary = matched;
        }
      }

      if (notesToggle && notes.trim()) {
        contextPack.notes = notes.trim();
      }

      const englishHelper = helperLangs.find((h) => h.lang === "en" && h.enabled);
      const useEnglishAsSource = !!englishHelper;
      const englishText = useEnglishAsSource
        ? getComments(englishHelper.versions[0])
        : undefined;

      const draftPayload = {
        ref: loaded.parsed.ref,
        source: useEnglishAsSource ? englishText : comments,
        original: useEnglishAsSource ? comments : undefined,
        contextPack,
        targetLanguage,
        llmConfig: llm.apiKey ? llm : undefined,
      };
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Translation error");
      }
      const draftResponse = await res.json();
      debugLlmExchange.current = { prompt: { ...draftPayload, llmConfig: { ...draftPayload.llmConfig, apiKey: "***" } }, response: draftResponse };
      const { drafts: d } = draftResponse;
      setDrafts(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    if (!loaded || !drafts) return;
    setSaving(true);
    try {
      const res = await fetch("/api/version-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indexTitle: loaded.parsed.indexTitle,
          ref: loaded.parsed.ref,
          drafts,
          actualLanguage: targetLanguage,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save error");
      }
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddGlossaryTerm = async () => {
    if (!newTermSource.trim() || !newTermFrench.trim()) return;
    try {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: newTermSource.trim(),
          french: newTermFrench.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGlossary(updated);
        setNewTermSource("");
        setNewTermFrench("");
      }
    } catch {}
  };

  const updateDraft = (index: number, value: string) => {
    if (!drafts) return;
    const next = [...drafts];
    next[index] = value;
    setDrafts(next);
    setSaved(false);
  };

  const toggleHelperLang = (lang: string) => {
    setHelperLangs((prev) =>
      prev.map((h) => (h.lang === lang ? { ...h, enabled: !h.enabled } : h)),
    );
    markSettingsChanged();
  };

  const fetchRefData = async (ref: string) => {
    const parsed = parseRef(ref);
    const translationFamily = TARGET_LANGUAGE_FAMILIES[targetLanguage];
    const endpoint = `v3/texts/${encodeURIComponent(parsed.ref)}?version=english|all&version=hebrew|all&version=${translationFamily}|all`;
    const res = await fetch(`/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Sefaria error (${res.status})`);
    }
    const data = await res.json();
    const versions: SefariaVersion[] = (data.versions ?? []).map((v: any) => ({
      versionTitle: v.versionTitle ?? "",
      language: v.language ?? "",
      actualLanguage: v.actualLanguage ?? "",
      isPrimary: v.isPrimary ?? false,
      isSource: v.isSource ?? false,
      license: v.license,
      text: v.text ?? "",
    }));
    const hasTargetTranslation = versions.some(
      (v) => v.actualLanguage === targetLanguage && hasContent(v.text),
    );
    const primaries = versions.filter((v) => isSourceLang(v.actualLanguage));
    const primary = primaries.find((v) => v.isPrimary || v.isSource) ?? primaries[0];
    const helper = versions.find((v) => v.actualLanguage === "en" && hasContent(v.text)) ?? null;
    return {
      parsed: { ...parsed, ref: data.ref ?? parsed.ref },
      versions,
      primary,
      helper,
      allPrimaries: primaries,
      next: data.next as string | undefined,
      hasTargetTranslation,
      sectionRef: data.sectionRef as string | undefined,
    };
  };

  const handleNextGap = async () => {
    if (!loaded) return;
    setSearchingGap(true);
    setGapMessage(null);
    try {
      let nextRef = loaded.next;
      while (nextRef) {
        const result = await fetchRefData(nextRef);
        if (!result.hasTargetTranslation && result.primary) {
          setInput(nextRef);
          setLoaded({
            parsed: result.parsed,
            versions: result.versions,
            primary: result.primary,
            helper: result.helper,
            allPrimaries: result.allPrimaries,
            next: result.next,
          });
          setDrafts(null);
          setSaved(false);
          setGapMessage(null);
          return;
        }
        nextRef = result.next;
      }
      setGapMessage(
        `All Segments in this Index already have a ${TARGET_LANGUAGE_NAMES[targetLanguage]} translation!`,
      );
      setSaved(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchingGap(false);
    }
  };

  const downloadCSV = (indexTitle: string) => {
    const url = `/api/version-file?indexTitle=${encodeURIComponent(indexTitle)}&actualLanguage=${targetLanguage}&format=csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${indexTitle} [${targetLanguage}].csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadCSV = () => {
    if (!loaded) return;
    downloadCSV(loaded.parsed.indexTitle);
  };

  const loadChapterByRef = async (raw: string) => {
    setChapterError(null);
    setChapterItems([]);
    const trimmed = raw.trim();
    if (!trimmed) return;
    setChapterLoading(true);
    try {
      const parsed = parseRef(trimmed);
      let result = await fetchRefData(parsed.ref);
      const sectionRef = result.sectionRef || result.parsed.ref;
      const primaryTextIsArray = Array.isArray(result.primary?.text);

      // Segment `next` is the next *section*, not the next verse/line.
      // Always expand from the section payload's text[].
      if (!primaryTextIsArray && sectionRef !== result.parsed.ref) {
        result = await fetchRefData(sectionRef);
      }

      if (!result.primary) {
        setChapterError("No source Segment found for this Ref.");
        setChapterIndexTitle(parsed.indexTitle);
        return;
      }

      const sourceTexts = getComments(result.primary);
      const helperTexts = result.helper ? getComments(result.helper) : [];
      const targetVersion = result.versions.find(
        (v) => v.actualLanguage === targetLanguage && hasContent(v.text),
      );
      const targetTexts = targetVersion ? getComments(targetVersion) : [];

      const items: ChapterItemState[] = [];
      sourceTexts.forEach((comment, i) => {
        if (!comment) return;
        const helperComment = helperTexts[i] ?? "";
        items.push({
          ref: leafRef(sectionRef, i + 1),
          primary: { ...result.primary!, text: comment },
          helper: result.helper
            ? { ...result.helper, text: helperComment }
            : null,
          comments: [comment],
          helperComments: helperComment ? [helperComment] : [],
          hasTargetTranslation: !!(targetTexts[i] && targetTexts[i].length > 0),
          drafts: null,
          status: "idle",
        });
      });

      if (items.length === 0) {
        setChapterError("No source Segment found for this Ref.");
      }
      setChapterItems(items);
      setChapterIndexTitle(parsed.indexTitle);
    } catch (err: any) {
      setChapterError(err.message);
    } finally {
      setChapterLoading(false);
    }
  };

  const handleLoadChapter = async () => {
    await loadChapterByRef(chapterInput);
  };

  const handleLoadBook = async () => {
    setBookError(null);
    setOutline(null);
    setExpandedRefs(new Set());
    setFetchedChildCounts({});
    const trimmed = bookInput.trim();
    if (!trimmed) return;
    setBookLoading(true);
    try {
      const parsed = parseRef(trimmed);
      const res = await fetch(
        `/api/outline?indexTitle=${encodeURIComponent(parsed.indexTitle)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Outline error (${res.status})`);
      }
      const data = (await res.json()) as IndexOutline;
      if (!data.nodes?.length) {
        setBookError("No sections found for this book.");
      }
      setOutline(data);
    } catch (err: any) {
      setBookError(err.message);
    } finally {
      setBookLoading(false);
    }
  };

  const childCountFor = (node: { ref: string; childCount?: number }) =>
    node.childCount ?? fetchedChildCounts[node.ref];

  const toggleExpandNode = async (node: {
    ref: string;
    childCount?: number;
  }) => {
    setExpandedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(node.ref)) next.delete(node.ref);
      else next.add(node.ref);
      return next;
    });
    if (childCountFor(node) != null) return;
    try {
      const translationFamily = TARGET_LANGUAGE_FAMILIES[targetLanguage];
      const endpoint = `v3/texts/${encodeURIComponent(node.ref)}?version=hebrew|all&version=english|all&version=${translationFamily}|all`;
      const res = await fetch(
        `/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const he =
        (data.versions ?? []).find(
          (v: any) =>
            ["he", "arc", "yi"].includes(v.actualLanguage ?? "") &&
            Array.isArray(v.text),
        ) ?? (data.versions ?? []).find((v: any) => Array.isArray(v.text));
      const count = Array.isArray(he?.text) ? he.text.length : 0;
      if (count > 0) {
        setFetchedChildCounts((prev) => ({ ...prev, [node.ref]: count }));
      }
    } catch {}
  };

  const translateSectionFromTree = async (sectionRef: string) => {
    setChapterInput(sectionRef);
    setMode("chapter");
    await loadChapterByRef(sectionRef);
  };

  const translateLeafFromTree = async (ref: string) => {
    setInput(ref);
    setMode("single");
    await handleLoad(ref);
  };

  const translateChapterItem = async (
    item: ChapterItemState,
    prevComments?: string[],
  ): Promise<string[] | null> => {
    setChapterItems((prev) =>
      prev.map((it) =>
        it.ref === item.ref ? { ...it, status: "translating", error: undefined } : it,
      ),
    );
    try {
      const useEnglishAsSource = !!item.helper && item.helperComments.length > 0;
      const contextPack: any = {};

      if (prevSegToggle && prevComments && prevComments.length > 0) {
        contextPack.previousSegments = prevComments;
      }

      if (glossaryToggle && targetLanguage === "fr") {
        const srcText = item.comments.join(" ");
        const matched = Object.entries(glossary)
          .filter(([term]) => srcText.includes(term))
          .map(([source, french]) => ({ source, french }));
        if (matched.length > 0) contextPack.glossary = matched;
      }

      if (notesToggle && notes.trim()) contextPack.notes = notes.trim();

      const draftPayload = {
        ref: item.ref,
        source: useEnglishAsSource ? item.helperComments : item.comments,
        original: useEnglishAsSource ? item.comments : undefined,
        contextPack,
        targetLanguage,
        llmConfig: llm.apiKey ? llm : undefined,
      };
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Translation error");
      }
      const { drafts } = await res.json();
      setChapterItems((prev) =>
        prev.map((it) => (it.ref === item.ref ? { ...it, drafts, status: "translated" } : it)),
      );
      return drafts as string[];
    } catch (err: any) {
      setChapterItems((prev) =>
        prev.map((it) =>
          it.ref === item.ref ? { ...it, status: "error", error: err.message } : it,
        ),
      );
      return null;
    }
  };

  const handleTranslateAllChapter = async () => {
    setBatchTranslating(true);
    const snapshot = chapterItems;
    const pending = snapshot.filter(
      (it) => !it.hasTargetTranslation && !it.drafts,
    );
    setBatchProgress({ done: 0, total: pending.length });
    for (const item of pending) {
      const idx = snapshot.indexOf(item);
      const prev = idx > 0 ? snapshot[idx - 1].comments : undefined;
      await translateChapterItem(item, prev);
      setBatchProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setBatchTranslating(false);
  };

  const saveChapterItem = async (item: ChapterItemState) => {
    if (!item.drafts) return;
    setChapterItems((prev) =>
      prev.map((it) => (it.ref === item.ref ? { ...it, status: "saving" } : it)),
    );
    try {
      const res = await fetch("/api/version-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indexTitle: chapterIndexTitle,
          ref: item.ref,
          drafts: item.drafts,
          actualLanguage: targetLanguage,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save error");
      }
      setChapterItems((prev) =>
        prev.map((it) => (it.ref === item.ref ? { ...it, status: "saved" } : it)),
      );
    } catch (err: any) {
      setChapterItems((prev) =>
        prev.map((it) =>
          it.ref === item.ref ? { ...it, status: "error", error: err.message } : it,
        ),
      );
    }
  };

  const handleSaveAllChapter = async () => {
    setBatchSaving(true);
    const toSave = chapterItems.filter((it) => it.drafts && it.status !== "saved");
    for (const item of toSave) {
      await saveChapterItem(item);
    }
    setBatchSaving(false);
  };

  const updateChapterDraft = (ref: string, idx: number, value: string) => {
    setChapterItems((prev) =>
      prev.map((it) => {
        if (it.ref !== ref || !it.drafts) return it;
        const next = [...it.drafts];
        next[idx] = value;
        return { ...it, drafts: next, status: it.status === "saved" ? "translated" : it.status };
      }),
    );
  };

  const sourceComments = loaded ? getComments(loaded.primary) : [];
  const sourceText = sourceComments.join(" ");
  const matchingGlossary =
    targetLanguage === "fr" && glossaryToggle
      ? Object.entries(glossary).filter(
          ([term]) => sourceText && sourceText.includes(term),
        )
      : [];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">
            Sefaria Translation Studio
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const ctx = {
                    input,
                    ref: loaded?.parsed,
                    llm: { ...llm, apiKey: llm.apiKey ? "***" : "" },
                    versions: loaded?.versions,
                    primary: loaded
                      ? {
                          versionTitle: loaded.primary.versionTitle,
                          actualLanguage: loaded.primary.actualLanguage,
                          text: loaded.primary.text,
                        }
                      : null,
                    helperLangs: helperLangs.map((h) => ({
                      lang: h.lang,
                      enabled: h.enabled,
                    })),
                    toggles: { prevSegToggle, glossaryToggle, notesToggle },
                    notes,
                    glossary,
                    prevSegments,
                    drafts,
                    error,
                    refusal,
                    _sefariaRaw: debugSefariaRaw.current,
                    _llmExchange: debugLlmExchange.current,
                  };

                  await navigator.clipboard.writeText(
                    JSON.stringify(ctx, null, 2),
                  );

                  setDebugExportMessage({
                    kind: "success",
                    text: "Debug payload copied to clipboard.",
                  });
                  window.setTimeout(() => setDebugExportMessage(null), 2500);
                } catch {
                  setDebugExportMessage({
                    kind: "error",
                    text: "Failed to copy debug payload to clipboard.",
                  });
                  window.setTimeout(() => setDebugExportMessage(null), 4000);
                }
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Export debug
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              ⚙ Settings
            </button>
          </div>
        </div>
          {debugExportMessage && (
            <div
              className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
                debugExportMessage.kind === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {debugExportMessage.text}
            </div>
          )}
        {showSettings && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Provider
              </label>
              <select
                value={llm.provider}
                onChange={(e) => updateLlm({ provider: e.target.value })}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="openai">openai</option>
                <option value="anthropic">anthropic</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Model
              </label>
              <select
                value={llm.model}
                onChange={(e) => updateLlm({ model: e.target.value })}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                {(MODEL_OPTIONS[llm.provider] || []).map((m: string) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={llm.apiKey}
                onChange={(e) => updateLlm({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Translation target language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => {
                  const next = e.target.value as TargetLanguage;
                  setTargetLanguage(next);
                  setDrafts(null);
                  setSaved(false);
                  setSettingsChanged(true);
                  setGapMessage(null);
                  setError(null);
                }}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                {TARGET_LANGUAGES.map((opt) => (
                  <option key={opt.actualLanguage} value={opt.actualLanguage}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        {/* Mode tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 w-fit">
          <button
            onClick={() => setMode("single")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === "single"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Segment
          </button>
          <button
            onClick={() => setMode("chapter")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === "chapter"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Chapter
          </button>
          <button
            onClick={() => setMode("book")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === "book"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Book
          </button>
        </div>

        {mode === "single" && (
        <>
        {/* Input bar */}
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="Sefaria URL or Ref (e.g. Rashi on Genesis 1:1)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => handleLoad()}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner /> : "Load"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 font-medium underline"
            >
              Close
            </button>
          </div>
        )}

        {refusal && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {refusal}
          </div>
        )}

        {loaded && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-800">
                {loaded.parsed.ref}
              </h2>
              <div className="flex items-center gap-2">
                {settingsChanged && (
                  <span className="text-xs text-amber-600 font-medium">
                    ● Context changed
                  </span>
                )}
                <button
                  onClick={handleTranslate}
                  disabled={drafting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {drafting ? (
                    <span className="flex items-center gap-2">
                      <Spinner /> Translating…
                    </span>
                  ) : (
                    "Translate"
                  )}
                </button>
                {drafts && (
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Saving…
                      </span>
                    ) : saved ? (
                      "✓ Saved"
                    ) : (
                      "Save"
                    )}
                  </button>
                )}
              </div>
            </div>

            {loaded.allPrimaries.length > 1 && (
              <details className="rounded-lg border border-zinc-200 bg-white">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-600">
                  Primary selector ({loaded.primary.versionTitle})
                </summary>
                <div className="border-t border-zinc-100 p-3 space-y-1">
                  {loaded.allPrimaries.map((v) => (
                    <button
                      key={v.versionTitle}
                      onClick={() => handleSelectPrimary(v)}
                      className={`block w-full rounded px-3 py-1.5 text-left text-sm ${
                        v.versionTitle === loaded.primary.versionTitle
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {v.versionTitle}{" "}
                      <span className="text-zinc-400">
                        ({v.actualLanguage})
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}

            {/* Context pack toggles */}
            <details
              open={panelOpen}
              onToggle={(e) =>
                setPanelOpen((e.target as HTMLDetailsElement).open)
              }
              className="rounded-lg border border-zinc-200 bg-white"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-600">
                Context pack
              </summary>
              <div className="border-t border-zinc-100 p-4 space-y-4">
                <Toggle
                  label="Previous segments"
                  checked={prevSegToggle}
                  onChange={(v) => {
                    setPrevSegToggle(v);
                    markSettingsChanged();
                  }}
                />

                {helperLangs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium uppercase text-zinc-500">
                      Helpers
                    </span>
                    {helperLangs.map((h) => (
                      <Toggle
                        key={h.lang}
                        label={h.lang.toUpperCase()}
                        checked={h.enabled}
                        onChange={() => toggleHelperLang(h.lang)}
                      />
                    ))}
                  </div>
                )}

                <Toggle
                  label="Glossary"
                  checked={targetLanguage === "fr" && glossaryToggle}
                  onChange={(v) => {
                    if (targetLanguage !== "fr") return;
                    setGlossaryToggle(v);
                    markSettingsChanged();
                  }}
                />
                {targetLanguage !== "fr" && (
                  <div className="text-xs text-amber-700">
                    Glossary works only for French for now.
                  </div>
                )}

                <Toggle
                  label="Notes"
                  checked={notesToggle}
                  onChange={(v) => {
                    setNotesToggle(v);
                    markSettingsChanged();
                  }}
                />

                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">
                    Translator notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      markSettingsChanged();
                    }}
                    rows={2}
                    placeholder="Style, register, proper nouns…"
                    className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                  />
                </div>

                {matchingGlossary.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-zinc-500">
                      Matching glossary terms
                    </span>
                    <div className="mt-1 space-y-1">
                      {matchingGlossary.map(([term, fr]) => (
                        <div
                          key={term}
                          className="flex gap-2 text-sm text-zinc-700"
                        >
                          <span dir="rtl" className="font-medium">
                            {term}
                          </span>
                          <span className="text-zinc-400">→</span>
                          <span>{fr}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {targetLanguage === "fr" && (
                  <div>
                    <span className="text-xs font-medium uppercase text-zinc-500">
                      Add term
                    </span>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={newTermSource}
                        onChange={(e) => setNewTermSource(e.target.value)}
                        placeholder="Source term (Hebrew)"
                        dir="rtl"
                        className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={newTermFrench}
                        onChange={(e) => setNewTermFrench(e.target.value)}
                        placeholder="French"
                        className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        onClick={handleAddGlossaryTerm}
                        disabled={!newTermSource.trim() || !newTermFrench.trim()}
                        className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </details>

            {/* Panels grid */}
            <div
              className={`grid gap-4 ${
                drafts
                  ? "grid-cols-1 lg:grid-cols-3"
                  : helperLangs.some((h) => h.enabled)
                    ? "grid-cols-1 lg:grid-cols-2"
                    : "grid-cols-1"
              }`}
            >
              <TextPanel
                title={`Source (${loaded.primary.actualLanguage.toUpperCase()})`}
                segments={sourceComments}
                dir="rtl"
                font="font-serif"
              />

              {helperLangs.some((h) => h.enabled) && (
                <TextPanel
                  title={`Helper (${helperLangs.filter((h) => h.enabled).map((h) => h.lang.toUpperCase()).join(", ")})`}
                  segments={helperLangs
                    .filter((h) => h.enabled)
                    .flatMap((h) => getComments(h.versions[0]))}
                />
              )}

              {drafts && (
                <TextPanel
                  title={`Draft (${targetLanguage.toUpperCase()})`}
                  segments={drafts}
                  editable
                  onChange={updateDraft}
                />
              )}
            </div>

            {saved && !gapMessage && (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Draft saved to Version file for "{loaded.parsed.indexTitle}".
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSaved(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Stay
                  </button>
                  <button
                    onClick={handleNextGap}
                    disabled={searchingGap}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {searchingGap ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Searching for next Gap…
                      </span>
                    ) : (
                      "Next Gap"
                    )}
                  </button>
                  <button
                    onClick={() => { reset(); setInput(""); }}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    New URL
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            )}

            {gapMessage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {gapMessage}
              </div>
            )}
          </div>
        )}
        </>
        )}

        {mode === "chapter" && (
        <>
        {/* Chapter input bar */}
        <div className="flex gap-3">
          <input
            type="text"
            value={chapterInput}
            onChange={(e) => setChapterInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadChapter()}
            placeholder="Sefaria URL or Ref of the first segment of the chapter (e.g. Genesis 1:1)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLoadChapter}
            disabled={chapterLoading || !chapterInput.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chapterLoading ? <Spinner /> : "Load chapter"}
          </button>
        </div>

        {chapterError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {chapterError}
            <button
              onClick={() => setChapterError(null)}
              className="ml-3 font-medium underline"
            >
              Close
            </button>
          </div>
        )}

        {chapterItems.length > 0 && (() => {
          const gaps = chapterItems.filter((it) => !it.hasTargetTranslation);
          const alreadyTranslated = chapterItems.length - gaps.length;
          const translatedCount = chapterItems.filter((it) => it.drafts).length;
          const allTranslated = gaps.every((it) => it.drafts);
          return (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <div className="text-sm text-zinc-600">
                  <span className="font-medium text-zinc-900">{chapterIndexTitle}</span>
                  {" — "}
                  {chapterItems.length} Segments · {gaps.length} Gaps
                  {alreadyTranslated > 0 &&
                    ` · ${alreadyTranslated} already in ${TARGET_LANGUAGE_NAMES[targetLanguage]}`}
                  {translatedCount > 0 && ` · ${translatedCount} translated`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTranslateAllChapter}
                    disabled={batchTranslating || gaps.length === 0 || allTranslated}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {batchTranslating ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Translating {batchProgress.done}/{batchProgress.total}…
                      </span>
                    ) : (
                      "Translate all"
                    )}
                  </button>
                  <button
                    onClick={handleSaveAllChapter}
                    disabled={batchSaving || translatedCount === 0}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {batchSaving ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Saving…
                      </span>
                    ) : (
                      "Save all"
                    )}
                  </button>
                  <button
                    onClick={() => downloadCSV(chapterIndexTitle)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {chapterItems.map((item) => (
                  <div key={item.ref} className="rounded-lg border border-zinc-200 bg-white">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
                      <h3 className="text-sm font-medium text-zinc-800">{item.ref}</h3>
                      <div className="flex items-center gap-2">
                        {item.hasTargetTranslation && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                            Already in {TARGET_LANGUAGE_NAMES[targetLanguage]}
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700" title={item.error}>
                            Error
                          </span>
                        )}
                        {item.status === "saved" && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            ✓ Saved
                          </span>
                        )}
                        {!item.hasTargetTranslation && (
                          <>
                            <button
                              onClick={() => translateChapterItem(item)}
                              disabled={item.status === "translating"}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {item.status === "translating" ? <Spinner /> : "Translate"}
                            </button>
                            {item.drafts && (
                              <button
                                onClick={() => saveChapterItem(item)}
                                disabled={item.status === "saving" || item.status === "saved"}
                                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
                              >
                                {item.status === "saving" ? <Spinner /> : "Save"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`grid gap-4 p-4 ${
                        item.drafts
                          ? "grid-cols-1 lg:grid-cols-3"
                          : item.helperComments.length > 0
                            ? "grid-cols-1 lg:grid-cols-2"
                            : "grid-cols-1"
                      }`}
                    >
                      <TextPanel
                        title={`Source (${item.primary.actualLanguage.toUpperCase()})`}
                        segments={item.comments}
                        dir="rtl"
                        font="font-serif"
                      />
                      {item.helperComments.length > 0 && (
                        <TextPanel title="Helper (EN)" segments={item.helperComments} />
                      )}
                      {item.drafts && (
                        <TextPanel
                          title={`Draft (${targetLanguage.toUpperCase()})`}
                          segments={item.drafts}
                          editable
                          onChange={(idx, value) => updateChapterDraft(item.ref, idx, value)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        </>
        )}

        {mode === "book" && (
        <>
        <div className="flex gap-3">
          <input
            type="text"
            value={bookInput}
            onChange={(e) => setBookInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadBook()}
            placeholder="Book URL or index title (e.g. Genesis, Berakhot)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLoadBook}
            disabled={bookLoading || !bookInput.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bookLoading ? <Spinner /> : "Load book"}
          </button>
        </div>

        {bookError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {bookError}
            <button
              onClick={() => setBookError(null)}
              className="ml-3 font-medium underline"
            >
              Close
            </button>
          </div>
        )}

        {outline && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-800">
                {outline.indexTitle}
                <span className="ml-2 font-normal text-zinc-500">
                  {outline.nodes.length} {outline.sectionName.toLowerCase()}
                  {outline.nodes.length === 1 ? "" : "s"}
                </span>
              </h2>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto p-2">
              {outline.nodes.map((node) => {
                const expanded = expandedRefs.has(node.ref);
                const count = childCountFor(node);
                return (
                  <li key={node.ref} className="rounded">
                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50">
                      <button
                        onClick={() => toggleExpandNode(node)}
                        className="w-6 shrink-0 text-zinc-400 hover:text-zinc-700"
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                      <span className="flex-1 text-sm text-zinc-800">
                        {node.label}
                        {count != null && (
                          <span className="ml-2 text-xs text-zinc-400">
                            {count} segments
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => translateSectionFromTree(node.ref)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Translate section
                      </button>
                    </div>
                    {expanded && count != null && count > 0 && (
                      <ul className="mb-2 ml-8 space-y-0.5">
                        {Array.from({ length: count }, (_, i) => {
                          const ref = leafRef(node.ref, i + 1);
                          return (
                            <li
                              key={ref}
                              className="flex items-center justify-between rounded px-2 py-1 hover:bg-zinc-50"
                            >
                              <span className="text-sm text-zinc-600">{ref}</span>
                              <button
                                onClick={() => translateLeafFromTree(ref)}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                Translate
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {expanded && count == null && (
                      <p className="mb-2 ml-8 text-xs text-zinc-400">
                        No segment count for this section.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
