import type { App } from 'obsidian';
import type { EpubBook, Bookmark, Highlight, Note, ReadingPosition } from './types';

export class EpubStorageService {
	private app: App;
	private basePath: string;

	constructor(app: App) {
		this.app = app;
		this.basePath = 'weave/epub-reading';
	}

	async ensureDirectories(): Promise<void> {
		const vault = this.app.vault;
		const adapter = vault.adapter;

		if (!(await adapter.exists(this.basePath))) {
			await adapter.mkdir(this.basePath);
		}
	}

	async loadBooks(): Promise<Record<string, EpubBook>> {
		await this.ensureDirectories();
		const booksPath = `${this.basePath}/books.json`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(booksPath)) {
			const content = await adapter.read(booksPath);
			return JSON.parse(content);
		}

		return {};
	}

	async saveBooks(books: Record<string, EpubBook>): Promise<void> {
		await this.ensureDirectories();
		const booksPath = `${this.basePath}/books.json`;
		await this.app.vault.adapter.write(booksPath, JSON.stringify(books));
	}

	async saveBook(book: EpubBook): Promise<void> {
		const books = await this.loadBooks();
		books[book.id] = book;
		await this.saveBooks(books);
	}

	async getBook(bookId: string): Promise<EpubBook | null> {
		const books = await this.loadBooks();
		return books[bookId] || null;
	}

	async findBookByFilePath(filePath: string): Promise<EpubBook | null> {
		const books = await this.loadBooks();
		for (const book of Object.values(books)) {
			if (book.filePath === filePath) {
				return book;
			}
		}
		return null;
	}

	async deleteBook(bookId: string): Promise<void> {
		const books = await this.loadBooks();
		delete books[bookId];
		await this.saveBooks(books);

		const bookDir = `${this.basePath}/${bookId}`;
		const adapter = this.app.vault.adapter;
		if (await adapter.exists(bookDir)) {
			await adapter.rmdir(bookDir, true);
		}
	}

	async saveProgress(bookId: string, position: ReadingPosition): Promise<void> {
		const book = await this.getBook(bookId);
		if (book) {
			book.currentPosition = position;
			book.readingStats.lastReadTime = Date.now();
			await this.saveBook(book);
		}
	}

	async loadProgress(bookId: string): Promise<ReadingPosition | null> {
		const book = await this.getBook(bookId);
		return book?.currentPosition || null;
	}

	private async ensureBookDirectory(bookId: string): Promise<void> {
		const bookDir = `${this.basePath}/${bookId}`;
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(bookDir))) {
			await adapter.mkdir(bookDir);
		}
	}

	async loadBookmarks(bookId: string): Promise<Bookmark[]> {
		await this.ensureBookDirectory(bookId);
		const bookmarksPath = `${this.basePath}/${bookId}/bookmarks.json`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(bookmarksPath)) {
			const content = await adapter.read(bookmarksPath);
			return JSON.parse(content);
		}

		return [];
	}

	async saveBookmarks(bookId: string, bookmarks: Bookmark[]): Promise<void> {
		await this.ensureBookDirectory(bookId);
		const bookmarksPath = `${this.basePath}/${bookId}/bookmarks.json`;
		await this.app.vault.adapter.write(bookmarksPath, JSON.stringify(bookmarks));
	}

	async addBookmark(bookId: string, bookmark: Bookmark): Promise<void> {
		const bookmarks = await this.loadBookmarks(bookId);
		bookmarks.push(bookmark);
		await this.saveBookmarks(bookId, bookmarks);
	}

	async deleteBookmark(bookId: string, bookmarkId: string): Promise<void> {
		const bookmarks = await this.loadBookmarks(bookId);
		const filtered = bookmarks.filter(b => b.id !== bookmarkId);
		await this.saveBookmarks(bookId, filtered);
	}

	async loadHighlights(bookId: string): Promise<Highlight[]> {
		await this.ensureBookDirectory(bookId);
		const highlightsPath = `${this.basePath}/${bookId}/highlights.json`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(highlightsPath)) {
			const content = await adapter.read(highlightsPath);
			return JSON.parse(content);
		}

		return [];
	}

	async saveHighlights(bookId: string, highlights: Highlight[]): Promise<void> {
		await this.ensureBookDirectory(bookId);
		const highlightsPath = `${this.basePath}/${bookId}/highlights.json`;
		await this.app.vault.adapter.write(highlightsPath, JSON.stringify(highlights));
	}

	async addHighlight(bookId: string, highlight: Highlight): Promise<void> {
		const highlights = await this.loadHighlights(bookId);
		highlights.push(highlight);
		await this.saveHighlights(bookId, highlights);
	}

	async deleteHighlight(bookId: string, highlightId: string): Promise<void> {
		const highlights = await this.loadHighlights(bookId);
		const filtered = highlights.filter(h => h.id !== highlightId);
		await this.saveHighlights(bookId, filtered);
	}

	async loadNotes(bookId: string): Promise<Note[]> {
		await this.ensureBookDirectory(bookId);
		const notesPath = `${this.basePath}/${bookId}/notes.json`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(notesPath)) {
			const content = await adapter.read(notesPath);
			return JSON.parse(content);
		}

		return [];
	}

	async saveNotes(bookId: string, notes: Note[]): Promise<void> {
		await this.ensureBookDirectory(bookId);
		const notesPath = `${this.basePath}/${bookId}/notes.json`;
		await this.app.vault.adapter.write(notesPath, JSON.stringify(notes));
	}

	async addNote(bookId: string, note: Note): Promise<void> {
		const notes = await this.loadNotes(bookId);
		notes.push(note);
		await this.saveNotes(bookId, notes);
	}

	async updateNote(bookId: string, noteId: string, content: string): Promise<void> {
		const notes = await this.loadNotes(bookId);
		const note = notes.find(n => n.id === noteId);
		if (note) {
			note.content = content;
			note.modifiedTime = Date.now();
			await this.saveNotes(bookId, notes);
		}
	}

	async deleteNote(bookId: string, noteId: string): Promise<void> {
		const notes = await this.loadNotes(bookId);
		const filtered = notes.filter(n => n.id !== noteId);
		await this.saveNotes(bookId, filtered);
	}

	async getCanvasBinding(bookId: string): Promise<string | null> {
		const bindings = await this.loadCanvasBindings();
		return bindings[bookId] || null;
	}

	async setCanvasBinding(bookId: string, canvasPath: string): Promise<void> {
		const bindings = await this.loadCanvasBindings();
		bindings[bookId] = canvasPath;
		await this.saveCanvasBindings(bindings);
	}

	async removeCanvasBinding(bookId: string): Promise<void> {
		const bindings = await this.loadCanvasBindings();
		delete bindings[bookId];
		await this.saveCanvasBindings(bindings);
	}

	private async loadCanvasBindings(): Promise<Record<string, string>> {
		await this.ensureDirectories();
		const bindingsPath = `${this.basePath}/canvas-bindings.json`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(bindingsPath)) {
			try {
				const content = await adapter.read(bindingsPath);
				return JSON.parse(content);
			} catch {
				return {};
			}
		}
		return {};
	}

	private async saveCanvasBindings(bindings: Record<string, string>): Promise<void> {
		await this.ensureDirectories();
		const bindingsPath = `${this.basePath}/canvas-bindings.json`;
		await this.app.vault.adapter.write(bindingsPath, JSON.stringify(bindings));
	}
}
