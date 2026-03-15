/**
 * EPUB Active Document Store
 * 全局状态：EPUB阅读器当前打开的文件路径及共享服务实例
 * - filePath: 卡片管理界面用于文档关联筛选
 * - services: 全局侧边栏用于读取TOC/高亮并执行导航
 */

import type { EpubReaderService, EpubAnnotationService, EpubBook } from '../services/epub';
import type { EpubBacklinkHighlightService } from '../services/epub/EpubBacklinkHighlightService';

export interface EpubSharedState {
  filePath: string | null;
  readerService: EpubReaderService | null;
  annotationService: EpubAnnotationService | null;
  backlinkService: EpubBacklinkHighlightService | null;
  book: EpubBook | null;
  progress: number;
  onSettingsClick: ((evt: MouseEvent) => void) | null;
  onSwitchBook: ((filePath: string) => void) | null;
}

type Subscriber = (state: EpubSharedState) => void;
type FilePathSubscriber = (filePath: string | null) => void;

const EMPTY_STATE: EpubSharedState = {
  filePath: null,
  readerService: null,
  annotationService: null,
  backlinkService: null,
  book: null,
  progress: 0,
  onSettingsClick: null,
  onSwitchBook: null,
};

class EpubActiveDocumentStore {
  private state: EpubSharedState = { ...EMPTY_STATE };
  private subscribers: Set<Subscriber> = new Set();
  private filePathSubscribers: Set<FilePathSubscriber> = new Set();

  setActiveDocument(filePath: string | null): void {
    this.state.filePath = filePath;
    this.notifyAll();
  }

  getActiveDocument(): string | null {
    return this.state.filePath;
  }

  clearActiveDocument(filePath?: string | null): void {
    if (filePath && this.state.filePath && this.state.filePath !== filePath) {
      return;
    }
    this.state = { ...EMPTY_STATE };
    this.notifyAll();
  }

  setSharedState(partial: Partial<EpubSharedState>): void {
    Object.assign(this.state, partial);
    this.notifyAll();
  }

  getSharedState(): Readonly<EpubSharedState> {
    return this.state;
  }

  subscribe(callback: FilePathSubscriber): () => void {
    this.filePathSubscribers.add(callback);
    callback(this.state.filePath);
    return () => { this.filePathSubscribers.delete(callback); };
  }

  subscribeState(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => { this.subscribers.delete(callback); };
  }

  private notifyAll(): void {
    this.filePathSubscribers.forEach(cb => cb(this.state.filePath));
    this.subscribers.forEach(cb => cb(this.state));
  }
}

export const epubActiveDocumentStore = new EpubActiveDocumentStore();
