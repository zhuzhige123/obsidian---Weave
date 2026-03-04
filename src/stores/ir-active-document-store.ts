/**
 * IR Active Document Store
 * 全局状态：增量阅读界面当前正在阅读的文件路径
 * 用于让卡片管理界面能够识别增量阅读正在阅读的文件，支持文档关联筛选
 */

type Subscriber = (filePath: string | null) => void;

class IRActiveDocumentStore {
  private currentFilePath: string | null = null;
  private subscribers: Set<Subscriber> = new Set();

  /**
   * 设置当前增量阅读的活动文件路径
   */
  setActiveDocument(filePath: string | null): void {
    this.currentFilePath = filePath;
    this.notifySubscribers();
  }

  /**
   * 获取当前增量阅读的活动文件路径
   */
  getActiveDocument(): string | null {
    return this.currentFilePath;
  }

  /**
   * 清除当前活动文件（增量阅读界面关闭时调用）
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
    // 立即通知当前状态
    callback(this.currentFilePath);
    
    // 返回取消订阅函数
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentFilePath));
  }
}

// 导出单例
export const irActiveDocumentStore = new IRActiveDocumentStore();
