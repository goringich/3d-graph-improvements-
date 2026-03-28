import {Setting} from "obsidian";

const SimpleSliderSetting = (containerEl: HTMLElement, options: SliderOptions, onChange: (newValue: number) => void) => {
	const slider = new Setting(containerEl)
		.setName(options.name)
		.setDesc(options.desc ?? "")
		.setClass("mod-slider")
		.addSlider(
			(slider) => {
				slider.setLimits(options.stepOptions.min, options.stepOptions.max, options.stepOptions.step)
					.setValue(options.value)
					.onChange(async (value) => {
						onChange(value);
					});
			}
		)
	return slider;
}

export interface SliderOptions {
	name: string;
	desc?: string;
	stepOptions: SliderStepOptions;
	value: number;
}

export interface SliderStepOptions {
	min: number;
	max: number;
	step: number;
}

export const DEFAULT_SLIDER_STEP_OPTIONS: SliderStepOptions = {
	min: 1,
	max: 20,
	step: 1,
}

export default SimpleSliderSetting;
