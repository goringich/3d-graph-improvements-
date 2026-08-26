import type { NodeIntelligenceMetadata } from "./Projection";

const SOURCE_HUES: Record<string, number> = {
  obsidian: 208,
  obsidian_structure: 44,
  architecture: 278,
  project_reality: 146,
  state_graph: 18,
  semantic: 326,
};

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

export const intelligenceNodeColor = (
  metadata: NodeIntelligenceMetadata
): string => {
  const source = metadata.source || "unknown";
  const community = String(metadata.metrics.community ?? "none");
  const baseHue = SOURCE_HUES[source] ?? hash(source) % 360;
  const communityOffset = community === "none" ? 0 : (hash(`${source}:${community}`) % 71) - 35;
  const hue = (baseHue + communityOffset + 360) % 360;

  if (metadata.kind === "folder") {
    return `hsl(${hue} 38% 52%)`;
  }
  if (metadata.kind === "tag") {
    return `hsl(${hue} 48% 56%)`;
  }

  const saturation = metadata.virtual ? 66 : 72;
  const lightness = metadata.virtual ? 58 : 62;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};
