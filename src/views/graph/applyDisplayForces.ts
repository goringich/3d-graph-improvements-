import type { DisplaySettings } from "../../settings/categories/DisplaySettings";

export type RelationSpacingMetadata = {
  kind?: string;
  semantic?: boolean;
};

export const relationSpacingMultiplier = (
  metadata?: RelationSpacingMetadata
): number => {
  const kind = String(metadata?.kind || "").trim().toLowerCase();
  if (kind === "in_folder") return 0.68;
  if (kind === "tagged_with") return 0.78;
  if (kind === "parent_folder") return 0.9;
  if (kind === "wikilink") return 1;
  if (kind === "contains") return 1.08;
  if (
    kind === "imports" ||
    kind === "calls" ||
    kind === "handled_by" ||
    kind === "reads_writes" ||
    kind === "verified_by"
  ) {
    return 1.16;
  }
  if (kind === "observed_as" || kind === "has_incident") return 1.22;
  if (metadata?.semantic || kind === "semantic_related") return 1.48;
  return 1.1;
};

export type DisplayForceGraphInstance = {
  d3Force?: (forceName: string) => unknown;
  d3ReheatSimulation?: () => void;
  d3VelocityDecay?: (value: number) => void;
};

export const applyDisplayForces = (
  displaySettings: DisplaySettings,
  graphInstance: DisplayForceGraphInstance,
  shouldReheat = true,
  logError: (message?: unknown, ...optionalParams: unknown[]) => void = console.error
) => {
  if (!graphInstance?.d3Force) return false;

  try {
    const { nodeSpacing, nodeRepulsion, layoutDamping } = displaySettings;
    const chargeForce = graphInstance.d3Force("charge") as
      | { strength?: (value: number) => void }
      | undefined;
    const linkForce = graphInstance.d3Force("link") as
      | {
          distance?: (
            value: number | ((link: { intelligence?: RelationSpacingMetadata }) => number)
          ) => void;
        }
      | undefined;

    chargeForce?.strength?.(nodeRepulsion);
    linkForce?.distance?.((link) => {
      return nodeSpacing * relationSpacingMultiplier(link?.intelligence);
    });
    graphInstance.d3VelocityDecay?.(layoutDamping);
    if (shouldReheat) {
      graphInstance.d3ReheatSimulation?.();
    }
    return true;
  } catch (error) {
    logError("Could not apply display force settings", error);
    return false;
  }
};
