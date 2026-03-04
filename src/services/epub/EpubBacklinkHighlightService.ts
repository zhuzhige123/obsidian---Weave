import type { App } from 'obsidian';
import { EpubLinkService } from './EpubLinkService';
import { logger } from '../../utils/logger';

export interface BacklinkHighlight {
	cfiRange: string;
	color: string;
	text: string;
	sourceFile: string;
}

export class EpubBacklinkHighlightService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async collectHighlights(epubFilePath: string): Promise<BacklinkHighlight[]> {
		const highlights: BacklinkHighlight[] = [];
		const sourceFiles = this.findBacklinkSources(epubFilePath);

		for (const sourcePath of sourceFiles) {
			try {
				const content = await this.app.vault.adapter.read(sourcePath);
				const parsed = this.parseEpubCallouts(content, epubFilePath, sourcePath);
				highlights.push(...parsed);
			} catch (_e) {
				logger.debug('[EpubBacklinkHighlightService] Failed to read:', sourcePath);
			}
		}

		logger.debug(`[EpubBacklinkHighlightService] Found ${highlights.length} highlights from ${sourceFiles.length} files for ${epubFilePath}`);
		return highlights;
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
		return sources;
	}

	private parseEpubCallouts(
		content: string,
		epubFilePath: string,
		sourceFile: string
	): BacklinkHighlight[] {
		const results: BacklinkHighlight[] = [];
		const epubFileName = epubFilePath.split('/').pop() || '';

		// [!EPUB|color] [[file.epub#weave-cfi=...]]
		// > quoted text (one or more lines)
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
				sourceFile
			});
		}

		return results;
	}
}
