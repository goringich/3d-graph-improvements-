import test from "node:test";
import assert from "node:assert/strict";

import { DisplaySettings } from "../src/settings/categories/DisplaySettings.ts";
import { applyDisplayForces } from "../src/views/graph/applyDisplayForces.ts";

test("applyDisplayForces applies spacing and repulsion and reheats the graph", () => {
	const displaySettings = new DisplaySettings(4, 5, 6, 4, 45, -90);
	let receivedRepulsion: number | undefined;
	let receivedSpacing: number | undefined;
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
					distance(value: number) {
						receivedSpacing = value;
					},
				};
			}
			return undefined;
		},
		d3ReheatSimulation() {
			reheated = true;
		},
	};

	const applied = applyDisplayForces(displaySettings, graphInstance);

	assert.equal(applied, true);
	assert.equal(receivedRepulsion, -90);
	assert.equal(receivedSpacing, 45);
	assert.equal(reheated, true);
});

test("applyDisplayForces returns false when d3Force is unavailable", () => {
	const displaySettings = new DisplaySettings();
	const applied = applyDisplayForces(displaySettings, {});

	assert.equal(applied, false);
});

test("applyDisplayForces catches errors instead of throwing", () => {
	const displaySettings = new DisplaySettings();
	const errors: unknown[][] = [];
	const graphInstance = {
		d3Force() {
			throw new Error("boom");
		},
	};

	const applied = applyDisplayForces(displaySettings, graphInstance, (...args) => {
		errors.push(args);
	});

	assert.equal(applied, false);
	assert.equal(errors.length, 1);
	assert.match(String(errors[0][0]), /Could not apply display force settings/);
});
