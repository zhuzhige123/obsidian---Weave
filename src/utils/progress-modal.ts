/**
 * 可复用的进度条模态窗
 * 用于显示批量操作（如删除卡片、删除牌组）的进度
 */

import { Modal, type App } from 'obsidian';
import { logger } from './logger';

export interface ProgressModalOptions {
  title: string;
  description?: string;
  total: number;
  /** 是否允许用户取消操作 */
  cancellable?: boolean;
}

/** 注入动画条纹样式（只注入一次） */
let styleInjected = false;
function injectProgressStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .weave-progress-modal .modal-close-button { display: none; }
    .weave-progress-modal .progress-bar-track {
      width: 100%;
      height: 14px;
      background: var(--background-modifier-border);
      border-radius: 7px;
      overflow: hidden;
      margin: 20px 0 12px 0;
      position: relative;
    }
    .weave-progress-modal .progress-bar-fill {
      height: 100%;
      width: 0%;
      border-radius: 7px;
      background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover, var(--interactive-accent)));
      transition: width 0.25s ease;
      position: relative;
      overflow: hidden;
    }
    .weave-progress-modal .progress-bar-fill.animating::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 6px,
        rgba(255,255,255,0.1) 6px,
        rgba(255,255,255,0.1) 12px
      );
      animation: weave-stripe-move 0.6s linear infinite;
    }
    @keyframes weave-stripe-move {
      0% { background-position-x: 0; }
      100% { background-position-x: 17px; }
    }
    .weave-progress-modal .progress-bar-fill.complete {
      background: var(--text-success, #4caf50);
    }
    .weave-progress-modal .progress-bar-fill.error {
      background: var(--text-error, #e53935);
    }
    .weave-progress-modal .progress-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .weave-progress-modal .progress-percentage {
      font-size: 22px;
      font-weight: 600;
      text-align: center;
      color: var(--text-normal);
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }
    .weave-progress-modal .progress-eta {
      text-align: center;
      font-size: 12px;
      color: var(--text-faint);
      margin-bottom: 16px;
      min-height: 18px;
    }
    .weave-progress-modal .progress-desc {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .weave-progress-modal .progress-buttons {
      display: flex;
      justify-content: center;
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
}

export class ProgressModal extends Modal {
  private fillEl!: HTMLDivElement;
  private percentageEl!: HTMLDivElement;
  private statsEl!: HTMLDivElement;
  private etaEl!: HTMLDivElement;
  private descEl!: HTMLDivElement;
  private cancelButton: HTMLButtonElement | null = null;

  private total: number;
  private current = 0;
  private cancelled = false;
  private allowClose = false;
  private options: ProgressModalOptions;
  private startTime = 0;

  constructor(app: App, options: ProgressModalOptions) {
    super(app);
    this.options = options;
    this.total = options.total;
  }

  onOpen() {
    injectProgressStyles();
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('weave-progress-modal');

    this.titleEl.setText(this.options.title);
    this.startTime = Date.now();

    // 描述
    this.descEl = contentEl.createDiv({ cls: 'progress-desc' });
    if (this.options.description) {
      this.descEl.setText(this.options.description);
    }

    // 百分比大数字
    this.percentageEl = contentEl.createDiv({ cls: 'progress-percentage' });
    this.percentageEl.setText('0%');

    // 进度条轨道 + 填充
    const track = contentEl.createDiv({ cls: 'progress-bar-track' });
    this.fillEl = track.createDiv({ cls: 'progress-bar-fill animating' });

    // 统计行 (N / Total)
    this.statsEl = contentEl.createDiv({ cls: 'progress-stats' });
    this.statsEl.innerHTML = `<span>0 / ${this.total}</span><span></span>`;

    // ETA
    this.etaEl = contentEl.createDiv({ cls: 'progress-eta' });

    // 取消按钮
    if (this.options.cancellable) {
      const btnBox = contentEl.createDiv({ cls: 'progress-buttons' });
      this.cancelButton = btnBox.createEl('button', { text: '取消操作' });
      this.cancelButton.onclick = () => {
        this.cancelled = true;
        if (this.cancelButton) {
          this.cancelButton.setText('正在取消...');
          this.cancelButton.disabled = true;
        }
      };
    }

    // 拦截 ESC 和点击背景关闭
    this.scope.register([], 'Escape', (e) => {
      if (!this.allowClose) { e.preventDefault(); return false; }
    });
    this.modalEl.addEventListener('click', (e) => {
      if (!this.allowClose && e.target === this.modalEl) { e.stopPropagation(); }
    }, true);
  }

  onClose() {
    // 如果操作仍在进行，阻止关闭（回滚）
    if (!this.allowClose) {
      // Modal 已经执行了 close，无法阻止；标记取消
      this.cancelled = true;
    }
  }

  /** 更新进度 */
  updateProgress(current: number, detail?: string) {
    this.current = current;
    const pct = this.total > 0 ? Math.min(100, Math.round((current / this.total) * 100)) : 0;

    this.fillEl.style.width = `${pct}%`;
    this.percentageEl.setText(`${pct}%`);

    const rightText = detail || '';
    this.statsEl.innerHTML = `<span>${current} / ${this.total}</span><span>${rightText}</span>`;

    // 预估剩余时间
    const elapsed = Date.now() - this.startTime;
    if (current > 0 && current < this.total) {
      const avgMs = elapsed / current;
      const remainMs = avgMs * (this.total - current);
      this.etaEl.setText(this.formatETA(remainMs));
    } else if (current >= this.total) {
      this.etaEl.setText('');
    }
  }

  /** 递增进度 */
  increment(detail?: string) {
    this.updateProgress(this.current + 1, detail);
  }

  /** 是否已取消 */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /** 设置完成状态 */
  setComplete(message: string) {
    this.allowClose = true;
    this.fillEl.style.width = '100%';
    this.fillEl.classList.remove('animating');
    this.fillEl.classList.add('complete');
    this.percentageEl.setText('100%');
    this.statsEl.innerHTML = `<span>${message}</span><span></span>`;
    this.etaEl.setText('');

    if (this.cancelButton) {
      this.cancelButton.setText('关闭');
      this.cancelButton.disabled = false;
      this.cancelButton.onclick = () => this.close();
    }

    setTimeout(() => this.close(), 1200);
  }

  /** 设置错误状态 */
  setError(message: string) {
    this.allowClose = true;
    this.fillEl.classList.remove('animating');
    this.fillEl.classList.add('error');
    this.percentageEl.setText('--');
    this.statsEl.innerHTML = `<span>${message}</span><span></span>`;
    this.etaEl.setText('');

    if (this.cancelButton) {
      this.cancelButton.setText('关闭');
      this.cancelButton.disabled = false;
      this.cancelButton.onclick = () => this.close();
    }
  }

  private formatETA(ms: number): string {
    const sec = Math.round(ms / 1000);
    if (sec < 2) return '即将完成';
    if (sec < 60) return `预计剩余 ${sec} 秒`;
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    return `预计剩余 ${min} 分 ${remainSec} 秒`;
  }
}

/**
 * 带进度条的批量操作执行器
 */
export async function executeBatchWithProgress<T>(
  app: App,
  options: ProgressModalOptions,
  items: T[],
  processor: (item: T, index: number) => Promise<boolean>
): Promise<{ ok: number; fail: number; cancelled: boolean }> {
  const modal = new ProgressModal(app, {
    ...options,
    total: items.length,
    cancellable: options.cancellable !== false
  });

  modal.open();

  let ok = 0;
  let fail = 0;

  try {
    for (let i = 0; i < items.length; i++) {
      if (modal.isCancelled()) {
        logger.info(`[ProgressModal] 操作已取消，已处理 ${i}/${items.length}`);
        break;
      }

      try {
        const success = await processor(items[i], i);
        if (success) {
          ok++;
        } else {
          fail++;
        }
      } catch (error) {
        logger.error(`[ProgressModal] 处理项目 ${i} 失败:`, error);
        fail++;
      }

      modal.increment();
    }

    if (modal.isCancelled()) {
      modal.setComplete(`已取消: 成功 ${ok}, 失败 ${fail}, 未处理 ${items.length - ok - fail}`);
    } else if (fail > 0) {
      modal.setComplete(`完成: 成功 ${ok}, 失败 ${fail}`);
    } else {
      modal.setComplete(`全部完成: ${ok} 项`);
    }
  } catch (error) {
    logger.error('[ProgressModal] 批量操作失败:', error);
    modal.setError(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  return { ok, fail, cancelled: modal.isCancelled() };
}
