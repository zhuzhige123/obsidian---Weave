/**
 * 渐进式挖空调试工具
 * 
 * 用于诊断渐进式挖空卡片的显示问题
 * 
 * 使用方法（浏览器控制台）：
 * ```javascript
 * // 诊断当前学习的卡片
 * window.weaveDevTools.diagnoseProgressiveCard();
 * 
 * // 诊断指定卡片
 * window.weaveDevTools.diagnoseProgressiveCard('card-uuid-here');
 * ```
 * 
 * @module utils/dev/progressive-debug-tool
 */

import { logger } from '../logger';
import type WeavePlugin from '../../main';
import { 
  isProgressiveClozeChild, 
  isProgressiveClozeParent,
  type ProgressiveClozeChildCard 
} from '../../types/progressive-cloze-v2';

/**
 * 诊断结果
 */
export interface ProgressiveDiagnosisResult {
  cardId: string;
  cardType: string;
  isV2Format: boolean;
  isParent: boolean;
  isChild: boolean;
  
  // V2子卡片信息
  parentCardId?: string;
  clozeOrd?: number;
  activeClozeOrdinal?: number;
  
  // V2父卡片信息
  childCardIds?: string[];
  totalClozes?: number;
  
  // V1.5遗留信息
  hasV15ProgressiveCloze?: boolean;
  v15Data?: any;
  
  // 内容分析
  content: string;
  clozeMatches: Array<{
    match: string;
    ordinal: number;
    text: string;
    hint?: string;
  }>;
  
  // 诊断建议
  issues: string[];
  suggestions: string[];
}

/**
 * 注册渐进式挖空调试工具
 */
export function registerProgressiveDebugTool(plugin: WeavePlugin) {
  (window as any).weaveDevTools = (window as any).weaveDevTools || {};
  
  /**
   * 诊断渐进式挖空卡片
   */
  (window as any).weaveDevTools.diagnoseProgressiveCard = async (cardId?: string) => {
    logger.info('[调试工具] 开始诊断渐进式挖空卡片...');
    
    try {
      // 获取卡片
      let card;
      if (cardId) {
        card = await plugin.dataStorage.getCardByUUID(cardId);
        if (!card) {
          logger.error(`[调试工具] 未找到卡片: ${cardId}`);
          return null;
        }
      } else {
        // 从当前学习界面获取卡片
        const studyView = plugin.app.workspace.getLeavesOfType('study-view')[0];
        if (!studyView) {
          logger.error('[调试工具] 未找到学习界面');
          console.log('💡 请先打开学习界面，或指定卡片ID');
          return null;
        }
        
        // 尝试从学习界面获取当前卡片
        // @ts-ignore - 访问StudyView的内部状态
        const currentCard = studyView.view?.currentCard;
        if (!currentCard) {
          logger.error('[调试工具] 学习界面未加载卡片');
          return null;
        }
        
        card = currentCard;
      }
      
      // 执行诊断
      const result = diagnoseCard(card, plugin);
      
      // 输出诊断报告
      console.group('🔍 渐进式挖空卡片诊断报告');
      console.log('📇 卡片ID:', result.cardId);
      console.log('🏷️ 卡片类型:', result.cardType);
      console.log('📋 V2格式:', result.isV2Format ? '✅ 是' : '❌ 否');
      
      if (result.isParent) {
        console.log('👨‍👧‍👦 角色: 父卡片 (ProgressiveParent)');
        console.log('  └─ 子卡片数量:', result.totalClozes);
        console.log('  └─ 子卡片IDs:', result.childCardIds);
      } else if (result.isChild) {
        console.log('👶 角色: 子卡片 (ProgressiveChild)');
        console.log('  └─ 父卡片ID:', result.parentCardId);
        console.log('  └─ 挖空序号 (clozeOrd):', result.clozeOrd, '(0-based)');
        console.log('  └─ 激活序号 (activeClozeOrdinal):', result.activeClozeOrdinal, '(1-based)');
      } else {
        console.log('📄 角色: 普通卡片或V1.5格式');
      }
      
      if (result.hasV15ProgressiveCloze) {
        console.warn('⚠️ 发现V1.5格式数据:', result.v15Data);
      }
      
      console.group('📝 内容分析');
      console.log('原始内容:', result.content.substring(0, 100) + '...');
      console.log('检测到的挖空:', result.clozeMatches.length);
      if (result.clozeMatches.length > 0) {
        console.table(result.clozeMatches);
      }
      console.groupEnd();
      
      if (result.issues.length > 0) {
        console.group('⚠️ 发现的问题');
        result.issues.forEach(issue => console.warn('  •', issue));
        console.groupEnd();
      }
      
      if (result.suggestions.length > 0) {
        console.group('💡 建议');
        result.suggestions.forEach(suggestion => console.log('  •', suggestion));
        console.groupEnd();
      }
      
      console.groupEnd();
      
      return result;
    } catch (error) {
      logger.error('[调试工具] 诊断失败:', error);
      throw error;
    }
  };
  
  logger.debug('[调试工具] 渐进式挖空诊断工具已注册');
}

/**
 * 诊断卡片
 */
function diagnoseCard(card: any, plugin: WeavePlugin): ProgressiveDiagnosisResult {
  const result: ProgressiveDiagnosisResult = {
    cardId: card.uuid,
    cardType: card.type,
    isV2Format: false,
    isParent: false,
    isChild: false,
    content: card.content || '',
    clozeMatches: [],
    issues: [],
    suggestions: []
  };
  
  // 检查V2格式
  result.isParent = isProgressiveClozeParent(card);
  result.isChild = isProgressiveClozeChild(card);
  result.isV2Format = result.isParent || result.isChild;
  
  // V2父卡片信息
  if (result.isParent) {
    result.childCardIds = card.progressiveCloze?.childCardIds || [];
    result.totalClozes = card.progressiveCloze?.totalClozes || 0;
  }
  
  // V2子卡片信息
  if (result.isChild) {
    // 类型断言：确认是ProgressiveClozeChildCard
    const childCard = card as ProgressiveClozeChildCard;
    result.parentCardId = childCard.parentCardId;
    result.clozeOrd = childCard.clozeOrd;
    result.activeClozeOrdinal = childCard.clozeOrd + 1; // 转换为1-based
  }
  
  // 检查V1.5遗留数据
  if ((card as any).progressiveCloze && !result.isV2Format) {
    result.hasV15ProgressiveCloze = true;
    result.v15Data = (card as any).progressiveCloze;
    result.issues.push('检测到V1.5格式的progressiveCloze字段');
    result.suggestions.push('使用 window.weaveDevTools.cleanV15Cards() 清理V1.5数据');
  }
  
  // 分析挖空内容
  const clozePattern = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
  let match;
  
  while ((match = clozePattern.exec(result.content)) !== null) {
    const ordinal = parseInt(match[1]);
    const text = match[2];
    const hint = match[3];
    
    result.clozeMatches.push({
      match: match[0],
      ordinal,
      text,
      hint
    });
  }
  
  // 诊断问题
  if (card.type === 'progressive') {
    result.issues.push('卡片类型为已废弃的"progressive"（V1.5）');
    result.suggestions.push('需要转换为V2格式（progressive-parent + progressive-child）');
  }
  
  if (result.isChild && !result.content) {
    result.issues.push('⚠️ 子卡片content为空（可能是V1遗留数据，建议运行迁移工具）');
  }
  
  if (result.isChild && result.clozeMatches.length === 0) {
    result.issues.push('子卡片没有检测到挖空标记');
    result.suggestions.push('检查父卡片的content是否包含挖空标记');
  }
  
  if (result.isChild && result.clozeOrd !== undefined) {
    const matchingCloze = result.clozeMatches.find(c => c.ordinal === result.activeClozeOrdinal);
    if (!matchingCloze) {
      result.issues.push(`子卡片的clozeOrd(${result.clozeOrd})对应的挖空c${result.activeClozeOrdinal}在内容中不存在`);
    }
  }
  
  return result;
}
