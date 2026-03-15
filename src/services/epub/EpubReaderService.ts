import ePub, { type Book, type Rendition, type NavItem } from 'epubjs';
import type { App } from 'obsidian';
import type { EpubBook, BookMetadata, TocItem, ReadingPosition, EpubTheme } from './types';
import { generateUUID } from '../../utils/helpers';
import { logger } from '../../utils/logger';

export class EpubReaderService {
	private app: App;
	private book: Book | null = null;
	private rendition: Rendition | null = null;
	private currentBookId: string | null = null;
	private renderContainer: HTMLElement | null = null;
	private isDestroyed = false;
	private _cssTextCache = new Map<string, string>();
	private _navSeq = 0;
	private _activeCfiMarker: HTMLElement | null = null;
	private _savedHighlights: Array<{ cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }> = [];
	private _highlightClickCallback: ((info: HighlightClickInfo) => void) | null = null;
	private _highlightDataMap = new Map<string, { cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }>();
	private _markClickedRegistered = false;
	private _searchAbort: AbortController | null = null;

	constructor(app: App) {
		this.app = app;
	}

	private async safeDisplay(target?: string): Promise<void> {
		if (!this.rendition) return;
		const suppressIndexSize = (e: ErrorEvent) => {
			if (e.error instanceof DOMException && e.error.name === 'IndexSizeError') {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		};
		window.addEventListener('error', suppressIndexSize, true);
		try {
			await this.rendition.display(target);
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'IndexSizeError' && target) {
				logger.warn('[EpubReaderService] CFI position invalid, falling back:', target);
				try {
					await this.rendition.display();
				} catch (_fallback) {
					logger.error('[EpubReaderService] Fallback display also failed');
				}
			} else {
				throw e;
			}
		} finally {
			window.removeEventListener('error', suppressIndexSize, true);
		}
	}

	async loadEpub(filePath: string, existingBookId?: string): Promise<EpubBook> {
		const adapter = this.app.vault.adapter;
		const arrayBuffer = await adapter.readBinary(filePath);
		this.book = ePub(arrayBuffer);

		// 在 book.ready 前尽早 patch Resources，防止 replacements() 链中 substitute 崩溃
		this.book.loaded.resources.then((resources: any) => {
			this.patchResourcesDefense(resources);
		}).catch(() => {});

		await this.book.ready;

		const metadata = await this.extractMetadata();
		const bookId = existingBookId || generateUUID();
		this.currentBookId = bookId;

		const epubBook: EpubBook = {
			id: bookId,
			filePath: filePath,
			metadata: metadata,
			currentPosition: {
				chapterIndex: 0,
				cfi: '',
				percent: 0
			},
			readingStats: {
				totalReadTime: 0,
				lastReadTime: Date.now(),
				createdTime: Date.now()
			}
		};

		return epubBook;
	}

	async extractMetadata(): Promise<BookMetadata> {
		if (!this.book) {
			throw new Error('No book loaded');
		}

		const metadata = this.book.packaging.metadata;
		const toc = await this.getTableOfContents();

		let coverImage: string | undefined;
		try {
			const coverUrl = await this.book.coverUrl();
			if (coverUrl) {
				coverImage = await this.blobUrlToDataUrl(coverUrl);
			}
		} catch (e) {
			logger.warn('[EpubReaderService] Failed to extract cover image:', e);
		}

		return {
			title: metadata.title || 'Unknown Title',
			author: metadata.creator || 'Unknown Author',
			publisher: metadata.publisher,
			language: metadata.language,
			isbn: metadata.identifier,
			coverImage,
			chapterCount: toc.length
		};
	}

	async renderTo(container: HTMLElement, options?: { width?: number; height?: number; flow?: string; spread?: string }): Promise<void> {
		if (!this.book) {
			throw new Error('No book loaded');
		}

		const rect = container.getBoundingClientRect();
		const w = options?.width || rect.width || 800;
		const h = options?.height || rect.height || 600;

		this.renderContainer = container;
		const flow = options?.flow || 'paginated';
		this.rendition = this.book.renderTo(container, {
			width: w,
			height: h,
			spread: options?.spread || 'none',
			flow,
			manager: 'default'
		} as any);

		this.setupContentSanitizationHook();

		await this.safeDisplay();

		this.setupKeyboardForwarding();
		this.setupTouchForwarding();

		// locations.generate is expensive - run it in background without blocking rendering
		this.book.locations.generate(1024).catch((e: unknown) => {
			logger.warn('[EpubReaderService] Failed to generate locations:', e);
		});
	}

	/**
	 * CSP + substitute 崩溃防御：在 epubjs 渲染章节内容前，
	 * 剥离外部 @import / 外部 <link> stylesheet，
	 * 避免 Obsidian CSP 拦截 blob: stylesheet 并减少 substitute 处理无效 URL 的概率
	 */
	private setupContentSanitizationHook(): void {
		if (!this.rendition) return;

		this.rendition.hooks.content.register((contents: any) => {
			if (this.isDestroyed) return;
			try {
				const doc = contents?.document;
				if (!doc) return;

				// 移除 <script> 标签（sandbox iframe 不允许脚本执行，移除后避免控制台报错）
				const scripts = doc.querySelectorAll('script');
				for (const script of scripts) {
					script.remove();
				}

				// 移除外部域名的 <link rel="stylesheet">
				const links = doc.querySelectorAll('link[rel="stylesheet"]');
				for (const link of links) {
					const href = link.getAttribute('href') || '';
					if (this.isExternalUrl(href)) {
						link.remove();
					}
				}

				// 清理 <style> 中的外部 @import 规则
				const styles = doc.querySelectorAll('style');
				for (const style of styles) {
					if (style.textContent) {
						style.textContent = style.textContent.replace(
							/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])[^;]*;?/gi,
							(match: string) => {
								if (/https?:\/\//i.test(match)) {
									return '/* [Weave] external import removed */';
								}
								return match;
							}
						);
					}
				}
			} catch (e) {
				logger.debug('[EpubReaderService] content sanitization hook error:', e);
			}
		});

		// 安全网：确保 Resources 对象已被 patch（布局切换时 rendition 重建会再次调用此方法）
		const origResources = (this.book as any)?.resources;
		if (origResources) {
			this.patchResourcesDefense(origResources);
		}
	}

	private isExternalUrl(url: string): boolean {
		return /^https?:\/\//i.test(url);
	}

	private static _computeRelativePath(from: string, to: string): string {
		const fromParts = from.split('/').slice(0, -1);
		const toParts = to.split('/');
		let common = 0;
		for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
			if (fromParts[i] === toParts[i]) common++;
			else break;
		}
		const ups = fromParts.length - common;
		return '../'.repeat(ups) + toParts.slice(common).join('/');
	}

	/**
	 * epubjs substitute 崩溃防御
	 *
	 * 根因：epubjs 内部 substitute 是独立函数（非 Resources 方法），
	 * Resources.createCssFile / Resources.substitute 都会调用它并传入 this.replacementUrls。
	 * Resources.destroy() 将 replacementUrls 设为 void 0，导致 substitute 内部
	 * replacements[i] 时 TypeError: Cannot read properties of undefined (reading '0')。
	 *
	 * 策略：
	 * 1) Object.defineProperty 拦截 setter，确保 replacementUrls 永远是数组
	 * 2) patch createCssFile 做最终防御（即使 defineProperty 失败也能兜底）
	 * 3) patch Resources.substitute 方法（serialize hook 调用路径）
	 */
	private _resourcesPatched = false;
	private patchResourcesDefense(resources: any): void {
		if (!resources || this._resourcesPatched) return;
		this._resourcesPatched = true;

		// 1) 确保当前值为数组
		if (!Array.isArray(resources.replacementUrls)) {
			resources.replacementUrls = [];
		}

		// 2) Object.defineProperty 拦截所有写入（含 destroy() 的 void 0 赋值）
		let _replacementUrls: string[] = resources.replacementUrls;
		try {
			Object.defineProperty(resources, 'replacementUrls', {
				get() { return _replacementUrls; },
				set(val: any) { _replacementUrls = Array.isArray(val) ? val : []; },
				configurable: true,
			});
		} catch (_e) {
			// 某些环境 defineProperty 可能失败
		}

		// 3) patch createCssFile: 不创建 blob URL（CSP 阻止），
		// 改为缓存 CSS 文本并返回 marker URL，后续在 content hook 中以 <style> 内联注入
		if (typeof resources.createCssFile === 'function') {
			const cssCache = this._cssTextCache;
			resources.createCssFile = function (this: any, href: string) {
				if (/^\//.test(href)) {
					return Promise.resolve(undefined);
				}
				const absolute = this.settings.resolver(href);
				let textResponse: Promise<string> | undefined;
				if (this.settings.archive) {
					textResponse = this.settings.archive.getText(absolute);
				} else if (this.settings.request) {
					textResponse = this.settings.request(absolute, 'text');
				}
				if (!textResponse) return Promise.resolve(undefined);

				const relUrls = (this.urls || []).map((assetHref: string) => {
					const resolved = this.settings.resolver(assetHref);
					return EpubReaderService._computeRelativePath(absolute, resolved);
				});

				return textResponse.then((cssText: string) => {
					// 替换 CSS 中的相对资源路径为已解析的 blob/base64 URL
					const replacements = this.replacementUrls || [];
					relUrls.forEach((url: string, i: number) => {
						if (url && replacements[i]) {
							const escaped = url.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
							cssText = cssText.replace(new RegExp(escaped, 'g'), replacements[i]);
						}
					});
					// 存入缓存，返回 marker URL
					const marker = `weave-inline-css://${cssCache.size}`;
					cssCache.set(marker, cssText);
					return marker;
				}).catch(() => undefined);
			};
		}

		// 4) patch Resources.substitute 方法（serialize hook 调用路径）
		// 在 HTML string 阶段将 <link href="weave-inline-css://N"> 替换为 <style>，
		// 避免浏览器尝试加载 marker URL 触发 CSP 错误
		if (typeof resources.substitute === 'function') {
			const origSubstitute = resources.substitute.bind(resources);
			const self = this;
			resources.substitute = function (content: string, url: string) {
				if (self.isDestroyed || !Array.isArray(this.replacementUrls)) {
					return content;
				}
				try {
					content = origSubstitute(content, url);
				} catch (e) {
					logger.debug('[EpubReaderService] Resources.substitute error caught:', e);
				}
				// 将 marker URL 的 <link> 替换为内联 <style>（HTML string 阶段，早于 DOM 解析）
				content = content.replace(
					/<link[^>]*href=["']weave-inline-css:\/\/(\d+)["'][^>]*\/?>/gi,
					(_match: string, id: string) => {
						const marker = `weave-inline-css://${id}`;
						const cssText = self._cssTextCache.get(marker);
						return cssText ? `<style>${cssText}</style>` : '';
					}
				);
				return content;
			};
		}
	}

	private setupKeyboardForwarding(): void {
		if (!this.rendition) return;

		const forwardKeyEvent = (e: KeyboardEvent) => {
			const newEvent = new KeyboardEvent(e.type, {
				key: e.key,
				code: e.code,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
				altKey: e.altKey,
				shiftKey: e.shiftKey,
				bubbles: true,
				cancelable: true,
				composed: true
			});
			document.dispatchEvent(newEvent);
		};

		this.rendition.hooks.content.register((contents: any) => {
			try {
				const doc = contents?.document;
				if (!doc) return;
				doc.addEventListener('keydown', forwardKeyEvent);
				doc.addEventListener('keyup', forwardKeyEvent);
			} catch (_e) {
				// cross-origin or access error
			}
		});
	}

	private setupTouchForwarding(): void {
		if (!this.rendition || !this.renderContainer) return;

		const container = this.renderContainer;

		this.rendition.hooks.content.register((contents: any) => {
			try {
				const doc = contents?.document;
				if (!doc) return;
				const win = doc.defaultView;
				if (!win) return;

				const forwardTouch = (e: TouchEvent) => {
					const iframe = win.frameElement as HTMLElement | null;
					if (!iframe) return;
					const rect = iframe.getBoundingClientRect();

					const adjustedTouches: Touch[] = [];
					for (let i = 0; i < e.changedTouches.length; i++) {
						const t = e.changedTouches[i];
						adjustedTouches.push(new Touch({
							identifier: t.identifier,
							target: container,
							clientX: t.clientX + rect.left,
							clientY: t.clientY + rect.top,
							pageX: t.pageX + rect.left,
							pageY: t.pageY + rect.top,
							screenX: t.screenX,
							screenY: t.screenY,
						}));
					}

					const newEvent = new TouchEvent(e.type, {
						touches: e.type === 'touchend' ? [] : adjustedTouches,
						changedTouches: adjustedTouches,
						targetTouches: e.type === 'touchend' ? [] : adjustedTouches,
						bubbles: true,
						cancelable: true,
					});
					container.dispatchEvent(newEvent);
				};

				doc.addEventListener('touchstart', forwardTouch, { passive: true });
				doc.addEventListener('touchmove', forwardTouch, { passive: true });
				doc.addEventListener('touchend', forwardTouch, { passive: true });
			} catch (_e) {
				// cross-origin or access error
			}
		});
	}

	async getTableOfContents(): Promise<TocItem[]> {
		if (!this.book) {
			throw new Error('No book loaded');
		}

		await this.book.loaded.navigation;
		const toc = this.book.navigation.toc;

		return this.convertNavItems(toc, 0);
	}

	private convertNavItems(items: NavItem[], level: number): TocItem[] {
		return items.map((item, index) => ({
			id: `toc-${level}-${index}`,
			label: item.label?.trim() || '',
			href: item.href?.trim() || '',
			level: level,
			subitems: item.subitems ? this.convertNavItems(item.subitems, level + 1) : undefined
		}));
	}

	async goToChapter(chapterIndex: number): Promise<void> {
		if (!this.rendition || !this.book) {
			throw new Error('Book not rendered');
		}

		const spine = this.book.spine as any;
		const spineItems = spine.items || [];
		if (chapterIndex >= 0 && chapterIndex < spineItems.length) {
			const spineItem = spine.get(chapterIndex);
			if (spineItem?.href) {
				await this.safeDisplay(spineItem.href);
			}
		}
	}

	async goToHref(href: string): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}
		await this.safeDisplay(href);
	}

	async navigateToHrefStable(href: string): Promise<void> {
		if (!this.rendition || !this.book) {
			throw new Error('Book not rendered');
		}
		const navSeq = ++this._navSeq;
		const resolved = this.resolveNavHref(href);
		logger.debug('[EpubReaderService] navigateToHrefStable: original=%s resolved=%s', href, resolved);
		await this.safeDisplay(resolved);
		if (this.isDestroyed || navSeq !== this._navSeq) return;
		await this.waitForRelocated(1200);
		if (this.isDestroyed || navSeq !== this._navSeq) return;
		this.correctFragmentPosition(resolved);
	}

	private resolveNavHref(href: string): string {
		if (!this.book) return href;
		const spine = this.book.spine as any;
		if (!spine?.get) return href;

		const hashIdx = href.indexOf('#');
		const baseHref = hashIdx >= 0 ? href.substring(0, hashIdx) : href;
		const fragment = hashIdx >= 0 ? href.substring(hashIdx) : '';

		if (!baseHref) return href;

		const direct = spine.get(baseHref);
		if (direct) return direct.href + fragment;

		const decoded = decodeURIComponent(baseHref);
		if (decoded !== baseHref) {
			const byDecoded = spine.get(decoded);
			if (byDecoded) return byDecoded.href + fragment;
		}

		const fileName = baseHref.split('/').pop() || '';
		const items: any[] = spine.items || [];
		for (const item of items) {
			const itemHref = (item.href || '') as string;
			const itemFile = itemHref.split('/').pop() || '';
			if (itemFile === fileName) return itemHref + fragment;
		}

		for (const item of items) {
			const itemHref = (item.href || '') as string;
			const canonical = (item.canonical || '') as string;
			if (itemHref.endsWith(baseHref) || baseHref.endsWith(itemHref) ||
				canonical.endsWith(baseHref) || baseHref.endsWith(canonical)) {
				return itemHref + fragment;
			}
		}

		return href;
	}

	private correctFragmentPosition(href: string): void {
		const hashIdx = href.indexOf('#');
		if (hashIdx < 0) return;
		const fragmentId = href.substring(hashIdx + 1);
		if (!fragmentId) return;

		try {
			if (!this.rendition) return;
			const manager = (this.rendition as any)?.manager;
			if (!manager) return;

			const views = manager.views?.();
			if (!views) return;

			for (const view of views) {
				const doc = view?.document || view?.contents?.document;
				if (!doc) continue;

				const el = doc.getElementById(fragmentId);
				if (!el) continue;

				el.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
				return;
			}
		} catch (e) {
			logger.debug('[EpubReaderService] correctFragmentPosition error:', e);
		}
	}

	async goToLocation(cfi: string): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}

		await this.safeDisplay(cfi);
	}

	async navigateToLocationStable(cfi: string): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}
		const navSeq = ++this._navSeq;
		await this.safeDisplay(cfi);
		if (this.isDestroyed || navSeq !== this._navSeq) return;
		await this.waitForRelocated(1200);
		if (this.isDestroyed || navSeq !== this._navSeq) return;
		this.centerCfiIntoView(cfi);
	}

	async nextPage(): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}

		await this.rendition.next();
	}

	async prevPage(): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}

		await this.rendition.prev();
	}

	getCurrentCFI(): string {
		if (!this.rendition) {
			return '';
		}

		const location = this.rendition.currentLocation() as any;
		return location?.start?.cfi || '';
	}

	getReadingProgress(): number {
		if (!this.rendition || !this.book) {
			return 0;
		}

		const location = this.rendition.currentLocation() as any;
		if (!location?.start?.cfi) {
			return 0;
		}

		try {
			const locations = this.book.locations as any;
			if (locations?.percentageFromCfi) {
				const percentage = locations.percentageFromCfi(location.start.cfi);
				return Math.round(percentage * 100);
			}
		} catch (e) {
			logger.warn('[EpubReaderService] Failed to get reading progress:', e);
		}
		return 0;
	}

	getCurrentChapterIndex(): number {
		if (!this.rendition || !this.book) {
			return 0;
		}

		const location = this.rendition.currentLocation() as any;
		if (!location?.start?.href) {
			return 0;
		}

		const spine = this.book.spine as any;
		const spineItem = spine.get(location.start.href);
		return spineItem?.index || 0;
	}

	getCurrentPosition(): ReadingPosition {
		return {
			chapterIndex: this.getCurrentChapterIndex(),
			cfi: this.getCurrentCFI(),
			percent: this.getReadingProgress()
		};
	}

	getCurrentChapterHref(): string {
		if (!this.rendition || !this.book) return '';
		try {
			const location = this.rendition.currentLocation() as any;
			return location?.start?.href || '';
		} catch {
			return '';
		}
	}

	getCurrentChapterTitle(): string {
		if (!this.rendition || !this.book) return '';

		try {
			const location = this.rendition.currentLocation() as any;
			const currentHref = location?.start?.href;
			if (!currentHref) return '';

			const toc = this.book.navigation?.toc;
			if (!toc) return '';

			return this.findTocLabelByHref(toc, currentHref) || '';
		} catch (e) {
			logger.warn('[EpubReaderService] getCurrentChapterTitle failed:', e);
			return '';
		}
	}

	private findTocLabelByHref(items: NavItem[], href: string): string | null {
		const searchHref = href.split('#')[0];
		for (const item of items) {
			const itemHref = (item.href || '').split('#')[0];
			if (itemHref === searchHref) {
				return item.label?.trim() || null;
			}
			if (item.subitems) {
				const found = this.findTocLabelByHref(item.subitems, href);
				if (found) return found;
			}
		}
		return null;
	}

	async setLineHeight(height: number): Promise<void> {
		if (!this.rendition) {
			return;
		}

		this.rendition.themes.override('line-height', height.toString());
	}

	async setTheme(theme: EpubTheme): Promise<void> {
		if (!this.rendition) {
			return;
		}

		const fontSize = this.normalizeCSSSizeValue(
			this.getObsidianCSSVar('--font-text-size', '16px')
		);
		const fontText = this.getObsidianCSSVar('--font-text', '').trim();
		const fontStack = fontText
			? `${fontText}, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
			: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

		if (theme === 'sepia') {
			const sepiaTheme = {
				body: { background: '#F4ECD8', color: '#433422' },
				'p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a': { color: '#433422' }
			};
			this.rendition.themes.register('sepia', sepiaTheme);
			this.rendition.themes.select('sepia');
		} else {
			const bgColor = this.getObsidianCSSVar('--background-primary', '#ffffff');
			const textColor = this.getObsidianCSSVar('--text-normal', '#1a1a1a');
			const defaultTheme = {
				body: { background: bgColor, color: textColor },
				'p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a': { color: textColor }
			};
			this.rendition.themes.register('default', defaultTheme);
			this.rendition.themes.select('default');
		}

		// themes.override() adds !important, ensuring Obsidian font settings
		// take priority over the EPUB book's internal CSS.
		this.rendition.themes.override('font-size', fontSize);
		this.rendition.themes.override('font-family', fontStack);

		// epub.js themes.select() does not force-update already-rendered iframe content.
		// Re-display the current page to apply the new theme immediately.
		try {
			const cfi = this.rendition.location?.start?.cfi;
			if (cfi) {
				await this.safeDisplay(cfi);
			}
		} catch (_) {
			// ignore - theme is applied, visual update will happen on next navigation
		}
	}

	private getObsidianCSSVar(varName: string, fallback: string): string {
		try {
			const bodyStyle = getComputedStyle(document.body);
			const value = bodyStyle.getPropertyValue(varName).trim();
			return value || fallback;
		} catch {
			return fallback;
		}
	}

	private normalizeCSSSizeValue(value: string): string {
		// Obsidian --font-text-size may return a bare number (e.g. "16") without units.
		// CSS font-size requires units, so append 'px' if missing.
		if (/^\d+(\.\d+)?$/.test(value)) {
			return value + 'px';
		}
		return value;
	}

	async setLayoutMode(mode: 'paginated' | 'double'): Promise<void> {
		if (!this.rendition || !this.book || !this.renderContainer) {
			return;
		}

		const currentCfi = this.getCurrentPosition().cfi;
		const rect = this.renderContainer.getBoundingClientRect();

		// /skip innerHTML = '' is used to clear EPUB render container before layout switch
		this.renderContainer.innerHTML = '';
		try {
			this.rendition.destroy();
		} catch (e) {
			logger.debug('[EpubReaderService] rendition destroy on layout switch:', e);
		}

		this._markClickedRegistered = false;

		this.rendition = this.book.renderTo(this.renderContainer, {
			width: rect.width,
			height: rect.height,
			spread: mode === 'double' ? 'always' : 'none',
			flow: 'paginated',
			manager: 'default'
		} as any);

		this.setupContentSanitizationHook();

		await this.safeDisplay(currentCfi || undefined);

		this.setupKeyboardForwarding();
		this.setupTouchForwarding();
	}

	onRelocated(callback: (position: ReadingPosition) => void): void {
		if (!this.rendition) {
			return;
		}

		this.rendition.on('relocated', () => {
			callback(this.getCurrentPosition());
		});
	}

	resize(width: number, height: number): void {
		if (!this.rendition) return;
		this.rendition.resize(width, height);
	}

	private static readonly SEARCH_MAX_RESULTS = 200;

	async searchText(query: string): Promise<Array<{ cfi: string; excerpt: string; chapterTitle: string }>> {
		if (!this.book || !query.trim()) return [];

		if (this._searchAbort) {
			this._searchAbort.abort();
		}
		const abort = new AbortController();
		this._searchAbort = abort;

		const results: Array<{ cfi: string; excerpt: string; chapterTitle: string }> = [];
		const spine = this.book.spine as any;
		if (!spine?.each) return [];

		const items: any[] = [];
		spine.each((item: any) => items.push(item));

		for (const item of items) {
			if (abort.signal.aborted) break;
			try {
				await item.load(this.book.load.bind(this.book));
				const found = await item.find(query);
				if (found && found.length > 0) {
					const chapterTitle = this.findTocLabelByHref(
						this.book.navigation?.toc || [],
						item.href
					) || item.href.split('/').pop() || '';
					for (const f of found) {
						results.push({
							cfi: f.cfi,
							excerpt: f.excerpt || query,
							chapterTitle
						});
						if (results.length >= EpubReaderService.SEARCH_MAX_RESULTS) break;
					}
				}
				item.unload();
				if (results.length >= EpubReaderService.SEARCH_MAX_RESULTS) break;
			} catch (_e) {
				try { item.unload(); } catch (_) { /* ignore */ }
			}
		}

		if (this._searchAbort === abort) {
			this._searchAbort = null;
		}
		return abort.signal.aborted ? [] : results;
	}

	destroy(): void {
		this.isDestroyed = true;
		this._resourcesPatched = false;
		this._cssTextCache.clear();
		this._savedHighlights = [];
		this._highlightClickCallback = null;
		this._highlightDataMap.clear();
		this._markClickedRegistered = false;
		this.clearActiveCfiMarker();
		if (this.rendition) {
			try {
				this.rendition.destroy();
			} catch (e) {
				logger.debug('[EpubReaderService] rendition destroy error:', e);
			}
			this.rendition = null;
		}
		if (this.book) {
			try {
				this.book.destroy();
			} catch (e) {
				logger.debug('[EpubReaderService] book destroy error:', e);
			}
			this.book = null;
		}
		this.currentBookId = null;
	}

	getBook(): Book | null {
		return this.book;
	}

	getRendition(): Rendition | null {
		return this.rendition;
	}

	getCurrentBookId(): string | null {
		return this.currentBookId;
	}

	private clearActiveCfiMarker(): void {
		try {
			this._activeCfiMarker?.remove();
		} catch {
		}
		this._activeCfiMarker = null;
	}

	private centerCfiIntoView(cfi: string): void {
		try {
			if (!this.rendition) return;
			this.clearActiveCfiMarker();
			const range = (this.rendition as any).getRange?.(cfi);
			if (!range) return;
			const doc = (range.startContainer as any)?.ownerDocument as Document | undefined;
			if (!doc) return;
			const marker = doc.createElement('span');
			marker.className = 'weave-cfi-marker';
			marker.style.cssText = 'display:inline-block;width:0;height:0;line-height:0;';
			const collapsed = range.cloneRange();
			collapsed.collapse(true);
			collapsed.insertNode(marker);
			this._activeCfiMarker = marker;
			marker.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
			setTimeout(() => {
				this.clearActiveCfiMarker();
			}, 800);
		} catch {
		}
	}

	private waitForRelocated(timeoutMs: number): Promise<void> {
		if (!this.rendition) return Promise.resolve();
		return new Promise((resolve) => {
			let settled = false;
			const handler = () => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve();
			};
			const cleanup = () => {
				try { (this.rendition as any).off?.('relocated', handler); } catch { }
				try { (this.rendition as any).removeListener?.('relocated', handler); } catch { }
			};
			try { (this.rendition as any).on?.('relocated', handler); } catch { }
			setTimeout(() => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve();
			}, Math.max(0, timeoutMs));
		});
	}

	async highlightAtCfi(cfi: string, text?: string): Promise<void> {
		if (!this.rendition) {
			return;
		}
		const navSeq = ++this._navSeq;

		try {
			await this.safeDisplay(cfi);

			// 等待渲染完成
			await this.waitForRelocated(1200);
			if (this.isDestroyed || navSeq !== this._navSeq) return;

			// 尝试 annotation 高亮
			let annotationApplied = false;
			try {
				this.rendition.annotations.highlight(
					cfi,
					{},
					() => {},
					'epub-temp-highlight',
					{ fill: 'rgba(255, 200, 0, 0.4)', 'fill-opacity': '0.4' }
				);
				annotationApplied = true;
			} catch (_e) {
				logger.debug('[EpubReaderService] annotation highlight failed, trying text-based fallback');
			}

			// DOM 文本高亮 (更可靠的回退方案)
			if (text) {
				this.highlightTextInIframe(text);
			}

			// 滚动到高亮位置
			this.centerCfiIntoView(cfi);
			this.scrollHighlightIntoView();

			// 点击任意位置移除高亮（而非自动超时）
			this.setupHighlightDismiss(cfi, annotationApplied);
		} catch (e) {
			logger.warn('[EpubReaderService] highlightAtCfi failed:', e);

			// CFI 导航失败，尝试纯文本搜索
			if (text) {
				logger.info('[EpubReaderService] CFI failed, falling back to text search');
				this.highlightTextInIframe(text);
				this.setupHighlightDismiss(cfi, false);
			}
		}
	}

	private highlightTextInIframe(searchText: string): void {
		try {
			const manager = (this.rendition as any)?.manager;
			if (!manager) return;

			const views = manager.views?.();
			if (!views) return;

			for (const view of views) {
				const doc = view?.document || view?.contents?.document;
				if (!doc) continue;

				const treeWalker = doc.createTreeWalker(
					doc.body,
					NodeFilter.SHOW_TEXT,
					null
				);

				const normalizedSearch = searchText.replace(/\s+/g, ' ').trim();
				const shortSearch = normalizedSearch.length > 80
					? normalizedSearch.slice(0, 80)
					: normalizedSearch;

				let node: Text | null;
				while ((node = treeWalker.nextNode() as Text)) {
					const nodeText = (node.textContent || '').replace(/\s+/g, ' ');
					const idx = nodeText.indexOf(shortSearch);
					if (idx === -1) continue;

					try {
						const range = doc.createRange();
						range.setStart(node, idx);
						range.setEnd(node, Math.min(idx + shortSearch.length, node.length));

						const wrapper = doc.createElement('span');
						wrapper.className = 'weave-temp-highlight';
						wrapper.style.cssText = 'background: rgba(255, 200, 0, 0.45); border-radius: 2px; transition: background 0.3s;';
						range.surroundContents(wrapper);
					} catch (_e) {
						// 跨节点选区无法 surroundContents，跳过
					}
					break;
				}
			}
		} catch (e) {
			logger.warn('[EpubReaderService] highlightTextInIframe failed:', e);
		}
	}

	private scrollHighlightIntoView(): void {
		setTimeout(() => {
			try {
				if (!this.rendition) return;
				const manager = (this.rendition as any).manager;
				if (!manager?.container) return;

				// 优先滚动到 DOM 高亮元素
				const views = manager.views?.();
				if (views) {
					for (const view of views) {
						const doc = view?.document || view?.contents?.document;
						if (!doc) continue;
						const hlEl = doc.querySelector('.weave-temp-highlight');
						if (hlEl) {
							hlEl.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
							return;
						}
					}
				}

				// 回退：向上偏移 1/3 视口
				const container = manager.container;
				container.scrollBy({ top: 0, behavior: 'auto' });
			} catch (_e) {
				// ignore scroll errors
			}
		}, 200);
	}

	private setupHighlightDismiss(cfi: string, annotationApplied: boolean): void {
		const cleanup = () => {
			// 移除 DOM 高亮
			try {
				const manager = (this.rendition as any)?.manager;
				const views = manager?.views?.();
				if (views) {
					for (const view of views) {
						const doc = view?.document || view?.contents?.document;
						if (!doc) continue;
						const highlights = doc.querySelectorAll('.weave-temp-highlight');
						highlights.forEach((el: HTMLElement) => {
							const parent = el.parentNode;
							if (parent) {
								while (el.firstChild) {
									parent.insertBefore(el.firstChild, el);
								}
								parent.removeChild(el);
							}
						});
					}
				}
			} catch (_e) { /* ignore */ }

			// 移除 annotation 高亮
			if (annotationApplied) {
				try {
					this.rendition?.annotations.remove(cfi, 'highlight');
				} catch (_e) { /* ignore */ }
			}
		};

		// 在 iframe 和主文档上都监听点击
		const handler = () => {
			cleanup();
			document.removeEventListener('click', handler);
			document.removeEventListener('pointerdown', handler);
		};

		// 延迟注册，避免当前点击立即触发
		setTimeout(() => {
			document.addEventListener('click', handler, { once: true });

			// 也在 iframe 内注册
			try {
				const manager = (this.rendition as any)?.manager;
				const views = manager?.views?.();
				if (views) {
					for (const view of views) {
						const doc = view?.document || view?.contents?.document;
						if (!doc) continue;
						doc.addEventListener('click', () => {
							cleanup();
							document.removeEventListener('click', handler);
						}, { once: true });
					}
				}
			} catch (_e) { /* ignore */ }
		}, 500);
	}

	private static readonly HIGHLIGHT_FILL_MAP: Record<string, string> = {
		yellow: 'rgb(255, 235, 59)',
		green: 'rgb(76, 175, 80)',
		blue: 'rgb(66, 165, 245)',
		pink: 'rgb(236, 64, 122)',
		purple: 'rgb(171, 71, 188)'
	};

	onHighlightClick(callback: (info: HighlightClickInfo) => void): void {
		this._highlightClickCallback = callback;
	}

	async applyHighlights(highlights: Array<{ cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }>): Promise<void> {
		if (!this.rendition) {
			logger.warn('[EpubReaderService] applyHighlights: no rendition');
			return;
		}

		logger.debug('[EpubReaderService] applyHighlights called with', highlights.length, 'highlights');

		// Clear previous annotations
		for (const [cfi] of this._highlightDataMap) {
			try { (this.rendition.annotations as any).remove(cfi, 'highlight'); } catch (_e) { /* skip */ }
		}
		this._highlightDataMap.clear();
		this._savedHighlights = [];

		// Register markClicked handler once per rendition
		if (!this._markClickedRegistered) {
			this._markClickedRegistered = true;
			this.rendition.on('markClicked', (cfiRange: string, data: any, contents: any) => {
				if (this.isDestroyed) return;
				this.handleMarkClicked(cfiRange, data, contents);
			});
		}

		// Add annotations via epubjs API (SVG overlay, no DOM modification)
		let applied = 0;
		for (const hl of highlights) {
			const fill = EpubReaderService.HIGHLIGHT_FILL_MAP[hl.color] || EpubReaderService.HIGHLIGHT_FILL_MAP['yellow'];
			try {
				this.rendition.annotations.highlight(
					hl.cfiRange,
					{ color: hl.color, text: hl.text, sourceFile: hl.sourceFile, sourceRef: hl.sourceRef },
					undefined,
					`weave-epub-hl-${hl.color}`,
					{ fill, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
				);
				this._highlightDataMap.set(hl.cfiRange, hl);
				this._savedHighlights.push(hl);
				applied++;
			} catch (e) {
				logger.warn('[EpubReaderService] annotation.highlight failed for CFI:', hl.cfiRange.slice(0, 60), e);
			}
		}
		logger.debug('[EpubReaderService] applied', applied, '/', highlights.length, 'annotations');
	}

	addHighlight(hl: { cfiRange: string; color: string; text?: string; sourceFile?: string; sourceRef?: string }): void {
		if (!this.rendition) return;

		// Register markClicked handler if not already done
		if (!this._markClickedRegistered) {
			this._markClickedRegistered = true;
			this.rendition.on('markClicked', (cfiRange: string, data: any, contents: any) => {
				if (this.isDestroyed) return;
				this.handleMarkClicked(cfiRange, data, contents);
			});
		}

		const fill = EpubReaderService.HIGHLIGHT_FILL_MAP[hl.color] || EpubReaderService.HIGHLIGHT_FILL_MAP['yellow'];
		try {
			this.rendition.annotations.highlight(
				hl.cfiRange,
				{ color: hl.color, text: hl.text, sourceFile: hl.sourceFile, sourceRef: hl.sourceRef },
				undefined,
				`weave-epub-hl-${hl.color}`,
				{ fill, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
			);
			this._highlightDataMap.set(hl.cfiRange, hl);
			this._savedHighlights.push(hl);
		} catch (e) {
			logger.warn('[EpubReaderService] addHighlight failed for CFI:', hl.cfiRange.slice(0, 60), e);
		}
	}

	private handleMarkClicked(cfiRange: string, data: any, contents: any): void {
		if (!this._highlightClickCallback) return;

		const hl = this._highlightDataMap.get(cfiRange) || data;
		if (!hl) return;

		try {
			const range = contents.range(cfiRange);
			if (!range) return;

			const rangeRect = range.getBoundingClientRect();
			const iframe = contents.document?.defaultView?.frameElement as HTMLIFrameElement;
			const viewportEl = iframe?.closest('.epub-reader-viewport') as HTMLElement;
			if (!iframe || !viewportEl) return;

			const iframeRect = iframe.getBoundingClientRect();
			const viewportRect = viewportEl.getBoundingClientRect();

			const rect = {
				top: rangeRect.top + iframeRect.top - viewportRect.top,
				left: rangeRect.left + iframeRect.left - viewportRect.left,
				bottom: rangeRect.bottom + iframeRect.top - viewportRect.top,
				right: rangeRect.right + iframeRect.left - viewportRect.left,
				width: rangeRect.width,
				height: rangeRect.height
			};

			this._highlightClickCallback({
				cfiRange,
				color: hl.color || 'yellow',
				text: hl.text || '',
				sourceFile: hl.sourceFile || '',
				sourceRef: hl.sourceRef,
				rect
			});
		} catch (_e) { /* skip */ }
	}

	async navigateAndHighlight(options: NavigateAndHighlightOptions): Promise<void> {
		if (!this.rendition) return;
		const navSeq = ++this._navSeq;
		const flashStyle = options.flashStyle ?? 'pulse';

		try {
			// 1. Navigate
			if (options.cfi) {
				await this.safeDisplay(options.cfi);
			} else if (options.href) {
				const resolved = this.resolveNavHref(options.href);
				await this.safeDisplay(resolved);
			} else {
				return;
			}

			// 2. Wait for render
			await this.waitForRelocated(1200);
			if (this.isDestroyed || navSeq !== this._navSeq) return;

			// 3. Visual feedback
			if (flashStyle === 'highlight') {
				this.applyHighlightFlash(options, navSeq);
			} else if (flashStyle === 'pulse') {
				this.applyPulseFlash(options);
			} else {
				// 'none': just scroll into view
				if (options.cfi) {
					this.centerCfiIntoView(options.cfi);
				} else if (options.href) {
					this.correctFragmentPosition(this.resolveNavHref(options.href));
				}
			}
		} catch (e) {
			logger.warn('[EpubReaderService] navigateAndHighlight failed:', e);
			// CFI failed, try text fallback with pulse
			if (options.text && flashStyle !== 'none') {
				this.highlightTextInIframe(options.text);
				this.scrollHighlightIntoView();
				this.setupHighlightDismiss('', false);
			}
		}
	}

	private applyHighlightFlash(options: NavigateAndHighlightOptions, navSeq: number): void {
		if (!this.rendition) return;
		const cfi = options.cfi || '';

		// Annotation highlight
		let annotationApplied = false;
		if (cfi) {
			try {
				const color = options.flashColor || 'rgba(255, 200, 0, 0.4)';
				this.rendition.annotations.highlight(
					cfi, {}, () => {}, 'epub-temp-highlight',
					{ fill: color, 'fill-opacity': '0.4' }
				);
				annotationApplied = true;
			} catch (_e) {
				logger.debug('[EpubReaderService] annotation highlight failed, trying text fallback');
			}
		}

		// DOM text highlight fallback
		if (options.text) {
			this.highlightTextInIframe(options.text);
		}

		// Scroll
		if (cfi) {
			this.centerCfiIntoView(cfi);
		}
		this.scrollHighlightIntoView();

		// Dismiss
		this.setupHighlightDismiss(cfi, annotationApplied);
	}

	private applyPulseFlash(options: NavigateAndHighlightOptions): void {
		// Scroll into view first
		if (options.cfi) {
			this.centerCfiIntoView(options.cfi);
		} else if (options.href) {
			this.correctFragmentPosition(this.resolveNavHref(options.href));
		}

		// Inject pulse CSS and apply to target element
		const color = options.flashColor || 'rgba(99, 135, 210, 0.3)';
		this.injectPulseAtTarget(options.cfi, options.href, options.text, color);
	}

	private injectPulseAtTarget(cfi?: string, href?: string, text?: string, color?: string): void {
		try {
			if (!this.rendition) return;
			const manager = (this.rendition as any)?.manager;
			const views = manager?.views?.();
			if (!views) return;

			const pulseColor = color || 'rgba(99, 135, 210, 0.3)';

			for (const view of views) {
				const doc = view?.document || view?.contents?.document;
				if (!doc) continue;

				// Inject pulse keyframes CSS once per document
				if (!doc.querySelector('#weave-pulse-style')) {
					const style = doc.createElement('style');
					style.id = 'weave-pulse-style';
					style.textContent = `
						@keyframes weave-nav-pulse {
							0% { background-color: var(--weave-pulse-color); }
							100% { background-color: transparent; }
						}
						.weave-nav-pulse {
							animation: weave-nav-pulse 2s ease-out forwards;
							border-radius: 3px;
						}
					`;
					doc.head.appendChild(style);
				}

				// Find target element
				let targetEl: HTMLElement | null = null;

				// Strategy 1: CFI range
				if (cfi && !targetEl) {
					try {
						const range = (this.rendition as any).getRange?.(cfi);
						if (range) {
							const container = range.startContainer;
							targetEl = container.nodeType === Node.ELEMENT_NODE
								? container as HTMLElement
								: (container as Node).parentElement;
						}
					} catch (_) { /* skip */ }
				}

				// Strategy 2: href fragment id
				if (href && !targetEl) {
					const hashIdx = href.indexOf('#');
					if (hashIdx >= 0) {
						const fragId = href.substring(hashIdx + 1);
						if (fragId) {
							targetEl = doc.getElementById(fragId);
						}
					}
				}

				// Strategy 3: first heading (chapter navigation)
				if (!targetEl && !cfi) {
					targetEl = doc.querySelector('h1, h2, h3, h4');
				}

				// Strategy 4: text search
				if (!targetEl && text) {
					const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
					const normalized = text.replace(/\s+/g, ' ').trim();
					const shortText = normalized.length > 60 ? normalized.slice(0, 60) : normalized;
					let node: Text | null;
					while ((node = walker.nextNode() as Text)) {
						const nodeText = (node.textContent || '').replace(/\s+/g, ' ');
						if (nodeText.includes(shortText)) {
							targetEl = node.parentElement;
							break;
						}
					}
				}

				if (!targetEl) continue;

				// Remove any existing pulse
				const existing = doc.querySelectorAll('.weave-nav-pulse');
				existing.forEach((el: Element) => {
					(el as HTMLElement).classList.remove('weave-nav-pulse');
					(el as HTMLElement).style.removeProperty('--weave-pulse-color');
				});

				// Apply pulse
				targetEl.style.setProperty('--weave-pulse-color', pulseColor);
				targetEl.classList.add('weave-nav-pulse');
				targetEl.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

				// Cleanup after animation
				setTimeout(() => {
					try {
						targetEl?.classList.remove('weave-nav-pulse');
						targetEl?.style.removeProperty('--weave-pulse-color');
					} catch (_) { /* element may be gone */ }
				}, 2200);

				return; // applied to first matching view
			}
		} catch (e) {
			logger.debug('[EpubReaderService] injectPulseAtTarget error:', e);
		}
	}

	private async blobUrlToDataUrl(blobUrl: string): Promise<string> {
		try {
			const response = await fetch(blobUrl);
			const blob = await response.blob();
			URL.revokeObjectURL(blobUrl);
			return await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});
		} catch (e) {
			URL.revokeObjectURL(blobUrl);
			return blobUrl;
		}
	}
}

export type FlashStyle = 'pulse' | 'highlight' | 'none';

export interface NavigateAndHighlightOptions {
	cfi?: string;
	href?: string;
	text?: string;
	flashStyle?: FlashStyle;
	flashColor?: string;
	dismiss?: 'click' | 'auto';
}

export interface HighlightClickInfo {
	cfiRange: string;
	color: string;
	text: string;
	sourceFile: string;
	sourceRef?: string;
	rect: { top: number; left: number; bottom: number; right: number; width: number; height: number };
}
