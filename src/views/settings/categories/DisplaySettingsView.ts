import { DisplaySettings } from "../../../settings/categories/DisplaySettings";
import SimpleSliderSetting, {
	DEFAULT_SLIDER_STEP_OPTIONS,
	SliderOptions,
} from "../../atomics/SimpleSliderSetting";
import State from "../../../util/State";

const DisplaySettingsView = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	NodeSizeSetting(displaySettings, containerEl);
	GraphDiameterSetting(displaySettings, containerEl);
	NodeRepulsionSetting(displaySettings, containerEl);
	LayoutDampingSetting(displaySettings, containerEl);
	LinkThicknessSetting(displaySettings, containerEl);
	ParticleSizeSetting(displaySettings, containerEl);
	ParticleCountSetting(displaySettings, containerEl);
};

const NodeSizeSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Node Size",
		value: displaySettings.value.nodeSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.nodeSize = value;
	});
};

const LinkThicknessSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Link Thickness",
		value: displaySettings.value.linkThickness,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.linkThickness = value;
	});
};

const GraphDiameterSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Graph Diameter",
		value: displaySettings.value.nodeSpacing,
		stepOptions: {
			min: 10,
			max: 120,
			step: 5,
		},
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.nodeSpacing = value;
	});
};

const NodeRepulsionSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Node Repulsion",
		value: displaySettings.value.nodeRepulsion,
		stepOptions: {
			min: -150,
			max: -20,
			step: 5,
		},
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.nodeRepulsion = value;
	});
};

const LayoutDampingSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Layout Damping",
		value: displaySettings.value.layoutDamping,
		stepOptions: {
			min: 0.1,
			max: 0.95,
			step: 0.05,
		},
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.layoutDamping = Number(value.toFixed(2));
	});
};

const ParticleSizeSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Particle Size",
		value: displaySettings.value.particleSize,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.particleSize = value;
	});
};

const ParticleCountSetting = (
	displaySettings: State<DisplaySettings>,
	containerEl: HTMLElement
) => {
	const options: SliderOptions = {
		name: "Particle Count",
		value: displaySettings.value.particleCount,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.particleCount = value;
	});
};

export default DisplaySettingsView;
