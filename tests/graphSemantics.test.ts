import test from "node:test";
import assert from "node:assert/strict";

import {
  parseSpotlightQuery,
  rankNodeMatches,
  isDirectedRelation,
  isDependencyRelation,
} from "../src/intelligence/GraphSemantics.ts";
import { defaultNodeIntelligence } from "../src/intelligence/Projection.ts";

const node = (name: string, path: string, metadata: Record<string, unknown> = {}) => ({
  id: path,
  name,
  path,
  isAttachment: false,
  val: 10,
  neighbors: [],
  links: [],
  tags: [],
  intelligence: {
    ...defaultNodeIntelligence(),
    metadata,
  },
});

const link = (kind: string, semantic = false) => ({
  source: "a",
  target: "b",
  linksAnAttachment: false,
  intelligence: {
    kind,
    sourceClass: "test",
    semantic,
    metadata: {},
  },
});

test("Spotlight parses impact, dependencies and path commands", () => {
  assert.deepEqual(parseSpotlightQuery("impact of Obsidian"), {
    action: "impact",
    term: "Obsidian",
    direction: "both",
    depth: 2,
  });
  assert.deepEqual(parseSpotlightQuery("what depends on Qdrant"), {
    action: "impact",
    term: "Qdrant",
    direction: "incoming",
    depth: 2,
  });
  assert.deepEqual(parseSpotlightQuery("dependencies of Atlas"), {
    action: "impact",
    term: "Atlas",
    direction: "outgoing",
    depth: 2,
  });
  assert.deepEqual(parseSpotlightQuery("path Obsidian -> Qdrant"), {
    action: "path",
    from: "Obsidian",
    to: "Qdrant",
  });
});

test("Spotlight maps operational terms to deterministic lenses", () => {
  assert.equal(parseSpotlightQuery("runtime services").action, "search");
  const runtime = parseSpotlightQuery("runtime services");
  assert.equal(runtime.action === "search" ? runtime.mode : undefined, "runtime");
  const ai = parseSpotlightQuery("codex agents");
  assert.equal(ai.action === "search" ? ai.mode : undefined, "ai");
  const security = parseSpotlightQuery("security trust boundaries");
  assert.equal(security.action === "search" ? security.mode : undefined, "security");
});

test("rankNodeMatches prefers exact labels and metadata-backed matches", () => {
  const nodes = [
    node("Qdrant Runtime", "System/Qdrant.md", { repository: "qdrant/qdrant" }),
    node("Qdrant", "System/AI/Qdrant.md"),
    node("Other", "Other.md", { project: "Qdrant migration" }),
  ];
  const ranked = rankNodeMatches(nodes as never[], "Qdrant", 3);
  assert.equal(ranked[0].name, "Qdrant");
  assert.equal(ranked.length, 3);
});

test("relation direction and dependency semantics keep weak graph edges out of impact", () => {
  assert.equal(isDirectedRelation(link("CALLS") as never), true);
  assert.equal(isDirectedRelation(link("wikilink") as never), false);
  assert.equal(isDirectedRelation(link("SEMANTIC_RELATED", true) as never), false);
  assert.equal(isDependencyRelation(link("VERIFIED_BY") as never), true);
  assert.equal(isDependencyRelation(link("IN_FOLDER") as never), false);
  assert.equal(isDependencyRelation(link("TAGGED_WITH") as never), false);
});
