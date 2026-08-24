import type { App } from "obsidian";

export const INTELLIGENCE_PROJECTION_PATH =
  "System/Vault Intelligence/Generated/unified-intelligence-graph.v1.json";

export type GraphMode =
  | "all"
  | "knowledge"
  | "architecture"
  | "projects"
  | "live"
  | "semantic";

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

export const nodeMatchesMode = (
  mode: GraphMode,
  metadata: NodeIntelligenceMetadata
): boolean => {
  if (mode === "all") return true;
  if (mode === "knowledge") return metadata.kind === "note";
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
  return metadata.source === "semantic" || metadata.metadata.semantic === true;
};

export const nodeVisualWeight = (metadata: NodeIntelligenceMetadata): number => {
  const pagerank = Number(metadata.metrics.pagerank || 0);
  const degree = Number(metadata.metrics.degree || 0);
  const bridge = Number(metadata.metrics.bridge_score || 0);
  const base = metadata.kind === "note" ? 6 : 8;
  return Math.max(3, base + Math.min(18, pagerank * 500 + Math.log2(degree + 1) * 2 + bridge * 8));
};

export const defaultNodeIntelligence = (): NodeIntelligenceMetadata => ({
  kind: "note",
  source: "obsidian",
  virtual: false,
  metrics: {},
  state: {},
  metadata: {},
});
