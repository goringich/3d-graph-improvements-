import { ItemView, WorkspaceLeaf } from "obsidian";
import Node from "../../graph/Node";
import { ForceGraph } from "./ForceGraph";
import { GraphSettingsView } from "../settings/GraphSettingsView";
import Graph3dPlugin, { GRAPH_3D_VIEW_TYPE } from "src/main";
import {
  parseSpotlightQuery,
  rankNodeMatches,
} from "../../intelligence/GraphSemantics";
import {
  isLiveGap,
  nodeMatchesMode,
} from "../../intelligence/Projection";
import {
  summarizeGraphHealth,
  type GraphHealthFinding,
} from "../../intelligence/GraphHealth";

const scalarText = (value: unknown): string | number | undefined => {
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
};

const percentText = (value: number | undefined): string | undefined => {
  return value === undefined ? undefined : `${(value * 100).toFixed(1)}%`;
};

export class Graph3dView extends ItemView {
  private forceGraph: ForceGraph;
  private inspector: HTMLDivElement;
  private explorerStatus: HTMLDivElement;
  private explorerInput: HTMLInputElement;
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
      this.appendExplorer(viewContent);
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

  private appendExplorer(viewContent: HTMLElement) {
    const explorer = viewContent.createDiv({ cls: "graph-intelligence-explorer" });
    this.explorerInput = explorer.createEl("input", {
      cls: "graph-intelligence-search",
      attr: {
        type: "search",
        placeholder: "Search · impact of X · dependencies of X · path A -> B",
        "aria-label": "Graph Spotlight",
      },
    });
    const health = explorer.createEl("button", {
      cls: "graph-intelligence-health",
      text: "Health",
    });
    health.addEventListener("click", () => this.renderGraphHealth());
    const clear = explorer.createEl("button", {
      cls: "graph-intelligence-clear",
      text: "Clear",
    });
    clear.addEventListener("click", () => {
      this.forceGraph.clearFocus();
      this.explorerStatus.setText(this.defaultExplorerStatus());
      this.explorerInput.focus();
    });
    this.explorerInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.runExplorerQuery(this.explorerInput.value);
    });
    this.explorerStatus = explorer.createDiv({
      cls: "graph-intelligence-explorer-status",
      text: this.defaultExplorerStatus(),
    });
  }

  private defaultExplorerStatus(): string {
    const projection = this.plugin.intelligenceProjection;
    if (!projection) return "Native Obsidian graph · unified projection unavailable";
    const health = summarizeGraphHealth(projection);
    const actionable = health.findings.filter((finding) => finding.severity !== "info").length;
    return `Unified projection · ${health.nodeCount} nodes · ${health.edgeCount} edges · ${actionable ? `${actionable} health findings` : "health OK"} · ${projection.generated_at}`;
  }

  private setMode(mode: Parameters<typeof nodeMatchesMode>[0]) {
    this.plugin.settingsState.value.filters.graphMode = mode;
  }

  private resolveBest(term: string, candidates?: Node[]): Node | null {
    return rankNodeMatches(candidates || this.plugin.globalGraph.nodes, term, 1)[0] || null;
  }

  private runExplorerQuery(query: string) {
    const command = parseSpotlightQuery(query);
    const graph = this.plugin.globalGraph;

    if (command.action === "path") {
      const from = this.resolveBest(command.from);
      const to = this.resolveBest(command.to);
      if (!from || !to) {
        this.explorerStatus.setText("Path: one or both endpoints were not found.");
        return;
      }
      const path = graph.shortestPath(from.id, to.id, "both");
      if (!path.length) {
        this.explorerStatus.setText(`No graph path: ${from.name} → ${to.name}`);
        return;
      }
      this.forceGraph.focusPath(path);
      this.renderInspector(to);
      this.explorerStatus.setText(
        `Path · ${from.name} → ${to.name} · ${Math.max(0, path.length - 1)} hops`
      );
      return;
    }

    if (command.action === "impact") {
      const node = this.resolveBest(command.term);
      if (!node) {
        this.explorerStatus.setText(`Impact: no node matched “${command.term}”.`);
        return;
      }
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(
        node.id,
        command.direction,
        command.depth,
        true
      );
      this.renderInspector(node);
      this.explorerStatus.setText(
        `Impact ${command.direction} · ${node.name} · ${distances.size} nodes · depth ${command.depth}`
      );
      return;
    }

    if (command.mode) this.setMode(command.mode);
    let candidates = graph.nodes;
    if (command.mode) {
      candidates = candidates.filter((node) => nodeMatchesMode(command.mode!, node.intelligence));
    }
    if (command.liveGaps) {
      candidates = candidates.filter((node) => isLiveGap(node.intelligence));
    }

    const term = command.term.trim();
    if (!term && candidates.length) {
      const bounded = candidates.slice(0, 160);
      this.forceGraph.focusNodeIds(bounded.map((node) => node.id));
      this.explorerStatus.setText(
        `${command.liveGaps ? "Live gaps" : command.mode || "Selection"} · ${bounded.length}${candidates.length > bounded.length ? ` of ${candidates.length}` : ""} nodes`
      );
      return;
    }

    const matches = rankNodeMatches(candidates, term, 8);
    if (!matches.length) {
      this.explorerStatus.setText(`No graph node matched “${term}”.`);
      return;
    }
    const node = matches[0];
    const distances = this.forceGraph.focusNeighborhood(node.id, "both", 1, false);
    this.renderInspector(node);
    const alternatives = matches
      .slice(1, 4)
      .map((item) => item.name)
      .join(" · ");
    this.explorerStatus.setText(
      `Found ${node.name} · focused ${distances.size} nodes${alternatives ? ` · also: ${alternatives}` : ""}`
    );
  }

  private appendInspector(viewContent: HTMLElement) {
    this.inspector = viewContent.createDiv({ cls: "graph-intelligence-inspector" });
    this.inspector.createEl("strong", { text: "Graph Intelligence" });
    this.inspector.createDiv({
      cls: "graph-intelligence-inspector-empty",
      text: this.plugin.intelligenceProjection
        ? "Select a node to inspect it, or open Health to see graph-wide weaknesses."
        : "Native Obsidian graph mode. Unified projection is not loaded.",
    });
  }

  private appendInspectorRow(label: string, value: string | number | undefined) {
    if (value === undefined || value === "") return;
    const row = this.inspector.createDiv({ cls: "graph-intelligence-inspector-row" });
    row.createSpan({ cls: "graph-intelligence-inspector-label", text: `${label}: ` });
    row.createSpan({ text: String(value) });
  }

  private appendHealthFinding(finding: GraphHealthFinding) {
    const item = this.inspector.createDiv({
      cls: `graph-intelligence-health-finding is-${finding.severity}`,
    });
    item.createDiv({
      cls: "graph-intelligence-health-finding-title",
      text: `${finding.severity.toUpperCase()} · ${finding.title}`,
    });
    item.createDiv({
      cls: "graph-intelligence-health-finding-detail",
      text: finding.detail,
    });
  }

  private renderGraphHealth() {
    if (!this.inspector) return;
    this.inspector.empty();
    this.inspector.createEl("strong", { text: "Graph Health" });
    const projection = this.plugin.intelligenceProjection;
    if (!projection) {
      this.inspector.createDiv({
        cls: "graph-intelligence-inspector-empty",
        text: "Unified projection is unavailable; graph-wide quality cannot be evaluated.",
      });
      return;
    }

    const health = summarizeGraphHealth(projection);
    this.appendInspectorRow("Nodes", health.nodeCount);
    this.appendInspectorRow("Active edges", health.edgeCount);
    this.appendInspectorRow("Components", health.componentCount);
    this.appendInspectorRow("Largest component", percentText(health.largestComponentRatio));
    this.appendInspectorRow("Orphans", health.orphanCount);
    this.appendInspectorRow("Source families", health.sourceFamilyCount);
    this.appendInspectorRow("Cross-source edges", health.crossSourceEdgeCount);
    this.appendInspectorRow("Bridge nodes", health.crossSourceBridgeNodeCount);
    this.appendInspectorRow("Identity bridge coverage", percentText(health.identityBridgeCoverage));
    this.appendInspectorRow("Unknown relations", health.unknownRelationCount);

    const findings = this.inspector.createDiv({ cls: "graph-intelligence-health-findings" });
    findings.createEl("strong", { text: "Top weaknesses" });
    health.findings.forEach((finding) => this.appendHealthFinding(finding));
    this.explorerStatus.setText(
      `Graph Health · ${health.findings.filter((finding) => finding.severity === "critical").length} critical · ${health.findings.filter((finding) => finding.severity === "warning").length} warnings`
    );
  }

  private relationSummary(node: Node): string {
    const counts = new Map<string, number>();
    node.links.forEach((link) => {
      const kind = link.intelligence.kind || "related";
      counts.set(kind, (counts.get(kind) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 8)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(" · ");
  }

  private appendInspectorActions(node: Node) {
    const actions = this.inspector.createDiv({ cls: "graph-intelligence-inspector-actions" });
    const addAction = (label: string, run: () => void) => {
      const button = actions.createEl("button", { text: label });
      button.addEventListener("click", run);
    };
    addAction("Focus", () => {
      const distances = this.forceGraph.focusNeighborhood(node.id, "both", 1, false);
      this.explorerStatus.setText(`Focus · ${node.name} · ${distances.size} nodes`);
    });
    addAction("Impact", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "both", 2, true);
      this.explorerStatus.setText(`Impact · ${node.name} · ${distances.size} nodes`);
    });
    addAction("Used by", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "incoming", 2, true);
      this.explorerStatus.setText(`Used by · ${node.name} · ${distances.size} nodes`);
    });
    addAction("Depends on", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "outgoing", 2, true);
      this.explorerStatus.setText(`Depends on · ${node.name} · ${distances.size} nodes`);
    });
    addAction("Health", () => this.renderGraphHealth());
    addAction("Clear", () => {
      this.forceGraph.clearFocus();
      this.explorerStatus.setText(this.defaultExplorerStatus());
    });
  }

  private renderInspector(node: Node) {
    if (!this.inspector) return;
    this.inspector.empty();
    const intel = node.intelligence;
    this.inspector.createEl("strong", { text: node.name });
    this.appendInspectorActions(node);

    const semanticCount = node.links.filter((link) => link.intelligence.semantic).length;
    const rows: [string, string | number | undefined][] = [
      ["Kind", intel.kind],
      ["Role", scalarText(intel.metadata.role || intel.metadata.hub_role)],
      ["Change", scalarText(intel.metadata.change)],
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

    rows.forEach(([label, value]) => this.appendInspectorRow(label, value));
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
