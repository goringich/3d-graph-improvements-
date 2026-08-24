import type { App } from "obsidian";

export const INTELLIGENCE_PROJECTION_PATH =
  "System/Vault Intelligence/Generated/unified-intelligence-graph.v1.json";

export type GraphMode =
  | "all"
  | "knowledge"
  | "architecture"
  | "projects"
  | "runtime"
  | "ai"
  | "security"
  | "dependencies"
  | "live"
  | "semantic"
  | "changes";

export interface IntelligenceNodeMetrics {
  degree?: number;
  pagerank?: number;
  betweenness?: number;
  bridge_score?: number;
  community?: string | number;
}

export interface IntelligenceNodeState {
  lifecycle?: string;
  live?: string;
  freshness?: string;
  verification?: string;
  authority?: string;
}

export interface IntelligenceNodeRecord {
  id: string;
  label: string;
  kind: string;
  source: string;
  note_path?: string;
  layer?: number;
  virtual?: boolean;
  metrics?: IntelligenceNodeMetrics;
  state?: IntelligenceNodeState;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceEdgeRecord {
  source: string;
  target: string;
  kind: string;
  source_class: string;
  confidence?: string;
  semantic?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceProjection {
  schema_version: "2026-08-24.unified-intelligence-graph.v1";
  generated_at: string;
  authority: "projection";
  sources: Record<string, unknown>;
  counts?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  graph_quality?: Record<string, unknown>;
  nodes: IntelligenceNodeRecord[];
  edges: IntelligenceEdgeRecord[];
}

export interface NodeIntelligenceMetadata {
  projectionId?: string;
  kind: string;
  source: string;
  layer?: number;
  virtual: boolean;
  metrics: IntelligenceNodeMetrics;
  state: IntelligenceNodeState;
  metadata: Record<string, unknown>;
}

const asObject = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const searchable = (metadata: NodeIntelligenceMetadata): string => {
  return [
    metadata.kind,
    metadata.source,
    metadata.state.lifecycle,
    metadata.state.live,
    metadata.state.authority,
    JSON.stringify(metadata.metadata || {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const parseIntelligenceProjection = (
  raw: string
): IntelligenceProjection | null => {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    return null;
  }

  const record = asObject(payload);
  if (
    record.schema_version !== "2026-08-24.unified-intelligence-graph.v1" ||
    record.authority !== "projection" ||
    !Array.isArray(record.nodes) ||
    !Array.isArray(record.edges)
  ) {
    return null;
  }

  return payload as IntelligenceProjection;
};

export const loadIntelligenceProjection = async (
  app: App
): Promise<IntelligenceProjection | null> => {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(INTELLIGENCE_PROJECTION_PATH))) return null;

  try {
    const raw = await adapter.read(INTELLIGENCE_PROJECTION_PATH);
    return parseIntelligenceProjection(raw);
  } catch (_error) {
    return null;
  }
};

export const isStructuralNode = (metadata: NodeIntelligenceMetadata): boolean => {
  return (
    metadata.source === "obsidian_structure" ||
    metadata.kind === "folder" ||
    metadata.kind === "tag"
  );
};

export const isLiveGap = (metadata: NodeIntelligenceMetadata): boolean => {
  const live = String(metadata.state.live || "").toLowerCase();
  const freshness = String(metadata.state.freshness || "").toLowerCase();
  return (
    ["stale", "unknown", "conflicting", "failed", "blocked_external"].includes(live) ||
    ["stale", "expired", "unknown"].includes(freshness)
  );
};

export const nodeMatchesMode = (
  mode: GraphMode,
  metadata: NodeIntelligenceMetadata
): boolean => {
  if (mode === "all") return true;
  if (mode === "knowledge") {
    return metadata.kind === "note" || isStructuralNode(metadata);
  }
  if (mode === "architecture") {
    return metadata.source === "architecture" || metadata.kind === "architecture_layer";
  }
  if (mode === "projects") return metadata.source === "project_reality";
  if (mode === "live") {
    return (
      metadata.source === "state_graph" ||
      Boolean(metadata.state.live && metadata.state.live !== "not_applicable")
    );
  }
  if (mode === "semantic") {
    return metadata.source === "semantic" || metadata.metadata.semantic === true;
  }
  if (mode === "changes") {
    return ["added", "changed", "removed"].includes(
      String(metadata.metadata.change || "").toLowerCase()
    );
  }

  const text = searchable(metadata);
  if (mode === "runtime") {
    return (
      ["runtime", "service", "container", "endpoint", "host", "deployment", "model"].includes(
        metadata.kind
      ) ||
      metadata.source === "state_graph" ||
      /runtime|systemd|container|service|host|port|endpoint|deploy/.test(text)
    );
  }
  if (mode === "ai") {
    return (
      ["agent", "model", "skill", "technology"].includes(metadata.kind) ||
      /agent|model|llm|codex|rag|retriev|qdrant|context|router|routing|skill|ollama|openwebui/.test(
        text
      )
    );
  }
  if (mode === "security") {
    return /security|trust|auth|secret|permission|workforce|client|external|owner|boundary|approval/.test(
      text
    );
  }
  return (
    !isStructuralNode(metadata) &&
    ["architecture", "project_reality", "state_graph"].includes(metadata.source)
  );
};

export const nodeVisualWeight = (metadata: NodeIntelligenceMetadata): number => {
  const pagerank = Number(metadata.metrics.pagerank || 0);
  const degree = Number(metadata.metrics.degree || 0);
  const bridge = Number(metadata.metrics.bridge_score || 0);
  const support = Number(metadata.metadata.support || 0);
  const baseByKind: Record<string, number> = {
    note: 6,
    folder: 5,
    tag: 4.5,
    architecture_layer: 11,
    authority: 10,
    project: 9,
    repository: 8,
    incident: 8,
    service: 7.5,
    agent: 7.5,
    model: 7,
  };
  const base = baseByKind[metadata.kind] ?? (metadata.virtual ? 7 : 6);
  const centrality = pagerank * 500 + Math.log2(degree + 1) * 2 + bridge * 8;
  const supportBoost = Math.min(8, Math.log2(support + 1) * 1.4);
  const changeBoost = metadata.metadata.change ? 2 : 0;
  return Math.max(3, base + Math.min(18, centrality) + supportBoost + changeBoost);
};

export const defaultNodeIntelligence = (): NodeIntelligenceMetadata => ({
  kind: "note",
  source: "obsidian",
  virtual: false,
  metrics: {},
  state: {},
  metadata: {},
});
