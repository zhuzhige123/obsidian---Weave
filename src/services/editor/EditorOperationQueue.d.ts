/**
 * 编辑器操作队列
 *
 * 功能：
 * - 队列化编辑器操作，确保操作按顺序执行
 * - 消除时序依赖和竞态条件
 * - 替代复杂的保护锁机制
 *
 * 设计原则：
 * - 所有操作自动排队
 * - 失败的操作不阻塞队列
 * - 支持操作优先级（可选）
 */
export interface Operation<T = any> {
    /** 操作执行函数 */
    execute: () => Promise<T>;
    /** 操作名称（用于调试） */
    name?: string;
    /** 操作优先级（数字越大优先级越高） */
    priority?: number;
}
export interface OperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
    operationName?: string;
}
/**
 * 编辑器操作队列
 * 确保编辑器操作按顺序执行，避免竞态条件
 */
export declare class EditorOperationQueue {
    private operationQueue;
    private isProcessing;
    private debug;
    constructor(debug?: boolean);
    /**
     * 将操作加入队列并等待执行完成
     * @param operation 操作函数
     * @param options 操作选项
     * @returns 操作结果
     */
    enqueue<T>(operation: () => Promise<T>, options?: {
        name?: string;
        priority?: number;
    }): Promise<OperationResult<T>>;
    /**
     * 查找插入位置（按优先级排序）
     * @param priority 优先级
     * @returns 插入位置索引
     */
    private findInsertPosition;
    /**
     * 处理队列中的操作
     */
    private processQueue;
    /**
     * 清空队列
     */
    clear(): void;
    /**
     * 获取队列大小
     */
    get size(): number;
    /**
     * 检查队列是否正在处理
     */
    get processing(): boolean;
    /**
     * 调试日志
     */
    private log;
}
