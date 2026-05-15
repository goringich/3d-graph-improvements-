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
		desc: "Visual size of each node.",
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
		desc: "Visual thickness of connections between notes.",
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
		desc: "Overall spread of the graph. Higher values push linked nodes farther apart.",
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
		desc: "How strongly nodes push each other away. More negative means stronger separation.",
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
		desc: "How quickly the graph settles after movement. Higher values calm motion faster.",
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
		desc: "Size of animated particles on highlighted links.",
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
		desc: "Number of animated particles shown on highlighted links.",
		value: displaySettings.value.particleCount,
		stepOptions: DEFAULT_SLIDER_STEP_OPTIONS,
	};
	return SimpleSliderSetting(containerEl, options, (value) => {
		displaySettings.value.particleCount = value;
	});
};

export default DisplaySettingsView;
