import type Node from "../graph/Node";
import type Link from "../graph/Link";
import type { GraphMode } from "./Projection";

export type GraphDirection = "both" | "incoming" | "outgoing";

export type SpotlightCommand =
  | { action: "search"; term: string; mode?: GraphMode; liveGaps?: boolean }
  | { action: "impact"; term: string; direction: GraphDirection; depth: number }
  | { action: "path"; from: string; to: string };

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const scalarMetadata = (node: Node): string => {
  const metadata = node.intelligence.metadata || {};
  return Object.entries(metadata)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");
};

export const searchableNodeText = (node: Node): string => {
  return [
    node.name,
    node.path,
    node.intelligence.kind,
    node.intelligence.source,
    node.intelligence.state.live,
    node.intelligence.state.lifecycle,
    node.intelligence.state.authority,
    scalarMetadata(node),
    node.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const rankNodeMatches = (nodes: Node[], term: string, limit = 12): Node[] => {
  const query = normalize(term);
  if (!query) return [];
  const tokens = query.split(/\s+/).filter(Boolean);

  return nodes
    .map((node) => {
      const label = normalize(node.name);
      const path = normalize(node.path);
      const text = searchableNodeText(node);
      let score = 0;
      if (label === query) score += 120;
      if (path === query || path.endsWith(`/${query}`)) score += 105;
      if (label.startsWith(query)) score += 80;
      if (label.includes(query)) score += 62;
      if (path.includes(query)) score += 42;
      if (text.includes(query)) score += 30;
      for (const token of tokens) {
        if (label.includes(token)) score += 12;
        else if (path.includes(token)) score += 8;
        else if (text.includes(token)) score += 4;
      }
      score += Math.min(10, Math.log2(Number(node.intelligence.metrics.degree || 0) + 1));
      return { node, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name))
    .slice(0, Math.max(1, limit))
    .map((item) => item.node);
};

const UNDIRECTED_RELATIONS = new Set([
  "wikilink",
  "semantic_related",
  "tagged_with",
  "in_folder",
]);

export const isDirectedRelation = (link: Link): boolean => {
  if (link.intelligence.semantic) return false;
  return !UNDIRECTED_RELATIONS.has(normalize(link.intelligence.kind));
};

export const isDependencyRelation = (link: Link): boolean => {
  const kind = normalize(link.intelligence.kind);
  if (link.intelligence.semantic) return false;
  return !new Set(["wikilink", "tagged_with", "in_folder", "parent_folder"]).has(kind);
};

export const parseSpotlightQuery = (query: string): SpotlightCommand => {
  const raw = query.trim();
  const normalized = raw.toLowerCase();

  const path = raw.match(/^(?:path|route|путь)\s+(.+?)\s*(?:->|→|\bto\b|\bдо\b)\s*(.+)$/i);
  if (path) {
    return { action: "path", from: path[1].trim(), to: path[2].trim() };
  }

  const impactRules: Array<{
    pattern: RegExp;
    direction: GraphDirection;
  }> = [
    { pattern: /^(?:what depends on|dependents of|кто зависит от)\s+(.+)$/i, direction: "incoming" },
    { pattern: /^(?:dependencies of|depends on|зависимости)\s+(.+)$/i, direction: "outgoing" },
    { pattern: /^(?:impact of|impact|влияние)\s+(.+)$/i, direction: "both" },
  ];
  for (const rule of impactRules) {
    const match = raw.match(rule.pattern);
    if (match) {
      return { action: "impact", term: match[1].trim(), direction: rule.direction, depth: 2 };
    }
  }

  if (/\b(stale|live gaps?|conflicts?|unknown|устарев|конфликт)\b/.test(normalized)) {
    return {
      action: "search",
      term: raw.replace(/\b(stale|live gaps?|conflicts?|unknown|устарев\w*|конфликт\w*)\b/gi, "").trim(),
      mode: "live",
      liveGaps: true,
    };
  }
  if (/\b(runtime|services?|hosts?|ports?|containers?|сервисы?|хосты?)\b/.test(normalized)) {
    return { action: "search", term: raw, mode: "runtime" };
  }
  if (/\b(agents?|models?|rag|qdrant|codex|skills?|агенты?|модели?)\b/.test(normalized)) {
    return { action: "search", term: raw, mode: "ai" };
  }
  if (/\b(security|trust|permissions?|secret|auth|безопасност|секрет)\b/.test(normalized)) {
    return { action: "search", term: raw, mode: "security" };
  }

  return { action: "search", term: raw };
};
