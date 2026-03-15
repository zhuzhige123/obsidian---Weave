import type { App } from 'obsidian';
import { getV2PathsFromApp } from '../../config/paths';
import { EpubLinkService } from './EpubLinkService';
import { logger } from '../../utils/logger';

export interface BacklinkHighlight {
	cfiRange: string;
	color: string;
	text: string;
	sourceFile: string;
	sourceRef?: string;
}

type JsonCardLike = {
	uuid?: string;
	content?: string;
	modified?: string;
};

type CanvasNodeLike = {
	id?: string;
	type?: string;
	text?: string;
};

export class EpubBacklinkHighlightService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async collectHighlights(epubFilePath: string): Promise<BacklinkHighlight[]> {
		const highlights: BacklinkHighlight[] = [];

		await this.waitForMetadataCache(2000);

		let sourceFiles = this.findBacklinkSources(epubFilePath);
		logger.debug('[EpubBacklinkHighlight] findBacklinkSources result:', sourceFiles.length);

		if (sourceFiles.length === 0) {
			sourceFiles = this.findBacklinkSourcesByVaultScan(epubFilePath);
			logger.debug('[EpubBacklinkHighlight] vault scan fallback:', sourceFiles.length);
		}

		if (sourceFiles.length === 0) {
			sourceFiles = await this.findBacklinkSourcesByContentSearch(epubFilePath);
			logger.debug('[EpubBacklinkHighlight] content search fallback:', sourceFiles.length);
		}

		const readPromises = sourceFiles.map(async (sourcePath) => {
			try {
				const content = await this.app.vault.adapter.read(sourcePath);
				const parsed = this.parseEpubCallouts(content, epubFilePath, sourcePath);
				if (parsed.length === 0) {
					logger.debug('[EpubBacklinkHighlight] parseEpubCallouts found 0 highlights in:', sourcePath);
				}
				return parsed;
			} catch (_e) {
				logger.debug('[EpubBacklinkHighlightService] Failed to read:', sourcePath);
				return [] as BacklinkHighlight[];
			}
		});

		const [markdownResults, canvasHighlights, jsonHighlights] = await Promise.all([
			Promise.all(readPromises),
			this.collectCanvasHighlights(epubFilePath),
			this.collectCardJsonHighlights(epubFilePath)
		]);

		for (const parsed of markdownResults) {
			highlights.push(...parsed);
		}
		highlights.push(...canvasHighlights, ...jsonHighlights);

		logger.debug(
			`[EpubBacklinkHighlightService] Found ${highlights.length} highlights for ${epubFilePath} `
			+ `(markdown=${sourceFiles.length}, canvas=${canvasHighlights.length}, json=${jsonHighlights.length})`
		);
		return highlights;
	}

	async findSourceFileForCfi(cfiRange: string, epubFilePath: string): Promise<string | null> {
		const encodedCfi = EpubLinkService.encodeCfiForWikilink(cfiRange);
		const normalizedCfi = EpubLinkService.normalizeCfi(cfiRange);
		const epubFileName = epubFilePath.split('/').pop() || '';

		const allFiles = this.app.vault.getMarkdownFiles();
		for (const file of allFiles) {
			try {
				const content = await this.app.vault.cachedRead(file);
				if (!content.includes(epubFileName)) continue;
				if (content.includes(encodedCfi) || content.includes(cfiRange)) {
					return file.path;
				}
				const parsed = this.parseEpubCallouts(content, epubFilePath, file.path);
				for (const p of parsed) {
					if (EpubLinkService.normalizeCfi(p.cfiRange) === normalizedCfi) {
						return file.path;
					}
				}
			} catch { /* skip */ }
		}

		const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');
		for (const file of canvasFiles) {
			try {
				const content = await this.app.vault.cachedRead(file);
				if (!content.includes(epubFileName)) continue;
				if (content.includes(encodedCfi) || content.includes(cfiRange)) {
					return file.path;
				}

				const parsed = this.parseHighlightsFromCanvasContent(content, epubFilePath, file.path);
				for (const p of parsed) {
					if (EpubLinkService.normalizeCfi(p.cfiRange) === normalizedCfi) {
						return file.path;
					}
				}
			} catch { /* skip */ }
		}

		const jsonFiles = this.getRelevantCardJsonFiles();
		for (const file of jsonFiles) {
			try {
				const content = await this.app.vault.cachedRead(file);
				if (!content.includes(epubFileName)) continue;
				const parsed = this.parseHighlightsFromCardJsonContent(content, epubFilePath, file.path);
				for (const highlight of parsed) {
					if (EpubLinkService.normalizeCfi(highlight.cfiRange) === normalizedCfi) {
						return file.path;
					}
				}
			} catch { /* skip */ }
		}

		return null;
	}

	async deleteHighlight(sourceFile: string, cfiRange: string, epubFilePath: string, sourceRef?: string): Promise<boolean> {
		if (sourceFile.endsWith('.canvas')) {
			return this.deleteHighlightFromCanvas(sourceFile, cfiRange, epubFilePath, sourceRef);
		}

		if (sourceFile.endsWith('.json')) {
			return this.deleteHighlightFromCardJson(sourceFile, cfiRange, epubFilePath, sourceRef);
		}

		try {
			const content = await this.app.vault.adapter.read(sourceFile);
			const updated = this.removeCalloutByCfi(content, cfiRange, epubFilePath);
			if (updated === content) return false;
			await this.app.vault.adapter.write(sourceFile, updated);
			return true;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] deleteHighlight failed:', _e);
			return false;
		}
	}

	async changeHighlightColor(
		sourceFile: string,
		cfiRange: string,
		epubFilePath: string,
		newColor: string,
		sourceRef?: string
	): Promise<boolean> {
		if (sourceFile.endsWith('.canvas')) {
			return this.changeCanvasHighlightColor(sourceFile, cfiRange, epubFilePath, newColor, sourceRef);
		}

		if (sourceFile.endsWith('.json')) {
			return this.changeCardJsonHighlightColor(sourceFile, cfiRange, epubFilePath, newColor, sourceRef);
		}

		try {
			const content = await this.app.vault.adapter.read(sourceFile);
			const updated = this.updateCalloutColor(content, cfiRange, epubFilePath, newColor);
			if (updated === content) return false;
			await this.app.vault.adapter.write(sourceFile, updated);
			return true;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] changeHighlightColor failed:', _e);
			return false;
		}
	}

	private async waitForMetadataCache(timeoutMs: number): Promise<void> {
		if (this.isMetadataCacheReady()) return;

		return new Promise<void>((resolve) => {
			let settled = false;
			const handler = () => {
				if (settled) return;
				settled = true;
				this.app.metadataCache.off('resolved', handler);
				resolve();
			};
			this.app.metadataCache.on('resolved', handler);
			setTimeout(() => {
				if (!settled) {
					settled = true;
					this.app.metadataCache.off('resolved', handler);
					resolve();
				}
			}, timeoutMs);
		});
	}

	private isMetadataCacheReady(): boolean {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		return resolvedLinks && Object.keys(resolvedLinks).length > 0;
	}

	private findBacklinkSources(epubFilePath: string): string[] {
		const sources: string[] = [];
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		for (const sourcePath in resolvedLinks) {
			const links = resolvedLinks[sourcePath];
			if (links && links[epubFilePath]) {
				sources.push(sourcePath);
			}
		}

		if (sources.length === 0) {
			try {
				const epubFile = this.app.vault.getAbstractFileByPath(epubFilePath);
				if (epubFile && 'path' in epubFile) {
					const backlinks = (this.app.metadataCache as any).getBacklinksForFile?.(epubFile);
					if (backlinks?.data) {
						for (const [path] of backlinks.data) {
							if (!sources.includes(path)) sources.push(path);
						}
					}
				}
			} catch (_e) {
				logger.debug('[EpubBacklinkHighlightService] getBacklinksForFile fallback failed');
			}
		}

		return sources;
	}

	private findBacklinkSourcesByVaultScan(epubFilePath: string): string[] {
		const epubFileName = epubFilePath.split('/').pop() || '';
		if (!epubFileName) return [];

		const candidates: string[] = [];
		const mdFiles = this.app.vault.getMarkdownFiles();

		for (const file of mdFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.links) continue;

			for (const link of cache.links) {
				if (link.link?.includes(epubFileName)) {
					candidates.push(file.path);
					break;
				}
			}
		}

		logger.debug(`[EpubBacklinkHighlightService] Vault scan found ${candidates.length} candidates for ${epubFileName}`);
		return candidates;
	}

	private async findBacklinkSourcesByContentSearch(epubFilePath: string): Promise<string[]> {
		const epubFileName = epubFilePath.split('/').pop() || '';
		if (!epubFileName) return [];

		const candidates: string[] = [];
		const mdFiles = this.app.vault.getMarkdownFiles();
		const batchSize = 50;
		for (let i = 0; i < mdFiles.length; i += batchSize) {
			const batch = mdFiles.slice(i, i + batchSize);
			const results = await Promise.all(batch.map(async (file) => {
				try {
					const content = await this.app.vault.cachedRead(file);
					if (content.includes('[!EPUB') && content.includes(epubFileName)) {
						return file.path;
					}
				} catch (_e) { /* skip */ }
				return null;
			}));
			for (const path of results) {
				if (path) candidates.push(path);
			}
		}

		logger.debug(`[EpubBacklinkHighlightService] Content search found ${candidates.length} candidates for ${epubFileName}`);
		return candidates;
	}

	private async collectCanvasHighlights(epubFilePath: string): Promise<BacklinkHighlight[]> {
		const results: BacklinkHighlight[] = [];
		const epubFileName = epubFilePath.split('/').pop() || '';
		const canvasFiles = this.app.vault.getFiles().filter(f => f.extension === 'canvas');

		for (const file of canvasFiles) {
			try {
				const content = await this.app.vault.cachedRead(file);
				if (!content.includes(epubFileName)) continue;
				results.push(...this.parseHighlightsFromCanvasContent(content, epubFilePath, file.path));
			} catch (_e) {
				logger.debug('[EpubBacklinkHighlightService] Failed to read canvas:', file.path);
			}
		}

		return results;
	}

	private async collectCardJsonHighlights(epubFilePath: string): Promise<BacklinkHighlight[]> {
		const results: BacklinkHighlight[] = [];
		const epubFileName = epubFilePath.split('/').pop() || '';
		const jsonFiles = this.getRelevantCardJsonFiles();

		for (const file of jsonFiles) {
			try {
				const content = await this.app.vault.cachedRead(file);
				if (!content.includes(epubFileName)) continue;
				results.push(...this.parseHighlightsFromCardJsonContent(content, epubFilePath, file.path));
			} catch (_e) {
				logger.debug('[EpubBacklinkHighlightService] Failed to read card json:', file.path);
			}
		}

		return results;
	}

	private getRelevantCardJsonFiles() {
		const v2Paths = getV2PathsFromApp(this.app);
		return this.app.vault.getFiles().filter((file) => {
			if (file.extension !== 'json') return false;
			if (file.path.startsWith(`${v2Paths.memory.cards}/`) && file.name !== 'card-files-index.json') {
				return true;
			}
			return false;
		});
	}

	private parseHighlightsFromCanvasContent(content: string, epubFilePath: string, sourceFile: string): BacklinkHighlight[] {
		try {
			const parsed = JSON.parse(content) as { nodes?: CanvasNodeLike[] };
			const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
			const results: BacklinkHighlight[] = [];

			for (const node of nodes) {
				if (node?.type !== 'text' || typeof node.text !== 'string' || node.text.length === 0) continue;
				results.push(...this.parseEpubCallouts(node.text, epubFilePath, sourceFile, node.id));
			}

			return results;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] Failed to parse canvas json:', sourceFile);
			return [];
		}
	}

	private parseHighlightsFromCardJsonContent(content: string, epubFilePath: string, sourceFile: string): BacklinkHighlight[] {
		try {
			const parsed = JSON.parse(content);
			const cardArrays = this.extractCardArraysFromJson(parsed);
			const results: BacklinkHighlight[] = [];

			for (const cards of cardArrays) {
				for (const card of cards) {
					if (!card || typeof card.content !== 'string') continue;
					const sourceRef = typeof card.uuid === 'string' && card.uuid.length > 0 ? `card:${card.uuid}` : undefined;
					results.push(...this.parseEpubCallouts(card.content, epubFilePath, sourceFile, sourceRef));
				}
			}

			return results;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] Failed to parse card json:', sourceFile);
			return [];
		}
	}

	private extractCardArraysFromJson(parsed: unknown): JsonCardLike[][] {
		if (Array.isArray(parsed)) {
			return [parsed as JsonCardLike[]];
		}

		if (!parsed || typeof parsed !== 'object') {
			return [];
		}

		const container = parsed as Record<string, unknown>;
		const arrays: JsonCardLike[][] = [];

		if (Array.isArray(container.cards)) {
			arrays.push(container.cards as JsonCardLike[]);
		}

		if (Array.isArray(container.questions)) {
			arrays.push(container.questions as JsonCardLike[]);
		}

		return arrays;
	}

	private async deleteHighlightFromCanvas(sourceFile: string, cfiRange: string, epubFilePath: string, sourceRef?: string): Promise<boolean> {
		try {
			const content = await this.app.vault.adapter.read(sourceFile);
			const parsed = JSON.parse(content) as { nodes?: CanvasNodeLike[] };
			const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
			let changed = false;

			for (const node of nodes) {
				if (node?.type !== 'text' || typeof node.text !== 'string') continue;
				if (sourceRef && node.id !== sourceRef) continue;

				const updatedText = this.removeCalloutByCfi(node.text, cfiRange, epubFilePath);
				if (updatedText !== node.text) {
					node.text = updatedText;
					changed = true;
					if (sourceRef) break;
				}
			}

			if (!changed) return false;
			await this.app.vault.adapter.write(sourceFile, JSON.stringify(parsed));
			return true;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] deleteHighlightFromCanvas failed:', _e);
			return false;
		}
	}

	private async changeCanvasHighlightColor(
		sourceFile: string,
		cfiRange: string,
		epubFilePath: string,
		newColor: string,
		sourceRef?: string
	): Promise<boolean> {
		try {
			const content = await this.app.vault.adapter.read(sourceFile);
			const parsed = JSON.parse(content) as { nodes?: CanvasNodeLike[] };
			const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
			let changed = false;

			for (const node of nodes) {
				if (node?.type !== 'text' || typeof node.text !== 'string') continue;
				if (sourceRef && node.id !== sourceRef) continue;

				const updatedText = this.updateCalloutColor(node.text, cfiRange, epubFilePath, newColor);
				if (updatedText !== node.text) {
					node.text = updatedText;
					changed = true;
					if (sourceRef) break;
				}
			}

			if (!changed) return false;
			await this.app.vault.adapter.write(sourceFile, JSON.stringify(parsed));
			return true;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] changeCanvasHighlightColor failed:', _e);
			return false;
		}
	}

	private async deleteHighlightFromCardJson(sourceFile: string, cfiRange: string, epubFilePath: string, sourceRef?: string): Promise<boolean> {
		return this.mutateCardJsonHighlights(sourceFile, sourceRef, (content) => this.removeCalloutByCfi(content, cfiRange, epubFilePath));
	}

	private async changeCardJsonHighlightColor(
		sourceFile: string,
		cfiRange: string,
		epubFilePath: string,
		newColor: string,
		sourceRef?: string
	): Promise<boolean> {
		return this.mutateCardJsonHighlights(sourceFile, sourceRef, (content) => this.updateCalloutColor(content, cfiRange, epubFilePath, newColor));
	}

	private async mutateCardJsonHighlights(
		sourceFile: string,
		sourceRef: string | undefined,
		mutator: (content: string) => string
	): Promise<boolean> {
		try {
			const raw = await this.app.vault.adapter.read(sourceFile);
			const parsed = JSON.parse(raw);
			const cardArrays = this.extractCardArraysFromJson(parsed);
			const targetCardUuid = sourceRef?.startsWith('card:') ? sourceRef.slice(5) : null;
			let changed = false;

			for (const cards of cardArrays) {
				for (const card of cards) {
					if (!card || typeof card.content !== 'string') continue;
					if (targetCardUuid && card.uuid !== targetCardUuid) continue;

					const updatedContent = mutator(card.content);
					if (updatedContent !== card.content) {
						card.content = updatedContent;
						card.modified = new Date().toISOString();
						changed = true;
						if (targetCardUuid) break;
					}
				}
				if (changed && targetCardUuid) break;
			}

			if (!changed) return false;
			await this.app.vault.adapter.write(sourceFile, JSON.stringify(parsed));
			return true;
		} catch (_e) {
			logger.debug('[EpubBacklinkHighlightService] mutateCardJsonHighlights failed:', _e);
			return false;
		}
	}

	private removeCalloutByCfi(content: string, cfiRange: string, epubFilePath: string): string {
		const epubFileName = epubFilePath.split('/').pop() || '';
		const calloutRegex = /^> \[!EPUB(?:\|\w+)?\]\s*\[\[([^\]]+)\]\]\s*\n((?:^>.*\n?)*)/gm;
		let result = content;
		let match;
		while ((match = calloutRegex.exec(content)) !== null) {
			const linkContent = match[1];
			if (!linkContent.includes(epubFileName)) continue;
			const hashIdx = linkContent.indexOf('#');
			if (hashIdx === -1) continue;
			const subpath = linkContent.substring(hashIdx);
			const parsed = EpubLinkService.parseEpubLink(subpath);
			if (parsed?.cfi === cfiRange) {
				const fullMatch = match[0];
				result = result.replace(fullMatch, '');
				result = result.replace(/\n{3,}/g, '\n\n');
				break;
			}
		}
		return result;
	}

	private updateCalloutColor(content: string, cfiRange: string, epubFilePath: string, newColor: string): string {
		const epubFileName = epubFilePath.split('/').pop() || '';
		const calloutRegex = /^(> \[!EPUB)(?:\|(\w+))?\](\s*\[\[([^\]]+)\]\]\s*\n(?:(?:^>.*\n?)*))/gm;
		let match;
		while ((match = calloutRegex.exec(content)) !== null) {
			const linkContent = match[4];
			if (!linkContent.includes(epubFileName)) continue;
			const hashIdx = linkContent.indexOf('#');
			if (hashIdx === -1) continue;
			const subpath = linkContent.substring(hashIdx);
			const parsed = EpubLinkService.parseEpubLink(subpath);
			if (parsed?.cfi === cfiRange) {
				const oldCalloutHeader = match[0].split('\n')[0];
				const newCalloutHeader = oldCalloutHeader.replace(
					/> \[!EPUB(?:\|\w+)?\]/,
					`> [!EPUB|${newColor}]`
				);
				return content.replace(oldCalloutHeader, newCalloutHeader);
			}
		}
		return content;
	}

	private parseEpubCallouts(
		content: string,
		epubFilePath: string,
		sourceFile: string,
		sourceRef?: string
	): BacklinkHighlight[] {
		const results: BacklinkHighlight[] = [];
		const epubFileName = epubFilePath.split('/').pop() || '';
		const calloutRegex = /^> \[!EPUB(?:\|(\w+))?\]\s*\[\[([^\]]+)\]\]\s*\n((?:^>.*\n?)*)/gm;

		let match;
		while ((match = calloutRegex.exec(content)) !== null) {
			const color = match[1] || 'yellow';
			const linkContent = match[2];
			const quotedBody = match[3];

			if (!linkContent.includes(epubFileName)) continue;

			const hashIdx = linkContent.indexOf('#');
			if (hashIdx === -1) continue;

			const subpath = linkContent.substring(hashIdx);
			const parsed = EpubLinkService.parseEpubLink(subpath);
			if (!parsed?.cfi) continue;

			const text = quotedBody
				.split('\n')
				.map((line: string) => line.replace(/^>\s?/, ''))
				.join('\n')
				.trim();

			results.push({
				cfiRange: parsed.cfi,
				color,
				text,
				sourceFile,
				sourceRef
			});
		}

		return results;
	}
}
