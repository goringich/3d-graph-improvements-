import type { DisplaySettings } from "../../settings/categories/DisplaySettings";
import { relationSpacingMultiplier } from "../../intelligence/VisualEncoding";

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
            value: number | ((link: { intelligence?: Record<string, unknown> }) => number)
          ) => void;
        }
      | undefined;

    chargeForce?.strength?.(nodeRepulsion);
    linkForce?.distance?.((link) => {
      const intelligence = link?.intelligence as
        | {
            kind?: string;
            sourceClass?: string;
            confidence?: string;
            semantic?: boolean;
            metadata?: Record<string, unknown>;
          }
        | undefined;
      return nodeSpacing * relationSpacingMultiplier(intelligence);
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
