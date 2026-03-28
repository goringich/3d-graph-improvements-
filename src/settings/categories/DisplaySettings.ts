export class DisplaySettings {
	nodeSize = 4;
	linkThickness = 5;
	particleSize = 6;
	particleCount = 4;
	nodeSpacing = 30;
	nodeRepulsion = -60;

	constructor(
		nodeSize?: number,
		linkThickness?: number,
		particleSize?: number,
		particleCount?: number,
		nodeSpacing?: number,
		nodeRepulsion?: number
	) {
		this.nodeSize = nodeSize ?? this.nodeSize;
		this.linkThickness = linkThickness ?? this.linkThickness;
		this.particleSize = particleSize ?? this.particleSize;
		this.particleCount = particleCount ?? this.particleCount;
		this.nodeSpacing = nodeSpacing ?? this.nodeSpacing;
		this.nodeRepulsion = nodeRepulsion ?? this.nodeRepulsion;
	}

	public static fromStore(store: any) {
		return new DisplaySettings(
			store?.nodeSize,
			store?.linkThickness,
			store?.particleSize,
			store?.particleCount,
			store?.nodeSpacing,
			store?.nodeRepulsion
		);
	}

	public toObject() {
		return {
			nodeSize: this.nodeSize,
			linkThickness: this.linkThickness,
			particleSize: this.particleSize,
			particleCount: this.particleCount,
			nodeSpacing: this.nodeSpacing,
			nodeRepulsion: this.nodeRepulsion,
		};
	}
}
