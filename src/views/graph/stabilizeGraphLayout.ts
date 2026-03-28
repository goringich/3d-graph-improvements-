import type Graph from "../../graph/Graph";

type PositionedNode = {
	id: string;
	x?: number;
	y?: number;
	z?: number;
	vx?: number;
	vy?: number;
	vz?: number;
};

const hashString = (value: string) => {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const unitFromHash = (seed: number) => {
	return (seed & 0xffff) / 0xffff;
};

export const stabilizeGraphLayout = (graph: Graph) => {
	const radius = Math.max(40, Math.cbrt(graph.nodes.length || 1) * 32);

	graph.nodes.forEach((node, index) => {
		const positionedNode = node as PositionedNode;
		if (
			positionedNode.x !== undefined &&
			positionedNode.y !== undefined &&
			positionedNode.z !== undefined
		) {
			return;
		}

		const seed = hashString(positionedNode.id || String(index));
		const u = unitFromHash(seed);
		const v = unitFromHash(seed >>> 8 || seed);
		const theta = u * Math.PI * 2;
		const phi = Math.acos(2 * v - 1);

		positionedNode.x = radius * Math.sin(phi) * Math.cos(theta);
		positionedNode.y = radius * Math.sin(phi) * Math.sin(theta);
		positionedNode.z = radius * Math.cos(phi);
		positionedNode.vx = 0;
		positionedNode.vy = 0;
		positionedNode.vz = 0;
	});

	return graph;
};
