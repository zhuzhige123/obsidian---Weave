/**
 * 内容修改器
 * 负责精确地在指定位置插入内容，保留原有格式
 */
import type { UUIDManager } from './UUIDManager';
import type { PositionIndex, InsertionPlan, ModificationResult } from './types/sync-types';
export declare class ContentModifier {
    /**
     * 在指定位置插入内容
     * @param content 原始内容
     * @param position 插入位置（字符索引）
     * @param insertion 要插入的内容
     * @returns 修改后的内容
     */
    insertAtPosition(content: string, position: number, insertion: string): string;
    /**
     * 规划UUID和BlockID插入
     * @param index 位置索引
     * @param uuidManager UUID管理器
     * @returns 插入计划数组（已按位置从大到小排序）
     */
    planInsertions(index: PositionIndex, uuidManager: UUIDManager): Promise<InsertionPlan[]>;
    /**
     * 应用所有插入计划
     * @param content 原始内容
     * @param plans 插入计划数组（必须已从大到小排序）
     * @returns 修改结果
     */
    applyInsertions(content: string, plans: InsertionPlan[]): ModificationResult;
    /**
     * 批量应用修改（规划+应用的便捷方法）
     * @param content 原始内容
     * @param index 位置索引
     * @param uuidManager UUID管理器
     * @returns 修改结果
     */
    applyModifications(content: string, index: PositionIndex, uuidManager: UUIDManager): Promise<ModificationResult>;
    /**
     * 验证修改的完整性
     * @param originalContent 原始内容
     * @param modifiedContent 修改后的内容
     * @param index 位置索引
     * @returns 验证是否通过
     */
    validateModification(originalContent: string, modifiedContent: string, index: PositionIndex): {
        valid: boolean;
        errors: string[];
    };
}
