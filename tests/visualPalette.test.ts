import test from "node:test";
import assert from "node:assert/strict";

import { intelligenceNodeColor } from "../src/intelligence/VisualPalette.ts";
import { defaultNodeIntelligence } from "../src/intelligence/Projection.ts";

test("community palette is stable for the same node family", () => {
  const metadata = {
    ...defaultNodeIntelligence(),
    source: "obsidian",
    metrics: { community: 7 },
  };

  assert.equal(intelligenceNodeColor(metadata), intelligenceNodeColor(metadata));
  assert.match(intelligenceNodeColor(metadata), /^hsl\(/);
});

test("different communities receive distinguishable stable colors", () => {
  const first = {
    ...defaultNodeIntelligence(),
    source: "obsidian",
    metrics: { community: 1 },
  };
  const second = {
    ...defaultNodeIntelligence(),
    source: "obsidian",
    metrics: { community: 2 },
  };
  const architecture = {
    ...defaultNodeIntelligence(),
    source: "architecture",
    virtual: true,
    metrics: { community: 1 },
  };

  assert.notEqual(intelligenceNodeColor(first), intelligenceNodeColor(second));
  assert.notEqual(intelligenceNodeColor(first), intelligenceNodeColor(architecture));
});

test("structural hubs use calmer palette variants", () => {
  const folder = {
    ...defaultNodeIntelligence(),
    kind: "folder",
    source: "obsidian_structure",
    virtual: true,
    metrics: { community: 3 },
  };
  const note = {
    ...defaultNodeIntelligence(),
    source: "obsidian",
    metrics: { community: 3 },
  };

  assert.match(intelligenceNodeColor(folder), /38% 52%/);
  assert.match(intelligenceNodeColor(note), /72% 62%/);
});
