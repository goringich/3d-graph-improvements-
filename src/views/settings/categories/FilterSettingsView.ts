import {
	App,
	ButtonComponent,
	ExtraButtonComponent,
	Setting,
	TFolder,
	TextComponent,
} from "obsidian";
import { FilterSettings } from "src/settings/categories/FilterSettings";
import State from "src/util/State";

const normalizeExcludedFolders = (value: string): string[] =>
	value
		.split(/\r?\n|,/)
		.map((folder) => folder.trim().replace(/^\/+|\/+$/g, ""))
		.filter(Boolean);

const getVaultFolders = (app: App): string[] =>
	app.vault
		.getAllLoadedFiles()
		.filter((file): file is TFolder => file instanceof TFolder)
		.map((folder) => folder.path)
		.filter((path) => path.length > 0)
		.sort((a, b) => a.localeCompare(b));

const FilterSettingsView = (
	filterSettings: State<FilterSettings>,
	app: App,
	containerEl: HTMLElement
) => {
	new Setting(containerEl).setName("Show Orphans").addToggle((toggle) => {
		toggle
			.setValue(filterSettings.value.doShowOrphans || false)
			.onChange(async (value) => {
				filterSettings.value.doShowOrphans = value;
			});
	});
	new Setting(containerEl).setName("Show Attachments").addToggle((toggle) => {
		toggle
			.setValue(filterSettings.value.doShowAttachments || false)
			.onChange(async (value) => {
				filterSettings.value.doShowAttachments = value;
			});
	});

	const folderPaths = getVaultFolders(app);
	const sectionEl = containerEl.createDiv({
		cls: "graph-filter-folders-section",
	});
	const headerSetting = new Setting(sectionEl)
		.setName("Exclude folders");
	const headerNameEl = headerSetting.nameEl;
	headerNameEl.addClass("graph-setting-name-with-tooltip");
	headerNameEl.setAttribute(
		"title",
		"These folders and everything inside them will be hidden."
	);
	new ExtraButtonComponent(headerNameEl)
		.setIcon("info")
		.setTooltip("These folders and everything inside them will be hidden.")
		.extraSettingsEl.addClass("graph-setting-info-button");

	let inputComponent: TextComponent | null = null;
	const selectedFoldersEl = sectionEl.createDiv({
		cls: "graph-filter-folder-list",
	});
	const datalistId = `graph-filter-folders-${Math.random()
		.toString(36)
		.slice(2)}`;
	const datalistEl = createEl("datalist", { attr: { id: datalistId } });
	folderPaths.forEach((folderPath) => {
		datalistEl.createEl("option", { value: folderPath });
	});
	sectionEl.appendChild(datalistEl);

	const addExcludedFolder = (rawValue: string) => {
		const [folder] = normalizeExcludedFolders(rawValue);
		if (!folder) return;

		const nextFolders = new Set(filterSettings.value.excludedFolders);
		nextFolders.add(folder);
		filterSettings.value.excludedFolders = Array.from(nextFolders).sort((a, b) =>
			a.localeCompare(b)
		);
		if (inputComponent) inputComponent.setValue("");
		renderSelectedFolders();
	};

	const removeExcludedFolder = (folder: string) => {
		filterSettings.value.excludedFolders =
			filterSettings.value.excludedFolders.filter((path) => path !== folder);
		renderSelectedFolders();
	};

	const renderSelectedFolders = () => {
		selectedFoldersEl.empty();
		if (filterSettings.value.excludedFolders.length === 0) {
			selectedFoldersEl.createDiv({
				cls: "graph-filter-folder-empty",
				text: "No excluded folders",
			});
			return;
		}

		filterSettings.value.excludedFolders.forEach((folder) => {
			const chipEl = selectedFoldersEl.createDiv({
				cls: "graph-filter-folder-chip",
			});
			chipEl.createSpan({
				cls: "graph-filter-folder-chip-label",
				text: folder,
			});
			new ButtonComponent(chipEl)
				.setClass("graph-filter-folder-chip-remove")
				.setIcon("x")
				.setTooltip(`Remove ${folder}`)
				.onClick(() => removeExcludedFolder(folder));
		});
	};

	headerSetting.addText((text) => {
		inputComponent = text;
		text
			.setPlaceholder("Start typing a folder path…")
			.onChange(() => undefined);
		text.inputEl.addClass("graph-filter-folder-input");
		text.inputEl.setAttribute("list", datalistId);
		text.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				addExcludedFolder(text.getValue());
			}
		});
		return text;
	});
	headerSetting.addButton((button) => {
		button
			.setButtonText("Add")
			.setClass("graph-filter-folder-add")
			.onClick(() => addExcludedFolder(inputComponent?.getValue() ?? ""));
	});

	renderSelectedFolders();
};

export default FilterSettingsView;
