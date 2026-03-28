import test from "node:test";
import assert from "node:assert/strict";

import { stabilizeGraphLayout } from "../src/views/graph/stabilizeGraphLayout.ts";

test("stabilizeGraphLayout assigns deterministic coordinates by node id", () => {
	const graphA = {
		nodes: [{ id: "a.md" }, { id: "b.md" }],
	};
	const graphB = {
		nodes: [{ id: "a.md" }, { id: "b.md" }],
	};

	stabilizeGraphLayout(graphA as any);
	stabilizeGraphLayout(graphB as any);

	assert.deepEqual(
		graphA.nodes.map((node: any) => [node.x, node.y, node.z]),
		graphB.nodes.map((node: any) => [node.x, node.y, node.z])
	);
});

test("stabilizeGraphLayout preserves existing coordinates", () => {
	const node: any = { id: "a.md" };
	node.x = 11;
	node.y = 22;
	node.z = 33;

	const graph = { nodes: [node] };
	stabilizeGraphLayout(graph as any);

	assert.equal(node.x, 11);
	assert.equal(node.y, 22);
	assert.equal(node.z, 33);
});
