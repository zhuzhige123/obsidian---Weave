import type { Bookmark, Highlight, Note, HighlightColor } from './types';
import { generateUUID } from '../../utils/helpers';
import type { EpubStorageService } from './EpubStorageService';

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

		let markdown = `# 《${book.metadata.title}》阅读笔记\n\n`;
		markdown += `## 书籍信息\n\n`;
		markdown += `- **作者**: ${book.metadata.author}\n`;
		if (book.metadata.publisher) {
			markdown += `- **出版社**: ${book.metadata.publisher}\n`;
		}
		if (book.metadata.isbn) {
			markdown += `- **ISBN**: ${book.metadata.isbn}\n`;
		}
		markdown += `- **阅读进度**: ${book.currentPosition.percent}%\n`;
		markdown += `\n`;

		if (bookmarks.length > 0) {
			markdown += `## 书签\n\n`;
			for (const bookmark of bookmarks) {
				markdown += `- **${bookmark.title}**\n`;
				markdown += `  > ${bookmark.preview}\n\n`;
			}
		}

		if (highlights.length > 0) {
			markdown += `## 高亮\n\n`;
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
			markdown += `## 笔记\n\n`;
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
		const names: Record<HighlightColor, string> = {
			yellow: '黄色高亮',
			green: '绿色高亮',
			blue: '蓝色高亮',
			pink: '粉色高亮',
			purple: '紫色高亮'
		};
		return names[color];
	}
}
