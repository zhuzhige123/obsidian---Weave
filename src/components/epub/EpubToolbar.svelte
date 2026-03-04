<script lang="ts">
	import { setIcon } from 'obsidian';
	import type { EpubBook, EpubReaderSettings, EpubTheme, EpubFontFamily } from '../../services/epub';

	interface Props {
		book: EpubBook | null;
		chapterTitle: string;
		sidebarVisible: boolean;
		settings: EpubReaderSettings;
		settingsVisible: boolean;
		hidden: boolean;
		onToggleSidebar: () => void;
		onToggleSettings: () => void;
		onThemeChange: (theme: EpubTheme) => void;
		onFontSizeChange: (delta: number) => void;
		onFontFamilyChange: (family: EpubFontFamily) => void;
	}

	let {
		book,
		chapterTitle,
		sidebarVisible,
		settings,
		settingsVisible,
		hidden,
		onToggleSidebar,
		onToggleSettings,
		onThemeChange,
		onFontSizeChange,
		onFontFamilyChange
	}: Props = $props();

	function icon(node: HTMLElement, name: string) {
		setIcon(node, name);
		return {
			update(newName: string) {
				node.innerHTML = '';
				setIcon(node, newName);
			}
		};
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (settingsVisible && !target.closest('.epub-settings-container')) {
			onToggleSettings();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<header
	class="epub-top-bar epub-glass-panel"
	class:hidden
	onclick={handleClickOutside}
>
	<div class="bar-left">
		<button
			class="epub-icon-btn"
			class:active={sidebarVisible}
			onclick={onToggleSidebar}
			title="Toggle sidebar"
		>
			<span use:icon={'panel-left'}></span>
		</button>
	</div>

	<div class="bar-center">
		<span class="chapter-title">
			{chapterTitle || book?.metadata.title || ''}
		</span>
	</div>

	<div class="bar-right">
		<button class="epub-icon-btn" title="Search">
			<span use:icon={'search'}></span>
		</button>

		<div class="epub-settings-container">
			<button
				class="epub-icon-btn"
				class:active={settingsVisible}
				onclick={(e: MouseEvent) => { e.stopPropagation(); onToggleSettings(); }}
				title="Display settings"
			>
				<span use:icon={'a-large-small'}></span>
			</button>

			<div class="epub-settings-popover epub-glass-panel" class:visible={settingsVisible}>
				<div class="epub-settings-row">
					<span class="label">Eye care</span>
					<button
						class="epub-sepia-toggle"
						class:active={settings.theme === 'sepia'}
						onclick={() => onThemeChange(settings.theme === 'sepia' ? 'default' : 'sepia')}
						title="Toggle sepia mode"
					>
						<span use:icon={'sun'}></span>
					</button>
				</div>

				<div class="epub-settings-row">
					<span class="label">Font size</span>
					<div class="epub-stepper">
						<button class="epub-stepper-btn" aria-label="Decrease font size" onclick={() => onFontSizeChange(-1)}>
							<span use:icon={'minus'}></span>
						</button>
						<span class="epub-stepper-val">{settings.fontSize}</span>
						<button class="epub-stepper-btn" aria-label="Increase font size" onclick={() => onFontSizeChange(1)}>
							<span use:icon={'plus'}></span>
						</button>
					</div>
				</div>

				<div class="epub-settings-row">
					<span class="label">Font</span>
					<select
						class="epub-font-select"
						value={settings.fontFamily}
						onchange={(e: Event) => onFontFamilyChange((e.target as HTMLSelectElement).value as EpubFontFamily)}
					>
						<option value="serif">Serif</option>
						<option value="sans">Sans</option>
					</select>
				</div>
			</div>
		</div>
	</div>
</header>
