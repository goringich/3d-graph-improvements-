import test from "node:test";
import assert from "node:assert/strict";

import {
	restoreIsLocalGraph,
	serializeGraphViewState,
	shouldQueueGraphRender,
	shouldShowGraph,
} from "../src/views/graph/graphViewState.ts";
import { DisplaySettings } from "../src/settings/categories/DisplaySettings.ts";
import { FilterSettings } from "../src/settings/categories/FilterSettings.ts";

test("serializeGraphViewState preserves local graph flag", () => {
	assert.deepEqual(serializeGraphViewState(true), { isLocalGraph: true });
	assert.deepEqual(serializeGraphViewState(false), { isLocalGraph: false });
});

test("restoreIsLocalGraph defaults to false for missing state", () => {
	assert.equal(restoreIsLocalGraph(undefined), false);
	assert.equal(restoreIsLocalGraph({}), false);
	assert.equal(restoreIsLocalGraph({ isLocalGraph: true }), true);
});

test("graph render decisions are deterministic", () => {
	assert.equal(shouldQueueGraphRender(true), false);
	assert.equal(shouldQueueGraphRender(false), true);
	assert.equal(shouldShowGraph(false), true);
	assert.equal(shouldShowGraph(true), false);
});

test("DisplaySettings keeps safe defaults and round-trips new force controls", () => {
	const defaults = new DisplaySettings();
	assert.equal(defaults.nodeSpacing, 30);
	assert.equal(defaults.nodeRepulsion, -60);
	assert.equal(defaults.layoutDamping, 0.6);

	const restored = DisplaySettings.fromStore({
		nodeSize: 3,
		linkThickness: 5,
		particleSize: 20,
		particleCount: 20,
		nodeSpacing: 55,
		nodeRepulsion: -80,
		layoutDamping: 0.75,
	});

	assert.equal(restored.nodeSpacing, 55);
	assert.equal(restored.nodeRepulsion, -80);
	assert.equal(restored.layoutDamping, 0.75);
	assert.deepEqual(restored.toObject(), {
		nodeSize: 3,
		linkThickness: 5,
		particleSize: 20,
		particleCount: 20,
		nodeSpacing: 55,
		nodeRepulsion: -80,
		layoutDamping: 0.75,
	});
});

test("FilterSettings keeps excluded folders and restores empty arrays safely", () => {
	const defaults = new FilterSettings();
	assert.deepEqual(defaults.excludedFolders, []);

	const restored = FilterSettings.fromStore({
		doShowOrphans: false,
		doShowAttachments: true,
		excludedFolders: ["Templates", "Assets/Images"],
	});

	assert.equal(restored.doShowOrphans, false);
	assert.equal(restored.doShowAttachments, true);
	assert.deepEqual(restored.excludedFolders, [
		"Templates",
		"Assets/Images",
	]);
	assert.deepEqual(restored.toObject(), {
		doShowOrphans: false,
		doShowAttachments: true,
		excludedFolders: ["Templates", "Assets/Images"],
	});
});
