/**
 * @deprecated v5.0: 此服务已弃用，块文件方案不再需要文件监听
 *
 * 增量阅读文件监听服务（旧 UUID 标记方案）
 *
 * 监听增量阅读文件夹中的文件变化，自动同步内容块数据
 * 此服务用于旧的"源文件内 UUID 标记"方案，新的块文件方案不需要此服务
 *
 * @module services/incremental-reading/IRFileWatcher
 * @version 2.2.0
 */
import { App } from 'obsidian';
import { IRStorageService } from './IRStorageService';
import { IRContentSplitter } from './IRContentSplitter';
export declare class IRFileWatcher {
    private app;
    private storage;
    private contentSplitter;
    private eventRefs;
    private isWatching;
    private importFolder;
    /** 防抖处理文件变化 */
    private debouncedHandleModify;
    constructor(app: App, storage: IRStorageService, contentSplitter: IRContentSplitter, importFolder?: string);
    /**
     * 更新监听的导入文件夹路径
     */
    setImportFolder(folder: string): void;
    /**
     * 开始监听文件变化
     */
    startWatching(): void;
    /**
     * 停止监听
     */
    stopWatching(): void;
    /**
     * 检查文件是否在监听文件夹中
     */
    private isInWatchFolder;
    /**
     * 处理文件修改事件
     * 重新解析文件中的 UUID 标记，同步更新 blocks.json
     */
    private handleFileModified;
    /**
     * 从内容中提取所有 UUID
     */
    private extractUuidsFromContent;
    /**
     * 按 UUID 标记解析内容块
     * UUID 标记在内容块末尾，UUID 之前的内容属于该块
     */
    private parseBlocksByUuid;
    /**
     * 提取标题
     */
    private extractTitle;
    /**
     * 处理文件删除事件
     */
    private handleFileDeleted;
    /**
     * 处理文件重命名事件
     */
    private handleFileRenamed;
}
