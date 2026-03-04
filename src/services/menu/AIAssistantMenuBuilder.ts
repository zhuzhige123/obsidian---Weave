import { Menu } from 'obsidian';
import { get } from 'svelte/store';
import type { WeavePlugin } from '../../main';
import type { Card } from '../../data/types';
import type { AIAction } from '../../types/ai-types';
//  导入DerivationMethod
import { DerivationMethod } from '../relation/types';
import { logger } from '../../utils/logger';
//  导入AI配置Store
import { customActionsForMenu } from '../../stores/ai-config.store';

/**
 * AI助手菜单构建器
 * 负责构建和显示AI助手的多级菜单
 */
export class AIAssistantMenuBuilder {
  constructor(
    private plugin: WeavePlugin,
    private card: Card,
    private onAIFormatCustom: (actionId: string) => void,
    private onSplitCard: (actionId: string) => void,
    private onManageActions: () => void
  ) {}

  /**
   * 🆕 检查卡片是否为子卡片（已拆分的卡片）
   */
  private isChildCard(card: Card): boolean {
    // 方法1: 检查是否有父卡片ID
    if (card.parentCardId) {
      return true;
    }
    
    // 方法2: 检查关系元数据
    if (card.relationMetadata) {
      // 如果明确标记为非父卡片，则为子卡片
      if (card.relationMetadata.isParent === false) {
        return true;
      }
      
      // 如果有派生元数据且方法为AI拆分，则为子卡片
      if (card.relationMetadata.derivationMetadata?.method === DerivationMethod.AI_SPLIT) {
        return true;
      }
    }
    
    return false;
  }

  //  refreshMenuData已移除，Store自动保持最新数据

  /**
   * 显示主菜单（使用悬停展开子菜单）
   */
  showMainMenu(evt: MouseEvent): void {
    const menu = new Menu();

    // AI格式化 - 悬停展开子菜单
    menu.addItem((item) => {
      item.setTitle('AI格式化');
      const formatSubmenu = (item as any).setSubmenu();
      this.buildFormatSubmenu(formatSubmenu);
    });

    // AI拆分（仅对非子卡片显示）- 悬停展开子菜单
    if (!this.isChildCard(this.card)) {
      menu.addItem((item) => {
        item.setTitle('AI拆分');
        const splitSubmenu = (item as any).setSubmenu();
        this.buildSplitSubmenu(splitSubmenu);
      });
    }

    menu.showAtMouseEvent(evt);
  }

  /**
   * 构建AI格式化子菜单内容
   */
  private buildFormatSubmenu(menu: Menu): void {
    const actions = this.getFormatActions();

    // 添加所有格式化功能
    actions.forEach((action) => {
      menu.addItem((item) => {
        item
          .setTitle(action.name)
          .onClick(() => {
            this.onAIFormatCustom(action.id);
          });
      });
    });

    // 添加分隔线和管理设置
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle('管理功能...')
        .onClick(() => {
          this.onManageActions();
        });
    });
  }

  /**
   * 构建AI拆分子菜单内容
   */
  private buildSplitSubmenu(menu: Menu): void {
    const actions = this.getSplitActions();

    logger.debug('[AIAssistantMenuBuilder] 构建AI拆分子菜单');
    logger.debug('[AIAssistantMenuBuilder] 可用的拆分功能数量:', actions.length);

    // 添加所有拆分功能
    if (actions.length === 0) {
      logger.warn('[AIAssistantMenuBuilder] ⚠️ 警告: 没有可用的AI拆分功能');
      menu.addItem((item) => {
        item
          .setTitle('暂无可用功能')
          .setDisabled(true);
      });
    } else {
      actions.forEach((action) => {
        menu.addItem((item) => {
          item
            .setTitle(action.name)
            .onClick(() => {
              logger.debug('[AIAssistantMenuBuilder] 用户点击拆分功能:', { id: action.id, name: action.name });
              this.onSplitCard(action.id);
            });
        });
      });
    }

    // 添加分隔线和管理设置
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle('管理功能...')
        .onClick(() => {
          this.onManageActions();
        });
    });
  }

  /**
   *  获取所有格式化功能（直接从Store读取）
   */
  private getFormatActions(): AIAction[] {
    const actions = get(customActionsForMenu);
    return actions.format;
  }

  /**
   *  获取所有拆分功能（直接从Store读取）
   */
  private getSplitActions(): AIAction[] {
    const actions = get(customActionsForMenu);
    return actions.split;
  }
}
