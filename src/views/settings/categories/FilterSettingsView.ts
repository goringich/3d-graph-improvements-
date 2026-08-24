import { Setting } from "obsidian";
import { FilterSettings } from "src/settings/categories/FilterSettings";
import State from "src/util/State";
import type { GraphMode } from "src/intelligence/Projection";

const FilterSettingsView = (
  filterSettings: State<FilterSettings>,
  containerEl: HTMLElement
) => {
  new Setting(containerEl)
    .setName("Graph mode")
    .setDesc("Switch between knowledge, architecture, project, live and semantic projections.")
    .addDropdown((dropdown) => {
      const modes: GraphMode[] = [
        "all",
        "knowledge",
        "architecture",
        "projects",
        "live",
        "semantic",
      ];
      modes.forEach((mode) => dropdown.addOption(mode, mode));
      dropdown
        .setValue(filterSettings.value.graphMode)
        .onChange(async (value) => {
          filterSettings.value.graphMode = value as GraphMode;
        });
    });

  new Setting(containerEl)
    .setName("Local depth")
    .setDesc("Number of graph hops shown in Local Graph mode.")
    .addSlider((slider) => {
      slider
        .setLimits(1, 6, 1)
        .setDynamicTooltip()
        .setValue(filterSettings.value.localDepth)
        .onChange(async (value) => {
          filterSettings.value.localDepth = value;
        });
    });

  new Setting(containerEl).setName("Show Orphans").addToggle((toggle) => {
    toggle
      .setValue(filterSettings.value.doShowOrphans)
      .onChange(async (value) => {
        filterSettings.value.doShowOrphans = value;
      });
  });

  new Setting(containerEl).setName("Show Attachments").addToggle((toggle) => {
    toggle
      .setValue(filterSettings.value.doShowAttachments)
      .onChange(async (value) => {
        filterSettings.value.doShowAttachments = value;
      });
  });

  new Setting(containerEl)
    .setName("Show system/project virtual nodes")
    .setDesc("Virtual nodes come from the read-only unified intelligence projection.")
    .addToggle((toggle) => {
      toggle
        .setValue(filterSettings.value.doShowVirtualNodes)
        .onChange(async (value) => {
          filterSettings.value.doShowVirtualNodes = value;
        });
    });

  new Setting(containerEl)
    .setName("Show semantic suggestions")
    .setDesc("Semantic edges are low-authority suggestions and never become wikilinks automatically.")
    .addToggle((toggle) => {
      toggle
        .setValue(filterSettings.value.doShowSemanticEdges)
        .onChange(async (value) => {
          filterSettings.value.doShowSemanticEdges = value;
        });
    });
};

export default FilterSettingsView;
