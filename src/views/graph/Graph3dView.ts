import { ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";
import Graph3dPlugin from "src/main";
import { GRAPH_3D_VIEW_TYPE } from "src/main";
import {
	restoreIsLocalGraph,
	serializeGraphViewState,
	shouldQueueGraphRender,
	shouldShowGraph,
} from "./graphViewState";

export class Graph3dView extends ItemView {
	private forceGraph: ForceGraph;
	private graphShown = false;
	private isLocalGraph: boolean;
	private readonly plugin: Graph3dPlugin;
	private statusEl: HTMLDivElement | null = null;

	constructor(
		plugin: Graph3dPlugin,
		leaf: WorkspaceLeaf,
		isLocalGraph = false
	) {
		super(leaf);
		this.isLocalGraph = isLocalGraph;
		this.plugin = plugin;
	}

	onunload() {
		super.onunload();
		this.forceGraph?.getInstance()._destructor();
		this.graphShown = false;
	}

	async onOpen() {
		await super.onOpen();
		if (shouldQueueGraphRender(this.plugin.isGraphCacheReady())) {
			this.plugin.queueGraphView(this);
		} else {
			this.showGraph();
		}
	}

	showGraph() {
		if (!shouldShowGraph(this.graphShown)) return;

		const viewContent = this.contentEl;

		if (viewContent) {
			viewContent.empty();
			viewContent.classList.add("graph-3d-view");
			this.renderStatus(viewContent, "Preparing 3D graph...");
			try {
				this.appendGraph(viewContent);
				const settings = new GraphSettingsView(
					this.plugin.settingsState,
					this.plugin.theme
				);
				viewContent.appendChild(settings);
				this.graphShown = true;
				this.updateStatus();
			} catch (error) {
				console.error("3D Graph view failed to render", error);
				this.renderStatus(
					viewContent,
					`Render failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		} else {
			console.error("Could not find view content");
		}
	}

	getDisplayText(): string {
		return "3D-Graph";
	}

	getViewType(): string {
		return GRAPH_3D_VIEW_TYPE;
	}

	async setState(
		state: { isLocalGraph?: boolean },
		result: ViewStateResult
	) {
		this.isLocalGraph = restoreIsLocalGraph(state);
		await super.setState(state, result);
	}

	getState() {
		return serializeGraphViewState(this.isLocalGraph);
	}

	onResize() {
		super.onResize();
		this.forceGraph?.updateDimensions();
	}

	private appendGraph(viewContent: HTMLElement) {
		this.updateStatus("Creating ForceGraph instance...");
		this.forceGraph = new ForceGraph(
			this.plugin,
			viewContent,
			this.isLocalGraph
		);
		this.updateStatus();

		this.forceGraph
			.getInstance()
			.onNodeClick((node: Node, mouseEvent: MouseEvent) => {
				const clickedNodeFile = this.app.vault
					.getFiles()
					.find((f) => f.path === node.path);

				if (clickedNodeFile) {
					if (this.isLocalGraph) {
						this.app.workspace
							.getLeaf(false)
							.openFile(clickedNodeFile);
					} else {
						this.leaf.openFile(clickedNodeFile);
					}
				}
			});
	}

	private renderStatus(containerEl: HTMLElement, text: string) {
		this.statusEl = containerEl.createDiv({ cls: "graph-3d-status" });
		this.statusEl.setText(text);
	}

	private updateStatus(message?: string) {
		if (!this.statusEl) return;
		if (message) {
			this.statusEl.setText(message);
			return;
		}

		const graph = this.plugin.globalGraph;
		const nodeCount = graph?.nodes?.length ?? 0;
		const linkCount = graph?.links?.length ?? 0;
		const scope = this.isLocalGraph ? "Local" : "Global";
		this.statusEl.setText(
			`${scope} graph ready. Nodes: ${nodeCount}. Links: ${linkCount}.`
		);
	}
}
