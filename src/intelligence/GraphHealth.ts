import type { IntelligenceProjection } from "./Projection";

export type GraphHealthSeverity = "critical" | "warning" | "info";

export interface GraphHealthFinding {
  severity: GraphHealthSeverity;
  title: string;
  detail: string;
}

export interface GraphHealthSummary {
  nodeCount: number;
  edgeCount: number;
  componentCount?: number;
  largestComponentRatio?: number;
  orphanCount?: number;
  sourceFamilyCount?: number;
  crossSourceEdgeCount?: number;
  crossSourceBridgeNodeCount?: number;
  identityBridgeCoverage?: number;
  unknownRelationCount?: number;
  unavailableSources: string[];
  findings: GraphHealthFinding[];
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const finiteNumber = (value: unknown): number | undefined => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const statusOf = (value: unknown): string => {
  const record = asRecord(value);
  return typeof record.status === "string" ? record.status : "";
};

const unavailableSources = (projection: IntelligenceProjection): string[] => {
  return Object.entries(projection.sources || {})
    .filter(([, value]) => {
      const status = statusOf(value).toLowerCase();
      return [
        "unavailable",
        "rejected_invalid_or_degraded",
        "failed",
        "stale",
        "unknown",
      ].includes(status);
    })
    .map(([name]) => name)
    .sort();
};

const pushFinding = (
  findings: GraphHealthFinding[],
  severity: GraphHealthSeverity,
  title: string,
  detail: string
) => findings.push({ severity, title, detail });

export const summarizeGraphHealth = (
  projection: IntelligenceProjection
): GraphHealthSummary => {
  const quality = asRecord(projection.graph_quality);
  const counts = asRecord(projection.counts);
  const relationCategories = asRecord(quality.relation_categories);

  const nodeCount = finiteNumber(quality.node_count)
    ?? finiteNumber(counts.nodes)
    ?? projection.nodes.length;
  const edgeCount = finiteNumber(quality.active_edge_count)
    ?? finiteNumber(counts.edges)
    ?? projection.edges.length;
  const componentCount = finiteNumber(quality.component_count);
  const largestComponentRatio = finiteNumber(quality.largest_component_ratio);
  const orphanCount = finiteNumber(quality.orphan_count);
  const sourceFamilyCount = finiteNumber(quality.source_family_count);
  const crossSourceEdgeCount = finiteNumber(quality.cross_source_edge_count);
  const crossSourceBridgeNodeCount = finiteNumber(quality.cross_source_bridge_node_count);
  const identityBridgeCoverage = finiteNumber(quality.identity_bridge_coverage);
  const unknownRelationCount = finiteNumber(relationCategories.unknown);
  const unavailable = unavailableSources(projection);
  const findings: GraphHealthFinding[] = [];

  if (!projection.graph_quality) {
    pushFinding(
      findings,
      "info",
      "Graph-quality producer unavailable",
      "Refresh the v3 unified projection to calculate fragmentation, bridge and relation-quality diagnostics."
    );
  }

  if (componentCount !== undefined && componentCount > 1) {
    const severe = componentCount >= 10 || (largestComponentRatio ?? 1) < 0.6;
    pushFinding(
      findings,
      severe ? "critical" : "warning",
      "Graph is fragmented",
      `${componentCount} connected components${largestComponentRatio === undefined ? "" : `; largest contains ${(largestComponentRatio * 100).toFixed(1)}% of active nodes`}.`
    );
  }

  if (largestComponentRatio !== undefined && largestComponentRatio < 0.85) {
    pushFinding(
      findings,
      largestComponentRatio < 0.6 ? "critical" : "warning",
      "Main component coverage is low",
      `Only ${(largestComponentRatio * 100).toFixed(1)}% of active nodes are in the largest connected component.`
    );
  }

  if (orphanCount !== undefined) {
    const orphanRatio = nodeCount > 0 ? orphanCount / nodeCount : 0;
    if (orphanCount >= 5 && orphanRatio >= 0.02) {
      pushFinding(
        findings,
        orphanRatio >= 0.08 ? "critical" : "warning",
        "Too many orphan nodes",
        `${orphanCount} nodes (${(orphanRatio * 100).toFixed(1)}%) have no active graph relation.`
      );
    }
  }

  if (
    sourceFamilyCount !== undefined
    && sourceFamilyCount >= 3
    && (crossSourceBridgeNodeCount ?? 0) === 0
  ) {
    pushFinding(
      findings,
      "critical",
      "Source families are not bridged",
      `${sourceFamilyCount} source families are present but no node currently bridges across source boundaries.`
    );
  } else if (
    sourceFamilyCount !== undefined
    && sourceFamilyCount >= 3
    && crossSourceEdgeCount !== undefined
    && crossSourceEdgeCount < sourceFamilyCount - 1
  ) {
    pushFinding(
      findings,
      "warning",
      "Cross-source connectivity is thin",
      `${sourceFamilyCount} source families have only ${crossSourceEdgeCount} active cross-source edges.`
    );
  }

  if (identityBridgeCoverage !== undefined && identityBridgeCoverage < 0.8) {
    pushFinding(
      findings,
      identityBridgeCoverage < 0.5 ? "critical" : "warning",
      "Knowledge identity coverage is incomplete",
      `${(identityBridgeCoverage * 100).toFixed(1)}% of notes with explicit system identity are connected to an exact graph entity.`
    );
  }

  if (unknownRelationCount !== undefined && unknownRelationCount > 0) {
    pushFinding(
      findings,
      "warning",
      "Unknown relation semantics remain",
      `${unknownRelationCount} active edges use an unclassified relation kind. They are fail-closed and do not propagate impact.`
    );
  }

  if (unavailable.length) {
    pushFinding(
      findings,
      "warning",
      "Some graph producers are unavailable",
      unavailable.join(", ")
    );
  }

  if (!findings.length) {
    pushFinding(
      findings,
      "info",
      "No high-signal graph weakness detected",
      "Current bounded quality metrics do not cross the built-in warning thresholds."
    );
  }

  const severityOrder: Record<GraphHealthSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  findings.sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity]
      || left.title.localeCompare(right.title)
  );

  return {
    nodeCount,
    edgeCount,
    componentCount,
    largestComponentRatio,
    orphanCount,
    sourceFamilyCount,
    crossSourceEdgeCount,
    crossSourceBridgeNodeCount,
    identityBridgeCoverage,
    unknownRelationCount,
    unavailableSources: unavailable,
    findings,
  };
};
