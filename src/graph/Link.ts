import Node from "./Node";
import type { IntelligenceEdgeRecord } from "../intelligence/Projection";

export type ResolvedLinkCache = Record<string, Record<string, number>>;

export interface LinkIntelligenceMetadata {
  kind: string;
  sourceClass: string;
  confidence?: string;
  semantic: boolean;
  metadata: Record<string, unknown>;
}

const defaultLinkIntelligence = (): LinkIntelligenceMetadata => ({
  kind: "wikilink",
  sourceClass: "obsidian",
  semantic: false,
  metadata: {},
});

export default class Link {
  public readonly source: string;
  public readonly target: string;
  public readonly linksAnAttachment: boolean;
  public readonly intelligence: LinkIntelligenceMetadata;

  constructor(
    sourceId: string,
    targetId: string,
    linksAnAttachment: boolean,
    intelligence: LinkIntelligenceMetadata = defaultLinkIntelligence()
  ) {
    this.source = sourceId;
    this.target = targetId;
    this.linksAnAttachment = linksAnAttachment;
    this.intelligence = intelligence;
  }

  static fromProjection(
    sourceId: string,
    targetId: string,
    record: IntelligenceEdgeRecord
  ): Link {
    return new Link(sourceId, targetId, false, {
      kind: record.kind || "related",
      sourceClass: record.source_class || "projection",
      confidence: record.confidence,
      semantic: Boolean(record.semantic),
      metadata: record.metadata || {},
    });
  }

  static createLinkIndex(links: Link[]): Map<string, Map<string, number>> {
    const linkIndex = new Map<string, Map<string, number>>();
    links.forEach((link, index) => {
      const source = typeof link.source === "string" ? link.source : String(link.source);
      const target = typeof link.target === "string" ? link.target : String(link.target);
      if (!linkIndex.has(source)) {
        linkIndex.set(source, new Map<string, number>());
      }
      linkIndex.get(source)?.set(target, index);
    });

    return linkIndex;
  }

  static createFromCache(
    cache: ResolvedLinkCache,
    nodes: Node[],
    nodeIndex: Map<string, number>
  ): [Link[], Map<string, Map<string, number>>] {
    const links = Object.keys(cache)
      .map((node1Id) => {
        return Object.keys(cache[node1Id])
          .map((node2Id) => {
            const [node1Index, node2Index] = [
              nodeIndex.get(node1Id),
              nodeIndex.get(node2Id),
            ];
            if (node1Index !== undefined && node2Index !== undefined) {
              return nodes[node1Index].addNeighbor(nodes[node2Index]);
            }
            return null;
          })
          .flat();
      })
      .flat()
      .filter(
        (link, index, self) =>
          link &&
          link.source !== link.target &&
          index ===
            self.findIndex(
              (candidate: Link | null) =>
                candidate &&
                candidate.source === link.source &&
                candidate.target === link.target
            )
      ) as Link[];

    return [links, Link.createLinkIndex(links)];
  }
}
