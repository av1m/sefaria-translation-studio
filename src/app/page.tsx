"use client";

import { useState, useCallback } from "react";
import { parseRef, type ParsedRef } from "@/lib/parse-ref";
import type { SefariaVersion } from "@/lib/sefaria-client";

interface LoadedRef {
  parsed: ParsedRef;
  versions: SefariaVersion[];
  primary: SefariaVersion;
  helper: SefariaVersion | null;
  allPrimaries: SefariaVersion[];
}

function isSourceLang(lang: string) {
  return ["he", "arc", "yi"].includes(lang);
}

function getComments(v: SefariaVersion): string[] {
  return Array.isArray(v.text) ? v.text : [v.text];
}

function Spinner() {
  return (
    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
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

  const reset = () => {
    setError(null);
    setRefusal(null);
    setLoaded(null);
    setDrafts(null);
    setSaved(false);
  };

  const handleLoad = useCallback(async () => {
    reset();
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const parsed = parseRef(trimmed);
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
      if (hasFrench) {
        setRefusal(
          "Ce Ref a déjà une traduction française sur Sefaria. Collez un autre lien.",
        );
        setInput("");
        setLoading(false);
        return;
      }

      const primaries = versions.filter(
        (v) => isSourceLang(v.actualLanguage),
      );
      const primary =
        primaries.find((v) => v.isPrimary || v.isSource) ?? primaries[0];

      if (!primary) {
        throw new Error("Aucune version source (hébreu/araméen/yiddish) trouvée pour ce Ref.");
      }

      const helper =
        versions.find(
          (v) => v.actualLanguage === "en" && hasContent(v.text),
        ) ?? null;

      setLoaded({
        parsed: { ...parsed, ref: data.ref ?? parsed.ref },
        versions,
        primary,
        helper,
        allPrimaries: primaries,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [input]);

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
    try {
      const comments = getComments(loaded.primary);
      const contextPack: any = {};
      if (loaded.helper) {
        contextPack.helpers = [
          { lang: "en", text: loaded.helper.text },
        ];
      }
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: loaded.parsed.ref,
          source: comments,
          contextPack,
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

  const updateDraft = (index: number, value: string) => {
    if (!drafts) return;
    const next = [...drafts];
    next[index] = value;
    setDrafts(next);
    setSaved(false);
  };

  const sourceComments = loaded ? getComments(loaded.primary) : [];
  const helperComments = loaded?.helper ? getComments(loaded.helper) : [];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-zinc-900">
          Studio de traduction Sefaria
        </h1>
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

        {/* Error */}
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

        {/* Refusal (not a Gap) */}
        {refusal && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {refusal}
          </div>
        )}

        {/* Content panels */}
        {loaded && (
          <div className="mt-6 space-y-6">
            {/* Ref info */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-800">
                {loaded.parsed.ref}
              </h2>
              <div className="flex gap-2">
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

            {/* Primary selector */}
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

            {/* Panels grid */}
            <div
              className={`grid gap-4 ${
                drafts
                  ? "grid-cols-1 lg:grid-cols-3"
                  : loaded.helper
                    ? "grid-cols-1 lg:grid-cols-2"
                    : "grid-cols-1"
              }`}
            >
              {/* Source panel */}
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

              {/* Helper panel */}
              {loaded.helper && (
                <div className="rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-4 py-2">
                    <h3 className="text-sm font-medium text-zinc-500">
                      Helper (EN)
                    </h3>
                  </div>
                  <div
                    dir="ltr"
                    className="p-4 space-y-3 font-sans text-base leading-relaxed text-zinc-900"
                  >
                    {helperComments.map((c, i) => (
                      <div
                        key={i}
                        className="rounded bg-zinc-50 p-3"
                        dangerouslySetInnerHTML={{ __html: c }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Draft panel */}
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

            {/* Save success */}
            {saved && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Draft enregistré dans le Version file pour «{" "}
                {loaded.parsed.indexTitle} ».
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function hasContent(text: string | string[]): boolean {
  if (Array.isArray(text)) return text.some((t) => t.length > 0);
  return typeof text === "string" && text.length > 0;
}
