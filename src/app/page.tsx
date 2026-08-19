"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { parseRef, type ParsedRef } from "@/lib/parse-ref";
import type { SefariaVersion } from "@/lib/sefaria-client";

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

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
};

function isSourceLang(lang: string) {
  return ["he", "arc", "yi"].includes(lang);
}

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
    model: "gpt-4o",
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

  const [prevSegToggle, setPrevSegToggle] = useState(true);
  const [glossaryToggle, setGlossaryToggle] = useState(true);
  const [notesToggle, setNotesToggle] = useState(true);
  const [helperLangs, setHelperLangs] = useState<HelperLangToggle[]>([]);

  const [notes, setNotes] = useState("");

  const [glossary, setGlossary] = useState<Glossary>({});
  const [newTermSource, setNewTermSource] = useState("");
  const [newTermFrench, setNewTermFrench] = useState("");

  const prevSegmentsCache = useRef<Record<string, string[]>>({});
  const [prevSegments, setPrevSegments] = useState<string[] | null>(null);

  const [settingsChanged, setSettingsChanged] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const [searchingGap, setSearchingGap] = useState(false);
  const [gapMessage, setGapMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/glossary")
      .then((r) => r.json())
      .then(setGlossary)
      .catch(() => {});
  }, []);

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
    setGlossaryToggle(true);
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
      const endpoint = `v3/texts/${encodeURIComponent(prevRef)}?version=all`;
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

  const handleLoad = useCallback(async () => {
    reset();
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const parsed = parseRef(trimmed);
      const encodedRef = encodeURIComponent(parsed.ref);
      const endpoint = `v3/texts/${encodedRef}?version=all`;
      const res = await fetch(
        `/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur Sefaria (${res.status})`);
      }
      const data = await res.json();

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

      const hasFrench = versions.some(
        (v) => v.actualLanguage === "fr" && hasContent(v.text),
      );
      if (hasFrench) {
        setRefusal(
          "Ce Ref a déjà une traduction française sur Sefaria. Collez un autre lien.",
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
          "Aucune version source (hébreu/araméen/yiddish) trouvée pour ce Ref.",
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
          v.actualLanguage === "fr" ||
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
  }, [input, fetchPrevSegments]);

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

      if (glossaryToggle) {
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

      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: loaded.parsed.ref,
          source: comments,
          contextPack,
          llmConfig: llm.apiKey ? llm : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur de traduction");
      }
      const { drafts: d } = await res.json();
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
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur d'enregistrement");
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
    const encodedRef = encodeURIComponent(parsed.ref);
    const endpoint = `v3/texts/${encodedRef}?version=all`;
    const res = await fetch(`/api/sefaria?endpoint=${encodeURIComponent(endpoint)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erreur Sefaria (${res.status})`);
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
    const hasFrench = versions.some(
      (v) => v.actualLanguage === "fr" && hasContent(v.text),
    );
    const primaries = versions.filter((v) => isSourceLang(v.actualLanguage));
    const primary = primaries.find((v) => v.isPrimary || v.isSource) ?? primaries[0];
    const helper = versions.find((v) => v.actualLanguage === "en" && hasContent(v.text)) ?? null;
    return { parsed: { ...parsed, ref: data.ref ?? parsed.ref }, versions, primary, helper, allPrimaries: primaries, next: data.next as string | undefined, hasFrench };
  };

  const handleNextGap = async () => {
    if (!loaded) return;
    setSearchingGap(true);
    setGapMessage(null);
    try {
      let nextRef = loaded.next;
      while (nextRef) {
        const result = await fetchRefData(nextRef);
        if (!result.hasFrench && result.primary) {
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
      setGapMessage("Tous les Segments de cet Index ont déjà une traduction française !");
      setSaved(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchingGap(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!loaded) return;
    const url = `/api/version-file?indexTitle=${encodeURIComponent(loaded.parsed.indexTitle)}&format=csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${loaded.parsed.indexTitle} [fr].csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sourceComments = loaded ? getComments(loaded.primary) : [];
  const sourceText = sourceComments.join(" ");
  const matchingGlossary = Object.entries(glossary).filter(
    ([term]) => sourceText && sourceText.includes(term),
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">
            Studio de traduction Sefaria
          </h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ⚙ Paramètres
          </button>
        </div>
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
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        {/* Input bar */}
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="URL Sefaria ou Ref (ex: Rashi on Genesis 1:1)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLoad}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner /> : "Charger"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 font-medium underline"
            >
              Fermer
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
                    ● Contexte modifié
                  </span>
                )}
                <button
                  onClick={handleTranslate}
                  disabled={drafting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {drafting ? (
                    <span className="flex items-center gap-2">
                      <Spinner /> Traduction…
                    </span>
                  ) : (
                    "Traduire"
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
                        <Spinner /> Enregistrement…
                      </span>
                    ) : saved ? (
                      "✓ Enregistré"
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                )}
              </div>
            </div>

            {loaded.allPrimaries.length > 1 && (
              <details className="rounded-lg border border-zinc-200 bg-white">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-zinc-600">
                  Sélecteur de Primary ({loaded.primary.versionTitle})
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
                  label="Segments précédents"
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
                  label="Glossaire"
                  checked={glossaryToggle}
                  onChange={(v) => {
                    setGlossaryToggle(v);
                    markSettingsChanged();
                  }}
                />

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
                    Notes du traducteur
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      markSettingsChanged();
                    }}
                    rows={2}
                    placeholder="Style, registre, noms propres…"
                    className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                  />
                </div>

                {matchingGlossary.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-zinc-500">
                      Termes du glossaire trouvés
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

                <div>
                  <span className="text-xs font-medium uppercase text-zinc-500">
                    Ajouter un terme
                  </span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={newTermSource}
                      onChange={(e) => setNewTermSource(e.target.value)}
                      placeholder="Terme source (hébreu)"
                      dir="rtl"
                      className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newTermFrench}
                      onChange={(e) => setNewTermFrench(e.target.value)}
                      placeholder="Français"
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
              <div className="rounded-lg border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-4 py-2">
                  <h3 className="text-sm font-medium text-zinc-500">
                    Source ({loaded.primary.actualLanguage.toUpperCase()})
                  </h3>
                </div>
                <div
                  dir="rtl"
                  className="p-4 space-y-3 font-serif text-base leading-relaxed text-zinc-900"
                >
                  {sourceComments.map((c, i) => (
                    <div
                      key={i}
                      className="rounded bg-zinc-50 p-3"
                      dangerouslySetInnerHTML={{ __html: c }}
                    />
                  ))}
                </div>
              </div>

              {helperLangs.some((h) => h.enabled) && (
                <div className="rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-4 py-2">
                    <h3 className="text-sm font-medium text-zinc-500">
                      Helper (
                      {helperLangs
                        .filter((h) => h.enabled)
                        .map((h) => h.lang.toUpperCase())
                        .join(", ")}
                      )
                    </h3>
                  </div>
                  <div
                    dir="ltr"
                    className="p-4 space-y-3 font-sans text-base leading-relaxed text-zinc-900"
                  >
                    {helperLangs
                      .filter((h) => h.enabled)
                      .flatMap((h) => {
                        const texts = getComments(h.versions[0]);
                        return texts.map((c, i) => (
                          <div key={`${h.lang}-${i}`}>
                            {helperLangs.filter((x) => x.enabled).length >
                              1 && (
                              <span className="text-xs text-zinc-400 mb-1 block">
                                {h.lang.toUpperCase()}
                              </span>
                            )}
                            <div
                              className="rounded bg-zinc-50 p-3"
                              dangerouslySetInnerHTML={{ __html: c }}
                            />
                          </div>
                        ));
                      })}
                  </div>
                </div>
              )}

              {drafts && (
                <div className="rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-4 py-2">
                    <h3 className="text-sm font-medium text-zinc-500">
                      Draft (FR)
                    </h3>
                  </div>
                  <div
                    dir="ltr"
                    className="p-4 space-y-3 font-sans text-base leading-relaxed"
                  >
                    {drafts.map((d, i) => (
                      <textarea
                        key={i}
                        value={d}
                        onChange={(e) => updateDraft(i, e.target.value)}
                        rows={Math.max(3, d.split("\n").length + 1)}
                        className="w-full rounded border border-zinc-200 bg-zinc-50 p-3 text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {saved && !gapMessage && (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Draft enregistré dans le Version file pour «{" "}
                  {loaded.parsed.indexTitle} ».
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSaved(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Rester
                  </button>
                  <button
                    onClick={handleNextGap}
                    disabled={searchingGap}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {searchingGap ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Recherche du prochain Gap…
                      </span>
                    ) : (
                      "Gap suivant"
                    )}
                  </button>
                  <button
                    onClick={() => { reset(); setInput(""); }}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Nouvelle URL
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Télécharger CSV
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
      </div>
    </div>
  );
}
