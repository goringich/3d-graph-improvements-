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
  type IntelligenceNodeRecord,
} from "../../intelligence/Projection";
import {
  buildEntityDossier,
  collectBlindSpots,
  type BlindSpot,
  type TruthSegment,
} from "../../intelligence/AtlasViewModel";
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

const humanize = (value: string | undefined): string => {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ");
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
      ? "System Intelligence"
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
        "aria-label": "System Spotlight",
      },
    });
    const blindSpots = explorer.createEl("button", {
      cls: "graph-intelligence-blind-spots",
      text: "Blind spots",
    });
    blindSpots.addEventListener("click", () => this.renderBlindSpots());
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
    return `System projection · ${health.nodeCount} entities · ${health.edgeCount} relations · ${actionable ? `${actionable} findings` : "no major findings"} · ${projection.generated_at}`;
  }

  private setMode(mode: Parameters<typeof nodeMatchesMode>[0]) {
    this.plugin.settingsState.value.filters.graphMode = mode;
  }

  private resolveBest(term: string, candidates?: Node[]): Node | null {
    return rankNodeMatches(candidates || this.plugin.globalGraph.nodes, term, 1)[0] || null;
  }

  private runExplorerQuery(query: string) {
    const normalized = query.trim().toLowerCase();
    if (["blind spots", "show blind spots", "gaps", "unknowns"].includes(normalized)) {
      this.renderBlindSpots();
      return;
    }

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
        `Impact ${command.direction} · ${node.name} · ${distances.size} entities · depth ${command.depth}`
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
        `${command.liveGaps ? "Live gaps" : command.mode || "Selection"} · ${bounded.length}${candidates.length > bounded.length ? ` of ${candidates.length}` : ""} entities`
      );
      return;
    }

    const matches = rankNodeMatches(candidates, term, 8);
    if (!matches.length) {
      this.explorerStatus.setText(`No system entity matched “${term}”.`);
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
      `Found ${node.name} · focused ${distances.size} entities${alternatives ? ` · also: ${alternatives}` : ""}`
    );
  }

  private appendInspector(viewContent: HTMLElement) {
    this.inspector = viewContent.createDiv({ cls: "graph-intelligence-inspector" });
    this.inspector.createEl("strong", { text: "System Intelligence" });
    this.inspector.createDiv({
      cls: "graph-intelligence-inspector-empty",
      text: this.plugin.intelligenceProjection
        ? "Select an entity to see what it is, whether it works, what depends on it and what is still unproven."
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

  private appendTruthRing(truth: TruthSegment[]) {
    const section = this.inspector.createDiv({ cls: "graph-intelligence-truth" });
    section.createDiv({ cls: "graph-intelligence-section-title", text: "Truth" });
    const ring = section.createDiv({ cls: "graph-intelligence-truth-ring" });
    truth.forEach((segment) => {
      const item = ring.createDiv({
        cls: `graph-intelligence-truth-segment is-${segment.state}`,
        attr: {
          title: `${humanize(segment.stage)} · ${humanize(segment.state)}`,
          "aria-label": `${humanize(segment.stage)}: ${humanize(segment.state)}`,
        },
      });
      item.createSpan({ text: humanize(segment.stage) });
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
    this.appendInspectorRow("Entities", health.nodeCount);
    this.appendInspectorRow("Active relations", health.edgeCount);
    this.appendInspectorRow("Components", health.componentCount);
    this.appendInspectorRow("Largest component", percentText(health.largestComponentRatio));
    this.appendInspectorRow("Orphans", health.orphanCount);
    this.appendInspectorRow("Source families", health.sourceFamilyCount);
    this.appendInspectorRow("Cross-source relations", health.crossSourceEdgeCount);
    this.appendInspectorRow("Bridge entities", health.crossSourceBridgeNodeCount);
    this.appendInspectorRow("Identity bridge coverage", percentText(health.identityBridgeCoverage));
    this.appendInspectorRow("Unknown relations", health.unknownRelationCount);

    const findings = this.inspector.createDiv({ cls: "graph-intelligence-health-findings" });
    findings.createEl("strong", { text: "Top weaknesses" });
    health.findings.forEach((finding) => this.appendHealthFinding(finding));
    this.explorerStatus.setText(
      `Graph Health · ${health.findings.filter((finding) => finding.severity === "critical").length} critical · ${health.findings.filter((finding) => finding.severity === "warning").length} warnings`
    );
  }

  private blindSpotNode(spot: BlindSpot): Node | null {
    if (!spot.entityId) return null;
    return this.plugin.globalGraph.nodes.find((node) => {
      return node.id === spot.entityId || node.intelligence.projectionId === spot.entityId;
    }) || null;
  }

  private renderBlindSpots() {
    if (!this.inspector) return;
    this.inspector.empty();
    this.inspector.createEl("strong", { text: "Blind Spots" });
    const projection = this.plugin.intelligenceProjection;
    if (!projection) {
      this.inspector.createDiv({
        cls: "graph-intelligence-inspector-empty",
        text: "Unified projection is unavailable, so blind spots cannot be evaluated.",
      });
      return;
    }

    const spots = collectBlindSpots(projection);
    if (!spots.length) {
      this.inspector.createDiv({
        cls: "graph-intelligence-inspector-empty",
        text: "No blind spots are visible in the current projection.",
      });
      this.explorerStatus.setText("Blind Spots · none visible in current projection");
      return;
    }

    const counts = new Map<string, number>();
    spots.forEach((spot) => counts.set(spot.kind, (counts.get(spot.kind) || 0) + 1));
    this.inspector.createDiv({
      cls: "graph-intelligence-inspector-summary",
      text: Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([kind, count]) => `${humanize(kind)} ${count}`)
        .join(" · "),
    });

    const list = this.inspector.createDiv({ cls: "graph-intelligence-blind-spot-list" });
    spots.slice(0, 80).forEach((spot) => {
      const item = list.createEl("button", { cls: "graph-intelligence-blind-spot" });
      item.createDiv({ cls: "graph-intelligence-blind-spot-kind", text: humanize(spot.kind) });
      item.createDiv({ cls: "graph-intelligence-blind-spot-detail", text: spot.detail });
      const node = this.blindSpotNode(spot);
      if (!node) {
        item.disabled = true;
        return;
      }
      item.addEventListener("click", () => {
        this.forceGraph.focusNeighborhood(node.id, "both", 1, false);
        this.renderInspector(node);
        this.explorerStatus.setText(`Blind spot · ${node.name} · ${humanize(spot.kind)}`);
      });
    });

    if (spots.length > 80) {
      this.inspector.createDiv({
        cls: "graph-intelligence-inspector-empty",
        text: `${spots.length - 80} additional blind spots are hidden from this bounded list.`,
      });
    }
    this.explorerStatus.setText(`Blind Spots · ${spots.length} findings`);
  }

  private appendInspectorActions(node: Node) {
    const actions = this.inspector.createDiv({ cls: "graph-intelligence-inspector-actions" });
    const addAction = (label: string, run: () => void) => {
      const button = actions.createEl("button", { text: label });
      button.addEventListener("click", run);
    };
    addAction("Focus", () => {
      const distances = this.forceGraph.focusNeighborhood(node.id, "both", 1, false);
      this.explorerStatus.setText(`Focus · ${node.name} · ${distances.size} entities`);
    });
    addAction("Impact", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "both", 2, true);
      this.explorerStatus.setText(`Impact · ${node.name} · ${distances.size} entities`);
    });
    addAction("Used by", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "incoming", 2, true);
      this.explorerStatus.setText(`Used by · ${node.name} · ${distances.size} entities`);
    });
    addAction("Depends on", () => {
      this.setMode("dependencies");
      const distances = this.forceGraph.focusNeighborhood(node.id, "outgoing", 2, true);
      this.explorerStatus.setText(`Depends on · ${node.name} · ${distances.size} entities`);
    });
    addAction("Blind spots", () => this.renderBlindSpots());
    addAction("Clear", () => {
      this.forceGraph.clearFocus();
      this.explorerStatus.setText(this.defaultExplorerStatus());
    });
  }

  private intelligenceRecord(node: Node): IntelligenceNodeRecord {
    return {
      id: node.intelligence.projectionId || node.id,
      label: node.name,
      kind: node.intelligence.kind,
      source: node.intelligence.source,
      note_path: node.path,
      layer: node.intelligence.layer,
      virtual: node.intelligence.virtual,
      metrics: node.intelligence.metrics,
      state: node.intelligence.state,
      metadata: node.intelligence.metadata,
    };
  }

  private renderInspector(node: Node) {
    if (!this.inspector) return;
    this.inspector.empty();
    const projection = this.plugin.intelligenceProjection;
    const record = this.intelligenceRecord(node);
    const dossier = projection ? buildEntityDossier(record, projection) : null;
    const intel = node.intelligence;

    this.inspector.createEl("strong", { text: node.name });
    this.inspector.createDiv({
      cls: "graph-intelligence-dossier-purpose",
      text: dossier?.purpose || `${humanize(intel.kind)} from ${humanize(intel.source)}`,
    });
    this.appendInspectorActions(node);

    if (dossier) {
      const truthSummary = this.inspector.createDiv({ cls: "graph-intelligence-truth-summary" });
      truthSummary.createDiv({
        cls: "graph-intelligence-truth-proven",
        text: dossier.strongestProvenStage
          ? `Proven through ${humanize(dossier.strongestProvenStage)}`
          : "No proven truth stage",
      });
      truthSummary.createDiv({
        cls: "graph-intelligence-truth-gap",
        text: dossier.earliestUnprovenStage
          ? `Next unproven: ${humanize(dossier.earliestUnprovenStage)}`
          : "No unproven stage in current evidence",
      });
      this.appendTruthRing(dossier.truth);

      const relations = this.inspector.createDiv({ cls: "graph-intelligence-dossier-section" });
      relations.createDiv({ cls: "graph-intelligence-section-title", text: "Connections" });
      relations.createDiv({
        cls: "graph-intelligence-inspector-summary",
        text: `Uses ${dossier.relationships.uses} · Used by ${dossier.relationships.usedBy} · Data flows ${dossier.relationships.dataFlows} · Verified by ${dossier.relationships.verifiedBy} · Total ${dossier.relationships.total}`,
      });
    }

    const state = this.inspector.createDiv({ cls: "graph-intelligence-dossier-section" });
    state.createDiv({ cls: "graph-intelligence-section-title", text: "Current evidence" });
    this.appendInspectorRow("Live", intel.state.live);
    this.appendInspectorRow("Freshness", intel.state.freshness);
    this.appendInspectorRow("Authority", intel.state.authority);
    this.appendInspectorRow("Lifecycle", intel.state.lifecycle);

    const raw = this.inspector.createEl("details", { cls: "graph-intelligence-raw" });
    raw.createEl("summary", { text: "Raw graph metadata" });
    const rawBody = raw.createDiv({ cls: "graph-intelligence-raw-body" });
    const addRaw = (label: string, value: string | number | undefined) => {
      if (value === undefined || value === "") return;
      const row = rawBody.createDiv({ cls: "graph-intelligence-inspector-row" });
      row.createSpan({ cls: "graph-intelligence-inspector-label", text: `${label}: ` });
      row.createSpan({ text: String(value) });
    };
    addRaw("Kind", intel.kind);
    addRaw("Role", scalarText(intel.metadata.role || intel.metadata.hub_role));
    addRaw("Change", scalarText(intel.metadata.change));
    addRaw("Source", intel.source);
    addRaw("Layer", intel.layer);
    addRaw("Verification", intel.state.verification);
    addRaw("Degree", intel.metrics.degree);
    addRaw("PageRank", intel.metrics.pagerank);
    addRaw("Betweenness", intel.metrics.betweenness);
    addRaw("Bridge score", intel.metrics.bridge_score);
    addRaw("Community", scalarText(intel.metrics.community));
    addRaw("Support", scalarText(intel.metadata.support));
    addRaw("Folder", scalarText(intel.metadata.folder));
    addRaw("Project", scalarText(intel.metadata.project));
    addRaw("Repository", scalarText(intel.metadata.repository));
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
