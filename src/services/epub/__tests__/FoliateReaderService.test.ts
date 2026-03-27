import JSZip from 'jszip';
import { Platform, TFile } from 'obsidian';
import { EpubCFI } from '../legacy-epub-cfi';
import { FoliateReaderService } from '../FoliateReaderService';

function createMockRect(top: number, left: number, width: number, height: number): DOMRect {
	return {
		x: left,
		y: top,
		top,
		left,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON: () => ({}),
	} as DOMRect;
}

const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
const originalBlobArrayBuffer = Blob.prototype.arrayBuffer;
const originalMatchMedia = globalThis.matchMedia;
const originalSetCssProps = (HTMLElement.prototype as HTMLElement & {
	setCssProps?: (props: Record<string, string>) => void;
}).setCssProps;
const mockRangeRect = createMockRect(15, 20, 120, 26);

async function createSampleEpubBuffer(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip');
	zip.file(
		'META-INF/container.xml',
		`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml" />
	</rootfiles>
</container>`,
	);
	zip.file(
		'OPS/content.opf',
		`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
		<dc:title>Foliate Sample</dc:title>
		<dc:creator>Author F</dc:creator>
		<dc:publisher>Weave Press</dc:publisher>
		<dc:language>zh-CN</dc:language>
	</metadata>
	<manifest>
		<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
		<item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image" />
		<item id="chapter-1" href="text/chapter1.xhtml" media-type="application/xhtml+xml" />
	</manifest>
	<spine>
		<itemref idref="chapter-1" />
	</spine>
</package>`,
	);
	zip.file(
		'OPS/nav.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
	<body>
		<nav epub:type="toc">
			<ol>
				<li>
					<a href="text/chapter1.xhtml">Chapter 1</a>
					<ol>
						<li><a href="text/chapter1.xhtml#sec-1">Section 1</a></li>
					</ol>
				</li>
			</ol>
		</nav>
	</body>
</html>`,
	);
	zip.file(
		'OPS/text/chapter1.xhtml',
		`<html xmlns="http://www.w3.org/1999/xhtml">
	<head><title>Chapter 1</title></head>
	<body>
		<h1 id="sec-1">Chapter 1</h1>
		<p id="para-1">Selection text for testing.</p>
	</body>
</html>`,
	);
	zip.file('OPS/images/cover.png', new Uint8Array([137, 80, 78, 71]));
	return zip.generateAsync({ type: 'arraybuffer' });
}

function createMockApp(binary: ArrayBuffer) {
	const createVaultFile = (path: string) => {
		const normalizedPath = path.replace(/\\/g, '/');
		const fileName = normalizedPath.split('/').pop() || 'sample.epub';
		const folderPath = normalizedPath.includes('/') ? normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) : '';
		return Object.assign(Object.create(TFile.prototype), {
			path: normalizedPath,
			name: fileName,
			basename: fileName.replace(/\.[^.]+$/, ''),
			extension: 'epub',
			parent: folderPath ? { path: folderPath } : null,
			stat: {
				size: binary.byteLength,
				mtime: Date.now(),
				ctime: Date.now(),
			},
		});
	};

	return {
		vault: {
			getAbstractFileByPath: vi.fn((path: string) => createVaultFile(path)),
			readBinary: vi.fn(async () => binary),
		},
	};
}

async function createService(): Promise<FoliateReaderService> {
	const binary = await createSampleEpubBuffer();
	const service = new FoliateReaderService(createMockApp(binary) as any);
	await service.loadEpub('Books/sample.epub', 'foliate-book');
	return service;
}

async function getParagraphSelectionCfi(service: FoliateReaderService): Promise<{ cfi: string; doc: Document }> {
	const section = (service as any).currentFoliateBook.sections[0];
	const doc = await section.createDocument();
	const paragraph = doc.querySelector('#para-1');
	const textNode = paragraph?.firstChild;
	if (!textNode) {
		throw new Error('Paragraph text node not found');
	}
	const range = doc.createRange();
	range.setStart(textNode, 0);
	range.setEnd(textNode, textNode.textContent?.length || 0);
	return {
		cfi: new EpubCFI(range, section.cfi).toString(),
		doc,
	};
}

function createReadiumLocation(payload: Record<string, unknown>): string {
	return `readium:${encodeURIComponent(JSON.stringify(payload))}`;
}

function createParagraphRange(doc: Document): Range {
	const paragraph = doc.querySelector('#para-1');
	const textNode = paragraph?.firstChild;
	if (!textNode) {
		throw new Error('Paragraph text node not found');
	}
	const range = doc.createRange();
	range.setStart(textNode, 0);
	range.setEnd(textNode, textNode.textContent?.length || 0);
	return range;
}

function createCollapsedParagraphCfi(service: FoliateReaderService, doc: Document): string {
	const section = (service as any).currentFoliateBook.sections[0];
	const paragraph = doc.querySelector('#para-1');
	const textNode = paragraph?.firstChild;
	if (!textNode) {
		throw new Error('Paragraph text node not found');
	}
	const range = doc.createRange();
	range.setStart(textNode, 0);
	range.collapse(true);
	return new EpubCFI(range, section.cfi).toString();
}

async function withPlatformIsMobile<T>(value: boolean, run: () => Promise<T>): Promise<T> {
	const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'isMobile');
	Object.defineProperty(Platform, 'isMobile', {
		configurable: true,
		value,
	});
	try {
		return await run();
	} finally {
		if (originalDescriptor) {
			Object.defineProperty(Platform, 'isMobile', originalDescriptor);
		} else {
			delete (Platform as { isMobile?: boolean }).isMobile;
		}
	}
}

describe('FoliateReaderService', () => {
	beforeAll(() => {
		if (!globalThis.matchMedia) {
			const matchMedia = vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn().mockReturnValue(false),
			}));
			Object.defineProperty(globalThis, 'matchMedia', {
				configurable: true,
				value: matchMedia,
			});
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				value: matchMedia,
			});
		}
		if (!Blob.prototype.arrayBuffer) {
			Object.defineProperty(Blob.prototype, 'arrayBuffer', {
				configurable: true,
				value() {
					return new Promise<ArrayBuffer>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result as ArrayBuffer);
						reader.onerror = () => reject(reader.error);
						reader.readAsArrayBuffer(this);
					});
				},
			});
		}
		Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
			configurable: true,
			value: () => mockRangeRect,
		});
		if (typeof originalSetCssProps !== 'function') {
			Object.defineProperty(HTMLElement.prototype, 'setCssProps', {
				configurable: true,
				value(this: HTMLElement, props: Record<string, string>) {
					for (const [key, value] of Object.entries(props || {})) {
						this.style.setProperty(key, value);
					}
				},
			});
		}
	});

	afterAll(() => {
		if (originalMatchMedia) {
			Object.defineProperty(globalThis, 'matchMedia', {
				configurable: true,
				value: originalMatchMedia,
			});
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				value: originalMatchMedia,
			});
		} else {
			delete (globalThis as typeof globalThis & { matchMedia?: typeof globalThis.matchMedia }).matchMedia;
			delete (window as Window & typeof globalThis & { matchMedia?: typeof globalThis.matchMedia }).matchMedia;
		}
		if (originalBlobArrayBuffer) {
			Object.defineProperty(Blob.prototype, 'arrayBuffer', {
				configurable: true,
				value: originalBlobArrayBuffer,
			});
		} else {
			delete (Blob.prototype as Partial<Blob>).arrayBuffer;
		}
		if (originalGetBoundingClientRect) {
			Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
				configurable: true,
				value: originalGetBoundingClientRect,
			});
		} else {
			delete (Range.prototype as Partial<Range>).getBoundingClientRect;
		}
		if (typeof originalSetCssProps === 'function') {
			Object.defineProperty(HTMLElement.prototype, 'setCssProps', {
				configurable: true,
				value: originalSetCssProps,
			});
		} else {
			delete (HTMLElement.prototype as HTMLElement & { setCssProps?: (props: Record<string, string>) => void }).setCssProps;
		}
	});

	beforeEach(() => {
		document.body.innerHTML = '';
		document.body.className = '';
		document.documentElement.className = '';
	});

	it('loads metadata, cover, and toc from a local EPUB', async () => {
		const service = await createService();

		const toc = await service.getTableOfContents();
		const book = (service as any).currentBook;

		expect(book).toMatchObject({
			id: 'foliate-book',
			filePath: 'Books/sample.epub',
			metadata: {
				title: 'Foliate Sample',
				author: 'Author F',
				publisher: 'Weave Press',
				language: 'zh-CN',
				chapterCount: 1,
				coverImage: 'data:image/png;base64,iVBORw==',
			},
		});
		expect(toc).toEqual([
			{
				id: '0-0-OPS/text/chapter1.xhtml',
				label: 'Chapter 1',
				href: 'OPS/text/chapter1.xhtml',
				level: 0,
				subitems: [
					{
						id: '1-0-OPS/text/chapter1.xhtml#sec-1',
						label: 'Section 1',
						href: 'OPS/text/chapter1.xhtml#sec-1',
						level: 1,
						subitems: undefined,
					},
				],
			},
		]);
	});

	it('wraps bare legacy CFIs into canonical EPUB CFI strings', async () => {
		const service = await createService();
		const { cfi } = await getParagraphSelectionCfi(service);
		const bareCfi = cfi.replace(/^epubcfi\((.*)\)$/, '$1');

		const canonical = await service.canonicalizeLocation(bareCfi, 'Selection text for testing.');

		expect(canonical).toBe(cfi);
	});

	it('expands bare section CFIs into anchorable foliate locations', async () => {
		const service = await createService();
		const section = (service as any).currentFoliateBook.sections[0];

		const canonical = await service.canonicalizeLocation(section.cfi);

		expect(canonical).toContain('!');

		const doc = await section.createDocument();
		const range = new EpubCFI(canonical || '').toRange(doc);
		expect(range.toString().length).toBeGreaterThanOrEqual(1);
	});

	it('expands legacy section CFIs even when foliate resolveCFI throws', async () => {
		const service = await createService();
		(service as any).currentFoliateBook.resolveCFI = vi.fn(() => {
			throw new Error('resolveCFI failed');
		});

		const canonical = await service.canonicalizeLocation('epubcfi(/6/2)');

		expect(canonical).toContain('!');

		const section = (service as any).currentFoliateBook.sections[0];
		const doc = await section.createDocument();
		const range = new EpubCFI(canonical || '').toRange(doc);
		expect(range.toString().length).toBeGreaterThanOrEqual(1);
	});

	it('converts stored readium locations into foliate EPUB CFIs', async () => {
		const service = await createService();
		const readiumLocation = createReadiumLocation({
			href: 'OPS/text/chapter1.xhtml#para-1',
			locations: {
				fragments: ['para-1'],
				totalProgression: 0.25,
			},
			text: {
				highlight: 'Selection text for testing.',
				before: '',
				after: '',
			},
		});

		const canonical = await service.canonicalizeLocation(readiumLocation);

		expect(canonical).toContain('epubcfi(');

		const section = (service as any).currentFoliateBook.sections[0];
		const doc = await section.createDocument();
		const range = new EpubCFI(canonical || '').toRange(doc);

		expect(range.toString()).toBe('Selection text for testing.');
	});

	it('expands collapsed point CFIs into quote ranges when highlight text is available', async () => {
		const service = await createService();
		const section = (service as any).currentFoliateBook.sections[0];
		const doc = await section.createDocument();
		const pointCfi = createCollapsedParagraphCfi(service, doc);

		const canonical = await service.canonicalizeLocation(pointCfi, 'Selection text for testing.');

		expect(canonical).toContain(',');

		const resolvedRange = new EpubCFI(canonical || '').toRange(doc);
		expect(resolvedRange.toString()).toBe('Selection text for testing.');
	});

	it('locates readium payload targets inside the visible foliate document', async () => {
		const service = await createService();
		const { doc } = await getParagraphSelectionCfi(service);
		const readiumLocation = createReadiumLocation({
			href: 'OPS/text/chapter1.xhtml#para-1',
			locations: {
				fragments: ['para-1'],
			},
			text: {
				highlight: 'Selection text for testing.',
			},
		});

		(service as any).foliateView = {
			renderer: {
				getContents: () => [{ doc, index: 0 }],
			},
		};

		const rect = service.getNavigationTargetRect({ cfi: readiumLocation });

		expect(rect).toBeTruthy();
		expect(rect).toMatchObject({
			top: 15,
			left: 20,
			width: 120,
			height: 26,
		});
	});

	it('renders a foliate view element without crashing the reader flow', async () => {
		const service = await createService();
		const container = document.createElement('div');
		container.style.width = '960px';
		container.style.height = '720px';
		document.body.appendChild(container);

		await expect(service.renderTo(container)).resolves.toBeUndefined();

		expect(container.querySelector('foliate-view')).toBeTruthy();
	});

	it('ignores transient null foliate documents while building compat contents', async () => {
		const service = await createService();
		const { doc } = await getParagraphSelectionCfi(service);

		(service as any).foliateView = {
			renderer: {
				getContents: () => [
					{ doc: null, index: 0 },
					{ doc, index: 0 },
				],
			},
		};

		const contents = (service.getRendition() as any).getContents();

		expect(contents).toHaveLength(1);
		expect(contents[0]?.document).toBe(doc);
		expect(contents[0]?.window).toBeTruthy();
	});

	it('keeps original mobile section blob URLs when the runtime can read sandboxed iframe documents', async () => {
		const service = await createService();
		const originalLoad = vi.fn(async () => 'blob:test-section');
		const book = {
			sections: [{
				id: 'OPS/text/chapter1.xhtml',
				load: originalLoad,
			}],
		};

		await withPlatformIsMobile(true, async () => {
			vi.spyOn(service as any, 'getMobileSectionUrlStrategy').mockResolvedValue('original');

			await (service as any).applyMobileSectionUrlStrategy(book);

			await expect(book.sections[0].load()).resolves.toBe('blob:test-section');
			expect(originalLoad).toHaveBeenCalledTimes(1);
		});
	});

	it('converts mobile section blob URLs into data URLs only when the runtime requires that fallback', async () => {
		const service = await createService();
		const html = '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Section</p></body></html>';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			blob: async () => new Blob([html], { type: 'application/xhtml+xml' }),
		} as Response);
		const originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, 'fetch', {
			configurable: true,
			value: fetchMock,
		});
		Object.defineProperty(window, 'fetch', {
			configurable: true,
			value: fetchMock,
		});
		const unload = vi.fn();
		const book = {
			sections: [{
				id: 'OPS/text/chapter1.xhtml',
				load: vi.fn(async () => 'blob:test-section'),
				unload,
			}],
		};

		try {
			await withPlatformIsMobile(true, async () => {
				vi.spyOn(service as any, 'getMobileSectionUrlStrategy').mockResolvedValue('data-url');

				await (service as any).applyMobileSectionUrlStrategy(book);

				const firstLoad = await book.sections[0].load();
				const secondLoad = await book.sections[0].load();

				expect(firstLoad).toMatch(/^data:application\/xhtml\+xml;base64,/);
				expect(secondLoad).toBe(firstLoad);
				expect(fetchMock).toHaveBeenCalledTimes(1);

				book.sections[0].unload();
				await book.sections[0].load();

				expect(unload).toHaveBeenCalledTimes(1);
				expect(fetchMock).toHaveBeenCalledTimes(2);
			});
		} finally {
			Object.defineProperty(globalThis, 'fetch', {
				configurable: true,
				value: originalFetch,
			});
			Object.defineProperty(window, 'fetch', {
				configurable: true,
				value: originalFetch,
			});
		}
	});

	it('retries mobile rendering with the alternate section URL strategy when content stays blank', async () => {
		const service = await createService();
		const performRender = vi.spyOn(service as any, 'performRender').mockResolvedValue(undefined);
		const rebuild = vi.spyOn(service as any, 'rebuildCurrentBookWithMobileStrategy').mockResolvedValue(undefined);
		const waitForRenderableContentInspection = vi
			.spyOn(service as any, 'waitForRenderableContentInspection')
			.mockResolvedValueOnce({
				renderable: false,
				documents: 1,
				textDocuments: 1,
				visibleTextDocuments: 0,
				visibleMediaDocuments: 0,
			})
			.mockResolvedValueOnce({
				renderable: true,
				documents: 1,
				textDocuments: 1,
				visibleTextDocuments: 1,
				visibleMediaDocuments: 0,
			});

		(service as any).renderContainer = document.createElement('div');
		(service as any).lastRenderOptions = {
			flow: 'paginated',
			spread: 'none',
			theme: 'default',
			lineHeight: 1.9,
			widthMode: 'full',
		};
		(service as any).currentFlowMode = 'scrolled';
		(service as any).mobileSectionUrlStrategyInUse = 'original';
		(service as any).foliateView = { goTo: vi.fn(async () => {}) };

		await withPlatformIsMobile(true, async () => {
			await (service as any).ensureMobileRenderableContent('OPS/text/chapter1.xhtml#sec-1');
		});

		expect(waitForRenderableContentInspection).toHaveBeenCalledTimes(2);
		expect(rebuild).toHaveBeenCalledWith('data-url');
		expect(performRender).toHaveBeenCalledTimes(1);
		expect((service as any).forcedMobileSectionUrlStrategy).toBe('data-url');
		expect((service as any).mobileBlankRecoveryTrail).toEqual([]);
		expect((service as any).foliateView.goTo).toHaveBeenCalledWith('OPS/text/chapter1.xhtml#sec-1');
	});

	it('switches blank mobile paginated rendering to scrolled flow before retrying URL strategies', async () => {
		const service = await createService();
		const setLayoutMode = vi.spyOn(service, 'setLayoutMode').mockResolvedValue(undefined);
		const waitForRenderableContentInspection = vi
			.spyOn(service as any, 'waitForRenderableContentInspection')
			.mockResolvedValueOnce({
				renderable: false,
				documents: 1,
				textDocuments: 1,
				visibleTextDocuments: 0,
				visibleMediaDocuments: 0,
			})
			.mockResolvedValueOnce({
				renderable: true,
				documents: 1,
				textDocuments: 1,
				visibleTextDocuments: 1,
				visibleMediaDocuments: 0,
			});

		(service as any).currentFlowMode = 'paginated';
		(service as any).renderContainer = document.createElement('div');
		(service as any).foliateView = { goTo: vi.fn(async () => {}) };

		await withPlatformIsMobile(true, async () => {
			await (service as any).ensureMobileRenderableContent('OPS/text/chapter1.xhtml#sec-1');
		});

		expect(waitForRenderableContentInspection).toHaveBeenCalledTimes(2);
		expect(setLayoutMode).toHaveBeenCalledWith('paginated', 'scrolled', {
			theme: (service as any).currentTheme,
			lineHeight: (service as any).currentLineHeight,
		});
		expect((service as any).foliateView.goTo).toHaveBeenCalledWith('OPS/text/chapter1.xhtml#sec-1');
	});

	it('recovers to a readable section on mobile when a legacy fallback target lands on non-primary content', async () => {
		const service = await createService();
		const goTo = vi.fn(async () => {});
		const ensureMobileRenderableContent = vi
			.spyOn(service as any, 'ensureMobileRenderableContent')
			.mockResolvedValue(undefined);

		(service as any).foliateView = {
			goTo,
			goToTextStart: vi.fn(async () => {}),
		};

		vi.spyOn(service as any, 'resolveNavigationTarget').mockResolvedValue({
			target: 0,
			kind: 'section-fallback',
			sectionIndex: 0,
			canonicalCfi: 'epubcfi(/6/2)',
		});
		vi.spyOn(service as any, 'inspectPrimaryReadingSection').mockResolvedValue({
			isPrimary: false,
			reason: 'toc-like',
			href: 'OPS/nav.xhtml',
			linear: 'yes',
			textLength: 32,
		});
		vi.spyOn(service as any, 'findNearestPrimarySectionIndex').mockResolvedValue(1);

		await withPlatformIsMobile(true, async () => {
			await service.goToLocation('epubcfi(/6/2!/4/2)');
		});

		expect(goTo).toHaveBeenNthCalledWith(1, 0);
		expect(goTo).toHaveBeenNthCalledWith(2, 1);
		expect(ensureMobileRenderableContent).toHaveBeenNthCalledWith(1, 0);
		expect(ensureMobileRenderableContent).toHaveBeenNthCalledWith(2, 1);
	});

	it('uses direct href navigation for table-of-contents jumps', async () => {
		const service = await createService();
		const goTo = vi.fn(async () => {});

		(service as any).foliateView = {
			goTo,
		};

		await service.goToLocation('OPS/text/chapter1.xhtml#sec-1');

		expect(goTo).toHaveBeenCalledWith('OPS/text/chapter1.xhtml#sec-1');
	});

	it('expands section-level CFIs before rendering foliate highlights', async () => {
		const service = await createService();
		const sectionBaseCfi = (service as any).currentFoliateBook.sections[0].cfi;
		const addAnnotation = vi.fn(async () => {});

		(service as any).foliateView = {
			addAnnotation,
			deleteAnnotation: async () => {},
		};

		await (service as any).addResolvedHighlight({
			cfiRange: sectionBaseCfi,
			color: 'yellow',
			text: 'Selection text for testing.',
		});

		expect(addAnnotation).toHaveBeenCalledTimes(1);
		expect(addAnnotation.mock.calls[0]?.[0]?.value).toContain('!');
	});

	it('re-renders visible foliate highlights after relocate events', async () => {
		const service = await createService();
		const { cfi, doc } = await getParagraphSelectionCfi(service);
		const addAnnotation = vi.fn(async () => {});
		const deleteAnnotation = vi.fn(async () => {});
		const fakeView = document.createElement('div') as HTMLElement & {
			renderer?: { getContents: () => Array<{ doc: Document; index: number }> };
			addAnnotation: typeof addAnnotation;
			deleteAnnotation: typeof deleteAnnotation;
			open: () => Promise<void>;
			goTo: () => Promise<void>;
			search: () => AsyncGenerator<unknown, void, unknown>;
		};

		(fakeView as any).renderer = {
			getContents: () => [{ doc, index: 0 }],
		};
		(fakeView as any).addAnnotation = addAnnotation;
		(fakeView as any).deleteAnnotation = deleteAnnotation;
		(fakeView as any).open = async () => {};
		(fakeView as any).goTo = async () => {};
		(fakeView as any).search = async function* () {};

		(service as any).foliateView = fakeView;
		(service as any).bindViewListeners(fakeView);

		await service.applyHighlights([{
			cfiRange: cfi,
			color: 'purple',
			text: 'Selection text for testing.',
		}]);

		addAnnotation.mockClear();
		deleteAnnotation.mockClear();

		fakeView.dispatchEvent(new CustomEvent('relocate', {
			detail: {
				cfi,
				fraction: 0.5,
				location: {
					current: 0,
					total: 1,
				},
				section: {
					current: 0,
					total: 1,
				},
			},
		}));

		await new Promise((resolve) => setTimeout(resolve, 60));

		expect(deleteAnnotation).toHaveBeenCalledTimes(1);
		expect(addAnnotation).toHaveBeenCalledTimes(1);
		expect(addAnnotation).toHaveBeenCalledWith(expect.objectContaining({
			value: cfi,
			color: 'purple',
		}));
	});

	it('emits stronger foliate highlight overlay variables for dark mode', async () => {
		const service = await createService();
		document.body.classList.add('theme-dark');

		const styles = (service as any).buildReaderStyles();

		expect(styles).toContain('--overlayer-highlight-opacity: 0.56');
		expect(styles).toContain('--overlayer-highlight-blend-mode: screen');
	});

	it('forces stubborn epub text styles to inherit the reader theme', async () => {
		const service = await createService();

		const styles = (service as any).buildReaderStyles();

		expect(styles).toContain('color: inherit !important;');
		expect(styles).toContain('font-family: inherit !important;');
		expect(styles).toContain('line-height: inherit !important;');
		expect(styles).toContain('background-color: transparent !important;');
	});

	it('normalizes inline epub colors fonts and backgrounds on loaded chapter documents', async () => {
		const service = await createService();
		const doc = new DOMParser().parseFromString(
			`<html xmlns="http://www.w3.org/1999/xhtml"><body>
				<div id="box" style="color: #111; font-family: 'Courier New'; background: #fff;">
					<font id="legacy-font" color="#222" face="Times New Roman">Styled text</font>
				</div>
				<img id="cover" style="background: #fff;" />
			</body></html>`,
			'application/xhtml+xml',
		);

		(service as any).applyDocumentThemeOverrides(doc);

		const box = doc.querySelector('#box') as Element & { style: CSSStyleDeclaration };
		const legacyFont = doc.querySelector('#legacy-font') as Element & { style: CSSStyleDeclaration };
		const cover = doc.querySelector('#cover') as Element & { style: CSSStyleDeclaration };

		expect(box.style.getPropertyValue('color')).toBe('inherit');
		expect(box.style.getPropertyPriority('color')).toBe('');
		expect(box.style.getPropertyValue('font-family')).toBe('inherit');
		expect(box.style.getPropertyPriority('font-family')).toBe('');
		expect(box.style.getPropertyValue('background-color')).toBe('transparent');
		expect(box.style.getPropertyPriority('background-color')).toBe('');
		expect(legacyFont.getAttribute('color')).toBeNull();
		expect(legacyFont.getAttribute('face')).toBeNull();
		expect(legacyFont.style.getPropertyValue('color')).toBe('inherit');
		expect(legacyFont.style.getPropertyValue('font-family')).toBe('inherit');
		expect(cover.style.getPropertyValue('background-color')).toBe('rgb(255, 255, 255)');
		expect(cover.style.getPropertyPriority('background-color')).toBe('');
		expect(doc.documentElement.getAttribute('data-weave-epub-theme-overrides')).toBe('true');
		expect((doc.adoptedStyleSheets?.length ?? 0) > 0 || !!doc.documentElement.style.getPropertyValue('background')).toBe(true);
	});

	it('inlines blob stylesheet links inside foliate HTML resources', async () => {
		const service = await createService();
		const resourceReaderMock = vi
			.spyOn(service as any, 'readTextResource')
			.mockResolvedValue('body { color: rgb(10, 20, 30); }');

		const transformed = await (service as any).inlineFoliateBlobStylesheets(
			`<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="blob:test-style" /></head><body><p>Styled</p></body></html>`,
			'application/xhtml+xml',
			'OPS/text/chapter1.xhtml',
		);

		expect(resourceReaderMock).toHaveBeenCalledWith('blob:test-style');
		expect(transformed).toContain('data-weave-inline-stylesheet');
		expect(transformed).toContain('rel="stylesheet"');
		expect(transformed).toContain('data:text/css;charset=utf-8,');
		expect(transformed).toContain('rgb(10%2C%2020%2C%2030)');
	});

	it('inlines blob stylesheet @import rules to avoid CSP violations', async () => {
		const service = await createService();
		const resourceReaderMock = vi.spyOn(service as any, 'readTextResource').mockImplementation(async (href: string) => {
			if (href === 'blob:test-style') {
				return '@import "blob:test-import"; body { color: rgb(10, 20, 30); }';
			}
			if (href === 'blob:test-import') {
				return 'p { font-weight: 700; }';
			}
			throw new Error(`Unexpected href: ${href}`);
		});

		const transformed = await (service as any).inlineFoliateBlobStylesheets(
			`<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="blob:test-style" /></head><body><p>Styled</p></body></html>`,
			'application/xhtml+xml',
			'OPS/text/chapter1.xhtml',
		);

		expect(resourceReaderMock).toHaveBeenCalledWith('blob:test-style');
		expect(resourceReaderMock).toHaveBeenCalledWith('blob:test-import');
		expect(transformed).not.toContain('@import "blob:test-import"');
		expect(transformed).not.toContain('blob:test-import');
		expect(transformed).toContain('font-weight%3A%20700');
		expect(transformed).toContain('rgb(10%2C%2020%2C%2030)');
	});

	it('maps foliate search results into the reader search contract', async () => {
		const service = await createService();
		const searchCfi = 'epubcfi(/6/2!/4/4[para-1],/1:0,/1:27)';
		(service as any).foliateView = {
			search: async function* () {
				yield {
					label: 'Chapter 1',
					subitems: [
						{
							cfi: searchCfi,
							excerpt: 'Selection text for testing.',
						},
					],
				};
				yield 'done';
			},
			getTOCItemOf: async () => ({ label: 'Chapter 1' }),
			clearSearch: () => {},
		};

		const results = await service.searchText('Selection text for testing');

		expect(results).toHaveLength(1);
		expect(results[0]?.cfi).toBe(searchCfi);
		expect(results[0]?.chapterTitle).toBe('Chapter 1');
		expect(results[0]?.excerpt).toContain('Selection text for testing');
	});

	it('bridges foliate highlight clicks back into the existing toolbar callbacks', async () => {
		const service = await createService();
		const { cfi, doc } = await getParagraphSelectionCfi(service);
		const range = createParagraphRange(doc);
		const renditionMarkClicked = vi.fn();
		const highlightClick = vi.fn();
		const fakeView = document.createElement('div') as HTMLElement & {
			open: () => Promise<void>;
			goTo: () => Promise<void>;
			search: () => AsyncGenerator<unknown, void, unknown>;
			addAnnotation: () => Promise<void>;
			deleteAnnotation: () => Promise<void>;
		};

		(fakeView as any).open = async () => {};
		(fakeView as any).goTo = async () => {};
		(fakeView as any).search = async function* () {};
		(fakeView as any).addAnnotation = async () => {};
		(fakeView as any).deleteAnnotation = async () => {};

		(service as any).foliateView = fakeView;
		(service as any).bindViewListeners(fakeView);
		(service as any).highlightDataMap.set((service as any).normalizeHighlightKey(cfi), {
			cfiRange: cfi,
			color: 'blue',
			text: 'Selection text for testing.',
			sourceFile: 'Notes/sample.md',
		});

		(service.getRendition() as any).on('markClicked', renditionMarkClicked);
		service.onHighlightClick(highlightClick);

		fakeView.dispatchEvent(new CustomEvent('show-annotation', {
			detail: {
				value: cfi,
				index: 0,
				range,
			},
		}));

		expect(renditionMarkClicked).toHaveBeenCalledWith(
			cfi,
			expect.objectContaining({
				color: 'blue',
				text: 'Selection text for testing.',
				sourceFile: 'Notes/sample.md',
			}),
			expect.objectContaining({
				document: doc,
			}),
		);
		expect(highlightClick).toHaveBeenCalledWith(expect.objectContaining({
			cfiRange: cfi,
			color: 'blue',
			text: 'Selection text for testing.',
			sourceFile: 'Notes/sample.md',
			rect: expect.objectContaining({
				top: 15,
				left: 20,
				width: 120,
				height: 26,
			}),
		}));
	});

	it('stores relocate progress as a 0-100 percentage for the existing reader UI', async () => {
		const service = await createService();

		(service as any).handleRelocate({
			cfi: 'epubcfi(/6/2!/4/2)',
			fraction: 0.25,
			location: {
				current: 4,
				total: 12,
			},
			section: {
				current: 0,
				total: 1,
			},
		});

		expect(service.getReadingProgress()).toBe(25);
		expect(service.getCurrentPosition()).toMatchObject({
			chapterIndex: 0,
			cfi: 'epubcfi(/6/2!/4/2)',
			percent: 25,
		});
		expect(await service.getPaginationInfo()).toMatchObject({
			currentPage: 5,
			totalPages: 12,
		});
	});
});
