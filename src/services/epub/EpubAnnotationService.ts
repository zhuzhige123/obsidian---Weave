import type { Bookmark, Highlight, Note, HighlightColor } from './types';
import { generateUUID } from '../../utils/helpers';
import type { EpubStorageService } from './EpubStorageService';
import type { EpubBacklinkHighlightService } from './EpubBacklinkHighlightService';
import { EpubLinkService } from './EpubLinkService';
import { t } from '../../utils/i18n';

export class EpubAnnotationService {
	private storageService: EpubStorageService;

	constructor(storageService: EpubStorageService) {
		this.storageService = storageService;
	}

	async createBookmark(
		bookId: string,
		title: string,
		chapterIndex: number,
		cfi: string,
		preview: string
	): Promise<Bookmark> {
		const bookmark: Bookmark = {
			id: generateUUID(),
			title,
			chapterIndex,
			cfi,
			preview,
			createdTime: Date.now()
		};

		await this.storageService.addBookmark(bookId, bookmark);
		return bookmark;
	}

	async deleteBookmark(bookId: string, bookmarkId: string): Promise<void> {
		await this.storageService.deleteBookmark(bookId, bookmarkId);
	}

	async getBookmarks(bookId: string): Promise<Bookmark[]> {
		return await this.storageService.loadBookmarks(bookId);
	}

	async createHighlight(
		bookId: string,
		text: string,
		color: HighlightColor,
		chapterIndex: number,
		cfiRange: string
	): Promise<Highlight> {
		const highlight: Highlight = {
			id: generateUUID(),
			text,
			color,
			chapterIndex,
			cfiRange,
			createdTime: Date.now()
		};

		await this.storageService.addHighlight(bookId, highlight);
		return highlight;
	}

	async deleteHighlight(bookId: string, highlightId: string): Promise<void> {
		await this.storageService.deleteHighlight(bookId, highlightId);
	}

	async getHighlights(bookId: string): Promise<Highlight[]> {
		return await this.storageService.loadHighlights(bookId);
	}

	async createNote(
		bookId: string,
		content: string,
		chapterIndex: number,
		quotedText?: string,
		cfi?: string
	): Promise<Note> {
		const note: Note = {
			id: generateUUID(),
			content,
			quotedText,
			chapterIndex,
			cfi,
			createdTime: Date.now(),
			modifiedTime: Date.now()
		};

		await this.storageService.addNote(bookId, note);
		return note;
	}

	async updateNote(bookId: string, noteId: string, content: string): Promise<void> {
		await this.storageService.updateNote(bookId, noteId, content);
	}

	async deleteNote(bookId: string, noteId: string): Promise<void> {
		await this.storageService.deleteNote(bookId, noteId);
	}

	async getNotes(bookId: string): Promise<Note[]> {
		return await this.storageService.loadNotes(bookId);
	}

	async exportToMarkdown(bookId: string): Promise<string> {
		const book = await this.storageService.getBook(bookId);
		if (!book) {
			throw new Error('Book not found');
		}

		const bookmarks = await this.getBookmarks(bookId);
		const highlights = await this.getHighlights(bookId);
		const notes = await this.getNotes(bookId);

		let markdown = `# ${book.metadata.title} - ${t('epub.export.readingNotes')}\n\n`;
		markdown += `## ${t('epub.export.bookInfo')}\n\n`;
		markdown += `- **${t('epub.export.author')}**: ${book.metadata.author}\n`;
		if (book.metadata.publisher) {
			markdown += `- **${t('epub.export.publisher')}**: ${book.metadata.publisher}\n`;
		}
		if (book.metadata.isbn) {
			markdown += `- **ISBN**: ${book.metadata.isbn}\n`;
		}
		markdown += `- **${t('epub.export.readingProgress')}**: ${book.currentPosition.percent}%\n`;
		markdown += `\n`;

		if (bookmarks.length > 0) {
			markdown += `## ${t('epub.export.bookmarks')}\n\n`;
			for (const bookmark of bookmarks) {
				markdown += `- **${bookmark.title}**\n`;
				markdown += `  > ${bookmark.preview}\n\n`;
			}
		}

		if (highlights.length > 0) {
			markdown += `## ${t('epub.export.highlights')}\n\n`;
			const groupedByColor = highlights.reduce((acc, h) => {
				if (!acc[h.color]) acc[h.color] = [];
				acc[h.color].push(h);
				return acc;
			}, {} as Record<HighlightColor, Highlight[]>);

			for (const [color, items] of Object.entries(groupedByColor)) {
				markdown += `### ${this.getColorName(color as HighlightColor)}\n\n`;
				for (const highlight of items) {
					markdown += `> ${highlight.text}\n\n`;
				}
			}
		}

		if (notes.length > 0) {
			markdown += `## ${t('epub.export.notes')}\n\n`;
			for (const note of notes) {
				markdown += `### ${new Date(note.createdTime).toLocaleDateString()}\n\n`;
				markdown += `${note.content}\n\n`;
				if (note.quotedText) {
					markdown += `> ${note.quotedText}\n\n`;
				}
			}
		}

		return markdown;
	}

	private getColorName(color: HighlightColor): string {
		const keyMap: Record<HighlightColor, string> = {
			yellow: 'epub.export.colorYellow',
			green: 'epub.export.colorGreen',
			blue: 'epub.export.colorBlue',
			pink: 'epub.export.colorPink',
			purple: 'epub.export.colorPurple'
		};
		return t(keyMap[color]);
	}

	async collectAllHighlights(
		bookId: string,
		filePath: string,
		backlinkService: EpubBacklinkHighlightService
	): Promise<Array<{ cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }>> {
		const allHighlights: Array<{ cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }> = [];

		const storedHighlights = await this.getHighlights(bookId);
		for (const h of storedHighlights) {
			allHighlights.push({ cfiRange: h.cfiRange, color: h.color, text: h.text });
		}

		const backlinkHighlights = await backlinkService.collectHighlights(filePath);
		for (const bh of backlinkHighlights) {
			const bhNorm = EpubLinkService.normalizeCfi(bh.cfiRange);
			const existing = allHighlights.find(h => EpubLinkService.normalizeCfi(h.cfiRange) === bhNorm);
			if (existing) {
				if (!existing.sourceFile) existing.sourceFile = bh.sourceFile;
				if (!existing.sourceRef) existing.sourceRef = bh.sourceRef;
			} else {
				allHighlights.push({
					cfiRange: bh.cfiRange,
					color: bh.color,
					text: bh.text,
					sourceFile: bh.sourceFile,
					sourceRef: bh.sourceRef
				});
			}
		}

		return allHighlights;
	}
}
