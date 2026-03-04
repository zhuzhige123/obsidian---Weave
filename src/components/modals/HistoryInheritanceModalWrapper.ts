/**
 * 历史继承策略选择弹窗 - Obsidian Modal 包装器
 * 
 * 将 Svelte 组件包装成 Obsidian Modal
 */

import { Modal, App } from 'obsidian';
import { mount, unmount } from 'svelte';
import HistoryInheritanceModal from './HistoryInheritanceModal.svelte';
import type { Card } from '../../data/types';
import type { InheritanceOptions } from '../../services/progressive-cloze';

/**
 * 历史继承弹窗包装器
 */
export class HistoryInheritanceModalWrapper extends Modal {
  private component: any;
  
  constructor(
    app: App,
    private parentCard: Card,
    private clozes: Array<{ ord: number; text: string; hint?: string }>,
    private onConfirm: (options: InheritanceOptions, rememberChoice: boolean) => void
  ) {
    super(app);
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('history-inheritance-modal');
    
    // 挂载 Svelte 组件
    this.component = mount(HistoryInheritanceModal, {
      target: contentEl,
      props: {
        parentCard: this.parentCard,
        clozes: this.clozes,
        onConfirm: (options: InheritanceOptions, rememberChoice: boolean) => {
          this.onConfirm(options, rememberChoice);
          this.close();
        },
        onCancel: () => {
          this.close();
        }
      }
    });
  }
  
  onClose() {
    const { contentEl } = this;
    
    // 卸载 Svelte 组件
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    
    contentEl.empty();
  }
}
