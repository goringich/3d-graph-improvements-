import test from "node:test";
import assert from "node:assert/strict";

import { summarizeGraphHealth } from "../src/intelligence/GraphHealth.ts";

const projection = (quality: Record<string, unknown>, sources: Record<string, unknown> = {}) => ({
  schema_version: "2026-08-24.unified-intelligence-graph.v1" as const,
  generated_at: "2026-08-26T00:00:00+00:00",
  authority: "projection" as const,
  sources,
  counts: { nodes: 100, edges: 180 },
  graph_quality: quality,
  nodes: [],
  edges: [],
});

test("graph health ranks fragmentation and orphan debt as high-signal findings", () => {
  const summary = summarizeGraphHealth(projection({
    node_count: 100,
    active_edge_count: 80,
    component_count: 12,
    largest_component_ratio: 0.55,
    orphan_count: 10,
    source_family_count: 4,
    cross_source_edge_count: 0,
    cross_source_bridge_node_count: 0,
    identity_bridge_coverage: 0.4,
    relation_categories: { unknown: 7 },
  }));

  assert.equal(summary.findings[0].severity, "critical");
  assert.ok(summary.findings.some((finding) => finding.title === "Graph is fragmented"));
  assert.ok(summary.findings.some((finding) => finding.title === "Too many orphan nodes"));
  assert.ok(summary.findings.some((finding) => finding.title === "Source families are not bridged"));
  assert.ok(summary.findings.some((finding) => finding.title === "Knowledge identity coverage is incomplete"));
  assert.ok(summary.findings.some((finding) => finding.title === "Unknown relation semantics remain"));
});

test("unknown relation debt is visible but fail-closed impact remains a warning", () => {
  const summary = summarizeGraphHealth(projection({
    node_count: 100,
    active_edge_count: 180,
    component_count: 1,
    largest_component_ratio: 1,
    orphan_count: 0,
    source_family_count: 3,
    cross_source_edge_count: 20,
    cross_source_bridge_node_count: 12,
    identity_bridge_coverage: 1,
    relation_categories: { dependency: 80, unknown: 2 },
  }));

  const finding = summary.findings.find((item) => item.title === "Unknown relation semantics remain");
  assert.equal(finding?.severity, "warning");
  assert.match(finding?.detail || "", /do not propagate impact/);
});

test("unavailable producer status is surfaced", () => {
  const summary = summarizeGraphHealth(
    projection(
      {
        node_count: 10,
        active_edge_count: 12,
        component_count: 1,
        largest_component_ratio: 1,
        orphan_count: 0,
        source_family_count: 2,
        cross_source_edge_count: 3,
        cross_source_bridge_node_count: 2,
        relation_categories: {},
      },
      {
        obsidian: { status: "available" },
        semantic: { status: "rejected_invalid_or_degraded" },
        state_graph: { status: "unavailable" },
      }
    )
  );

  assert.deepEqual(summary.unavailableSources, ["semantic", "state_graph"]);
  assert.ok(summary.findings.some((finding) => finding.title === "Some graph producers are unavailable"));
});

test("healthy bounded metrics produce an informational result", () => {
  const summary = summarizeGraphHealth(projection({
    node_count: 100,
    active_edge_count: 240,
    component_count: 1,
    largest_component_ratio: 1,
    orphan_count: 0,
    source_family_count: 5,
    cross_source_edge_count: 30,
    cross_source_bridge_node_count: 20,
    identity_bridge_coverage: 0.95,
    relation_categories: { dependency: 100, knowledge: 140 },
  }));

  assert.equal(summary.findings.length, 1);
  assert.equal(summary.findings[0].severity, "info");
  assert.equal(summary.findings[0].title, "No high-signal graph weakness detected");
});

test("older projection without graph quality degrades honestly", () => {
  const summary = summarizeGraphHealth({
    schema_version: "2026-08-24.unified-intelligence-graph.v1",
    generated_at: "2026-08-26T00:00:00+00:00",
    authority: "projection",
    sources: {},
    counts: { nodes: 7, edges: 9 },
    nodes: [],
    edges: [],
  });

  assert.equal(summary.nodeCount, 7);
  assert.equal(summary.edgeCount, 9);
  assert.equal(summary.findings[0].title, "Graph-quality producer unavailable");
});
