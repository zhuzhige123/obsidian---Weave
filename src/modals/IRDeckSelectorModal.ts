import { SuggestModal, setIcon, type App } from 'obsidian';
import type { IRDeck } from '../types/ir-types';

export class IRDeckSelectorModal extends SuggestModal<IRDeck> {
  private decks: IRDeck[];
  private onSelect: (deck: IRDeck) => void;

  constructor(app: App, decks: IRDeck[], onSelect: (deck: IRDeck) => void) {
    super(app);
    this.decks = decks;
    this.onSelect = onSelect;

    this.setPlaceholder('搜索增量阅读牌组...');
    this.setInstructions([
      { command: '↑↓', purpose: '导航' },
      { command: '↵', purpose: '选择' },
      { command: 'esc', purpose: '关闭' }
    ]);
  }

  getSuggestions(query: string): IRDeck[] {
    if (!query) return this.decks;
    const q = query.toLowerCase();
    return this.decks.filter((d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }

  renderSuggestion(deck: IRDeck, el: HTMLElement): void {
    el.addClass('weave-ir-deck-suggestion');

    const row = el.createDiv({ cls: 'weave-ir-deck-suggestion-row' });
    const iconEl = row.createSpan({ cls: 'weave-ir-deck-suggestion-icon' });
    setIcon(iconEl, 'folder');

    row.createSpan({ text: deck.name, cls: 'weave-ir-deck-suggestion-name' });

    const meta = el.createDiv({ cls: 'weave-ir-deck-suggestion-meta' });
    meta.createSpan({ text: deck.id, cls: 'weave-ir-deck-suggestion-id' });
  }

  onChooseSuggestion(deck: IRDeck, _evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(deck);
  }
}
