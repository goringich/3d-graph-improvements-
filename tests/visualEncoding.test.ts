import test from "node:test";
import assert from "node:assert/strict";

import {
  confidenceWeight,
  isStructuralKind,
  linkArrowLength,
  linkCurvature,
  linkWidthMultiplier,
} from "../src/intelligence/VisualEncoding.ts";

const edge = (overrides: Record<string, unknown> = {}) => ({
  kind: "wikilink",
  sourceClass: "obsidian",
  confidence: "exact",
  semantic: false,
  metadata: {},
  ...overrides,
}) as any;

test("exact wikilinks remain visually stronger than semantic suggestions", () => {
  const wikilink = linkWidthMultiplier(edge());
  const semantic = linkWidthMultiplier(
    edge({ kind: "SEMANTIC_RELATED", sourceClass: "semantic", confidence: "mutual_top4", semantic: true })
  );
  assert.ok(wikilink > semantic);
  assert.equal(linkArrowLength(edge()), 0);
  assert.ok(linkCurvature(edge({ semantic: true })) > 0);
});

test("typed directed relations receive bounded directional encoding", () => {
  const incident = edge({ kind: "HAS_INCIDENT", sourceClass: "state_graph" });
  const folder = edge({ kind: "IN_FOLDER", sourceClass: "obsidian_structure" });
  assert.ok(linkArrowLength(incident) > linkArrowLength(folder));
  assert.ok(linkWidthMultiplier(incident) > linkWidthMultiplier(folder));
  assert.equal(isStructuralKind("IN_FOLDER"), true);
  assert.equal(isStructuralKind("TAGGED_WITH"), true);
});

test("confidence weights are monotonic for verified and suggested edges", () => {
  assert.ok(confidenceWeight("exact") > confidenceWeight("derived"));
  assert.ok(confidenceWeight("derived") > confidenceWeight("suggested"));
  assert.ok(confidenceWeight("mutual_top2") >= confidenceWeight("mutual_top4"));
});
