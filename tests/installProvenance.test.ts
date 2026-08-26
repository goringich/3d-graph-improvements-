import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const installer = readFileSync(new URL("../copy_to_vault.sh", import.meta.url), "utf8");

test("installer rebuilds from clean tracked runtime source", () => {
  assert.match(installer, /git -C \"\$ROOT\" diff --quiet -- \"\$\{RUNTIME_PATHS\[@\]\}\"/);
  assert.match(installer, /git -C \"\$ROOT\" diff --cached --quiet -- \"\$\{RUNTIME_PATHS\[@\]\}\"/);
  assert.match(installer, /RUNTIME_SOURCE_SHA=/);
  assert.match(installer, /npm --prefix \"\$ROOT\" run build/);
  assert.match(installer, /node --check \"\$ROOT\/main\.js\"/);
});

test("installer attests and rechecks installed plugin bytes", () => {
  assert.match(installer, /BUILD_MAIN_SHA=/);
  assert.match(installer, /INSTALLED_MAIN_SHA=/);
  assert.match(installer, /\[\[ \"\$INSTALLED_MAIN_SHA\" == \"\$BUILD_MAIN_SHA\" \]\]/);
  assert.match(installer, /\.intelligence-graph-install\.json/);
  assert.match(installer, /2026-08-26\.intelligence-graph-install\.v1/);
  assert.match(installer, /runtime_source_sha/);
  assert.match(installer, /tracked_runtime_source_clean: true/);
});
