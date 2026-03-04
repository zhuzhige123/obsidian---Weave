/**
 * UUID处理的新实现（重构版）
 * 使用位置信息进行精确插入，避免文件结构破坏
 *
 * 这是一个临时文件，用于替换 SimpleBatchParsingService.ts 中的 processUUIDs 方法
 */
import type { ParsedCard } from '../../types/newCardParsingTypes';
import type { CardWithPosition } from '../../utils/simplifiedParser/CardPositionTracker';
import type { UUIDManager } from './UUIDManager';
/**
 * UUID处理结果
 */
export interface UUIDProcessResult {
    duplicates: string[];
    contentUpdated: boolean;
    updatedContent: string;
}
/**
 * UUID处理器（重构版 - 使用位置信息）
 *
 * 核心改进：
 * 1. 不再使用 splitCardsRaw 重新分割内容
 * 2. 直接使用解析时保存的位置信息
 * 3. 从后往前插入UUID，避免位置偏移
 * 4. 保持文件结构完整，不删除或移动分隔符
 */
export declare function processUUIDsWithPosition(cards: ParsedCard[], cardsPosition: CardWithPosition[], content: string, uuidManager: UUIDManager, detectUUIDInContent: (content: string) => string | null): Promise<UUIDProcessResult>;
