export interface EpubBook {
	id: string;
	filePath: string;
	metadata: BookMetadata;
	currentPosition: ReadingPosition;
	readingStats: ReadingStats;
}

export interface BookMetadata {
	title: string;
	author: string;
	publisher?: string;
	language?: string;
	isbn?: string;
	coverImage?: string;
	wordCount?: number;
	chapterCount: number;
}

export interface ReadingPosition {
	chapterIndex: number;
	cfi: string;
	percent: number;
}

export interface ReadingStats {
	totalReadTime: number;
	lastReadTime: number;
	createdTime: number;
	completedTime?: number;
}

export interface Bookmark {
	id: string;
	title: string;
	chapterIndex: number;
	cfi: string;
	preview: string;
	createdTime: number;
}

export interface Highlight {
	id: string;
	text: string;
	color: HighlightColor;
	chapterIndex: number;
	cfiRange: string;
	createdTime: number;
	linkedNotePath?: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface Note {
	id: string;
	content: string;
	quotedText?: string;
	chapterIndex: number;
	cfi?: string;
	createdTime: number;
	modifiedTime: number;
}

export interface TocItem {
	id: string;
	label: string;
	href: string;
	level: number;
	subitems?: TocItem[];
}

export type EpubTheme = 'default' | 'sepia';
export type EpubFontFamily = 'serif' | 'sans';
export type EpubWidthMode = 'standard' | 'full';
export type EpubLayoutMode = 'scroll' | 'paginated' | 'double';

export interface EpubReaderSettings {
	fontSize: number;
	lineHeight: number;
	theme: EpubTheme;
	fontFamily: EpubFontFamily;
	widthMode: EpubWidthMode;
	layoutMode: EpubLayoutMode;
}
