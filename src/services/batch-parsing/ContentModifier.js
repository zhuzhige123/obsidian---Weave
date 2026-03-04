import { logger } from '../../utils/logger';
import { logDebugWithTag } from '../../utils/logger';
export class ContentModifier {
    /**
     * 在指定位置插入内容
     * @param content 原始内容
     * @param position 插入位置（字符索引）
     * @param insertion 要插入的内容
     * @returns 修改后的内容
     */
    insertAtPosition(content, position, insertion) {
        return content.slice(0, position) + insertion + content.slice(position);
    }
    /**
     * 规划UUID和BlockID插入
     * @param index 位置索引
     * @param uuidManager UUID管理器
     * @returns 插入计划数组（已按位置从大到小排序）
     */
    async planInsertions(index, uuidManager) {
        const plans = [];
        logDebugWithTag('ContentModifier', '开始规划UUID插入...');
        for (const card of index.cards) {
            if (card.hasUUID) {
                logDebugWithTag('ContentModifier', `卡片已有UUID，跳过: ${card.uuid}`);
                continue;
            }
            // 生成UUID和BlockID
            const uuid = uuidManager.generateUUID();
            const blockId = uuidManager.generateBlockID();
            // 计算插入位置：卡片内容末尾
            const insertPosition = card.endPos;
            // 格式化插入内容：\n<!-- uuid --> ^blockid
            const insertionContent = `\n<!-- ${uuid} --> ^${blockId}`;
            const plan = {
                position: insertPosition,
                content: insertionContent,
                cardBlockIndex: card.index,
                uuid,
                blockId
            };
            plans.push(plan);
            logDebugWithTag('ContentModifier', `规划插入: UUID=${uuid}, BlockID=${blockId}, Pos=${insertPosition}`);
        }
        // 从后往前排序（避免位置偏移）
        plans.sort((a, b) => b.position - a.position);
        logDebugWithTag('ContentModifier', `插入规划完成: ${plans.length}个插入点`);
        return plans;
    }
    /**
     * 应用所有插入计划
     * @param content 原始内容
     * @param plans 插入计划数组（必须已从大到小排序）
     * @returns 修改结果
     */
    applyInsertions(content, plans) {
        if (plans.length === 0) {
            return {
                content,
                modified: false,
                insertionsApplied: 0,
                bytesChanged: 0
            };
        }
        logDebugWithTag('ContentModifier', '开始应用插入...');
        let modifiedContent = content;
        let totalBytesChanged = 0;
        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            // 应用插入
            modifiedContent = this.insertAtPosition(modifiedContent, plan.position, plan.content);
            totalBytesChanged += plan.content.length;
            logDebugWithTag('ContentModifier', `已插入 ${i + 1}/${plans.length}: ${plan.content.length}字节 @ Pos=${plan.position}`);
        }
        logDebugWithTag('ContentModifier', '所有插入应用完成');
        return {
            content: modifiedContent,
            modified: true,
            insertionsApplied: plans.length,
            bytesChanged: totalBytesChanged
        };
    }
    /**
     * 批量应用修改（规划+应用的便捷方法）
     * @param content 原始内容
     * @param index 位置索引
     * @param uuidManager UUID管理器
     * @returns 修改结果
     */
    async applyModifications(content, index, uuidManager) {
        const plans = await this.planInsertions(index, uuidManager);
        return this.applyInsertions(content, plans);
    }
    /**
     * 验证修改的完整性
     * @param originalContent 原始内容
     * @param modifiedContent 修改后的内容
     * @param index 位置索引
     * @returns 验证是否通过
     */
    validateModification(originalContent, modifiedContent, index) {
        const errors = [];
        // 1. 验证批量范围标记未被修改
        const startMarker = '<!-- Weave:start -->';
        const endMarker = '<!-- Weave:end -->';
        if (originalContent.includes(startMarker) !== modifiedContent.includes(startMarker)) {
            errors.push('开始标记被意外修改或删除');
        }
        if (originalContent.includes(endMarker) !== modifiedContent.includes(endMarker)) {
            errors.push('结束标记被意外修改或删除');
        }
        // 2. 验证批量范围外的内容未被修改
        const originalBefore = originalContent.substring(0, index.batchRange.fullRange.start);
        const modifiedBefore = modifiedContent.substring(0, index.batchRange.fullRange.start);
        if (originalBefore !== modifiedBefore) {
            errors.push('批量范围之前的内容被意外修改');
        }
        // 3. 验证首尾非卡片块未被修改
        if (index.nonCards.length > 0) {
            const leadingBlock = index.nonCards.find(b => b.isLeading);
            const trailingBlock = index.nonCards.find(b => b.isTrailing);
            if (leadingBlock && !modifiedContent.includes(leadingBlock.content)) {
                errors.push('首块内容丢失或被修改');
            }
            if (trailingBlock && !modifiedContent.includes(trailingBlock.content)) {
                errors.push('尾块内容丢失或被修改');
            }
        }
        // 4. 验证修改后的长度合理
        const expectedMinLength = originalContent.length;
        const expectedMaxLength = originalContent.length + (index.cards.length * 200); // 假设每个UUID+BlockID最多200字节
        if (modifiedContent.length < expectedMinLength) {
            errors.push(`修改后内容长度过短: ${modifiedContent.length} < ${expectedMinLength}`);
        }
        if (modifiedContent.length > expectedMaxLength) {
            errors.push(`修改后内容长度异常: ${modifiedContent.length} > ${expectedMaxLength}`);
        }
        if (errors.length > 0) {
            logger.error('[ContentModifier] 验证失败:', errors);
            return { valid: false, errors };
        }
        logDebugWithTag('ContentModifier', '修改验证通过');
        return { valid: true, errors: [] };
    }
}
