import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import Node from "../../graph/Node";
import Link from "../../graph/Link";
import { StateChange } from "../../util/State";
import Graph3dPlugin from "../../main";
import Graph from "../../graph/Graph";
import { NodeGroup } from "../../settings/categories/GroupSettings";
import { rgba } from "polished";
import EventBus from "../../util/EventBus";
import { applyDisplayForces } from "./applyDisplayForces";
import { stabilizeGraphLayout } from "./stabilizeGraphLayout";
import {
  isStructuralNode,
  nodeMatchesMode,
  nodeVisualWeight,
} from "../../intelligence/Projection";
import { intelligenceNodeColor } from "../../intelligence/VisualPalette";
import {
  isStructuralKind,
  linkArrowLength,
  linkCurvature,
  linkWidthMultiplier,
} from "../../intelligence/VisualEncoding";
import {
  isDependencyRelation,
  type GraphDirection,
} from "../../intelligence/GraphSemantics";

const endpointId = (endpoint: string | Node): string => {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
};

const escapeHtml = (value: string): string => {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[char] || char)
  );
};

const metadataText = (value: unknown): string => {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

export class ForceGraph {
  private instance: ForceGraph3DInstance;
  private readonly rootHtmlElement: HTMLElement;

  private readonly highlightedNodes: Set<string> = new Set();
  private readonly highlightedLinks: Set<Link> = new Set();
  private focusedNodeIds: Set<string> | null = null;
  hoveredNode: Node | null;

  private readonly isLocalGraph: boolean;
  private graph: Graph;
  private readonly plugin: Graph3dPlugin;

  constructor(
    plugin: Graph3dPlugin,
    rootHtmlElement: HTMLElement,
    isLocalGraph: boolean
  ) {
    this.rootHtmlElement = rootHtmlElement;
    this.isLocalGraph = isLocalGraph;
    this.plugin = plugin;

    this.createGraph();
    this.initListeners();
  }

  private initListeners() {
    this.plugin.settingsState.onChange(this.onSettingsStateChanged);
    if (this.isLocalGraph) {
      this.plugin.openFileState.onChange(this.refreshGraphData);
    }
    EventBus.on("graph-changed", this.refreshGraphData);
  }

  private createGraph() {
    this.createInstance();
    this.createNodes();
    this.createLinks();
  }

  private createInstance() {
    const [width, height] = [
      this.rootHtmlElement.offsetWidth || this.rootHtmlElement.clientWidth,
      this.rootHtmlElement.offsetHeight || this.rootHtmlElement.clientHeight,
    ];
    this.instance = ForceGraph3D()(this.rootHtmlElement)
      .graphData(this.getGraphData())
      .nodeLabel((node: Node) => this.getNodeLabel(node))
      .nodeRelSize(this.plugin.getSettings().display.nodeSize)
      .backgroundColor(rgba(0, 0, 0, 0.0))
      .width(width)
      .height(height);
    this.applyDisplayForces(false);
  }

  private getNodeLabel(node: Node): string {
    const intel = node.intelligence;
    const role = metadataText(intel.metadata.role || intel.metadata.hub_role);
    const support = metadataText(intel.metadata.support);
    const change = metadataText(intel.metadata.change);
    const degree = Number(intel.metrics.degree || 0);
    const bridge = Number(intel.metrics.bridge_score || 0);
    const details = [
      intel.kind,
      role ? `role: ${role}` : "",
      change ? `change: ${change}` : "",
      support ? `support: ${support}` : "",
      degree ? `degree: ${degree}` : "",
      bridge >= 0.25 ? `bridge: ${bridge.toFixed(2)}` : "",
      intel.state.live ? `live: ${intel.state.live}` : "",
      intel.state.freshness ? `freshness: ${intel.state.freshness}` : "",
      intel.state.authority ? `authority: ${intel.state.authority}` : "",
    ].filter(Boolean);
    return `<div class="node-label"><strong>${escapeHtml(
      node.name
    )}</strong>${details.length ? `<br>${details.map((value) => escapeHtml(String(value))).join(" · ")}` : ""}</div>`;
  }

  private baseGraph = (): Graph => {
    if (this.isLocalGraph && this.plugin.openFileState.value) {
      return this.plugin.globalGraph
        .clone()
        .getLocalGraph(
          this.plugin.openFileState.value,
          this.plugin.getSettings().filters.localDepth
        );
    }
    return this.plugin.globalGraph.clone();
  };

  private getGraphData = (): Graph => {
    let next = this.baseGraph();
    if (this.focusedNodeIds?.size) {
      next = next.getSubgraph(this.focusedNodeIds);
    }
    this.graph = next;
    return stabilizeGraphLayout(this.graph);
  };

  private refreshGraphData = () => {
    this.instance.graphData(this.getGraphData());
    this.applyDisplayForces(false);
    this.instance.refresh();
  };

  private onSettingsStateChanged = (data: StateChange) => {
    if (data.currentPath === "display.nodeSize") {
      this.instance.nodeRelSize(data.newValue);
    } else if (
      data.currentPath === "display.nodeSpacing" ||
      data.currentPath === "display.nodeRepulsion" ||
      data.currentPath === "display.layoutDamping"
    ) {
      this.applyDisplayForces();
    } else if (data.currentPath === "display.linkThickness") {
      this.instance.linkWidth((link: Link) => this.getLinkWidth(link));
    } else if (data.currentPath === "display.particleSize") {
      this.instance.linkDirectionalParticleWidth(
        this.plugin.getSettings().display.particleSize
      );
    } else if (
      data.currentPath === "filters.localDepth" ||
      data.currentPath === "filters.graphMode" ||
      data.currentPath === "filters.doShowStructureNodes" ||
      data.currentPath === "filters.doShowSemanticEdges" ||
      data.currentPath === "filters.doShowVirtualNodes"
    ) {
      this.refreshGraphData();
      return;
    }

    this.instance.refresh();
  };

  private applyDisplayForces(shouldReheat = true) {
    applyDisplayForces(
      this.plugin.getSettings().display,
      this.instance as ForceGraph3DInstance,
      shouldReheat
    );
  }

  public updateDimensions() {
    const [width, height] = [
      this.rootHtmlElement.offsetWidth,
      this.rootHtmlElement.offsetHeight,
    ];
    this.setDimensions(width, height);
  }

  public setDimensions(width: number, height: number) {
    this.instance.width(width);
    this.instance.height(height);
  }

  private createNodes = () => {
    this.instance
      .nodeColor((node: Node) => this.getNodeColor(node))
      .nodeVal((node: Node) => nodeVisualWeight(node.intelligence))
      .nodeVisibility(this.doShowNode)
      .onNodeHover(this.onNodeHover);
  };

  private getNodeColor = (node: Node): string => {
    if (this.isHighlightedNode(node)) {
      return node === this.hoveredNode
        ? this.plugin.theme.interactiveAccentHover
        : this.plugin.theme.textAccent;
    }

    const change = String(node.intelligence.metadata.change || "");
    if (change === "removed") {
      return this.plugin.theme.backgroundModifierError || this.plugin.theme.textFaint;
    }
    if (change === "added") {
      return this.plugin.theme.backgroundModifierSuccess || this.plugin.theme.textAccent;
    }

    const live = node.intelligence.state.live || "";
    if (live === "conflicting" || live === "failed") {
      return this.plugin.theme.backgroundModifierError || this.plugin.theme.textAccent;
    }
    if (live === "verified_live" || live === "verified_current") {
      return this.plugin.theme.backgroundModifierSuccess || this.plugin.theme.textNormal;
    }
    if (live === "stale" || live === "unknown") {
      return this.plugin.theme.textFaint;
    }

    let color = intelligenceNodeColor(node.intelligence);
    this.plugin.getSettings().groups.groups.forEach((group) => {
      if (NodeGroup.matches(group.query, node)) color = group.color;
    });
    return color;
  };

  private doShowNode = (node: Node) => {
    const filters = this.plugin.getSettings().filters;
    const semanticMode = filters.graphMode === "semantic";
    const hasSemanticEdge = node.links.some((link) => link.intelligence.semantic);
    return (
      (filters.doShowOrphans || node.links.length > 0) &&
      (filters.doShowAttachments || !node.isAttachment) &&
      (filters.doShowVirtualNodes || !node.intelligence.virtual) &&
      (filters.doShowStructureNodes || !isStructuralNode(node.intelligence)) &&
      (semanticMode
        ? filters.doShowSemanticEdges && hasSemanticEdge
        : nodeMatchesMode(filters.graphMode, node.intelligence))
    );
  };

  private doShowLink = (link: Link) => {
    const filters = this.plugin.getSettings().filters;
    if (!filters.doShowAttachments && link.linksAnAttachment) return false;
    if (!filters.doShowSemanticEdges && link.intelligence.semantic) return false;
    if (!filters.doShowStructureNodes && isStructuralKind(link.intelligence.kind)) {
      return false;
    }
    if (filters.graphMode === "semantic" && !link.intelligence.semantic) return false;
    if (filters.graphMode === "dependencies" && !isDependencyRelation(link)) return false;

    const sceneSize = this.graph?.nodes.length || 0;
    if (
      sceneSize > 6000 &&
      !this.isHighlightedLink(link) &&
      (link.intelligence.semantic || isStructuralKind(link.intelligence.kind))
    ) {
      return false;
    }

    const source = this.graph.getNodeById(
      endpointId(link.source as unknown as string | Node)
    );
    const target = this.graph.getNodeById(
      endpointId(link.target as unknown as string | Node)
    );
    return Boolean(source && target && this.doShowNode(source) && this.doShowNode(target));
  };

  private onNodeHover = (node: Node | null) => {
    if (
      (!node && !this.highlightedNodes.size) ||
      (node && this.hoveredNode === node)
    ) {
      return;
    }

    if (!this.focusedNodeIds) this.clearHighlights();

    if (node) {
      this.highlightedNodes.add(node.id);
      node.neighbors.forEach((neighbor) => this.highlightedNodes.add(neighbor.id));
      this.graph
        .getLinksWithNode(node.id)
        .forEach((link) => this.highlightedLinks.add(link));
    }
    this.hoveredNode = node ?? null;
    this.updateHighlight();
  };

  private isHighlightedLink = (link: Link): boolean => {
    return this.highlightedLinks.has(link);
  };

  private isHighlightedNode = (node: Node): boolean => {
    return this.highlightedNodes.has(node.id);
  };

  private getLinkWidth(link: Link): number {
    const base = this.plugin.getSettings().display.linkThickness;
    const signal = linkWidthMultiplier(link.intelligence);
    return Math.max(0.35, base * signal * (this.isHighlightedLink(link) ? 1.75 : 1));
  }

  private getLinkColor = (link: Link): string => {
    if (this.isHighlightedLink(link)) return this.plugin.theme.textAccent;
    const kind = link.intelligence.kind.toLowerCase();
    if (kind === "has_incident") {
      return this.plugin.theme.backgroundModifierError || this.plugin.theme.textAccent;
    }
    if (link.intelligence.semantic || isStructuralKind(kind)) {
      return this.plugin.theme.textFaint;
    }
    if (link.intelligence.sourceClass === "architecture") {
      return this.plugin.theme.textAccent;
    }
    if (link.intelligence.sourceClass === "state_graph") {
      return this.plugin.theme.backgroundModifierSuccess || this.plugin.theme.textNormal;
    }
    if (link.intelligence.sourceClass === "project_reality") {
      return this.plugin.theme.textNormal;
    }
    return this.plugin.theme.textMuted;
  };

  private getLinkLabel = (link: Link): string => {
    const details = [
      link.intelligence.kind,
      link.intelligence.confidence ? `confidence: ${link.intelligence.confidence}` : "",
      link.intelligence.sourceClass ? `source: ${link.intelligence.sourceClass}` : "",
    ].filter(Boolean);
    return `<div class="node-label">${details.map((value) => escapeHtml(String(value))).join(" · ")}</div>`;
  };

  private createLinks = () => {
    this.instance
      .linkLabel((link: Link) => this.getLinkLabel(link))
      .linkWidth((link: Link) => this.getLinkWidth(link))
      .linkCurvature((link: Link) => linkCurvature(link.intelligence))
      .linkDirectionalArrowLength((link: Link) => linkArrowLength(link.intelligence))
      .linkDirectionalArrowRelPos(0.86)
      .linkDirectionalArrowColor((link: Link) => this.getLinkColor(link))
      .linkDirectionalParticles((link: Link) =>
        this.isHighlightedLink(link) && !link.intelligence.semantic
          ? this.plugin.getSettings().display.particleCount
          : 0
      )
      .linkDirectionalParticleWidth(
        this.plugin.getSettings().display.particleSize
      )
      .linkDirectionalParticleColor((link: Link) => this.getLinkColor(link))
      .linkVisibility(this.doShowLink)
      .onLinkHover(this.onLinkHover)
      .linkColor((link: Link) => this.getLinkColor(link));
  };

  private onLinkHover = (link: Link | null) => {
    if (!this.focusedNodeIds) this.clearHighlights();

    if (link) {
      this.highlightedLinks.add(link);
      this.highlightedNodes.add(
        endpointId(link.source as unknown as string | Node)
      );
      this.highlightedNodes.add(
        endpointId(link.target as unknown as string | Node)
      );
    }
    this.updateHighlight();
  };

  private clearHighlights = () => {
    this.highlightedNodes.clear();
    this.highlightedLinks.clear();
  };

  private updateHighlight() {
    this.instance
      .nodeColor(this.instance.nodeColor())
      .linkColor(this.instance.linkColor())
      .linkWidth(this.instance.linkWidth())
      .linkDirectionalArrowColor(this.instance.linkDirectionalArrowColor())
      .linkDirectionalParticles(this.instance.linkDirectionalParticles());
  }

  private zoomToFocused() {
    const instance = this.instance as ForceGraph3DInstance & {
      zoomToFit?: (duration?: number, padding?: number) => void;
    };
    instance.zoomToFit?.(450, 60);
  }

  public focusNodeIds(nodeIds: Iterable<string>) {
    const ids = new Set(nodeIds);
    this.focusedNodeIds = ids.size ? ids : null;
    this.clearHighlights();
    ids.forEach((id) => this.highlightedNodes.add(id));
    this.refreshGraphData();
    this.graph.links.forEach((link) => {
      const source = endpointId(link.source as unknown as string | Node);
      const target = endpointId(link.target as unknown as string | Node);
      if (ids.has(source) && ids.has(target)) this.highlightedLinks.add(link);
    });
    this.updateHighlight();
    this.zoomToFocused();
  }

  public focusNeighborhood(
    nodeId: string,
    direction: GraphDirection = "both",
    depth = 2,
    dependenciesOnly = false
  ): Map<string, number> {
    const sourceGraph = this.plugin.globalGraph.clone();
    const distances = sourceGraph.neighborhood(
      nodeId,
      direction,
      depth,
      dependenciesOnly ? isDependencyRelation : () => true
    );
    this.focusNodeIds(distances.keys());
    this.highlightedNodes.clear();
    this.highlightedNodes.add(nodeId);
    this.updateHighlight();
    return distances;
  }

  public focusPath(path: string[]) {
    this.focusNodeIds(path);
    this.clearHighlights();
    path.forEach((id) => this.highlightedNodes.add(id));
    for (let index = 0; index < path.length - 1; index += 1) {
      const current = path[index];
      const next = path[index + 1];
      this.graph.getLinksWithNode(current).forEach((link) => {
        const source = endpointId(link.source as unknown as string | Node);
        const target = endpointId(link.target as unknown as string | Node);
        if (
          (source === current && target === next) ||
          (source === next && target === current)
        ) {
          this.highlightedLinks.add(link);
        }
      });
    }
    this.updateHighlight();
  }

  public clearFocus() {
    this.focusedNodeIds = null;
    this.clearHighlights();
    this.refreshGraphData();
    this.zoomToFocused();
  }

  public isFocused(): boolean {
    return Boolean(this.focusedNodeIds?.size);
  }

  getInstance(): ForceGraph3DInstance {
    return this.instance;
  }

  getGraph(): Graph {
    return this.graph;
  }
}
