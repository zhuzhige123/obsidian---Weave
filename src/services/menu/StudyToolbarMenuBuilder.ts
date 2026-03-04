import { Menu } from 'obsidian';
import type { Card, Deck } from '../../data/types';
import type { AIAction } from '../../types/ai-types';
import { getCardDeckIds } from '../../utils/yaml-utils';
import { logger } from '../../utils/logger';

/**
 * 菜单构建器配置
 */
export interface MenuBuilderConfig {
  card: Card;
  decks: Deck[];
  isPremium: boolean;
  isGraphLinked: boolean;
  hasSourceFile: boolean;
  currentPriority: number;
  enableDirectDelete: boolean;
  showTimingInfo?: boolean; // 🆕 计时信息栏是否展开
  aiActions: {
    format: AIAction[];
    testGen: AIAction[];
    split: AIAction[];
  };
}

/**
 * 菜单回调函数
 */
export interface MenuCallbacks {
  onToggleEdit: () => void;
  onDelete: (skipConfirm?: boolean) => void;
  onRemoveFromDeck?: () => void; // 🆕 v2.0 从牌组移除（引用式牌组系统）
  onSetReminder: () => void;
  onChangePriority: (priority: number) => void;
  onChangeDeck: (deckId: string) => void | Promise<void>;
  onRecycleCard: () => void;
  onAIFormatCustom: (actionId: string) => void;
  onTestGenerate: (actionId: string) => void;
  onSplitCard: (actionId: string) => void;
  onOpenAIConfig: () => void;
  onGraphLinkToggle: (enabled: boolean) => void;
  onOpenDetailedView: () => void;
  onOpenSourceBlock: () => void;
  onToggleTimingInfo?: () => void; // 🆕 切换计时信息栏
}

/**
 * 优先级选项定义
 */
const PRIORITY_OPTIONS = [
  { value: 1, label: '低优先级', icon: '!' },
  { value: 2, label: '中优先级', icon: '!!' },
  { value: 3, label: '高优先级', icon: '!!!' },
  { value: 4, label: '紧急', icon: '!!!!' }
] as const;

/**
 * 学习界面工具栏菜单构建器
 * 使用 Obsidian Menu API 构建原生风格的功能菜单
 */
export class StudyToolbarMenuBuilder {
  private lastMenuPosition: { x: number; y: number } | null = null;

  constructor(
    private config: MenuBuilderConfig,
    private callbacks: MenuCallbacks
  ) {}

  /**
   * 构建并显示完整菜单（计时信息已移至顶部信息栏）
   */
  showMenuWithTimer(
    position: { x: number; y: number },
    timerInfo: { currentCardTime: number; averageTime: number; formatTime: (ms: number) => string }
  ): void {
    // 计时信息现在由顶部 MobileTimingInfoBar 显示，菜单中不再显示
    this.showMenu(position);
  }

  /**
   * 构建并显示完整菜单
   */
  showMenu(position: { x: number; y: number }): void {
    try {
      this.lastMenuPosition = position;
      const menu = new Menu();

      // 1. 卡片操作分类
      this.buildCardActionsSection(menu);

      // 2. AI功能分类（仅高级用户）
      if (this.config.isPremium) {
        menu.addSeparator();
        this.buildAISection(menu);
      }

      // 3. 更多功能分类
      menu.addSeparator();
      this.buildMoreSection(menu);

      // 显示菜单
      menu.showAtPosition(position);
      
      logger.debug('[StudyToolbarMenuBuilder] 菜单已显示');
    } catch (error) {
      logger.error('[StudyToolbarMenuBuilder] 菜单构建失败:', error);
    }
  }

  /**
   * 构建卡片操作分类
   * 顺序：编辑卡片、删除卡片、移除卡片、回收卡片、更换牌组、设置提醒、设置优先级
   */
  private buildCardActionsSection(menu: Menu): void {
    // 分类标题
    menu.addItem((item) => {
      item
        .setTitle('卡片操作')
        .setDisabled(true);
    });

    // 1. 编辑卡片
    menu.addItem((item) => {
      item
        .setTitle('编辑卡片')
        .setIcon('edit')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onToggleEdit());
        });
    });

    // 2. 删除卡片
    menu.addItem((item) => {
      item
        .setTitle('删除卡片')
        .setIcon('trash')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onDelete(this.config.enableDirectDelete));
        });
    });

    // 3. 移除卡片（引用式牌组系统）
    if (this.callbacks.onRemoveFromDeck) {
      menu.addItem((item) => {
        item
          .setTitle('移除卡片')
          .setIcon('unlink')
          .onClick(() => {
            this.safeCallback(() => this.callbacks.onRemoveFromDeck?.());
          });
      });
    }

    // 4. 回收卡片
    menu.addItem((item) => {
      item
        .setTitle('回收卡片')
        .setIcon('archive')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onRecycleCard());
        });
    });

    // 5. 更换牌组（子菜单）
    menu.addItem((item) => {
      item
        .setTitle('更换牌组')
        .setIcon('folder');
      const submenu = (item as any).setSubmenu();
      this.buildDeckSubmenu(submenu);
    });

    // 6. 设置提醒
    menu.addItem((item) => {
      item
        .setTitle('设置提醒')
        .setIcon('bell')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onSetReminder());
        });
    });

    // 7. 设置优先级（子菜单）
    menu.addItem((item) => {
      item
        .setTitle('设置优先级')
        .setIcon('star');
      const submenu = (item as any).setSubmenu();
      this.buildPrioritySubmenu(submenu);
    });
  }

  /**
   * 构建AI功能分类
   */
  private buildAISection(menu: Menu): void {
    // 分类标题
    menu.addItem((item) => {
      item
        .setTitle('AI功能')
        .setDisabled(true);
    });

    // AI助手（子菜单）
    menu.addItem((item) => {
      item
        .setTitle('AI助手')
        .setIcon('bot');
      const submenu = (item as any).setSubmenu();
      this.buildAIAssistantSubmenu(submenu);
    });

    // 图谱联动（开关）
    const graphDisabled = !this.config.hasSourceFile;
    menu.addItem((item) => {
      item
        .setTitle('图谱联动')
        .setIcon('link')
        .setChecked(this.config.isGraphLinked)
        .setDisabled(graphDisabled)
        .onClick(() => {
          if (!graphDisabled) {
            this.safeCallback(() => this.callbacks.onGraphLinkToggle(!this.config.isGraphLinked));
          }
        });
    });
  }

  /**
   * 构建更多功能分类
   */
  private buildMoreSection(menu: Menu): void {
    // 分类标题
    menu.addItem((item) => {
      item
        .setTitle('更多')
        .setDisabled(true);
    });

    // 卡片详情
    menu.addItem((item) => {
      item
        .setTitle('卡片详情')
        .setIcon('info')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onOpenDetailedView());
        });
    });

    // 查看源文本
    menu.addItem((item) => {
      item
        .setTitle('查看源文本')
        .setIcon('file-text')
        .setDisabled(!this.config.hasSourceFile)
        .onClick(() => {
          if (this.config.hasSourceFile) {
            this.safeCallback(() => this.callbacks.onOpenSourceBlock());
          }
        });
    });

    // 计时信息栏开关
    if (this.callbacks.onToggleTimingInfo) {
      menu.addItem((item) => {
        item
          .setTitle('计时信息')
          .setIcon('clock')
          .setChecked(this.config.showTimingInfo ?? false)
          .onClick(() => {
            this.safeCallback(() => this.callbacks.onToggleTimingInfo?.());
          });
      });
    }
  }

  /**
   * 构建优先级子菜单
   */
  private buildPrioritySubmenu(menu: Menu): void {
    PRIORITY_OPTIONS.forEach((option) => {
      menu.addItem((item) => {
        item
          .setTitle(`${option.icon} ${option.label}`)
          .setChecked(this.config.currentPriority === option.value)
          .onClick(() => {
            this.safeCallback(() => this.callbacks.onChangePriority(option.value));
          });
      });
    });
  }

  /**
   * 构建AI助手子菜单
   */
  private buildAIAssistantSubmenu(menu: Menu): void {
    const { aiActions } = this.config;

    // 内容优化（格式化功能）
    if (aiActions.format.length > 0) {
      menu.addItem((item) => {
        item.setTitle('内容优化').setDisabled(true);
      });
      aiActions.format.forEach((action) => {
        menu.addItem((item) => {
          item
            .setTitle(action.name)
            .setIcon(action.icon || 'sparkles')
            .onClick(() => {
              this.safeCallback(() => this.callbacks.onAIFormatCustom(action.id));
            });
        });
      });
    }

    // 卡片拆分
    if (aiActions.split.length > 0) {
      if (aiActions.format.length > 0) menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle('卡片拆分').setDisabled(true);
      });
      aiActions.split.forEach((action) => {
        menu.addItem((item) => {
          item
            .setTitle(action.name)
            .setIcon(action.icon || 'scissors')
            .onClick(() => {
              this.safeCallback(() => this.callbacks.onSplitCard(action.id));
            });
        });
      });
    }

    // 管理AI动作
    menu.addSeparator();
    menu.addItem((item) => {
      item
        .setTitle('管理AI动作')
        .setIcon('settings')
        .onClick(() => {
          this.safeCallback(() => this.callbacks.onOpenAIConfig());
        });
    });

    // 无功能时的提示
    if (aiActions.format.length === 0 && aiActions.split.length === 0) {
      menu.addItem((item) => {
        item.setTitle('暂无可用功能').setDisabled(true);
      });
    }
  }

  /**
   * 构建牌组切换子菜单
   */
  private buildDeckSubmenu(menu: Menu): void {
    const { decks, card } = this.config;

    if (!decks || decks.length === 0) {
      menu.addItem((item) => {
        item.setTitle('暂无可用牌组').setDisabled(true);
      });
      return;
    }

    // 🆕 v2.2: 优先从 content YAML 的 we_decks 获取牌组ID（多选）
    const { deckIds } = getCardDeckIds(card, decks);
    const selectedDeckIds = new Set(deckIds);

    // 标题
    menu.addItem((item) => {
      item.setTitle('设置卡片所属牌组').setDisabled(true);
    });
    menu.addSeparator();

    // 牌组列表（复选）
    decks.forEach((deck) => {
      const indent = '  '.repeat(deck.level || 0);
      const isSelected = selectedDeckIds.has(deck.id);

      menu.addItem((item) => {
        item
          .setTitle(`${indent}${deck.name}`)
          .setIcon(isSelected ? 'check-square' : 'square')
          .onClick(() => {
            // 尝试保持菜单可连续点击：点击后异步执行，再在相同位置重开菜单
            const pos = this.lastMenuPosition;

            this.safeCallback(() => {
              Promise.resolve(this.callbacks.onChangeDeck(deck.id)).finally(() => {
                if (pos) {
                  setTimeout(() => {
                    const newMenu = new Menu();
                    this.buildDeckSubmenu(newMenu);
                    newMenu.showAtPosition(pos);
                  }, 0);
                }
              });
            });
          });
      });
    });
  }

  /**
   * 安全执行回调（带错误处理）
   */
  private safeCallback(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      logger.error('[StudyToolbarMenuBuilder] 回调执行失败:', error);
    }
  }
}
