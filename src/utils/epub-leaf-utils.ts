import type { App, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_EPUB } from '../views/EpubView';
import { getLeafLocation } from './view-location-utils';

function isCenterLeaf(leaf: WorkspaceLeaf | null | undefined): leaf is WorkspaceLeaf {
	return !!leaf && getLeafLocation(leaf) === 'center';
}

export function findOpenEpubLeaf(app: App, filePath?: string): WorkspaceLeaf | null {
	const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EPUB);

	if (filePath) {
		const matchedLeaf = leaves.find((leaf) => {
			const state = leaf.getViewState()?.state;
			return state?.filePath === filePath;
		});
		if (matchedLeaf) {
			return matchedLeaf;
		}
	}

	return leaves.find((leaf) => isCenterLeaf(leaf)) ?? leaves[0] ?? null;
}

export function getPreferredEpubLeaf(app: App, filePath?: string): WorkspaceLeaf | null {
	const matchedEpubLeaf = findOpenEpubLeaf(app, filePath);
	if (matchedEpubLeaf) {
		return matchedEpubLeaf;
	}

	const activeLeaf = app.workspace.activeLeaf;
	if (isCenterLeaf(activeLeaf)) {
		return activeLeaf;
	}

	const recentLeaf = app.workspace.getMostRecentLeaf?.();
	if (isCenterLeaf(recentLeaf)) {
		return recentLeaf;
	}

	const markdownLeaf = app.workspace.getLeavesOfType('markdown').find((leaf) => isCenterLeaf(leaf));
	if (markdownLeaf) {
		return markdownLeaf;
	}

	const fallbackLeaf = app.workspace.getLeaf(false);
	if (isCenterLeaf(fallbackLeaf)) {
		return fallbackLeaf;
	}

	return app.workspace.getLeaf('tab');
}
