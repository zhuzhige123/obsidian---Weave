import type { App } from 'obsidian';
import { logger } from '../../utils/logger';
import { Notice } from 'obsidian';
import { EpubLinkService } from './EpubLinkService';

export interface ScreenshotRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export class EpubScreenshotService {
	private app: App;
	private linkService: EpubLinkService;

	constructor(app: App) {
		this.app = app;
		this.linkService = new EpubLinkService(app);
	}

	async captureFromCanvas(sourceEl: HTMLElement, rect: ScreenshotRect): Promise<Blob | null> {
		try {
			const blob = await this.captureWithElectron(sourceEl, rect);
			if (blob) return blob;

			return await this.captureWithSvgCanvas(sourceEl, rect);
		} catch (e) {
			logger.error('[EpubScreenshotService] captureFromCanvas failed:', e);
			return null;
		}
	}

	private async captureWithElectron(sourceEl: HTMLElement, rect: ScreenshotRect): Promise<Blob | null> {
		try {
			const remote = this.getElectronRemote();
			if (!remote) return null;

			const win = remote.getCurrentWindow();
			if (!win?.webContents?.capturePage) return null;

			const sourceRect = sourceEl.getBoundingClientRect();
			const nativeImage = await win.webContents.capturePage({
				x: Math.round(sourceRect.left + rect.x),
				y: Math.round(sourceRect.top + rect.y),
				width: Math.round(rect.width),
				height: Math.round(rect.height)
			});

			if (nativeImage.isEmpty()) return null;

			const buffer = nativeImage.toJPEG(92);
			return new Blob([buffer], { type: 'image/jpeg' });
		} catch (e) {
			logger.warn('[EpubScreenshotService] Electron capture failed:', e);
			return null;
		}
	}

	private getElectronRemote(): any {
		try {
			// /skip require('electron') is needed for desktop-only screenshot capture via webContents, wrapped in try/catch for mobile safety
			const electron = (window as any).require('electron');
			if (electron.remote) return electron.remote;
		} catch (_) { /* not available */ }
		try {
			return (window as any).require('@electron/remote');
		} catch (_) { /* not available */ }
		return null;
	}

	private async captureWithSvgCanvas(sourceEl: HTMLElement, rect: ScreenshotRect): Promise<Blob | null> {
		try {
			const canvas = document.createElement('canvas');
			const dpr = window.devicePixelRatio || 1;
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;

			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			ctx.scale(dpr, dpr);

			ctx.fillStyle = getComputedStyle(sourceEl).backgroundColor || '#ffffff';
			ctx.fillRect(0, 0, rect.width, rect.height);

			const iframes = sourceEl.querySelectorAll('iframe');
			for (const iframe of iframes) {
				try {
					const iframeDoc = iframe.contentDocument;
					if (!iframeDoc) continue;

					const iframeRect = iframe.getBoundingClientRect();
					const sourceRect = sourceEl.getBoundingClientRect();

					const relX = iframeRect.left - sourceRect.left;
					const relY = iframeRect.top - sourceRect.top;

					const overlapX = Math.max(rect.x, relX);
					const overlapY = Math.max(rect.y, relY);
					const overlapRight = Math.min(rect.x + rect.width, relX + iframeRect.width);
					const overlapBottom = Math.min(rect.y + rect.height, relY + iframeRect.height);

					if (overlapRight <= overlapX || overlapBottom <= overlapY) continue;

					const body = iframeDoc.body;
					const cloned = body.cloneNode(true) as HTMLElement;

					const styles = Array.from(iframeDoc.querySelectorAll('style, link[rel="stylesheet"]'));
					let styleText = '';
					for (const s of styles) {
						if (s instanceof HTMLStyleElement) {
							styleText += s.textContent || '';
						}
					}

					const svgWidth = overlapRight - overlapX;
					const svgHeight = overlapBottom - overlapY;
					const offsetX = -(overlapX - relX);
					const offsetY = -(overlapY - relY);

					const svgString = `
						<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
							<foreignObject width="${iframeRect.width}" height="${iframeRect.height}" x="${offsetX}" y="${offsetY}">
								<div xmlns="http://www.w3.org/1999/xhtml">
									<style>${styleText}</style>
									${cloned.outerHTML}
								</div>
							</foreignObject>
						</svg>
					`;

					const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
					const url = URL.createObjectURL(blob);
					const img = new Image();

					await new Promise<void>((resolve) => {
						img.onload = () => {
							ctx.drawImage(img, overlapX - rect.x, overlapY - rect.y, svgWidth, svgHeight);
							URL.revokeObjectURL(url);
							resolve();
						};
						img.onerror = () => {
							URL.revokeObjectURL(url);
							resolve();
						};
						img.src = url;
					});
				} catch (e) {
					logger.warn('[EpubScreenshotService] iframe capture failed:', e);
				}
			}

			return new Promise((resolve) => {
				canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
			});
		} catch (e) {
			logger.error('[EpubScreenshotService] SVG canvas capture failed:', e);
			return null;
		}
	}

	async saveAsJpeg(blob: Blob, bookTitle: string): Promise<string> {
		const sanitizedTitle = bookTitle
			.replace(/[\\/:*?"<>|]/g, '_')
			.substring(0, 30)
			.trim();
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
		const fileName = `epub-${sanitizedTitle}-${timestamp}.jpg`;

		const attachmentFolder = (this.app.vault as any).getConfig?.('attachmentFolderPath') || '';
		let folderPath = attachmentFolder || '';

		if (!folderPath || folderPath === '/' || folderPath === '.') {
			folderPath = '';
		}

		const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;

		const adapter = this.app.vault.adapter;
		if (folderPath && !(await adapter.exists(folderPath))) {
			await adapter.mkdir(folderPath);
		}

		const arrayBuffer = await blob.arrayBuffer();
		await adapter.writeBinary(fullPath, new Uint8Array(arrayBuffer) as any);

		new Notice(`Screenshot saved: ${fileName}`);
		return fullPath;
	}

	extractTextFromRect(sourceEl: HTMLElement, rect: ScreenshotRect): string {
		try {
			let targetDoc: Document | null = null;
			let iframeEl: HTMLIFrameElement | null = null;

			for (const iframe of sourceEl.querySelectorAll('iframe')) {
				try {
					if (iframe.contentDocument?.body) {
						targetDoc = iframe.contentDocument;
						iframeEl = iframe;
						break;
					}
				} catch (_e) { /* cross-origin */ }
			}

			if (!targetDoc || !iframeEl) return '';

			const sourceRect = sourceEl.getBoundingClientRect();
			const iframeRect = iframeEl.getBoundingClientRect();

			const iframeX = sourceRect.left + rect.x - iframeRect.left;
			const iframeY = sourceRect.top + rect.y - iframeRect.top;
			const iframeRight = iframeX + rect.width;
			const iframeBottom = iframeY + rect.height;

			const caretRange = targetDoc.caretRangeFromPoint?.bind(targetDoc);
			if (caretRange) {
				const startRange = caretRange(iframeX + 2, iframeY + 2);
				const endRange = caretRange(iframeRight - 2, iframeBottom - 2);

				if (startRange && endRange) {
					const range = targetDoc.createRange();
					range.setStart(startRange.startContainer, startRange.startOffset);
					range.setEnd(endRange.startContainer, endRange.startOffset);
					const text = range.toString().trim();
					if (text) return text;
				}
			}

			const sel = iframeEl.contentWindow?.getSelection?.();
			if (sel) {
				sel.removeAllRanges();
			}

			return '';
		} catch (e) {
			logger.warn('[EpubScreenshotService] extractTextFromRect failed:', e);
			return '';
		}
	}

	buildSnapshotEmbed(filePath: string, cfi: string, extractedText: string, chapterIndex?: number, chapterTitle?: string): string {
		const displayText = extractedText.length > 30 ? extractedText.slice(0, 30) + '...' : (extractedText || 'screenshot');
		const link = this.linkService.buildEpubLink(filePath, cfi, displayText, chapterIndex, chapterTitle);
		if (!extractedText) {
			return `> [!EPUB|] ${link}\n`;
		}
		const quotedLines = extractedText.split('\n').map(line => `> ${line}`).join('\n');
		return `> [!EPUB|] ${link}\n${quotedLines}\n`;
	}

	buildJpegInsert(imagePath: string, filePath: string, cfi: string, chapterIndex?: number, chapterTitle?: string): string {
		const link = this.linkService.buildEpubLink(filePath, cfi, 'screenshot', chapterIndex, chapterTitle);
		return `> [!EPUB|] ${link}\n> ![[${imagePath}]]\n`;
	}
}
