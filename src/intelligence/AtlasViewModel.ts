import type {
  GraphMode,
  IntelligenceEdgeRecord,
  IntelligenceNodeRecord,
  IntelligenceProjection,
} from "./Projection";

export type TruthStage =
  | "registered"
  | "source_present"
  | "source_verified"
  | "ci_verified"
  | "merged"
  | "deployed"
  | "reachable"
  | "functional_flow_verified"
  | "outcome_verified"
  | "continuously_observed";

export type TruthState =
  | "verified"
  | "blocked"
  | "failed"
  | "stale"
  | "unknown"
  | "not_applicable";

export type AtlasLens = Exclude<GraphMode, "all">;

export interface TruthSegment {
  stage: TruthStage;
  state: TruthState;
  evidence?: string;
}

export interface RelationshipSummary {
  uses: number;
  usedBy: number;
  dataFlows: number;
  verifiedBy: number;
  total: number;
}

export interface EntityDossier {
  id: string;
  title: string;
  purpose: string;
  kind: string;
  source: string;
  strongestProvenStage?: TruthStage;
  earliestUnprovenStage?: TruthStage;
  freshness?: string;
  live?: string;
  truth: TruthSegment[];
  relationships: RelationshipSummary;
  raw: IntelligenceNodeRecord;
}

export interface EdgeDossier {
  source: string;
  target: string;
  kind: string;
  category: string;
  direction: string;
  impactPropagates: boolean;
  confidence?: string;
  freshness?: string;
  producer: string;
  raw: IntelligenceEdgeRecord;
}

export interface BlindSpot {
  kind:
    | "orphan"
    | "unknown_relation"
    | "stale_evidence"
    | "missing_truth_stage"
    | "conflicting_state"
    | "unavailable_producer";
  entityId?: string;
  edge?: { source: string; target: string; kind: string };
  detail: string;
}

export const TRUTH_STAGES: TruthStage[] = [
  "registered",
  "source_present",
  "source_verified",
  "ci_verified",
  "merged",
  "deployed",
  "reachable",
  "functional_flow_verified",
  "outcome_verified",
  "continuously_observed",
];

const normalized = (value: unknown): string => String(value || "").trim().toLowerCase();

const truthState = (value: unknown): TruthState => {
  const state = normalized(value);
  if (["verified", "verified_current", "success", "pass", "passed", "true", "yes"].includes(state)) {
    return "verified";
  }
  if (state.includes("block") || state === "waiting") return "blocked";
  if (["failed", "failure", "error", "conflicting"].includes(state)) return "failed";
  if (["stale", "expired"].includes(state)) return "stale";
  if (["not_applicable", "n/a", "na"].includes(state)) return "not_applicable";
  return "unknown";
};

const metadataTruth = (node: IntelligenceNodeRecord): Record<string, unknown> => {
  const metadata = node.metadata || {};
  const truth = metadata.truth;
  return truth && typeof truth === "object" && !Array.isArray(truth)
    ? (truth as Record<string, unknown>)
    : {};
};

const inferredTruth = (node: IntelligenceNodeRecord): TruthSegment[] => {
  const explicit = metadataTruth(node);
  const state = node.state || {};
  const lifecycle = normalized(state.lifecycle);
  const verification = normalized(state.verification);
  const live = normalized(state.live);
  const freshness = normalized(state.freshness);

  return TRUTH_STAGES.map((stage) => {
    if (Object.prototype.hasOwnProperty.call(explicit, stage)) {
      return { stage, state: truthState(explicit[stage]) };
    }

    if (stage === "registered") return { stage, state: "verified" };
    if (stage === "source_present" && node.source) return { stage, state: "verified" };
    if (stage === "source_verified" && verification) return { stage, state: truthState(verification) };
    if (stage === "ci_verified" && /ci[_ -]?verified|exact[_ -]?head/.test(lifecycle)) {
      return { stage, state: "verified" };
    }
    if (stage === "merged" && /merged|installed|running|verified_live|verified_current/.test(lifecycle)) {
      return { stage, state: "verified" };
    }
    if (stage === "deployed" && /deployed|running|verified_live|verified_current/.test(lifecycle)) {
      return { stage, state: "verified" };
    }
    if (stage === "reachable" && ["reachable", "verified_live", "verified_current"].includes(live)) {
      return { stage, state: "verified" };
    }
    if (stage === "continuously_observed" && freshness && !["stale", "expired", "unknown"].includes(freshness)) {
      return { stage, state: "verified" };
    }
    if (["failed", "conflicting"].includes(live)) return { stage, state: "failed" };
    if (live.includes("blocked")) return { stage, state: "blocked" };
    if (["stale", "expired"].includes(freshness)) return { stage, state: "stale" };
    return { stage, state: "unknown" };
  });
};

const strongestStage = (truth: TruthSegment[]): TruthStage | undefined => {
  let strongest: TruthStage | undefined;
  truth.forEach((segment) => {
    if (segment.state === "verified") strongest = segment.stage;
  });
  return strongest;
};

const earliestUnproven = (truth: TruthSegment[]): TruthStage | undefined => {
  return truth.find((segment) => !["verified", "not_applicable"].includes(segment.state))?.stage;
};

const purposeText = (node: IntelligenceNodeRecord): string => {
  const metadata = node.metadata || {};
  for (const key of ["purpose", "summary", "description", "role", "responsibility"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `${node.kind.replace(/_/g, " ")} from ${node.source.replace(/_/g, " ")}`;
};

const relationCategory = (edge: IntelligenceEdgeRecord): string => {
  const metadata = edge.metadata || {};
  const value = metadata.relation_category;
  return typeof value === "string" && value ? value : "unknown";
};

const relationDirection = (edge: IntelligenceEdgeRecord): string => {
  const metadata = edge.metadata || {};
  const value = metadata.direction;
  return typeof value === "string" && value ? value : "outgoing";
};

const edgeImpact = (edge: IntelligenceEdgeRecord): boolean => {
  const metadata = edge.metadata || {};
  if (typeof metadata.impact_semantics === "string") {
    return metadata.impact_semantics === "propagates";
  }
  return ["dependency", "execution", "data_flow", "causal"].includes(relationCategory(edge));
};

export const relationshipSummary = (
  nodeId: string,
  projection: IntelligenceProjection
): RelationshipSummary => {
  const result: RelationshipSummary = { uses: 0, usedBy: 0, dataFlows: 0, verifiedBy: 0, total: 0 };
  projection.edges.forEach((edge) => {
    if (edge.source !== nodeId && edge.target !== nodeId) return;
    result.total += 1;
    const category = relationCategory(edge);
    const kind = normalized(edge.kind);
    if (edge.source === nodeId && ["dependency", "execution"].includes(category)) result.uses += 1;
    if (edge.target === nodeId && ["dependency", "execution"].includes(category)) result.usedBy += 1;
    if (category === "data_flow") result.dataFlows += 1;
    if (category === "verification" || kind === "verified_by") result.verifiedBy += 1;
  });
  return result;
};

export const buildEntityDossier = (
  node: IntelligenceNodeRecord,
  projection: IntelligenceProjection
): EntityDossier => {
  const truth = inferredTruth(node);
  return {
    id: node.id,
    title: node.label,
    purpose: purposeText(node),
    kind: node.kind,
    source: node.source,
    strongestProvenStage: strongestStage(truth),
    earliestUnprovenStage: earliestUnproven(truth),
    freshness: node.state?.freshness,
    live: node.state?.live,
    truth,
    relationships: relationshipSummary(node.id, projection),
    raw: node,
  };
};

export const buildEdgeDossier = (edge: IntelligenceEdgeRecord): EdgeDossier => ({
  source: edge.source,
  target: edge.target,
  kind: edge.kind,
  category: relationCategory(edge),
  direction: relationDirection(edge),
  impactPropagates: edgeImpact(edge),
  confidence: edge.confidence,
  freshness:
    typeof edge.metadata?.freshness === "string" ? edge.metadata.freshness : undefined,
  producer: edge.source_class,
  raw: edge,
});

export const nodeMatchesLenses = (
  node: IntelligenceNodeRecord,
  lenses: AtlasLens[],
  matchesMode: (mode: GraphMode, node: IntelligenceNodeRecord) => boolean
): boolean => {
  if (!lenses.length) return true;
  return lenses.every((lens) => matchesMode(lens, node));
};

export const collectBlindSpots = (projection: IntelligenceProjection): BlindSpot[] => {
  const degree = new Map<string, number>();
  projection.nodes.forEach((node) => degree.set(node.id, 0));
  projection.edges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });

  const spots: BlindSpot[] = [];
  projection.nodes.forEach((node) => {
    if ((degree.get(node.id) || 0) === 0) {
      spots.push({ kind: "orphan", entityId: node.id, detail: `${node.label} has no graph relations.` });
    }
    const freshness = normalized(node.state?.freshness);
    if (["stale", "expired", "unknown"].includes(freshness)) {
      spots.push({
        kind: "stale_evidence",
        entityId: node.id,
        detail: `${node.label} evidence freshness is ${freshness || "unknown"}.`,
      });
    }
    const live = normalized(node.state?.live);
    if (live === "conflicting") {
      spots.push({ kind: "conflicting_state", entityId: node.id, detail: `${node.label} has conflicting live state.` });
    }
    const dossier = buildEntityDossier(node, projection);
    if (dossier.earliestUnprovenStage) {
      spots.push({
        kind: "missing_truth_stage",
        entityId: node.id,
        detail: `${node.label} earliest unproven stage is ${dossier.earliestUnprovenStage}.`,
      });
    }
  });

  projection.edges.forEach((edge) => {
    if (relationCategory(edge) === "unknown") {
      spots.push({
        kind: "unknown_relation",
        edge: { source: edge.source, target: edge.target, kind: edge.kind },
        detail: `${edge.kind} has no canonical relation category.`,
      });
    }
  });

  Object.entries(projection.sources || {}).forEach(([source, raw]) => {
    const record = raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
    const status = normalized(record.status || record.state || record.availability);
    if (["unavailable", "missing", "failed", "stale"].includes(status)) {
      spots.push({ kind: "unavailable_producer", detail: `${source} producer is ${status}.` });
    }
  });

  return spots;
};
