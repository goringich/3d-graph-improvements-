import type { DisplaySettings } from "../../settings/categories/DisplaySettings";

export type DisplayForceGraphInstance = {
	d3Force?: (forceName: string) => unknown;
	d3ReheatSimulation?: () => void;
	d3VelocityDecay?: (value: number) => void;
};

export const applyDisplayForces = (
	displaySettings: DisplaySettings,
	graphInstance: DisplayForceGraphInstance,
	logError: (message?: unknown, ...optionalParams: unknown[]) => void = console.error
) => {
	if (!graphInstance?.d3Force) return false;

	try {
		const { nodeSpacing, nodeRepulsion, layoutDamping } = displaySettings;
		const chargeForce = graphInstance.d3Force("charge") as
			| { strength?: (value: number) => void }
			| undefined;
		const linkForce = graphInstance.d3Force("link") as
			| { distance?: (value: number) => void }
			| undefined;

		chargeForce?.strength?.(nodeRepulsion);
		linkForce?.distance?.(nodeSpacing);
		graphInstance.d3VelocityDecay?.(layoutDamping);
		graphInstance.d3ReheatSimulation?.();
		return true;
	} catch (error) {
		logError("Could not apply display force settings", error);
		return false;
	}
};
