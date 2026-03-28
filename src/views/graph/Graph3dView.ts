import { ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";
import Graph3dPlugin from "src/main";
import { GRAPH_3D_VIEW_TYPE } from "src/main";

export class Graph3dView extends ItemView {
	private forceGraph: ForceGraph;
	private graphShown = false;
	private isLocalGraph: boolean;
	private readonly plugin: Graph3dPlugin;

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
		if (this.plugin.isGraphCacheReady()) {
			this.showGraph();
		} else {
			this.plugin.queueGraphView(this);
		}
	}

	showGraph() {
		if (this.graphShown) return;

		const viewContent = this.contentEl;

		if (viewContent) {
			viewContent.empty();
			viewContent.classList.add("graph-3d-view");
			this.appendGraph(viewContent);
			const settings = new GraphSettingsView(
				this.plugin.settingsState,
				this.plugin.theme
			);
			viewContent.appendChild(settings);
			this.graphShown = true;
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
		this.isLocalGraph = Boolean(state?.isLocalGraph);
		await super.setState(state, result);
	}

	getState() {
		return {
			isLocalGraph: this.isLocalGraph,
		};
	}

	onResize() {
		super.onResize();
		this.forceGraph?.updateDimensions();
	}

	private appendGraph(viewContent: HTMLElement) {
		this.forceGraph = new ForceGraph(
			this.plugin,
			viewContent,
			this.isLocalGraph
		);

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
}
