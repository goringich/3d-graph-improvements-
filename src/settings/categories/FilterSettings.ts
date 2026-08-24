import type { GraphMode } from "../../intelligence/Projection";

export class FilterSettings {
  doShowOrphans = true;
  doShowAttachments = false;
  doShowVirtualNodes = true;
  doShowSemanticEdges = false;
  graphMode: GraphMode = "all";
  localDepth = 1;

  constructor(
    doShowOrphans?: boolean,
    doShowAttachments?: boolean,
    doShowVirtualNodes?: boolean,
    doShowSemanticEdges?: boolean,
    graphMode?: GraphMode,
    localDepth?: number
  ) {
    this.doShowOrphans = doShowOrphans ?? this.doShowOrphans;
    this.doShowAttachments = doShowAttachments ?? this.doShowAttachments;
    this.doShowVirtualNodes = doShowVirtualNodes ?? this.doShowVirtualNodes;
    this.doShowSemanticEdges = doShowSemanticEdges ?? this.doShowSemanticEdges;
    this.graphMode = graphMode ?? this.graphMode;
    this.localDepth = Math.max(1, Math.min(6, localDepth ?? this.localDepth));
  }

  public static fromStore(store: any) {
    return new FilterSettings(
      store?.doShowOrphans,
      store?.doShowAttachments,
      store?.doShowVirtualNodes,
      store?.doShowSemanticEdges,
      store?.graphMode,
      store?.localDepth
    );
  }

  public toObject() {
    return {
      doShowOrphans: this.doShowOrphans,
      doShowAttachments: this.doShowAttachments,
      doShowVirtualNodes: this.doShowVirtualNodes,
      doShowSemanticEdges: this.doShowSemanticEdges,
      graphMode: this.graphMode,
      localDepth: this.localDepth,
    };
  }
}
