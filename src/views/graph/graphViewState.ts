export type GraphViewStateData = {
	isLocalGraph?: boolean;
};

export const serializeGraphViewState = (isLocalGraph: boolean): GraphViewStateData => {
	return {
		isLocalGraph,
	};
};

export const restoreIsLocalGraph = (state?: GraphViewStateData) => {
	return Boolean(state?.isLocalGraph);
};

export const shouldQueueGraphRender = (cacheReady: boolean) => {
	return !cacheReady;
};

export const shouldShowGraph = (graphShown: boolean) => {
	return !graphShown;
};
