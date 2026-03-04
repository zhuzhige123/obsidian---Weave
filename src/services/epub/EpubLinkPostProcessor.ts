import type { App } from 'obsidian';
import { MarkdownPostProcessorContext } from 'obsidian';
import { EpubLinkService } from './EpubLinkService';
import { logger } from '../../utils/logger';

export function registerEpubLinkPostProcessor(app: App): void {
	// placeholder
}

export function createEpubLinkPostProcessor(app: App) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const links = el.querySelectorAll('a');

		links.forEach((linkEl) => {
			const href = linkEl.getAttribute('href') || linkEl.getAttribute('data-href') || '';

			// New wikilink format: [[book.epub#weave-cfi=...]]
			if (href.match(/\.epub#weave-cfi=/) || (linkEl.classList.contains('internal-link') && href.match(/\.epub/))) {
				const hashIdx = href.indexOf('#');
				if (hashIdx === -1 || !href.includes('weave-cfi=')) return;

				const filePath = href.substring(0, hashIdx);
				const subpath = href.substring(hashIdx);
				const parsed = EpubLinkService.parseEpubLink(subpath);
				if (!parsed) return;

				styleEpubLink(linkEl, linkEl.textContent || filePath.split('/').pop()?.replace(/\.epub$/i, '') || 'EPUB');

				linkEl.addEventListener('click', async (e) => {
					e.preventDefault();
					e.stopPropagation();
					const linkService = new EpubLinkService(app);
					await linkService.navigateToEpubLocation(filePath, parsed.cfi, parsed.text);
				});
				return;
			}

			// Legacy protocol format: obsidian://weave-epub?...
			if (!href.includes('weave-epub')) return;

			try {
				const url = new URL(href.startsWith('obsidian://') ? href : `obsidian://${href}`);
				const params = Object.fromEntries(url.searchParams.entries());
				if (!params.file || !params.cfi) return;

				const displayText = params.text
					? decodeURIComponent(params.text)
					: linkEl.textContent || decodeURIComponent(params.file).split('/').pop()?.replace(/\.epub$/i, '') || 'EPUB';
				styleEpubLink(linkEl, displayText);
			} catch (_e) {
				// skip malformed links
			}
		});
	};
}

function styleEpubLink(linkEl: Element, displayText: string): void {
	linkEl.addClass('weave-epub-link');
	linkEl.removeClass('external-link');
	linkEl.empty();

	(linkEl as HTMLElement).createSpan({
		cls: 'weave-epub-link-text',
		text: displayText
	});
}

