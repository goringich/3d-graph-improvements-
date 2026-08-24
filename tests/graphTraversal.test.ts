import test from "node:test";
import assert from "node:assert/strict";

import Graph from "../src/graph/Graph.ts";
import Node from "../src/graph/Node.ts";
import Link from "../src/graph/Link.ts";

const typedLink = (source: string, target: string, kind: string) =>
  new Link(source, target, false, {
    kind,
    sourceClass: "project_reality",
    semantic: false,
    metadata: {},
  });

const makeGraph = () => {
  const nodes = ["a", "b", "c", "d"].map((id) => new Node(id.toUpperCase(), id, false));
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const links = [
    typedLink("a", "b", "CALLS"),
    typedLink("b", "c", "DEPENDS_ON"),
    new Link("c", "d", false),
  ];
  links.forEach((link) => {
    const source = byId.get(link.source as string)!;
    const target = byId.get(link.target as string)!;
    source.links.push(link);
    target.links.push(link);
    source.neighbors.push(target);
    target.neighbors.push(source);
  });
  return new Graph(
    nodes,
    links,
    new Map(nodes.map((item, index) => [item.id, index])),
    Link.createLinkIndex(links)
  );
};

test("directed neighborhoods distinguish dependencies and dependents", () => {
  const graph = makeGraph();
  assert.deepEqual(Array.from(graph.neighborhood("b", "outgoing", 1).keys()), ["b", "c"]);
  assert.deepEqual(Array.from(graph.neighborhood("b", "incoming", 1).keys()), ["b", "a"]);
  assert.deepEqual(new Set(graph.neighborhood("b", "both", 1).keys()), new Set(["a", "b", "c"]));
});

test("shortestPath honors directed typed relations while wikilinks stay traversable both ways", () => {
  const graph = makeGraph();
  assert.deepEqual(graph.shortestPath("a", "c", "outgoing"), ["a", "b", "c"]);
  assert.deepEqual(graph.shortestPath("c", "a", "outgoing"), []);
  assert.deepEqual(graph.shortestPath("d", "c", "outgoing"), ["d", "c"]);
});

test("getSubgraph keeps only selected nodes and internal relations", () => {
  const graph = makeGraph().getSubgraph(["a", "b", "c"]);
  assert.deepEqual(graph.nodes.map((item) => item.id), ["a", "b", "c"]);
  assert.equal(graph.links.length, 2);
  assert.equal(graph.getNodeById("d"), null);
});
