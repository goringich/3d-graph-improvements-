import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEdgeDossier,
  buildEntityDossier,
  collectBlindSpots,
} from "../src/intelligence/AtlasViewModel";
import type { IntelligenceProjection } from "../src/intelligence/Projection";

const projection: IntelligenceProjection = {
  schema_version: "2026-08-24.unified-intelligence-graph.v1",
  generated_at: "2026-08-30T00:00:00Z",
  authority: "projection",
  sources: {
    architecture: { status: "available" },
    runtime: { status: "unavailable" },
  },
  nodes: [
    {
      id: "rag",
      label: "RAG v3",
      kind: "service",
      source: "architecture",
      state: {
        lifecycle: "merged",
        verification: "verified",
        live: "unknown",
        freshness: "stale",
      },
      metadata: { purpose: "Provides retrieval context to agents." },
    },
    {
      id: "agent",
      label: "Agent",
      kind: "agent",
      source: "architecture",
      state: { freshness: "verified_current" },
    },
    {
      id: "orphan",
      label: "Detached node",
      kind: "service",
      source: "architecture",
      state: { freshness: "verified_current" },
    },
  ],
  edges: [
    {
      source: "agent",
      target: "rag",
      kind: "DEPENDS_ON",
      source_class: "architecture",
      confidence: "exact",
      metadata: {
        relation_category: "dependency",
        direction: "outgoing",
        impact_semantics: "propagates",
      },
    },
    {
      source: "rag",
      target: "agent",
      kind: "MYSTERY",
      source_class: "architecture",
      metadata: {},
    },
  ],
};

test("entity dossier prioritizes human purpose and truth ladder", () => {
  const dossier = buildEntityDossier(projection.nodes[0], projection);
  assert.equal(dossier.title, "RAG v3");
  assert.equal(dossier.purpose, "Provides retrieval context to agents.");
  assert.equal(dossier.strongestProvenStage, "merged");
  assert.equal(dossier.earliestUnprovenStage, "deployed");
  assert.equal(dossier.relationships.usedBy, 1);
});

test("edge dossier preserves fail-closed impact semantics", () => {
  const dossier = buildEdgeDossier(projection.edges[0]);
  assert.equal(dossier.category, "dependency");
  assert.equal(dossier.impactPropagates, true);

  const unknown = buildEdgeDossier(projection.edges[1]);
  assert.equal(unknown.category, "unknown");
  assert.equal(unknown.impactPropagates, false);
});

test("blind spots expose stale, orphan, unknown relation and unavailable producer", () => {
  const spots = collectBlindSpots(projection);
  assert.ok(spots.some((spot) => spot.kind === "stale_evidence" && spot.entityId === "rag"));
  assert.ok(spots.some((spot) => spot.kind === "orphan" && spot.entityId === "orphan"));
  assert.ok(spots.some((spot) => spot.kind === "unknown_relation"));
  assert.ok(spots.some((spot) => spot.kind === "unavailable_producer"));
});
