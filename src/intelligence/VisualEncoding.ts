export interface EdgeVisualMetadata {
  kind: string;
  sourceClass: string;
  confidence?: string;
  semantic: boolean;
  metadata: Record<string, unknown>;
}

const normalized = (value?: string): string => (value || "").trim().toLowerCase();

export const confidenceWeight = (confidence?: string): number => {
  const value = normalized(confidence);
  const numeric = Number(value);
  if (value && Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) {
    return 0.55 + numeric * 0.45;
  }
  if (
    value === "exact" ||
    value === "verified" ||
    value === "verified_current" ||
    value === "mission_ledger" ||
    value === "mutual_top2"
  ) {
    return 1;
  }
  if (
    value === "declared" ||
    value === "current_projection" ||
    value === "mutual_top3" ||
    value === "mutual_top4"
  ) {
    return 0.88;
  }
  if (value.includes("mutual")) return 0.8;
  if (value.includes("source") || value.includes("parser")) return 0.76;
  if (value.includes("derived")) return 0.68;
  if (value.includes("suggest")) return 0.52;
  return 0.72;
};

export const relationWeight = (metadata: EdgeVisualMetadata): number => {
  const kind = normalized(metadata.kind);
  if (kind === "has_incident") return 1.4;
  if (kind === "observed_as") return 1.1;
  if (kind === "wikilink") return 1;
  if (kind === "imports" || kind === "calls" || kind === "verified_by") return 0.95;
  if (kind === "contains" || kind === "part_of_journey" || kind === "next_step") return 0.78;
  if (kind === "in_folder") return 0.58;
  if (kind === "tagged_with") return 0.48;
  if (metadata.semantic || kind === "semantic_related") return 0.46;
  return 0.82;
};

export const linkWidthMultiplier = (metadata: EdgeVisualMetadata): number => {
  return Math.max(0.24, relationWeight(metadata) * confidenceWeight(metadata.confidence));
};

export const linkCurvature = (metadata: EdgeVisualMetadata): number => {
  const kind = normalized(metadata.kind);
  if (metadata.semantic || kind === "semantic_related") return 0.16;
  if (kind === "tagged_with") return 0.1;
  if (kind === "in_folder") return 0.045;
  return 0;
};

export const linkArrowLength = (metadata: EdgeVisualMetadata): number => {
  const kind = normalized(metadata.kind);
  if (metadata.semantic || kind === "semantic_related" || kind === "wikilink") return 0;
  if (kind === "tagged_with") return 1.1;
  if (kind === "in_folder") return 1.35;
  if (kind === "contains") return 1.7;
  return 2.4;
};

export const isStructuralKind = (kind: string): boolean => {
  const value = normalized(kind);
  return value === "in_folder" || value === "tagged_with";
};
