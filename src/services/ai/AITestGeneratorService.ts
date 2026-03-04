/**
 * AI测试题生成服务
 * 基于卡片内容生成测试题并导入到题库牌组
 */

import type { Card, CardType, Deck } from '../../data/types';
import type { 
  AIAction, 
  TestGenerationRequest, 
  TestGenerationResponse,
  GeneratedTestQuestion,
  AIProvider 
} from '../../types/ai-types';
import type { WeavePlugin } from '../../main';
import { generateId, generateUUID } from '../../utils/helpers';
import { createTestCard, extractSourceInfo } from '../../utils/question-bank/createTestCard';
import { logger } from '../../utils/logger';
import { AIServiceFactory } from './AIServiceFactory';
import { PromptVariableResolver } from './PromptVariableResolver';

/**
 * 测试题生成请求参数
 */
export interface GenerateTestRequest {
  sourceCard: Card;
  action: AIAction;
  targetDeckId?: string;
}

/**
 * AI测试题生成服务
 */
export class AITestGeneratorService {
  private static variableResolver = new PromptVariableResolver();
  
  constructor(private plugin: WeavePlugin) {}

  private stripTrailingAnswerParens(question: string): string {
    return (question || '').replace(
      /\s*[（(]\s*[A-Z](?:\s*[,，、]\s*[A-Z])*\s*[）)]\s*$/,
      ''
    ).trim();
  }

  private buildAnswerParensFromIndices(indices: number[]): string {
    const letters = Array.from(
      new Set(
        (indices || [])
          .filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
          .map((n) => String.fromCharCode(65 + n))
      )
    ).sort();

    return letters.length > 0 ? `（${letters.join(',')}）` : '';
  }

  /**
   * 生成测试题
   * @param request 生成请求
   * @returns 生成的测试题列表
   */
  async generateTests(request: GenerateTestRequest): Promise<TestGenerationResponse> {
    try {
      const { sourceCard, action } = request;
      
      // 验证配置
      if (!action.testConfig) {
        throw new Error('测试题配置缺失');
      }

      // 检查AI配置
      const aiConfig = this.plugin.settings.aiConfig;
      if (!aiConfig?.cardSplitting?.enabled) {
        return {
          success: false,
          error: 'AI测试题生成功能未启用，请在设置中开启'
        };
      }

      // 确定使用的AI提供商：action > defaultProvider
      const provider = action.provider || aiConfig.defaultProvider;
      
      if (!provider) {
        return {
          success: false,
          error: '未设置AI提供商，请在设置中配置'
        };
      }

      // 检查API密钥
      const providerConfig = (aiConfig.apiKeys as any)[provider];
      if (!providerConfig || !providerConfig.apiKey) {
        return {
          success: false,
          error: `AI提供商"${provider}"未配置API密钥，请在设置中配置`
        };
      }

      // 获取AI服务
      const aiService = AIServiceFactory.createService(provider, this.plugin, action.model);
      
      // 构建提示词并调用AI服务
      const { systemPrompt, userPrompt } = this.buildPrompts(sourceCard, action);
      const response = await aiService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // 测试题生成需要一定的创造性
        maxTokens: 3000
      });
      
      if (!response.success || !response.content) {
        return {
          success: false,
          error: response.error || 'AI生成测试题失败'
        };
      }

      // 解析响应
      const questions = this.parseAIResponse(response.content, action);
      
      return {
        success: true,
        generatedQuestions: questions,
        metadata: {
          provider: provider,
          model: response.model || providerConfig.model,
          tokensUsed: response.tokensUsed || 0,
          cost: response.cost
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成测试题失败'
      };
    }
  }

  /**
   * 构建AI提示词
   */
  private buildPrompts(card: Card, action: AIAction): { systemPrompt: string; userPrompt: string } {
    // 准备上下文信息
    const context = {
      template: undefined, // 可以后续扩展
      deck: undefined
    };

    // 使用 PromptVariableResolver 解析变量
    const systemPrompt = AITestGeneratorService.variableResolver.resolve(
      action.systemPrompt, 
      card, 
      context
    );
    
    // 构建用户提示词，添加测试题生成特定的变量
    let userPrompt = action.userPromptTemplate;
    
    // 替换测试题生成特有的变量
    const testConfig = action.testConfig;
    if (testConfig) {
      userPrompt = userPrompt
        .replace(/\{\{数量\}\}/g, testConfig.defaultCount.toString())
        .replace(/\{\{类型\}\}/g, this.getQuestionTypeLabel(testConfig.questionType))
        .replace(/\{\{难度\}\}/g, this.getDifficultyLabel(testConfig.difficultyLevel));
    }
    
    // 最后解析其他标准变量
    userPrompt = AITestGeneratorService.variableResolver.resolve(
      userPrompt,
      card,
      context
    );
    
    return { systemPrompt, userPrompt };
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(responseContent: string, action: AIAction): GeneratedTestQuestion[] {
    try {
      // 清理AI响应（移除可能的代码块包裹）
      let cleaned = responseContent.trim();
      
      // 移除markdown代码块
      const codeBlockRegex = /^```(?:json|markdown|md|text|)?\s*\n?([\s\S]*?)\n?```$/;
      const match = cleaned.match(codeBlockRegex);
      if (match) {
        cleaned = match[1].trim();
      }
      
      // 首先尝试解析JSON格式
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/) || cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.parseJSONResponse(parsed, action);
        } catch (jsonError) {
          // 静默失败，尝试纯文本解析
        }
      }
      
      // 如果JSON解析失败，尝试解析纯文本格式
      return this.parseTextResponse(cleaned, action);
    } catch (error) {
      throw new Error(`AI响应格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析JSON格式响应
   */
  private parseJSONResponse(parsed: any, action: AIAction): GeneratedTestQuestion[] {
    const questions: GeneratedTestQuestion[] = [];

    // 支持两种格式：{ questions: [...] } 或直接 [...]
    const questionsArray = parsed.questions || (Array.isArray(parsed) ? parsed : []);
    
    if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
      throw new Error('AI返回的测试题列表为空');
    }

    questionsArray.forEach((q: any, index: number) => {
        if (action.testConfig?.questionType === 'multiple' || action.testConfig?.questionType === 'single') {
          // 选择题 - 严格验证
          const question = q.question || q.front;
          const options = q.options || q.choices || [];
          const correctAnswer = q.correctAnswer || q.correct || [];
          const explanation = q.explanation || '';
          
          //  数据完整性验证
          if (!question || question.trim() === '') {
            throw new Error(`第${index + 1}题缺少问题描述（question字段）`);
          }
          
          if (!Array.isArray(options) || options.length === 0) {
            throw new Error(`第${index + 1}题缺少选项（options字段必须是非空数组）`);
          }
          
          if (options.length < 2) {
            throw new Error(`第${index + 1}题选项不足（至少需要2个选项）`);
          }
          
          if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) {
            throw new Error(`第${index + 1}题缺少正确答案（correctAnswer字段必须是非空数组）`);
          }
          
          
          //  数据验证通过
          const answerParens = this.buildAnswerParensFromIndices(correctAnswer);
          const normalizedQuestion = this.stripTrailingAnswerParens(question);

          const optionsMarkdown = options
            .map((opt: string, idx: number) => {
              const label = String.fromCharCode(65 + idx);
              return `${label}. ${opt}`;
            })
            .join('\n');
          
          const frontMarkdown = `Q: ${normalizedQuestion}${answerParens}\n\n${optionsMarkdown}`;
          
          //  构建content字段（权威格式）
          let contentMarkdown = frontMarkdown;
          if (explanation && explanation.trim()) {
            contentMarkdown += `\n\n---div---\n\n${explanation}`;
          }
          
          questions.push({
            content: contentMarkdown,  //  权威字段
            front: frontMarkdown,      //  临时保留（仅用于兼容）
            back: explanation,         //  临时保留（仅用于兼容）
            type: 'choice',
            choices: options,
            correctAnswer: correctAnswer,
            explanation: explanation,
            difficulty: action.testConfig?.difficultyLevel
          });
        } else if (action.testConfig?.questionType === 'fill') {
          // 挖空题 - 使用content字段（包含==文本==标记）
          const fillContent = q.content || q.question || q.front || '';
          const explanation = q.explanation || '';
          
          //  构建content字段（权威格式）
          let contentMarkdown = fillContent;
          if (explanation && explanation.trim()) {
            contentMarkdown += `\n\n---div---\n\n${explanation}`;
          }
          
          questions.push({
            content: contentMarkdown,  //  权威字段
            front: fillContent,        //  临时保留（仅用于兼容）
            back: '',                  //  临时保留（仅用于兼容）
            type: 'fill',
            explanation: explanation,
            difficulty: action.testConfig?.difficultyLevel
          });
        } else if (action.testConfig?.questionType === 'judge') {
          // 判断题
          const statement = q.statement || q.question || q.front || '';
          const answer = typeof q.answer === 'boolean' ? (q.answer ? '正确' : '错误') : (q.answer || q.back || '');
          const explanation = q.explanation || '';
          
          //  构建content字段（权威格式）
          let contentMarkdown = `Q: ${statement}\n\nA: ${answer}`;
          if (explanation && explanation.trim()) {
            contentMarkdown += `\n\n---div---\n\n${explanation}`;
          }
          
          questions.push({
            content: contentMarkdown,  //  权威字段
            front: statement,          //  临时保留（仅用于兼容）
            back: answer,              //  临时保留（仅用于兼容）
            type: 'judge',
            explanation: explanation,
            difficulty: action.testConfig?.difficultyLevel
          });
        }
      });

      if (questions.length === 0) {
        throw new Error('未能从AI响应中解析出有效的测试题');
      }

      return questions;
  }

  /**
   * 解析纯文本格式响应
   */
  private parseTextResponse(textContent: string, action: AIAction): GeneratedTestQuestion[] {
    const questions: GeneratedTestQuestion[] = [];
    
    try {
      // 按 ---div--- 或 --- 分割问题和答案
      const parts = textContent.split(/---div---|---/).map(p => p.trim()).filter(p => p);
      
      if (parts.length < 2) {
        throw new Error('纯文本格式应包含问题和答案两部分，用 ---div--- 分隔');
      }
      
      const questionPart = parts[0];
      const answerPart = parts[1];
      
      // 解析选择题格式
      if (action.testConfig?.questionType === 'multiple' || action.testConfig?.questionType === 'single') {
        // 提取题目（Q: 开头；直到第一个选项标签出现）
        const questionMatch = questionPart.match(/^Q:\s*([\s\S]+?)(?=\n\s*[A-D][\)\.．、）]\s+)/m);
        if (!questionMatch) {
          throw new Error('未找到有效的题目格式（应以 Q: 开头）');
        }
        
        const question = questionMatch[1].trim();
        
        // 提取选项（支持 A) / A. / A、 / A） 等格式）
        const optionMatches = questionPart.match(/^\s*([A-D])[\)\.．、）]\s*.+$/gm);
        if (!optionMatches || optionMatches.length < 2) {
          throw new Error('选择题应包含至少2个选项（格式：A. 选项内容）');
        }
        
        const options = optionMatches.map(opt => opt.replace(/^\s*[A-D][\)\.．、）]\s*/, '').trim());
        
        // 从答案部分提取正确答案和解释
        let correctAnswer: number[] = [];
        let explanation = answerPart;
        
        // 尝试提取正确答案（如 "正确答案: B)" 或直接列出选项）
        const answerMatch = answerPart.match(/(?:正确答案|答案)[：:]\s*([A-D])/i) || 
                          answerPart.match(/^([A-D])\)/m);
        
        if (answerMatch) {
          const letter = answerMatch[1];
          const index = letter.charCodeAt(0) - 'A'.charCodeAt(0);
          correctAnswer = [index];
          
          // 移除答案标识，保留解释部分
          explanation = answerPart.replace(/(?:正确答案|答案)[：:]\s*[A-D]\)\s*/i, '').trim();
        } else {
          // 如果没有明确的答案标识，默认选择第一个选项
          correctAnswer = [0];
        }
        
        const answerParens = this.buildAnswerParensFromIndices(correctAnswer);
        const normalizedQuestion = this.stripTrailingAnswerParens(question);

        const optionsMarkdown = options
          .map((opt, idx) => {
            const label = String.fromCharCode(65 + idx);
            return `${label}. ${opt}`;
          })
          .join('\n');
        
        let contentMarkdown = `Q: ${normalizedQuestion}${answerParens}\n\n${optionsMarkdown}`;
        if (explanation && explanation.trim()) {
          contentMarkdown += `\n\n---div---\n\n${explanation}`;
        }
        
        questions.push({
          content: contentMarkdown,                   //  权威字段
          front: question,                            //  临时保留（仅用于兼容）
          back: options[correctAnswer[0]] || '未知答案', //  临时保留（仅用于兼容）
          type: 'choice',
          choices: options,
          correctAnswer: correctAnswer,
          explanation: explanation || '暂无解释',
          difficulty: action.testConfig?.difficultyLevel
        });
        
      } else {
        // 其他类型的题目，使用简单的问答格式
        //  构建content字段（权威格式）
        let contentMarkdown = `Q: ${questionPart}\n\nA: ${answerPart}`;
        
        questions.push({
          content: contentMarkdown,  //  权威字段
          front: questionPart,       //  临时保留（仅用于兼容）
          back: answerPart,          //  临时保留（仅用于兼容）
          type: 'judge',
          explanation: '',
          difficulty: action.testConfig?.difficultyLevel
        });
      }
      
      return questions;
      
    } catch (error) {
      throw new Error(`纯文本格式解析错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 将生成的测试题导入到题库牌组
   */
  async importToQuestionBank(
    questions: GeneratedTestQuestion[],
    targetDeckId: string,
    sourceCard: Card,
    action?: { id: string }
  ): Promise<{ success: boolean; importedCount: number }> {
    try {
      let importedCount = 0;

      for (const question of questions) {
        //  直接使用权威字段 content（已经是完整的Markdown格式，包含 ---div--- 分隔符）
        const content = question.content;
        
        //  使用标准 createTestCard 工具函数
        const newCard = createTestCard({
          deckId: targetDeckId,
          //  不传递 templateId - Weave 原生测试卡片不需要模板
          content: content,
          difficulty: (question.difficulty === 'mixed' ? 'medium' : question.difficulty) || 'medium',
          tags: ['AI生成', `来源:${sourceCard.uuid}`, ...(sourceCard.tags || [])],
          priority: 0,
          //  修复：映射题型到createTestCard期望的格式
          questionType: question.type === 'choice' ? 'single_choice' : 
                       question.type === 'fill' ? 'cloze' : 'qa',
          //  修复：将数字索引转换为字母字符串
          correctAnswer: question.correctAnswer !== undefined 
            ? (Array.isArray(question.correctAnswer) 
                ? question.correctAnswer.map(idx => String.fromCharCode(65 + idx))
                : String.fromCharCode(65 + question.correctAnswer))
            : undefined,
          
          //  优化：使用辅助函数提取源信息（继承自源记忆卡片）
          ...extractSourceInfo(sourceCard)
        });
        
        if (!newCard.metadata) newCard.metadata = {};
        newCard.metadata.generatedBy = action?.id || 'ai-test-generator';
        newCard.metadata.generatedAt = new Date().toISOString();
        newCard.metadata.explanation = question.explanation;
        newCard.metadata.sourceCardId = sourceCard.uuid;

        await this.plugin.dataStorage.saveCard(newCard as Card);
        importedCount++;
      }

      return { success: true, importedCount };
    } catch (error) {
      return { success: false, importedCount: 0 };
    }
  }

  /**
   * 获取题目类型标签
   */
  private getQuestionTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      single: '单选题',
      multiple: '多选题',
      judge: '判断题',
      fill: '填空题'
    };
    return labels[type || 'multiple'] || '测试题';
  }

  /**
   * 获取难度级别标签
   */
  private getDifficultyLabel(level?: string): string {
    const labels: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
      mixed: '混合'
    };
    return labels[level || 'medium'] || '中等';
  }

  /**
   * 获取或创建对应的题库牌组
   * @param sourceDeckId 源牌组ID（记忆牌组ID）
   * @returns 题库牌组ID
   */
  async getOrCreateQuestionBankDeck(sourceDeckId: string): Promise<string> {
    try {
      if (!this.plugin.questionBankService) {
        throw new Error('题库服务未初始化');
      }

      // 禁用旧方案：不允许 AI 自动创建题库。仅允许使用“从记忆卡片选择题引入组建考试牌组”的新流程。
      // 这里仅允许查找已存在的绑定题库。
      const existingBank = await this.plugin.questionBankService.findBankByMemoryDeckId(sourceDeckId);
      if (existingBank) {
        return existingBank.id;
      }

      throw new Error('未找到对应题库。该功能已禁用自动创建题库，请在卡片管理中使用“组建考试牌组”从选择题引入创建。');
    } catch (error) {
      logger.error('[AITestGeneratorService] 获取或创建题库失败:', error);
      throw error;
    }
  }
}
