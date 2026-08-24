import Link from "./Link";
import { getAllTags } from "obsidian";
import type { App, TFile } from "obsidian";
import {
  defaultNodeIntelligence,
  type IntelligenceNodeRecord,
  type NodeIntelligenceMetadata,
} from "../intelligence/Projection";

export default class Node {
  public readonly id: string;
  public readonly name: string;
  public readonly path: string;
  public readonly isAttachment: boolean;
  public readonly val: number;

  public readonly neighbors: Node[];
  public readonly links: Link[];
  public readonly tags: string[];
  public readonly intelligence: NodeIntelligenceMetadata;

  constructor(
    name: string,
    path: string,
    isAttachment: boolean,
    val = 10,
    neighbors: Node[] = [],
    links: Link[] = [],
    tags: string[] = [],
    intelligence: NodeIntelligenceMetadata = defaultNodeIntelligence()
  ) {
    this.id = path;
    this.name = name;
    this.path = path;
    this.isAttachment = isAttachment;
    this.val = val;
    this.neighbors = neighbors;
    this.links = links;
    this.tags = tags;
    this.intelligence = intelligence;
  }

  static createFromFiles(files: TFile[], app: App): [Node[], Map<string, number>] {
    const nodeMap = new Map<string, number>();
    const nodes: Node[] = [];

    files.forEach((file) => {
      const node = new Node(
        file.name,
        file.path,
        file.extension !== "md",
        10,
        [],
        [],
        [],
        {
          ...defaultNodeIntelligence(),
          kind: file.extension === "md" ? "note" : "attachment",
        }
      );
      const cache = app.metadataCache.getFileCache(file);
      const tags = cache ? getAllTags(cache) : null;
      tags?.forEach((tag) => node.tags.push(tag.substring(1)));

      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, nodes.length);
        nodes.push(node);
      }
    });

    return [nodes, nodeMap];
  }

  static createVirtual(record: IntelligenceNodeRecord): Node {
    return new Node(
      record.label,
      record.note_path || record.id,
      false,
      10,
      [],
      [],
      [],
      Node.intelligenceFromRecord(record, true)
    );
  }

  static intelligenceFromRecord(
    record: IntelligenceNodeRecord,
    virtual = Boolean(record.virtual)
  ): NodeIntelligenceMetadata {
    return {
      projectionId: record.id,
      kind: record.kind || "unknown",
      source: record.source || "unknown",
      layer: record.layer,
      virtual,
      metrics: record.metrics || {},
      state: record.state || {},
      metadata: record.metadata || {},
    };
  }

  applyIntelligence(record: IntelligenceNodeRecord) {
    const next = Node.intelligenceFromRecord(record, this.intelligence.virtual);
    Object.assign(this.intelligence, next);
  }

  addNeighbor(neighbor: Node, link?: Link): Link | null {
    if (!this.isNeighborOf(neighbor)) {
      const createdLink =
        link || new Link(this.id, neighbor.id, this.isAttachment || neighbor.isAttachment);
      this.neighbors.push(neighbor);
      this.addLink(createdLink);

      neighbor.neighbors.push(this);
      neighbor.addLink(createdLink);

      return createdLink;
    }
    return null;
  }

  addLink(link: Link) {
    if (
      !this.links.some(
        (candidate) =>
          candidate.source === link.source && candidate.target === link.target
      )
    ) {
      this.links.push(link);
    }
  }

  public isNeighborOf(node: Node | string) {
    if (node instanceof Node) return this.neighbors.includes(node);
    return this.neighbors.some((neighbor) => neighbor.id === node);
  }
}
