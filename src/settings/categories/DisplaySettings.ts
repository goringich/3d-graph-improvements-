export class DisplaySettings {
	nodeSize = 4;
	linkThickness = 5;
	particleSize = 6;
	particleCount = 4;
	nodeSpacing = 38;
	nodeRepulsion = -72;
	layoutDamping = 0.58;

	constructor(
		nodeSize?: number,
		linkThickness?: number,
		particleSize?: number,
		particleCount?: number,
		nodeSpacing?: number,
		nodeRepulsion?: number,
		layoutDamping?: number
	) {
		this.nodeSize = nodeSize ?? this.nodeSize;
		this.linkThickness = linkThickness ?? this.linkThickness;
		this.particleSize = particleSize ?? this.particleSize;
		this.particleCount = particleCount ?? this.particleCount;
		this.nodeSpacing = nodeSpacing ?? this.nodeSpacing;
		this.nodeRepulsion = nodeRepulsion ?? this.nodeRepulsion;
		this.layoutDamping = layoutDamping ?? this.layoutDamping;
	}

	public static fromStore(store: any) {
		return new DisplaySettings(
			store?.nodeSize,
			store?.linkThickness,
			store?.particleSize,
			store?.particleCount,
			store?.nodeSpacing,
			store?.nodeRepulsion,
			store?.layoutDamping
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
			layoutDamping: this.layoutDamping,
		};
	}
}
