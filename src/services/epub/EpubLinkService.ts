import type { App } from 'obsidian';
import { VIEW_TYPE_EPUB } from '../../views/EpubView';
import { getPreferredEpubLeaf } from '../../utils/epub-leaf-utils';
import { logger } from '../../utils/logger';

export interface EpubLinkParams {
	filePath: string;
	cfi: string;
	text: string;
	chapter?: number;
}

export class EpubLinkService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	static encodeCfiForWikilink(cfi: string): string {
		return cfi.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\|/g, '%7C');
	}

	static decodeCfiFromWikilink(encoded: string): string {
		return encoded.replace(/%5B/gi, '[').replace(/%5D/gi, ']').replace(/%7C/gi, '|');
	}

	static normalizeCfi(cfi: string): string {
		let normalized = cfi.replace(/%5B/gi, '[').replace(/%5D/gi, ']').replace(/%7C/gi, '|');
		if (normalized.includes('%')) {
			try { normalized = decodeURIComponent(normalized); } catch { /* use as-is */ }
		}
		return normalized;
	}

	static extractShortBookName(filePath: string): string {
		const fullName = filePath.split('/').pop()?.replace(/\.epub$/i, '') || 'EPUB';
		const mainTitle = fullName.split(/[([{]/)[0].trim();
		if (mainTitle.length > 25) {
			return mainTitle.slice(0, 25) + '...';
		}
		return mainTitle || fullName.slice(0, 25);
	}

	buildEpubLink(filePath: string, cfi: string, text: string, chapterIndex?: number, chapterTitle?: string): string {
		const bookName = EpubLinkService.extractShortBookName(filePath);
		let displayText: string;
		if (chapterTitle) {
			displayText = `${bookName} > ${chapterTitle}`;
		} else {
			displayText = bookName;
		}
		const safeCfi = EpubLinkService.encodeCfiForWikilink(cfi);
		let subpath = `weave-cfi=${safeCfi}`;
		if (chapterIndex !== undefined) {
			subpath += `&chapter=${chapterIndex}`;
		}
		return `[[${filePath}#${subpath}|${displayText}]]`;
	}

	buildQuoteBlock(filePath: string, cfi: string, text: string, chapterIndex?: number, color?: string, chapterTitle?: string, timestamp?: string): string {
		const link = this.buildEpubLink(filePath, cfi, text, chapterIndex, chapterTitle);
		const calloutMeta = color ? `|${color}` : '';
		const timeSuffix = timestamp ? ` ${timestamp}` : '';
		const quotedLines = text.split('\n').map(line => `> ${line}`).join('\n');
		return `> [!EPUB${calloutMeta}] ${link}${timeSuffix}\n${quotedLines}\n`;
	}

	static parseEpubLink(subpath: string): EpubLinkParams | null {
		if (!subpath || (!subpath.includes('weave-cfi=') && !subpath.includes('tuanki-cfi-'))) {
			return null;
		}

		try {
			const hashContent = subpath.startsWith('#') ? subpath.slice(1) : subpath;

			// support both weave-cfi= (current) and tuanki-cfi- (legacy) formats
			const cfiMatch = hashContent.match(/weave-cfi=(epubcfi\([^)]*\))/)
				|| hashContent.match(/weave-cfi=([^&|\]]*)/)
				|| hashContent.match(/tuanki-cfi-(epubcfi\([^)]*\))/)
				|| hashContent.match(/tuanki-cfi-([^&|\]]*)/);
			const chapterMatch = hashContent.match(/[&?]chapter=(\d+)/);

			if (!cfiMatch) {
				return null;
			}

			let cfi = cfiMatch[1];
			cfi = EpubLinkService.decodeCfiFromWikilink(cfi);
			if (cfi.includes('%')) {
				try { cfi = decodeURIComponent(cfi); } catch { /* use as-is */ }
			}

			return {
				filePath: '',
				cfi,
				text: '',
				chapter: chapterMatch ? parseInt(chapterMatch[1], 10) : undefined
			};
		} catch (e) {
			logger.warn('[EpubLinkService] Failed to parse epub link:', subpath, e);
			return null;
		}
	}

	static parseProtocolParams(params: Record<string, string>): EpubLinkParams | null {
		const file = params.file;
		const cfi = params.cfi;
		const text = params.text || '';
		const chapter = params.chapter;

		if (!file || !cfi) return null;

		return {
			filePath: file,
			cfi,
			text,
			chapter: chapter ? parseInt(chapter, 10) : undefined
		};
	}

	async navigateToEpubLocation(filePath: string, cfi: string, text: string): Promise<void> {
		try {
			const targetLeaf = getPreferredEpubLeaf(this.app, filePath);
			if (!targetLeaf) return;

			this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
			await targetLeaf.setViewState({
				type: VIEW_TYPE_EPUB,
				active: true,
				state: { filePath, pendingCfi: cfi, pendingText: text }
			});
			void this.app.workspace.revealLeaf(targetLeaf);

			logger.debug('[EpubLinkService] Navigated to:', filePath, cfi);
		} catch (error) {
			logger.error('[EpubLinkService] Navigation failed:', error);
		}
	}
}
