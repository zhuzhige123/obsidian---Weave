/**
 * EPUB Active Document Store
 * 全局状态：EPUB阅读器当前打开的文件路径
 * 用于让卡片管理界面能够识别EPUB阅读器正在阅读的文件，支持文档关联筛选
 */

type Subscriber = (filePath: string | null) => void;

class EpubActiveDocumentStore {
  private currentFilePath: string | null = null;
  private subscribers: Set<Subscriber> = new Set();

  /**
   * 设置当前EPUB阅读器的活动文件路径
   */
  setActiveDocument(filePath: string | null): void {
    this.currentFilePath = filePath;
    this.notifySubscribers();
  }

  /**
   * 获取当前EPUB阅读器的活动文件路径
   */
  getActiveDocument(): string | null {
    return this.currentFilePath;
  }

  /**
   * 清除当前活动文件（EPUB阅读器关闭时调用）
   */
  clearActiveDocument(): void {
    this.currentFilePath = null;
    this.notifySubscribers();
  }

  /**
   * 订阅活动文件变化
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.currentFilePath);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentFilePath));
  }
}

export const epubActiveDocumentStore = new EpubActiveDocumentStore();
