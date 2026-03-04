/**
 * 数据迁移确认模态窗
 * 使用 Obsidian 原生 Modal API
 */

import { Modal, App, Setting } from 'obsidian';
import type { WeavePlugin } from '../../main';
import { logger } from '../../utils/logger';

export interface MigrationStats {
  total: number;
  needsMigration: number;
  alreadyMigrated: number;
}

export class MigrationConfirmModal extends Modal {
  private plugin: WeavePlugin;
  private stats: MigrationStats;
  private onConfirm: () => Promise<void>;
  private onSkip: () => void;

  constructor(
    app: App,
    plugin: WeavePlugin,
    stats: MigrationStats,
    onConfirm: () => Promise<void>,
    onSkip: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.stats = stats;
    this.onConfirm = onConfirm;
    this.onSkip = onSkip;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weave-migration-modal');

    // 标题
    contentEl.createEl('h2', { text: '数据格式升级' });

    // 说明文字
    const descEl = contentEl.createEl('div', { cls: 'migration-description' });
    descEl.createEl('p', {
      text: '检测到部分卡片需要升级到新的 YAML 元数据格式。升级后，卡片的来源文档、标签、牌组等信息将统一存储在卡片内容中。'
    });

    // 统计信息
    const statsEl = contentEl.createEl('div', { cls: 'migration-stats' });
    
    new Setting(statsEl)
      .setName('总卡片数')
      .setDesc(`${this.stats.total} 张`);
    
    new Setting(statsEl)
      .setName('需要升级')
      .setDesc(`${this.stats.needsMigration} 张`);
    
    new Setting(statsEl)
      .setName('已是新格式')
      .setDesc(`${this.stats.alreadyMigrated} 张`);

    // 提示
    const tipEl = contentEl.createEl('div', { cls: 'migration-tip' });
    tipEl.createEl('p', {
      text: '升级过程通常很快完成，期间请勿关闭 Obsidian。',
      cls: 'mod-warning'
    });

    // 按钮区域
    const buttonContainer = contentEl.createEl('div', { cls: 'migration-buttons' });
    
    // 跳过按钮
    const skipBtn = buttonContainer.createEl('button', { 
      text: '稍后升级',
      cls: 'mod-muted'
    });
    skipBtn.addEventListener('click', () => {
      this.onSkip();
      this.close();
    });

    // 确认按钮
    const confirmBtn = buttonContainer.createEl('button', { 
      text: '立即升级',
      cls: 'mod-cta'
    });
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '升级中...';
      skipBtn.disabled = true;
      
      try {
        await this.onConfirm();
        this.close();
      } catch (error) {
        logger.error('[Migration] 迁移失败:', error);
        confirmBtn.textContent = '升级失败，请重试';
        confirmBtn.disabled = false;
        skipBtn.disabled = false;
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 样式
const styles = `
.weave-migration-modal {
  padding: 20px;
}

.weave-migration-modal h2 {
  margin-top: 0;
  margin-bottom: 16px;
}

.weave-migration-modal .migration-description {
  margin-bottom: 16px;
  color: var(--text-muted);
}

.weave-migration-modal .migration-stats {
  background: var(--background-secondary);
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 16px;
}

.weave-migration-modal .migration-stats .setting-item {
  border: none;
  padding: 4px 8px;
}

.weave-migration-modal .migration-tip {
  margin-bottom: 20px;
}

.weave-migration-modal .migration-tip .mod-warning {
  color: var(--text-warning);
  font-size: 0.9em;
}

.weave-migration-modal .migration-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
