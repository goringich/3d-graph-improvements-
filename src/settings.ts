import { App, PluginSettingTab } from "obsidian";
import Graph3dPlugin from "./main";

// Legacy Obsidian sample settings tab stub kept only for compatibility.
// The plugin uses the in-view graph settings panel instead.
export class SampleSettingTab extends PluginSettingTab {
	plugin: Graph3dPlugin;

	constructor(app: App, plugin: Graph3dPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();
	}
}
