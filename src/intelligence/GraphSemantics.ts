import type Node from "../graph/Node";
import type Link from "../graph/Link";
import type { GraphMode } from "./Projection";

export type GraphDirection = "both" | "incoming" | "outgoing";

export type RelationCategory =
  | "dependency"
  | "containment"
  | "ownership"
  | "execution"
  | "data_flow"
  | "verification"
  | "observation"
  | "knowledge"
  | "semantic"
  | "causal"
  | "deployment"
  | "security_boundary"
  | "association"
  | "unknown";

export interface RelationSemantics {
  category: RelationCategory;
  directed: boolean;
  impact: boolean;
}

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

const RELATION_CATEGORIES: Record<string, RelationCategory> = {
  depends_on: "dependency",
  requires: "dependency",
  uses: "dependency",
  imports: "dependency",
  calls: "execution",
  handled_by: "execution",
  invokes: "execution",
  routes_to: "execution",
  reads_writes: "data_flow",
  reads: "data_flow",
  writes: "data_flow",
  consumes: "data_flow",
  produces: "data_flow",
  contains: "containment",
  parent_folder: "containment",
  in_folder: "containment",
  tagged_with: "knowledge",
  wikilink: "knowledge",
  semantic_related: "semantic",
  owns: "ownership",
  owned_by: "ownership",
  verified_by: "verification",
  tested_by: "verification",
  observed_as: "observation",
  observed_in: "observation",
  part_of_journey: "association",
  has_incident: "causal",
  caused_by: "causal",
  deployed_as: "deployment",
  runs_on: "deployment",
  trust_boundary: "security_boundary",
  denies: "security_boundary",
  allows: "security_boundary",
};

const IMPACT_CATEGORIES = new Set<RelationCategory>([
  "dependency",
  "execution",
  "data_flow",
  "causal",
]);

const metadataString = (link: Link, key: string): string => {
  const metadata = link.intelligence.metadata || {};
  return normalize(metadata[key]);
};

export const relationSemantics = (link: Link): RelationSemantics => {
  const kind = normalize(link.intelligence.kind);
  if (link.intelligence.semantic) {
    return { category: "semantic", directed: false, impact: false };
  }

  const metadataCategory = metadataString(link, "relation_category") as RelationCategory;
  const category = (
    metadataCategory && [
      "dependency",
      "containment",
      "ownership",
      "execution",
      "data_flow",
      "verification",
      "observation",
      "knowledge",
      "semantic",
      "causal",
      "deployment",
      "security_boundary",
      "association",
      "unknown",
    ].includes(metadataCategory)
      ? metadataCategory
      : RELATION_CATEGORIES[kind] || "unknown"
  ) as RelationCategory;

  const direction = metadataString(link, "direction");
  const directed = direction === "undirected"
    ? false
    : direction === "directed"
      ? true
      : !UNDIRECTED_RELATIONS.has(kind);

  const impactMetadata = metadataString(link, "impact_semantics");
  const impact = impactMetadata === "propagates"
    ? true
    : impactMetadata === "non_propagating"
      ? false
      : IMPACT_CATEGORIES.has(category);

  return { category, directed, impact };
};

export const isDirectedRelation = (link: Link): boolean => relationSemantics(link).directed;

export const isDependencyRelation = (link: Link): boolean => relationSemantics(link).impact;

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
