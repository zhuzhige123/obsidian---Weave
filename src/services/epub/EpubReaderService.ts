import ePub, { type Book, type Rendition, type NavItem } from 'epubjs';
import type { App } from 'obsidian';
import type { EpubBook, BookMetadata, TocItem, ReadingPosition, EpubTheme, EpubFontFamily } from './types';
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

	constructor(app: App) {
		this.app = app;
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
				coverImage = coverUrl;
			}
		} catch (e) {
			console.warn('Failed to extract cover image:', e);
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
		const flow = options?.flow || 'scrolled-doc';
		this.rendition = this.book.renderTo(container, {
			width: w,
			height: h,
			spread: options?.spread || 'none',
			flow,
			manager: flow === 'scrolled-doc' ? 'continuous' : 'default'
		} as any);

		this.setupContentSanitizationHook();

		await this.rendition.display();

		this.setupKeyboardForwarding();

		try {
			await this.book.locations.generate(1024);
		} catch (e) {
			console.warn('Failed to generate locations:', e);
		}
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
				keyCode: e.keyCode,
				which: e.which,
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
				await this.rendition.display(spineItem.href);
			}
		}
	}

	async goToHref(href: string): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}
		await this.rendition.display(href);
	}

	async goToLocation(cfi: string): Promise<void> {
		if (!this.rendition) {
			throw new Error('Book not rendered');
		}

		await this.rendition.display(cfi);
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
			console.warn('Failed to get reading progress:', e);
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

	async setFontSize(size: number): Promise<void> {
		if (!this.rendition) {
			return;
		}

		this.rendition.themes.fontSize(`${size}px`);
	}

	async setFontFamily(family: EpubFontFamily): Promise<void> {
		if (!this.rendition) {
			return;
		}

		const fontStack = family === 'serif'
			? '"Charter", "Bitstream Charter", "Sitka Text", "Cambria", serif'
			: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

		this.rendition.themes.override('font-family', fontStack);
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

	async setLayoutMode(mode: 'scroll' | 'paginated' | 'double'): Promise<void> {
		if (!this.rendition || !this.book || !this.renderContainer) {
			return;
		}

		const currentCfi = this.getCurrentPosition().cfi;
		const rect = this.renderContainer.getBoundingClientRect();

		this.renderContainer.innerHTML = '';
		try {
			this.rendition.destroy();
		} catch (e) {
			logger.debug('[EpubReaderService] rendition destroy on layout switch:', e);
		}

		const flow = mode === 'scroll' ? 'scrolled-doc' : 'paginated';
		this.rendition = this.book.renderTo(this.renderContainer, {
			width: rect.width,
			height: rect.height,
			spread: mode === 'double' ? 'always' : 'none',
			flow,
			manager: flow === 'scrolled-doc' ? 'continuous' : 'default'
		} as any);

		this.setupContentSanitizationHook();

		if (currentCfi) {
			await this.rendition.display(currentCfi);
		} else {
			await this.rendition.display();
		}

		this.setupKeyboardForwarding();
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

	destroy(): void {
		this.isDestroyed = true;
		this._resourcesPatched = false;
		this._cssTextCache.clear();
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

	async highlightAtCfi(cfi: string, text?: string): Promise<void> {
		if (!this.rendition) {
			return;
		}

		try {
			await this.rendition.display(cfi);

			// 等待渲染完成
			await new Promise(resolve => setTimeout(resolve, 400));

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
							hlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
							return;
						}
					}
				}

				// 回退：向上偏移 1/3 视口
				const container = manager.container;
				const offset = Math.floor(container.clientHeight / 3);
				container.scrollBy({ top: -offset, behavior: 'smooth' });
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

	async applyHighlights(highlights: Array<{ cfiRange: string; color: string }>): Promise<void> {
		if (!this.rendition) return;

		const colorMap: Record<string, string> = {
			yellow: 'rgba(255, 235, 59, 0.3)',
			green: 'rgba(76, 175, 80, 0.3)',
			blue: 'rgba(66, 165, 245, 0.3)',
			pink: 'rgba(236, 64, 122, 0.3)',
			purple: 'rgba(171, 71, 188, 0.3)'
		};

		for (const hl of highlights) {
			try {
				const fill = colorMap[hl.color] || colorMap['yellow'];
				this.rendition.annotations.highlight(
					hl.cfiRange,
					{},
					() => {},
					`epub-highlight-${hl.color}`,
					{ fill, 'fill-opacity': '1' }
				);
			} catch (e) {
				// skip invalid CFI ranges
			}
		}
	}
}
