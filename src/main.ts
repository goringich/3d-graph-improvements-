import { Notice, Plugin } from "obsidian";
import { Graph3dView } from "./views/graph/Graph3dView";
import GraphSettings from "./settings/GraphSettings";
import State from "./util/State";
import Graph from "./graph/Graph";
import ObsidianTheme from "./util/ObsidianTheme";
import EventBus from "./util/EventBus";
import { ResolvedLinkCache } from "./graph/Link";
import shallowCompare from "./util/ShallowCompare";
import {
  loadIntelligenceProjection,
  type IntelligenceProjection,
} from "./intelligence/Projection";

export const GRAPH_3D_VIEW_TYPE = "3d_graph_view";

export default class Graph3dPlugin extends Plugin {
  _resolvedCache: ResolvedLinkCache;

  public settingsState: State<GraphSettings>;
  public openFileState: State<string | undefined> = new State(undefined);
  private cacheIsReady: State<boolean> = new State(false);

  public globalGraph: Graph;
  public theme: ObsidianTheme;
  public intelligenceProjection: IntelligenceProjection | null = null;
  private queuedGraphs: Graph3dView[] = [];
  private callbackUnregisterHandles: (() => void)[] = [];

  async onload() {
    await this.init();
    this.addRibbonIcon("glasses", "3D Graph", this.openGlobalGraph);
    this.addCommand({
      id: "open-3d-graph-global",
      name: "Open Global 3D Graph",
      callback: this.openGlobalGraph,
    });

    this.addCommand({
      id: "open-3d-graph-local",
      name: "Open Local 3D Graph",
      callback: this.openLocalGraph,
    });

    this.addCommand({
      id: "reload-3d-graph-intelligence",
      name: "Reload Unified Intelligence Projection",
      callback: async () => {
        await this.refreshGlobalGraph(true);
      },
    });
  }

  private async init() {
    await this.initStates();
    this.initListeners();
  }

  private async initStates() {
    const settings = await this.loadSettings();
    this.settingsState = new State<GraphSettings>(settings);
    this.theme = new ObsidianTheme(this.app.workspace.containerEl);
    this.cacheIsReady.value = this.app.metadataCache.resolvedLinks !== undefined;
    await this.refreshGlobalGraph(false);
  }

  private initListeners() {
    this.callbackUnregisterHandles.push(
      this.settingsState.onChange(() => this.saveSettings())
    );

    EventBus.on("do-reset-settings", this.onDoResetSettings);

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!file) return;
        menu.addItem((item) => {
          item
            .setTitle("Open in local 3D Graph")
            .setIcon("glasses")
            .onClick(() => this.openLocalGraph());
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) this.openFileState.value = file.path;
      })
    );

    this.callbackUnregisterHandles.push(
      this.cacheIsReady.onChange((isReady) => {
        if (isReady) this.openQueuedGraphs();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.cacheIsReady.value = true;
        void this.onGraphCacheChanged();
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("resolve", () => {
        void this.onGraphCacheChanged();
      })
    );
  }

  private openQueuedGraphs() {
    this.queuedGraphs.forEach((view) => view.showGraph());
    this.queuedGraphs = [];
  }

  private async onGraphCacheChanged() {
    if (
      this.cacheIsReady.value &&
      !shallowCompare(this._resolvedCache, this.app.metadataCache.resolvedLinks)
    ) {
      this._resolvedCache = structuredClone(this.app.metadataCache.resolvedLinks);
      await this.refreshGlobalGraph(false);
    }
  }

  private async refreshGlobalGraph(showNotice: boolean) {
    this.intelligenceProjection = await loadIntelligenceProjection(this.app);
    this.globalGraph = Graph.createFromApp(this.app).applyProjection(
      this.intelligenceProjection
    );
    EventBus.trigger("graph-changed");

    if (showNotice) {
      new Notice(
        this.intelligenceProjection
          ? `Unified Intelligence Graph loaded: ${this.intelligenceProjection.nodes.length} projected nodes, ${this.intelligenceProjection.edges.length} projected edges`
          : "Unified Intelligence Graph projection is unavailable; using native Obsidian links only"
      );
    }
  }

  private onDoResetSettings = () => {
    this.settingsState.value.reset();
    EventBus.trigger("did-reset-settings");
  };

  private openLocalGraph = () => {
    const newFilePath = this.app.workspace.getActiveFile()?.path;

    if (newFilePath) {
      this.openFileState.value = newFilePath;
      this.openGraph(true);
    } else {
      new Notice("No file is currently open");
    }
  };

  private openGlobalGraph = () => {
    this.openGraph(false);
  };

  private openGraph = async (isLocalGraph: boolean) => {
    const leaf = this.app.workspace.getLeaf(isLocalGraph ? "split" : false);
    const graphView = new Graph3dView(this, leaf, isLocalGraph);
    await leaf.open(graphView);
    this.app.workspace.revealLeaf(leaf);
    if (this.cacheIsReady.value) {
      graphView.showGraph();
    } else {
      this.queuedGraphs.push(graphView);
    }
  };

  private async loadSettings(): Promise<GraphSettings> {
    const loadedData = await this.loadData();
    return GraphSettings.fromStore(loadedData);
  }

  async saveSettings() {
    await this.saveData(this.settingsState.getRawValue().toObject());
  }

  onunload() {
    super.onunload();
    this.callbackUnregisterHandles.forEach((handle) => handle());
    EventBus.off("do-reset-settings", this.onDoResetSettings);
  }

  public getSettings(): GraphSettings {
    return this.settingsState.value;
  }
}
