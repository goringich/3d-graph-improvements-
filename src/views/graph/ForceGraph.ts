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
  nodeMatchesMode,
  nodeVisualWeight,
} from "../../intelligence/Projection";

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

export class ForceGraph {
  private instance: ForceGraph3DInstance;
  private readonly rootHtmlElement: HTMLElement;

  private readonly highlightedNodes: Set<string> = new Set();
  private readonly highlightedLinks: Set<Link> = new Set();
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
    const details = [
      intel.kind,
      intel.state.live ? `live: ${intel.state.live}` : "",
      intel.state.freshness ? `freshness: ${intel.state.freshness}` : "",
      intel.state.authority ? `authority: ${intel.state.authority}` : "",
    ].filter(Boolean);
    return `<div class="node-label"><strong>${escapeHtml(
      node.name
    )}</strong>${details.length ? `<br>${details.map(escapeHtml).join(" · ")}` : ""}</div>`;
  }

  private getGraphData = (): Graph => {
    if (this.isLocalGraph && this.plugin.openFileState.value) {
      this.graph = this.plugin.globalGraph
        .clone()
        .getLocalGraph(
          this.plugin.openFileState.value,
          this.plugin.getSettings().filters.localDepth
        );
    } else {
      this.graph = this.plugin.globalGraph.clone();
    }

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
    } else if (data.currentPath === "value.filters.localDepth") {
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

    let color = node.intelligence.virtual
      ? this.plugin.theme.textNormal
      : this.plugin.theme.textMuted;
    this.plugin.getSettings().groups.groups.forEach((group) => {
      if (NodeGroup.matches(group.query, node)) color = group.color;
    });
    return color;
  };

  private doShowNode = (node: Node) => {
    const filters = this.plugin.getSettings().filters;
    return (
      (filters.doShowOrphans || node.links.length > 0) &&
      (filters.doShowAttachments || !node.isAttachment) &&
      (filters.doShowVirtualNodes || !node.intelligence.virtual) &&
      nodeMatchesMode(filters.graphMode, node.intelligence)
    );
  };

  private doShowLink = (link: Link) => {
    const filters = this.plugin.getSettings().filters;
    if (!filters.doShowAttachments && link.linksAnAttachment) return false;
    if (!filters.doShowSemanticEdges && link.intelligence.semantic) return false;

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

    this.clearHighlights();

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
    if (link.intelligence.semantic) return Math.max(0.5, base * 0.35);
    return this.isHighlightedLink(link) ? base * 1.5 : base;
  }

  private createLinks = () => {
    this.instance
      .linkWidth((link: Link) => this.getLinkWidth(link))
      .linkDirectionalParticles((link: Link) =>
        this.isHighlightedLink(link) && !link.intelligence.semantic
          ? this.plugin.getSettings().display.particleCount
          : 0
      )
      .linkDirectionalParticleWidth(
        this.plugin.getSettings().display.particleSize
      )
      .linkVisibility(this.doShowLink)
      .onLinkHover(this.onLinkHover)
      .linkColor((link: Link) => {
        if (this.isHighlightedLink(link)) return this.plugin.theme.textAccent;
        return link.intelligence.semantic
          ? this.plugin.theme.textFaint
          : this.plugin.theme.textMuted;
      });
  };

  private onLinkHover = (link: Link | null) => {
    this.clearHighlights();

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
      .linkDirectionalParticles(this.instance.linkDirectionalParticles());
  }

  getInstance(): ForceGraph3DInstance {
    return this.instance;
  }

  getGraph(): Graph {
    return this.graph;
  }
}
