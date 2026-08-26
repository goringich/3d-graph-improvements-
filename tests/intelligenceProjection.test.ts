import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultNodeIntelligence,
  isLiveGap,
  isStructuralNode,
  nodeMatchesMode,
  nodeVisualWeight,
  parseIntelligenceProjection,
} from "../src/intelligence/Projection.ts";

test("parseIntelligenceProjection accepts only the canonical projection contract", () => {
  const valid = JSON.stringify({
    schema_version: "2026-08-24.unified-intelligence-graph.v1",
    generated_at: "2026-08-24T12:00:00Z",
    authority: "projection",
    sources: {},
    nodes: [],
    edges: [],
  });

  assert.ok(parseIntelligenceProjection(valid));
  assert.equal(
    parseIntelligenceProjection(
      JSON.stringify({
        schema_version: "wrong",
        authority: "projection",
        nodes: [],
        edges: [],
      })
    ),
    null
  );
  assert.equal(parseIntelligenceProjection("not-json"), null);
});

test("nodeMatchesMode keeps source families distinct and includes bounded knowledge structure", () => {
  const note = defaultNodeIntelligence();
  assert.equal(nodeMatchesMode("knowledge", note), true);
  assert.equal(nodeMatchesMode("architecture", note), false);

  const folder = {
    ...defaultNodeIntelligence(),
    kind: "folder",
    source: "obsidian_structure",
    virtual: true,
  };
  assert.equal(isStructuralNode(folder), true);
  assert.equal(nodeMatchesMode("knowledge", folder), true);

  const architecture = {
    ...defaultNodeIntelligence(),
    kind: "authority",
    source: "architecture",
    virtual: true,
  };
  assert.equal(nodeMatchesMode("architecture", architecture), true);
  assert.equal(nodeMatchesMode("projects", architecture), false);

  const live = {
    ...defaultNodeIntelligence(),
    source: "state_graph",
    state: { live: "verified_live" },
    virtual: true,
  };
  assert.equal(nodeMatchesMode("live", live), true);
});

test("system-wide lenses classify runtime, AI, security, dependencies and changes deterministically", () => {
  const runtime = {
    ...defaultNodeIntelligence(),
    kind: "service",
    source: "architecture",
    virtual: true,
    metadata: { purpose: "systemd runtime service" },
  };
  assert.equal(nodeMatchesMode("runtime", runtime), true);
  assert.equal(nodeMatchesMode("dependencies", runtime), true);

  const ai = {
    ...defaultNodeIntelligence(),
    kind: "agent",
    source: "architecture",
    virtual: true,
    metadata: { purpose: "Codex routing agent" },
  };
  assert.equal(nodeMatchesMode("ai", ai), true);

  const security = {
    ...defaultNodeIntelligence(),
    kind: "authority",
    source: "architecture",
    virtual: true,
    metadata: { purpose: "secret trust boundary" },
  };
  assert.equal(nodeMatchesMode("security", security), true);

  const changed = {
    ...defaultNodeIntelligence(),
    metadata: { change: "changed" },
  };
  assert.equal(nodeMatchesMode("changes", changed), true);
});

test("live-gap classification is explicit and does not treat good live state as a gap", () => {
  const stale = {
    ...defaultNodeIntelligence(),
    state: { live: "stale" },
  };
  const verified = {
    ...defaultNodeIntelligence(),
    state: { live: "verified_current", freshness: "fresh" },
  };
  assert.equal(isLiveGap(stale), true);
  assert.equal(isLiveGap(verified), false);
});

test("nodeVisualWeight rewards central and supported hub nodes without runaway sizes", () => {
  const small = defaultNodeIntelligence();
  const central = {
    ...defaultNodeIntelligence(),
    metrics: {
      degree: 64,
      pagerank: 0.02,
      bridge_score: 0.8,
    },
  };
  const stableTag = {
    ...defaultNodeIntelligence(),
    kind: "tag",
    source: "obsidian_structure",
    virtual: true,
    metadata: { support: 32 },
  };

  assert.ok(nodeVisualWeight(central) > nodeVisualWeight(small));
  assert.ok(nodeVisualWeight(stableTag) > 4.5);
  assert.ok(nodeVisualWeight(central) <= 26);
});
