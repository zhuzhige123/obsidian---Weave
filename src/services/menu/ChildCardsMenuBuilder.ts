import { Menu } from 'obsidian';
import type { Deck } from '../../data/types';
import { logger } from '../../utils/logger';

/**
 * 子卡片操作菜单配置
 */
export interface ChildCardsMenuConfig {
  selectedCount: number;
  isRegenerating: boolean;
  showDeckSelector: boolean;
  availableDecks: Array<{ id: string; name: string }>;
  selectedDeckId: string;
}

/**
 * 子卡片操作菜单回调
 */
export interface ChildCardsMenuCallbacks {
  onReturn: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  onDeckChange: (deckId: string) => void;
}

/**
 * 子卡片操作菜单构建器
 * 用于 AI 拆分后的子卡片操作，使用 Obsidian Menu API
 */
export class ChildCardsMenuBuilder {
  constructor(
    private config: ChildCardsMenuConfig,
    private callbacks: ChildCardsMenuCallbacks
  ) {}

  /**
   * 显示牌组选择菜单
   */
  showDeckSelectMenu(position: { x: number; y: number }): void {
    try {
      const menu = new Menu();

      // 标题
      menu.addItem((item) => {
        item
          .setTitle('选择目标牌组')
          .setDisabled(true);
      });
      menu.addSeparator();

      const { availableDecks, selectedDeckId } = this.config;

      if (!availableDecks || availableDecks.length === 0) {
        menu.addItem((item) => {
          item.setTitle('暂无可用牌组').setDisabled(true);
        });
      } else {
        availableDecks.forEach((deck) => {
          menu.addItem((item) => {
            item
              .setTitle(deck.name)
              .setIcon('folder')
              .setChecked(deck.id === selectedDeckId)
              .onClick(() => {
                this.safeCallback(() => this.callbacks.onDeckChange(deck.id));
              });
          });
        });
      }

      menu.showAtPosition(position);
      logger.debug('[ChildCardsMenuBuilder] 牌组选择菜单已显示');
    } catch (error) {
      logger.error('[ChildCardsMenuBuilder] 牌组选择菜单构建失败:', error);
    }
  }

  /**
   * 显示完整操作菜单（移动端使用）
   */
  showFullMenu(position: { x: number; y: number }): void {
    try {
      const menu = new Menu();
      const { selectedCount, isRegenerating, showDeckSelector, selectedDeckId, availableDecks } = this.config;

      // 标题
      menu.addItem((item) => {
        item
          .setTitle('子卡片操作')
          .setDisabled(true);
      });
      menu.addSeparator();

      // 1. 选择目标牌组（仅在 AI 拆分模式显示）
      if (showDeckSelector && availableDecks.length > 0) {
        const currentDeck = availableDecks.find(d => d.id === selectedDeckId);
        menu.addItem((item) => {
          item
            .setTitle(`目标牌组: ${currentDeck?.name || '未选择'}`)
            .setIcon('folder');
          const submenu = (item as any).setSubmenu();
          this.buildDeckSubmenu(submenu);
        });
        menu.addSeparator();
      }

      // 2. 返回
      menu.addItem((item) => {
        item
          .setTitle('返回')
          .setIcon('arrow-left')
          .onClick(() => {
            this.safeCallback(() => this.callbacks.onReturn());
          });
      });

      // 3. 重新生成
      menu.addItem((item) => {
        item
          .setTitle(isRegenerating ? '正在生成...' : '重新生成')
          .setIcon('refresh-cw')
          .setDisabled(isRegenerating)
          .onClick(() => {
            if (!isRegenerating) {
              this.safeCallback(() => this.callbacks.onRegenerate());
            }
          });
      });

      // 4. 收入卡片
      const canSave = selectedCount > 0 && !isRegenerating && (!showDeckSelector || selectedDeckId);
      menu.addItem((item) => {
        item
          .setTitle(`收入 ${selectedCount} 张卡片`)
          .setIcon('save')
          .setDisabled(!canSave)
          .onClick(() => {
            if (canSave) {
              this.safeCallback(() => this.callbacks.onSave());
            }
          });
      });

      menu.showAtPosition(position);
      logger.debug('[ChildCardsMenuBuilder] 完整操作菜单已显示');
    } catch (error) {
      logger.error('[ChildCardsMenuBuilder] 完整操作菜单构建失败:', error);
    }
  }

  /**
   * 构建牌组子菜单
   */
  private buildDeckSubmenu(menu: Menu): void {
    const { availableDecks, selectedDeckId } = this.config;

    if (!availableDecks || availableDecks.length === 0) {
      menu.addItem((item) => {
        item.setTitle('暂无可用牌组').setDisabled(true);
      });
      return;
    }

    availableDecks.forEach((deck) => {
      menu.addItem((item) => {
        item
          .setTitle(deck.name)
          .setIcon('folder')
          .setChecked(deck.id === selectedDeckId)
          .onClick(() => {
            this.safeCallback(() => this.callbacks.onDeckChange(deck.id));
          });
      });
    });
  }

  /**
   * 安全执行回调
   */
  private safeCallback(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      logger.error('[ChildCardsMenuBuilder] 回调执行失败:', error);
    }
  }
}
