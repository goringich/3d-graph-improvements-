import Link from "./Link";
import Node from "./Node";
import type { App } from "obsidian";
import type { IntelligenceProjection } from "../intelligence/Projection";
import {
  isDirectedRelation,
  type GraphDirection,
} from "../intelligence/GraphSemantics";

const endpointId = (endpoint: string | Node): string => {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
};

export default class Graph {
  public readonly nodes: Node[];
  public readonly links: Link[];

  private readonly nodeIndex: Map<string, number>;
  private readonly linkIndex: Map<string, Map<string, number>>;

  constructor(
    nodes: Node[],
    links: Link[],
    nodeIndex: Map<string, number>,
    linkIndex: Map<string, Map<string, number>>
  ) {
    this.nodes = nodes;
    this.links = links;
    this.nodeIndex = nodeIndex || new Map<string, number>();
    this.linkIndex = linkIndex || new Map<string, Map<string, number>>();
  }

  public getNodeById(id: string): Node | null {
    const index = this.nodeIndex.get(id);
    return index !== undefined ? this.nodes[index] : null;
  }

  public getLinkByIds(sourceNodeId: string, targetNodeId: string): Link | null {
    const sourceLinkMap = this.linkIndex.get(sourceNodeId);
    if (sourceLinkMap) {
      const index = sourceLinkMap.get(targetNodeId);
      if (index !== undefined) return this.links[index];
    }
    return null;
  }

  public getLinksFromNode(sourceNodeId: string): Link[] {
    const sourceLinkMap = this.linkIndex.get(sourceNodeId);
    if (!sourceLinkMap) return [];
    return Array.from(sourceLinkMap.values()).map((index) => this.links[index]);
  }

  public getLinksWithNode(nodeId: string): Link[] {
    return this.links.filter((link) => {
      const source = endpointId(link.source as unknown as string | Node);
      const target = endpointId(link.target as unknown as string | Node);
      return source === nodeId || target === nodeId;
    });
  }

  public getSubgraph(selectedNodeIds: Iterable<string>): Graph {
    const selected = new Set(selectedNodeIds);
    const clone = this.clone();
    const nodes = clone.nodes.filter((node) => selected.has(node.id));
    const links = clone.links.filter((link) => {
      const source = endpointId(link.source as unknown as string | Node);
      const target = endpointId(link.target as unknown as string | Node);
      return selected.has(source) && selected.has(target);
    });
    const nodeIndex = new Map<string, number>();
    nodes.forEach((node, index) => nodeIndex.set(node.id, index));

    nodes.forEach((node) => {
      node.neighbors.splice(
        0,
        node.neighbors.length,
        ...node.neighbors.filter((neighbor) => selected.has(neighbor.id))
      );
      node.links.splice(
        0,
        node.links.length,
        ...node.links.filter((link) => {
          const source = endpointId(link.source as unknown as string | Node);
          const target = endpointId(link.target as unknown as string | Node);
          return selected.has(source) && selected.has(target);
        })
      );
    });

    return new Graph(nodes, links, nodeIndex, Link.createLinkIndex(links));
  }

  private candidatesFromLink(
    current: string,
    link: Link,
    direction: GraphDirection
  ): string[] {
    const source = endpointId(link.source as unknown as string | Node);
    const target = endpointId(link.target as unknown as string | Node);
    if (source !== current && target !== current) return [];

    if (!isDirectedRelation(link) || direction === "both") {
      return [source === current ? target : source];
    }
    if (direction === "outgoing" && source === current) return [target];
    if (direction === "incoming" && target === current) return [source];
    return [];
  }

  public neighborhood(
    nodeId: string,
    direction: GraphDirection = "both",
    depth = 1,
    linkPredicate: (link: Link) => boolean = () => true
  ): Map<string, number> {
    if (!this.getNodeById(nodeId)) return new Map();
    const boundedDepth = Math.max(0, Math.min(6, Math.floor(depth)));
    const distances = new Map<string, number>([[nodeId, 0]]);
    let frontier = [nodeId];

    for (let level = 1; level <= boundedDepth; level += 1) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const link of this.getLinksWithNode(current)) {
          if (!linkPredicate(link)) continue;
          for (const candidate of this.candidatesFromLink(current, link, direction)) {
            if (distances.has(candidate)) continue;
            distances.set(candidate, level);
            next.push(candidate);
          }
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    return distances;
  }

  public getLocalGraph(nodeId: string, depth = 1): Graph {
    return this.getSubgraph(this.neighborhood(nodeId, "both", depth).keys());
  }

  public shortestPath(
    sourceId: string,
    targetId: string,
    direction: GraphDirection = "both",
    linkPredicate: (link: Link) => boolean = () => true
  ): string[] {
    if (!this.getNodeById(sourceId) || !this.getNodeById(targetId)) return [];
    if (sourceId === targetId) return [sourceId];

    const queue = [sourceId];
    const previous = new Map<string, string | null>([[sourceId, null]]);

    while (queue.length) {
      const current = queue.shift() as string;
      for (const link of this.getLinksWithNode(current)) {
        if (!linkPredicate(link)) continue;
        for (const next of this.candidatesFromLink(current, link, direction)) {
          if (previous.has(next)) continue;
          previous.set(next, current);
          if (next === targetId) {
            const path = [targetId];
            let cursor: string | null = current;
            while (cursor) {
              path.push(cursor);
              cursor = previous.get(cursor) || null;
            }
            return path.reverse();
          }
          queue.push(next);
        }
      }
    }

    return [];
  }

  public applyProjection(projection: IntelligenceProjection | null): Graph {
    if (!projection) return this;

    const projectionToGraphId = new Map<string, string>();

    projection.nodes.forEach((record) => {
      const existingId = record.note_path || record.id;
      const existing = this.getNodeById(existingId);
      if (existing) {
        existing.applyIntelligence(record);
        projectionToGraphId.set(record.id, existing.id);
        return;
      }

      const virtualNode = Node.createVirtual({ ...record, virtual: true });
      if (this.nodeIndex.has(virtualNode.id)) {
        projectionToGraphId.set(record.id, virtualNode.id);
        return;
      }
      this.nodeIndex.set(virtualNode.id, this.nodes.length);
      this.nodes.push(virtualNode);
      projectionToGraphId.set(record.id, virtualNode.id);
    });

    projection.edges.forEach((record) => {
      const sourceId = projectionToGraphId.get(record.source) || record.source;
      const targetId = projectionToGraphId.get(record.target) || record.target;
      const source = this.getNodeById(sourceId);
      const target = this.getNodeById(targetId);
      if (!source || !target || source.id === target.id) return;

      const duplicate = this.links.some((link) => {
        const left = endpointId(link.source as unknown as string | Node);
        const right = endpointId(link.target as unknown as string | Node);
        return (
          ((left === source.id && right === target.id) ||
            (left === target.id && right === source.id)) &&
          link.intelligence.kind === record.kind &&
          link.intelligence.sourceClass === record.source_class
        );
      });
      if (duplicate) return;

      const link = Link.fromProjection(source.id, target.id, record);
      source.addLink(link);
      target.addLink(link);
      if (!source.neighbors.some((neighbor) => neighbor.id === target.id)) {
        source.neighbors.push(target);
      }
      if (!target.neighbors.some((neighbor) => neighbor.id === source.id)) {
        target.neighbors.push(source);
      }
      this.links.push(link);
    });

    this.rebuildLinkIndex();
    return this;
  }

  public clone = (): Graph => {
    const nodes = structuredClone(this.nodes) as Node[];
    const links = structuredClone(this.links) as Link[];
    const nodeIndex = new Map<string, number>();
    nodes.forEach((node, index) => nodeIndex.set(node.id, index));
    return new Graph(nodes, links, nodeIndex, Link.createLinkIndex(links));
  };

  public static createFromApp = (app: App): Graph => {
    const [nodes, nodeIndex] = Node.createFromFiles(app.vault.getFiles(), app);
    const [links, linkIndex] = Link.createFromCache(
      app.metadataCache.resolvedLinks,
      nodes,
      nodeIndex
    );
    return new Graph(nodes, links, nodeIndex, linkIndex);
  };

  public update = (app: App) => {
    const newGraph = Graph.createFromApp(app);
    this.nodes.splice(0, this.nodes.length, ...newGraph.nodes);
    this.links.splice(0, this.links.length, ...newGraph.links);

    this.nodeIndex.clear();
    newGraph.nodeIndex.forEach((value, key) => this.nodeIndex.set(key, value));
    this.linkIndex.clear();
    newGraph.linkIndex.forEach((value, key) => this.linkIndex.set(key, value));
  };

  private rebuildLinkIndex() {
    this.linkIndex.clear();
    Link.createLinkIndex(this.links).forEach((value, key) => {
      this.linkIndex.set(key, value);
    });
  }
}
