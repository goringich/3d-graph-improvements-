import test from "node:test";
import assert from "node:assert/strict";

import { DisplaySettings } from "../src/settings/categories/DisplaySettings.ts";
import { applyDisplayForces } from "../src/views/graph/applyDisplayForces.ts";

test("applyDisplayForces applies semantic spacing, repulsion, damping and reheats the graph", () => {
	const displaySettings = new DisplaySettings(4, 5, 6, 4, 45, -90, 0.75);
	let receivedRepulsion: number | undefined;
	let distanceAccessor: ((link: { intelligence?: Record<string, unknown> }) => number) | undefined;
	let receivedDamping: number | undefined;
	let reheated = false;

	const graphInstance = {
		d3Force(forceName: string) {
			if (forceName === "charge") {
				return {
					strength(value: number) {
						receivedRepulsion = value;
					},
				};
			}
			if (forceName === "link") {
				return {
					distance(value: number | ((link: { intelligence?: Record<string, unknown> }) => number)) {
						if (typeof value === "function") distanceAccessor = value;
					},
				};
			}
			return undefined;
		},
		d3VelocityDecay(value: number) {
			receivedDamping = value;
		},
		d3ReheatSimulation() {
			reheated = true;
		},
	};

	const applied = applyDisplayForces(displaySettings, graphInstance);

	assert.equal(applied, true);
	assert.equal(receivedRepulsion, -90);
	assert.ok(distanceAccessor);
	assert.equal(distanceAccessor!({ intelligence: { kind: "wikilink", semantic: false } }), 45);
	assert.ok(
		distanceAccessor!({ intelligence: { kind: "SEMANTIC_RELATED", semantic: true } }) > 45
	);
	assert.ok(
		distanceAccessor!({ intelligence: { kind: "IN_FOLDER", semantic: false } }) < 45
	);
	assert.equal(receivedDamping, 0.75);
	assert.equal(reheated, true);
});

test("applyDisplayForces returns false when d3Force is unavailable", () => {
	const displaySettings = new DisplaySettings();
	const applied = applyDisplayForces(displaySettings, {});

	assert.equal(applied, false);
});

test("applyDisplayForces can skip reheating during initial graph setup", () => {
	const displaySettings = new DisplaySettings(4, 5, 6, 4, 45, -90, 0.75);
	let reheated = false;

	const graphInstance = {
		d3Force() {
			return {
				strength() {},
				distance() {},
			};
		},
		d3VelocityDecay() {},
		d3ReheatSimulation() {
			reheated = true;
		},
	};

	const applied = applyDisplayForces(displaySettings, graphInstance, false);

	assert.equal(applied, true);
	assert.equal(reheated, false);
});

test("applyDisplayForces catches errors instead of throwing", () => {
	const displaySettings = new DisplaySettings();
	const errors: unknown[][] = [];
	const graphInstance = {
		d3Force() {
			throw new Error("boom");
		},
	};

	const applied = applyDisplayForces(
		displaySettings,
		graphInstance,
		true,
		(...args: unknown[]) => {
			errors.push(args);
		}
	);

	assert.equal(applied, false);
	assert.equal(errors.length, 1);
	assert.match(String(errors[0][0]), /Could not apply display force settings/);
});
