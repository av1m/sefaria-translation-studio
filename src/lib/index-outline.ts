import { SefariaClient, type SefariaTextsResponse } from "./sefaria-client";

export interface OutlineNode {
  ref: string;
  label: string;
  childCount?: number;
}

export interface IndexOutline {
  indexTitle: string;
  sectionName: string;
  nodes: OutlineNode[];
}

const DEFAULT_MAX_SECTIONS = 2000;

export function leafRef(sectionRef: string, n: number): string {
  return `${sectionRef}:${n}`;
}

export function childCountsFromShape(shape: unknown): number[] {
  const entry = Array.isArray(shape) ? shape[0] : shape;
  if (!entry || typeof entry !== "object") return [];
  const chapters = (entry as { chapters?: unknown }).chapters;
  if (!Array.isArray(chapters)) return [];
  const nums = chapters.map((c) => Number(c)).filter((n) => Number.isFinite(n));
  let i = 0;
  while (i < nums.length && nums[i] === 0) i++;
  return nums.slice(i);
}

function sectionAddress(ref: string, indexTitle: string): string {
  if (ref === indexTitle) return ref;
  if (ref.startsWith(`${indexTitle} `)) {
    return ref.slice(indexTitle.length).trim();
  }
  return ref;
}

function sectionLabel(
  ref: string,
  indexTitle: string,
  sectionName: string,
): string {
  const address = sectionAddress(ref, indexTitle);
  if (!address || address === indexTitle) return ref;
  return `${sectionName} ${address}`;
}

function sameIndex(indexTitle: string, other?: string): boolean {
  return !other || other === indexTitle;
}

export async function buildOutline(
  indexTitle: string,
  client: SefariaClient,
  options: { maxSections?: number } = {},
): Promise<IndexOutline> {
  const maxSections = options.maxSections ?? DEFAULT_MAX_SECTIONS;
  const root = await client.getTexts(indexTitle);
  const resolvedTitle = root.indexTitle || indexTitle;
  const sectionName = root.sectionNames?.[0] || "Section";

  const start =
    root.firstAvailableSectionRef ||
    (root.ref && root.ref !== resolvedTitle ? root.ref : undefined) ||
    root.next;

  if (!start) {
    return { indexTitle: resolvedTitle, sectionName, nodes: [] };
  }

  const nodes: OutlineNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = start;
  let hops = 0;

  while (current && hops < maxSections) {
    hops++;
    if (seen.has(current)) break;
    seen.add(current);

    const data: SefariaTextsResponse = await client.getTexts(current);
    if (!sameIndex(resolvedTitle, data.indexTitle)) break;

    const ref: string = data.sectionRef || data.ref || current;
    nodes.push({
      ref,
      label: sectionLabel(ref, resolvedTitle, sectionName),
    });

    const next = data.next;
    if (!next || next === ref || seen.has(next)) break;
    current = next;
  }

  try {
    const shape = await client.getShape(resolvedTitle);
    const counts = childCountsFromShape(shape);
    if (counts.length === nodes.length) {
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].childCount = counts[i];
      }
    }
  } catch {
    // Shape is optional enrichment.
  }

  return { indexTitle: resolvedTitle, sectionName, nodes };
}
