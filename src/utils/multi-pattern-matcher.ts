import { logger } from '../utils/logger';
/**
 * 多模式匹配系统
 * 支持多种标题格式、标点符号、粗体格式等变化
 */

export interface MatchPattern {
  id: string;
  name: string;
  description: string;
  regex: RegExp;
  priority: number;
  fieldMapping: Record<string, number>;
  examples: string[];
  category: 'heading' | 'bold' | 'qa_pair' | 'list' | 'custom';
  confidence: number;
}

export interface MatchResult {
  pattern: MatchPattern;
  matches: RegExpMatchArray;
  fields: Record<string, string>;
  confidence: number;
  coverage: number;
}

export interface MultiMatchResult {
  bestMatch: MatchResult | null;
  allMatches: MatchResult[];
  totalAttempts: number;
  processingTime: number;
}

/**
 * 多模式匹配器
 * 尝试多种不同的模式来匹配内容
 */
export class MultiPatternMatcher {
  private patterns: MatchPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * 尝试所有模式匹配内容
   */
  matchContent(content: string): MultiMatchResult {
    const startTime = Date.now();
    const allMatches: MatchResult[] = [];
    
    logger.debug(`🎯 [MultiPatternMatcher] 开始匹配内容 (${content.length} 字符)`);
    
    // 按优先级排序模式
    const sortedPatterns = [...this.patterns].sort((a, b) => b.priority - a.priority);
    
    for (const pattern of sortedPatterns) {
      try {
        const match = content.match(pattern.regex);
        
        if (match) {
          const fields = this.extractFields(match, pattern.fieldMapping);
          const coverage = this.calculateCoverage(content, fields);
          const confidence = this.calculateConfidence(pattern, match, coverage);
          
          const matchResult: MatchResult = {
            pattern,
            matches: match,
            fields,
            confidence,
            coverage
          };
          
          allMatches.push(matchResult);
          
          logger.debug(`✅ [MultiPatternMatcher] 模式匹配成功: ${pattern.name} (置信度: ${(confidence * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        logger.warn(`⚠️ [MultiPatternMatcher] 模式匹配失败: ${pattern.name}`, error);
      }
    }
    
    // 选择最佳匹配
    const bestMatch = this.selectBestMatch(allMatches);
    const processingTime = Date.now() - startTime;
    
    logger.debug(`🏆 [MultiPatternMatcher] 完成匹配，找到${allMatches.length}个匹配，最佳: ${bestMatch?.pattern.name || 'none'}`);
    
    return {
      bestMatch,
      allMatches,
      totalAttempts: sortedPatterns.length,
      processingTime
    };
  }

  /**
   * 初始化所有匹配模式
   */
  private initializePatterns(): MatchPattern[] {
    return [
      // 1. 二级标题模式 - 最常用
      {
        id: 'h2-standard',
        name: '二级标题标准格式',
        description: '## 标题格式',
        regex: /^## (.+)\n([\s\S]*?)(?=\n##|\n#|$)/m,
        priority: 100,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['## 什么是JavaScript？\nJavaScript是一种编程语言...'],
        category: 'heading',
        confidence: 0.95
      },

      // 2. 二级标题变体 - 不同空格
      {
        id: 'h2-flexible-spaces',
        name: '二级标题灵活空格',
        description: '##标题 或 ##  标题格式',
        regex: /^##\s*(.+?)\s*\n([\s\S]*?)(?=\n##|\n#|$)/m,
        priority: 95,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['##什么是Python？\nPython是一种编程语言...', '##  什么是Java？  \nJava是一种编程语言...'],
        category: 'heading',
        confidence: 0.90
      },

      // 3. 三级标题模式
      {
        id: 'h3-standard',
        name: '三级标题标准格式',
        description: '### 标题格式',
        regex: /^### (.+)\n([\s\S]*?)(?=\n###|\n##|\n#|$)/m,
        priority: 85,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['### 如何学习编程？\n学习编程需要...'],
        category: 'heading',
        confidence: 0.85
      },

      // 4. 一级标题模式
      {
        id: 'h1-standard',
        name: '一级标题标准格式',
        description: '# 标题格式',
        regex: /^# (.+)\n([\s\S]*?)(?=\n#|$)/m,
        priority: 80,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['# 编程基础\n编程是...'],
        category: 'heading',
        confidence: 0.80
      },

      // 5. 粗体问题格式
      {
        id: 'bold-question',
        name: '粗体问题格式',
        description: '**问题**: 答案格式',
        regex: /\*\*(.+?)\*\*[:：]\s*([\s\S]*?)(?=\n\*\*|\n##|\n#|$)/m,
        priority: 75,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['**什么是算法**: 算法是解决问题的步骤...'],
        category: 'bold',
        confidence: 0.85
      },

      // 6. 问答对格式 (Q: A:)
      {
        id: 'qa-pair-colon',
        name: 'Q:A:问答对格式',
        description: 'Q: 问题 A: 答案格式',
        regex: /Q[:：]\s*(.+?)\n+A[:：]\s*([\s\S]*?)(?=\nQ[:：]|$)/m,
        priority: 90,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['Q: 什么是数据结构？\nA: 数据结构是...'],
        category: 'qa_pair',
        confidence: 0.92
      },

      // 7. 中文问答格式
      {
        id: 'chinese-qa',
        name: '中文问答格式',
        description: '问题: 答案格式',
        regex: /问题?[:：]\s*(.+?)\n+答案?[:：]\s*([\s\S]*?)(?=\n问题?[:：]|$)/m,
        priority: 88,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['问题: 什么是机器学习？\n答案: 机器学习是...'],
        category: 'qa_pair',
        confidence: 0.90
      },

      // 8. 问答格式变体 - 不同标点
      {
        id: 'qa-flexible-punctuation',
        name: '问答灵活标点格式',
        description: '问题？答案格式',
        regex: /(.+[？?])\s*\n+([\s\S]*?)(?=\n.+[？?]|\n##|\n#|$)/m,
        priority: 70,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['什么是编程？\n编程是创建计算机程序的过程...'],
        category: 'qa_pair',
        confidence: 0.75
      },

      // 9. 列表项格式
      {
        id: 'list-item-qa',
        name: '列表项问答格式',
        description: '- 问题: 答案格式',
        regex: /^[-*+]\s*(.+?)[:：]\s*([\s\S]*?)(?=\n[-*+]|\n##|\n#|$)/m,
        priority: 65,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['- 什么是变量: 变量是存储数据的容器...'],
        category: 'list',
        confidence: 0.70
      },

      // 10. 数字列表格式
      {
        id: 'numbered-list-qa',
        name: '数字列表问答格式',
        description: '1. 问题: 答案格式',
        regex: /^\d+\.\s*(.+?)[:：]\s*([\s\S]*?)(?=\n\d+\.|\n##|\n#|$)/m,
        priority: 60,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['1. 什么是函数: 函数是可重用的代码块...'],
        category: 'list',
        confidence: 0.68
      },

      // 11. 自由格式 - 第一行为问题
      {
        id: 'free-format-first-line',
        name: '自由格式首行问题',
        description: '第一行作为问题，其余作为答案',
        regex: /^(.+)\n([\s\S]+)$/m,
        priority: 30,
        fieldMapping: { question: 1, answer: 2 },
        examples: ['编程的基本概念\n编程涉及多个概念...'],
        category: 'custom',
        confidence: 0.40
      },

      // 12. 单行格式
      {
        id: 'single-line',
        name: '单行格式',
        description: '整行内容作为问题',
        regex: /^(.+)$/m,
        priority: 10,
        fieldMapping: { question: 1, answer: 0 },
        examples: ['什么是编程？'],
        category: 'custom',
        confidence: 0.20
      }
    ];
  }

  /**
   * 从匹配结果中提取字段
   */
  private extractFields(match: RegExpMatchArray, fieldMapping: Record<string, number>): Record<string, string> {
    const fields: Record<string, string> = {};
    
    Object.entries(fieldMapping).forEach(([fieldKey, groupIndex]) => {
      const value = match[groupIndex];
      fields[fieldKey] = value ? value.trim() : '';
    });
    
    return fields;
  }

  /**
   * 计算内容覆盖率
   */
  private calculateCoverage(originalContent: string, fields: Record<string, string>): number {
    const originalLength = originalContent.replace(/\s+/g, '').length;
    const fieldsContent = Object.values(fields).join('').replace(/\s+/g, '');
    const fieldsLength = fieldsContent.length;
    
    return originalLength > 0 ? Math.min(fieldsLength / originalLength, 1.0) : 0;
  }

  /**
   * 计算匹配置信度
   */
  private calculateConfidence(pattern: MatchPattern, match: RegExpMatchArray, coverage: number): number {
    let confidence = pattern.confidence;
    
    // 基于覆盖率调整置信度
    confidence *= coverage;
    
    // 基于匹配质量调整
    const questionField = match[pattern.fieldMapping.question];
    const answerField = match[pattern.fieldMapping.answer];
    
    if (questionField && questionField.length > 5) {
      confidence += 0.1;
    }
    
    if (answerField && answerField.length > 10) {
      confidence += 0.1;
    }
    
    // 检查问题是否像真正的问题
    if (questionField && this.looksLikeQuestion(questionField)) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 检查文本是否像问题
   */
  private looksLikeQuestion(text: string): boolean {
    const questionIndicators = [
      /[？?]$/, // 以问号结尾
      /^(什么|如何|为什么|怎么|哪个|哪些|何时|何地|Who|What|When|Where|Why|How)/i, // 疑问词开头
      /^(请|试|解释|说明|描述|分析|比较|列举)/i, // 指令性开头
      /(是什么|怎么样|如何|为什么)/i // 包含疑问短语
    ];
    
    return questionIndicators.some(pattern => pattern.test(text.trim()));
  }

  /**
   * 选择最佳匹配
   */
  private selectBestMatch(matches: MatchResult[]): MatchResult | null {
    if (matches.length === 0) {
      return null;
    }
    
    // 按综合分数排序
    const scoredMatches = matches.map(match => ({
      match,
      score: this.calculateOverallScore(match)
    }));
    
    scoredMatches.sort((a, b) => b.score - a.score);
    
    return scoredMatches[0].match;
  }

  /**
   * 计算综合分数
   */
  private calculateOverallScore(match: MatchResult): number {
    const { pattern, confidence, coverage, fields } = match;
    
    let score = confidence * 0.4 + coverage * 0.3 + (pattern.priority / 100) * 0.3;
    
    // 奖励有意义的内容
    if (fields.question && fields.question.length > 5) {
      score += 0.1;
    }
    
    if (fields.answer && fields.answer.length > 10) {
      score += 0.1;
    }
    
    // 惩罚过短或过长的内容
    if (fields.question && fields.question.length < 3) {
      score -= 0.2;
    }
    
    if (fields.answer && fields.answer.length > 5000) {
      score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 添加自定义模式
   */
  addCustomPattern(pattern: Omit<MatchPattern, 'id'>): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullPattern: MatchPattern = {
      id,
      ...pattern
    };
    
    this.patterns.push(fullPattern);
    logger.debug(`➕ [MultiPatternMatcher] 添加自定义模式: ${pattern.name}`);
    
    return id;
  }

  /**
   * 移除模式
   */
  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      const removed = this.patterns.splice(index, 1)[0];
      logger.debug(`➖ [MultiPatternMatcher] 移除模式: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * 获取所有模式信息
   */
  getAllPatterns(): MatchPattern[] {
    return [...this.patterns];
  }

  /**
   * 获取模式统计信息
   */
  getPatternStatistics(): {
    totalPatterns: number;
    patternsByCategory: Record<string, number>;
    averagePriority: number;
    averageConfidence: number;
  } {
    const patternsByCategory: Record<string, number> = {};
    let totalPriority = 0;
    let totalConfidence = 0;
    
    this.patterns.forEach(_pattern => {
      patternsByCategory[_pattern.category] = (patternsByCategory[_pattern.category] || 0) + 1;
      totalPriority += _pattern.priority;
      totalConfidence += _pattern.confidence;
    });
    
    return {
      totalPatterns: this.patterns.length,
      patternsByCategory,
      averagePriority: totalPriority / this.patterns.length,
      averageConfidence: totalConfidence / this.patterns.length
    };
  }

  /**
   * 测试模式匹配效果
   */
  testPattern(patternId: string, testContent: string): {
    success: boolean;
    result?: MatchResult;
    error?: string;
  } {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (!pattern) {
      return { success: false, error: `模式 ${patternId} 不存在` };
    }
    
    try {
      const match = testContent.match(pattern.regex);
      if (!match) {
        return { success: false, error: '模式不匹配测试内容' };
      }
      
      const fields = this.extractFields(match, pattern.fieldMapping);
      const coverage = this.calculateCoverage(testContent, fields);
      const confidence = this.calculateConfidence(pattern, match, coverage);
      
      return {
        success: true,
        result: {
          pattern,
          matches: match,
          fields,
          confidence,
          coverage
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `测试失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
