import { logger } from '../../utils/logger';
/**
 * 题库测试数据生成器
 * 用于开发环境快速生成测试数据
 */

import type { QuestionBankConfig } from '../../types/question-bank-types';
import type { Card } from '../../data/types';
import { CardType } from '../../data/types';
import { generateId, generateUUID } from '../helpers';
import { createTestCard } from '../question-bank/createTestCard';

/**
 * 题库数据结构（用于测试数据生成）
 */
export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  category: string;
  created: string;
  modified: string;
  questionCount: number;
  metadata?: Record<string, unknown>;
}

export interface TestDataConfig {
  bankName?: string;
  totalQuestions?: number;
  singleChoiceCount?: number;
  multipleChoiceCount?: number;
}

/**
 * 生成测试题库
 */
export function generateTestQuestionBank(config?: TestDataConfig): QuestionBank {
  const bankName = config?.bankName || 'JavaScript基础测试';
  
  const bank: QuestionBank = {
    id: generateId(),
    name: bankName,
    description: '这是一个用于测试的JavaScript基础知识题库，包含单选题和多选题。',
    difficulty: 'medium',
    tags: ['编程', '前端', 'JavaScript', '测试数据'],
    category: 'programming',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    questionCount: config?.totalQuestions || 20,
    metadata: {
      isTestData: true,
      generatedAt: new Date().toISOString()
    }
  };

  return bank;
}

/**
 * 生成测试题目列表
 */
export function generateTestQuestions(bankId: string, config?: TestDataConfig): Card[] {
  const singleChoiceCount = config?.singleChoiceCount || 10;
  const multipleChoiceCount = config?.multipleChoiceCount || 10;
  const cards: Card[] = [];

  // 生成单选题
  for (let i = 0; i < singleChoiceCount; i++) {
    cards.push(generateSingleChoiceQuestion(bankId, i + 1));
  }

  // 生成多选题
  for (let i = 0; i < multipleChoiceCount; i++) {
    cards.push(generateMultipleChoiceQuestion(bankId, singleChoiceCount + i + 1));
  }

  return cards;
}

/**
 * 生成单选题
 */
function generateSingleChoiceQuestion(bankId: string, index: number): Card {
  const singleChoiceQuestions = [
    {
      stem: 'JavaScript中，哪个关键字用于声明常量？',
      options: ['var', 'let', 'const', 'static'],
      correct: 'C',
      explanation: 'const 关键字用于声明常量，其值在初始化后不能被重新赋值。var 和 let 用于声明变量，static 是类成员修饰符。',
      difficulty: 'easy' as const
    },
    {
      stem: '以下哪个方法可以将数组转换为字符串？',
      options: ['toString()', 'valueOf()', 'parseInt()', 'parseFloat()'],
      correct: 'A',
      explanation: 'toString() 方法可以将数组转换为字符串，元素之间用逗号分隔。valueOf() 返回数组本身，parseInt() 和 parseFloat() 用于字符串转数字。',
      difficulty: 'easy' as const
    },
    {
      stem: 'JavaScript中，typeof null 的返回值是什么？',
      options: ['null', 'undefined', 'object', 'number'],
      correct: 'C',
      explanation: 'typeof null 返回 "object"，这是JavaScript的一个历史遗留bug。虽然null是原始值，但由于历史原因，typeof 检测时会返回 "object"。',
      difficulty: 'medium' as const
    },
    {
      stem: '以下哪个不是JavaScript的原始数据类型？',
      options: ['string', 'number', 'array', 'boolean'],
      correct: 'C',
      explanation: 'array（数组）不是原始数据类型，它是引用类型（对象）。JavaScript的原始数据类型包括：string、number、boolean、null、undefined、symbol 和 bigint。',
      difficulty: 'easy' as const
    },
    {
      stem: '== 和 === 的区别是什么？',
      options: ['没有区别', '== 不检查类型，=== 检查类型', '== 检查类型，=== 不检查类型', '都检查类型'],
      correct: 'B',
      explanation: '== 是相等运算符，会进行类型转换后比较；=== 是严格相等运算符，不进行类型转换，类型和值都必须相同才返回true。',
      difficulty: 'medium' as const
    },
    {
      stem: '以下哪个方法用于在数组末尾添加元素？',
      options: ['unshift()', 'push()', 'shift()', 'pop()'],
      correct: 'B',
      explanation: 'push() 方法在数组末尾添加元素。unshift() 在开头添加，shift() 删除第一个元素，pop() 删除最后一个元素。',
      difficulty: 'easy' as const
    },
    {
      stem: 'Promise的三种状态不包括以下哪个？',
      options: ['pending', 'fulfilled', 'rejected', 'resolved'],
      correct: 'D',
      explanation: 'Promise只有三种状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。resolved 不是Promise的状态，而是一个术语，表示Promise已经敲定（settled）。',
      difficulty: 'medium' as const
    },
    {
      stem: '箭头函数与普通函数的主要区别是什么？',
      options: ['语法更简洁', '没有自己的this', '不能用作构造函数', '以上都是'],
      correct: 'D',
      explanation: '箭头函数的特点包括：1) 语法更简洁；2) 没有自己的this，继承外层作用域的this；3) 不能用作构造函数，不能使用new调用；4) 没有arguments对象；5) 没有prototype属性。',
      difficulty: 'hard' as const
    },
    {
      stem: 'let 和 var 的主要区别是什么？',
      options: ['作用域不同', '变量提升不同', '重复声明不同', '以上都是'],
      correct: 'D',
      explanation: 'let和var的区别：1) let是块级作用域，var是函数作用域；2) let存在暂时性死区，var会变量提升；3) let不允许重复声明，var允许；4) let声明的全局变量不是window属性。',
      difficulty: 'hard' as const
    },
    {
      stem: '以下哪个方法可以遍历对象的所有可枚举属性？',
      options: ['for...in', 'for...of', 'forEach()', 'map()'],
      correct: 'A',
      explanation: 'for...in 循环可以遍历对象的所有可枚举属性（包括继承的）。for...of 用于遍历可迭代对象（如数组），forEach() 和 map() 是数组方法。',
      difficulty: 'medium' as const
    }
  ];

  const q = singleChoiceQuestions[(index - 1) % singleChoiceQuestions.length];
  
  const optionLabels = ['A', 'B', 'C', 'D'];
  const answerParens = `（${q.correct}）`;
  const content = `Q: ${q.stem}

${answerParens}

A. ${q.options[0]}
B. ${q.options[1]}
C. ${q.options[2]}
D. ${q.options[3]}

---div---

${q.explanation}`;

  //  使用统一的测试卡片创建工具
  return createTestCard({
    deckId: bankId,
    //  不传递 templateId - Weave 原生测试卡片不需要模板
    content: content,
    difficulty: q.difficulty,
    tags: ['单选题', '自动生成'],
    questionType: 'single_choice',  //  明确标记题型
    correctAnswer: q.correct  //  传入正确答案
  });
}

/**
 * 生成多选题
 */
function generateMultipleChoiceQuestion(bankId: string, index: number): Card {
  const multipleChoiceQuestions = [
    {
      stem: 'JavaScript中，以下哪些是引用数据类型？（多选）',
      options: ['Object', 'Array', 'Function', 'Number'],
      correct: ['A', 'B', 'C'],
      explanation: 'Object、Array、Function都是引用数据类型（对象类型）。Number是原始数据类型。JavaScript中引用类型包括：Object、Array、Function、Date、RegExp等。',
      difficulty: 'easy' as const
    },
    {
      stem: '以下哪些方法会改变原数组？（多选）',
      options: ['push()', 'concat()', 'splice()', 'sort()'],
      correct: ['A', 'C', 'D'],
      explanation: 'push()、splice()、sort() 都会直接修改原数组。concat() 会返回一个新数组，不修改原数组。其他会修改原数组的方法还有：pop()、shift()、unshift()、reverse()、fill() 等。',
      difficulty: 'medium' as const
    },
    {
      stem: 'ES6新增的特性包括以下哪些？（多选）',
      options: ['箭头函数', 'Promise', 'class', 'async/await'],
      correct: ['A', 'B', 'C'],
      explanation: '箭头函数、Promise、class 都是ES6(ES2015)新增的特性。async/await 是ES8(ES2017)引入的。ES6是JavaScript发展史上最重要的版本之一。',
      difficulty: 'medium' as const
    },
    {
      stem: '以下哪些是JavaScript中的假值（falsy）？（多选）',
      options: ['0', 'null', '[]', 'undefined'],
      correct: ['A', 'B', 'D'],
      explanation: 'JavaScript中的假值包括：false、0、-0、0n、""（空字符串）、null、undefined、NaN。空数组[]和空对象{}不是假值。',
      difficulty: 'hard' as const
    },
    {
      stem: '以下哪些方法可以创建对象？（多选）',
      options: ['字面量{}', 'new Object()', 'Object.create()', 'class构造函数'],
      correct: ['A', 'B', 'C', 'D'],
      explanation: '所有选项都可以创建对象。字面量是最常用的方式，Object.create()可以指定原型，class构造函数是ES6的语法糖，本质上也是创建对象。',
      difficulty: 'easy' as const
    },
    {
      stem: 'JavaScript中，以下哪些是正确的声明函数的方式？（多选）',
      options: ['function fn(){}', 'const fn = function(){}', 'const fn = ()=>{}', 'const fn = new Function()'],
      correct: ['A', 'B', 'C', 'D'],
      explanation: '所有选项都是合法的函数声明方式。1) 函数声明；2) 函数表达式；3) 箭头函数；4) Function构造函数（不推荐使用）。',
      difficulty: 'easy' as const
    },
    {
      stem: '关于闭包，以下说法正确的是？（多选）',
      options: ['可以访问外部函数的变量', '会造成内存泄漏', '可以实现私有变量', '可以延长变量生命周期'],
      correct: ['A', 'C', 'D'],
      explanation: '闭包可以访问外部函数的变量、实现私有变量、延长变量生命周期。闭包本身不会造成内存泄漏，只有不当使用（如创建大量不释放的闭包）才可能导致内存问题。',
      difficulty: 'hard' as const
    },
    {
      stem: '以下哪些是异步编程的解决方案？（多选）',
      options: ['回调函数', 'Promise', 'Generator', 'async/await'],
      correct: ['A', 'B', 'C', 'D'],
      explanation: '所有选项都是JavaScript异步编程的解决方案。从回调函数到Promise，再到Generator和async/await，异步编程方案不断演进，代码可读性和可维护性也越来越好。',
      difficulty: 'medium' as const
    },
    {
      stem: '以下哪些操作会触发数组的迭代器？（多选）',
      options: ['for...of', 'Array.from()', 'spread运算符[...]', 'for...in'],
      correct: ['A', 'B', 'C'],
      explanation: 'for...of、Array.from()、扩展运算符都会使用数组的迭代器（Symbol.iterator）。for...in 是遍历对象的可枚举属性，不使用迭代器。',
      difficulty: 'hard' as const
    },
    {
      stem: '关于事件循环（Event Loop），以下说法正确的是？（多选）',
      options: ['宏任务先于微任务执行', '微任务队列优先级高于宏任务', 'Promise.then是微任务', 'setTimeout是宏任务'],
      correct: ['B', 'C', 'D'],
      explanation: '事件循环中，微任务优先级高于宏任务。每次宏任务执行完后，会清空所有微任务队列，然后再执行下一个宏任务。Promise.then是微任务，setTimeout是宏任务。',
      difficulty: 'hard' as const
    }
  ];

  const q = multipleChoiceQuestions[(index - 1 - 10) % multipleChoiceQuestions.length];
  
  const optionLabels = ['A', 'B', 'C', 'D'];
  const answerParens = `（${q.correct.join(',')}）`;
  
  const content = `Q: ${q.stem}

${answerParens}

A. ${q.options[0]}
B. ${q.options[1]}
C. ${q.options[2]}
D. ${q.options[3]}

---div---

${q.explanation}`;

  //  使用统一的测试卡片创建工具
  return createTestCard({
    deckId: bankId,
    //  不传递 templateId - Weave 原生测试卡片不需要模板
    content: content,
    difficulty: q.difficulty,
    tags: ['多选题', '自动生成'],
    questionType: 'multiple_choice',  //  明确标记题型
    correctAnswer: q.correct  //  传入正确答案数组
  });
}

/**
 * 注入测试数据到系统
 */
export async function injectTestData(
  questionBankService: any,
  _questionBankStorage: any
): Promise<{ bank: QuestionBank; questions: Card[] }> {
  try {
    // 生成测试题库
    const bank = generateTestQuestionBank();
    
    // 生成测试题目
    const questions = generateTestQuestions(bank.id);
    
    // 保存题库
    await questionBankService.createBank(bank);
    
    // 保存题目（使用 Service 的方法）
    for (const question of questions) {
      await questionBankService.addQuestion(bank.id, question);
    }
    
    logger.debug('[TestDataGenerator] ✅ 测试数据注入成功', {
      bankId: bank.id,
      bankName: bank.name,
      questionCount: questions.length
    });
    
    return { bank, questions };
  } catch (error) {
    logger.error('[TestDataGenerator] ❌ 测试数据注入失败:', error);
    throw error;
  }
}

