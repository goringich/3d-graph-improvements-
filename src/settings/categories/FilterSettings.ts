export class FilterSettings {
	doShowOrphans? = true;
	doShowAttachments? = false;
	excludedFolders: string[] = [];

	constructor(
		doShowOrphans?: boolean,
		doShowAttachments?: boolean,
		excludedFolders?: string[]
	) {
		this.doShowOrphans = doShowOrphans ?? this.doShowOrphans;
		this.doShowAttachments = doShowAttachments ?? this.doShowAttachments;
		this.excludedFolders = excludedFolders ?? this.excludedFolders;
	}

	public static fromStore(store: any) {
		return new FilterSettings(
			store?.doShowOrphans,
			store?.doShowAttachments,
			Array.isArray(store?.excludedFolders) ? store.excludedFolders : []
		);
	}

	public toObject() {
		return {
			doShowOrphans: this.doShowOrphans,
			doShowAttachments: this.doShowAttachments,
			excludedFolders: this.excludedFolders,
		};
	}
}
