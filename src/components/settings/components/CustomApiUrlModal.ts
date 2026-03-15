import { Modal, App, Notice } from 'obsidian';
import type { AIProvider } from '../constants/settings-constants';
import { AI_PROVIDER_LABELS, DEFAULT_API_URLS } from '../constants/settings-constants';

export class CustomApiUrlModal extends Modal {
  private provider: AIProvider;
  private currentUrl: string;
  private onSave: (url: string) => void;

  constructor(
    app: App,
    provider: AIProvider,
    currentUrl: string,
    onSave: (url: string) => void
  ) {
    super(app);
    this.provider = provider;
    this.currentUrl = currentUrl;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weave-custom-api-url-modal');

    this.setTitle(`自定义 ${AI_PROVIDER_LABELS[this.provider]} API地址`);

    // API基础地址输入（手动创建，避免Setting API的横排布局在移动端过窄）
    const inputGroup = contentEl.createEl('div', { cls: 'weave-url-input-group' });
    inputGroup.createEl('label', { text: 'API基础地址', cls: 'weave-url-label' });

    const inputEl = inputGroup.createEl('input', {
      type: 'text',
      placeholder: DEFAULT_API_URLS[this.provider] || 'https://api.example.com/v1',
      value: this.currentUrl,
      cls: 'weave-url-input',
    });
    inputEl.addEventListener('input', () => {
      this.currentUrl = inputEl.value;
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSave();
      }
    });

    inputGroup.createEl('div', {
      text: `默认: ${DEFAULT_API_URLS[this.provider] || '官方地址'}`,
      cls: 'weave-url-desc',
    });

    // 常用中转示例
    const examplesEl = contentEl.createEl('div', { cls: 'weave-url-examples' });
    examplesEl.createEl('h4', { text: '常用中转示例' });

    const examples = [
      { label: 'Cloudflare Worker:', url: 'https://your-worker.workers.dev' },
      { label: 'Vercel代理:', url: 'https://your-project.vercel.app' },
      { label: '自建代理:', url: 'https://proxy.example.com/api' },
    ];

    for (const example of examples) {
      const item = examplesEl.createEl('div', { cls: 'weave-example-item' });
      item.createEl('span', { text: example.label, cls: 'weave-example-label' });
      item.createEl('code', { text: example.url, cls: 'weave-example-url' });
    }

    // 注意事项
    const notesEl = contentEl.createEl('div', { cls: 'weave-url-notes' });
    notesEl.createEl('h4', { text: '注意事项' });
    const notesList = notesEl.createEl('ul');
    const notes = [
      '确保中转服务与官方API接口兼容',
      '自定义地址后需要重新测试连接',
      '某些功能可能因中转服务限制而不可用',
      '请勿使用不可信的第三方服务，以保护API密钥安全',
    ];
    for (const note of notes) {
      notesList.createEl('li', { text: note });
    }

    // 按钮区域
    const btnContainer = contentEl.createEl('div', { cls: 'weave-url-buttons' });

    const cancelBtn = btnContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => this.handleSave());
  }

  private handleSave() {
    const url = this.currentUrl.trim();
    if (!url) {
      new Notice('URL不能为空', 3000);
      return;
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        new Notice('只支持HTTP或HTTPS协议', 3000);
        return;
      }
      if (urlObj.search || urlObj.hash) {
        new Notice('基础URL不应包含查询参数或锚点', 3000);
        return;
      }
    } catch {
      new Notice('无效的URL格式', 3000);
      return;
    }

    const cleanedUrl = url.replace(/\/+$/, '');
    this.onSave(cleanedUrl);
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
