import { ItemView, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";
import Graph3dPlugin, { GRAPH_3D_VIEW_TYPE } from "src/main";

const scalarText = (value: unknown): string | number | undefined => {
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
};

export class Graph3dView extends ItemView {
  private forceGraph: ForceGraph;
  private inspector: HTMLDivElement;
  private readonly isLocalGraph: boolean;
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
  }

  showGraph() {
    const viewContent = this.containerEl.querySelector(
      ".view-content"
    ) as HTMLElement;

    if (viewContent) {
      viewContent.empty();
      viewContent.classList.add("graph-3d-view");
      this.appendGraph(viewContent);
      this.appendInspector(viewContent);
      const settings = new GraphSettingsView(
        this.plugin.settingsState,
        this.plugin.theme
      );
      viewContent.appendChild(settings);
    } else {
      console.error("Could not find view content");
    }
  }

  getDisplayText(): string {
    return this.plugin.intelligenceProjection
      ? "3D Intelligence Graph"
      : "3D-Graph";
  }

  getViewType(): string {
    return GRAPH_3D_VIEW_TYPE;
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
      .onNodeClick((node: Node) => this.onNodeClick(node));
  }

  private appendInspector(viewContent: HTMLElement) {
    this.inspector = viewContent.createDiv({ cls: "graph-intelligence-inspector" });
    this.inspector.createEl("strong", { text: "Graph Intelligence" });
    this.inspector.createDiv({
      cls: "graph-intelligence-inspector-empty",
      text: this.plugin.intelligenceProjection
        ? "Select a node to inspect authority, live state, graph signal and relation types."
        : "Native Obsidian graph mode. Unified projection is not loaded.",
    });
  }

  private relationSummary(node: Node): string {
    const counts = new Map<string, number>();
    node.links.forEach((link) => {
      const kind = link.intelligence.kind || "related";
      counts.set(kind, (counts.get(kind) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(" · ");
  }

  private renderInspector(node: Node) {
    if (!this.inspector) return;
    this.inspector.empty();
    const intel = node.intelligence;
    this.inspector.createEl("strong", { text: node.name });

    const semanticCount = node.links.filter((link) => link.intelligence.semantic).length;
    const rows: [string, string | number | undefined][] = [
      ["Kind", intel.kind],
      ["Role", scalarText(intel.metadata.role || intel.metadata.hub_role)],
      ["Source", intel.source],
      ["Layer", intel.layer],
      ["Authority", intel.state.authority],
      ["Lifecycle", intel.state.lifecycle],
      ["Live", intel.state.live],
      ["Freshness", intel.state.freshness],
      ["Verification", intel.state.verification],
      ["Degree", intel.metrics.degree],
      ["PageRank", intel.metrics.pagerank],
      ["Betweenness", intel.metrics.betweenness],
      ["Bridge score", intel.metrics.bridge_score],
      ["Community", intel.metrics.community],
      ["Support", scalarText(intel.metadata.support)],
      ["Semantic relations", semanticCount || undefined],
      ["Relations", this.relationSummary(node) || undefined],
      ["Folder", scalarText(intel.metadata.folder)],
      ["Project", scalarText(intel.metadata.project)],
      ["Repository", scalarText(intel.metadata.repository)],
    ];

    rows.forEach(([label, value]) => {
      if (value === undefined || value === "") return;
      const row = this.inspector.createDiv({ cls: "graph-intelligence-inspector-row" });
      row.createSpan({ cls: "graph-intelligence-inspector-label", text: `${label}: ` });
      row.createSpan({ text: String(value) });
    });
  }

  private onNodeClick(node: Node) {
    this.renderInspector(node);
    const clickedNodeFile = this.app.vault
      .getFiles()
      .find((file) => file.path === node.path);

    if (!clickedNodeFile) return;
    if (this.isLocalGraph) {
      void this.app.workspace.getLeaf(false).openFile(clickedNodeFile);
    } else {
      void this.leaf.openFile(clickedNodeFile);
    }
  }
}
