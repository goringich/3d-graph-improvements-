import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultNodeIntelligence,
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

test("nodeMatchesMode keeps source families distinct", () => {
  const note = defaultNodeIntelligence();
  assert.equal(nodeMatchesMode("knowledge", note), true);
  assert.equal(nodeMatchesMode("architecture", note), false);

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

test("nodeVisualWeight rewards central nodes without unbounded sizes", () => {
  const small = defaultNodeIntelligence();
  const central = {
    ...defaultNodeIntelligence(),
    metrics: {
      degree: 64,
      pagerank: 0.02,
      bridge_score: 0.8,
    },
  };

  assert.ok(nodeVisualWeight(central) > nodeVisualWeight(small));
  assert.ok(nodeVisualWeight(central) <= 26);
});
