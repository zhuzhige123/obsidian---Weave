import { logger } from '../utils/logger';
/**
 * 测试运行器
 * 提供简单的测试框架来验证插件功能
 */

// ==================== 类型定义 ====================

export interface TestCase {
  name: string;
  description: string;
  test: () => Promise<void> | void;
  timeout?: number;
  skip?: boolean;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
  beforeEach?: () => Promise<void> | void;
  afterEach?: () => Promise<void> | void;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  duration: number;
  skipped: boolean;
}

export interface SuiteResult {
  name: string;
  description: string;
  results: TestResult[];
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestReport {
  suites: SuiteResult[];
  totalDuration: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  success: boolean;
}

// ==================== 断言函数 ====================

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

export const assert = {
  /**
   * 断言值为真
   */
  isTrue(value: any, message?: string): void {
    if (!value) {
      throw new AssertionError(message || `Expected ${value} to be true`);
    }
  },

  /**
   * 断言值为假
   */
  isFalse(value: any, message?: string): void {
    if (value) {
      throw new AssertionError(message || `Expected ${value} to be false`);
    }
  },

  /**
   * 断言相等
   */
  equals(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${actual} to equal ${expected}`
      );
    }
  },

  /**
   * 断言深度相等
   */
  deepEquals(actual: any, expected: any, message?: string): void {
    if (!this.deepEqual(actual, expected)) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(actual)} to deep equal ${JSON.stringify(expected)}`
      );
    }
  },

  /**
   * 断言不相等
   */
  notEquals(actual: any, expected: any, message?: string): void {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected ${actual} to not equal ${expected}`
      );
    }
  },

  /**
   * 断言为 null
   */
  isNull(value: any, message?: string): void {
    if (value !== null) {
      throw new AssertionError(message || `Expected ${value} to be null`);
    }
  },

  /**
   * 断言不为 null
   */
  isNotNull(value: any, message?: string): void {
    if (value === null) {
      throw new AssertionError(message || "Expected value to not be null");
    }
  },

  /**
   * 断言为 undefined
   */
  isUndefined(value: any, message?: string): void {
    if (value !== undefined) {
      throw new AssertionError(message || `Expected ${value} to be undefined`);
    }
  },

  /**
   * 断言不为 undefined
   */
  isDefined(value: any, message?: string): void {
    if (value === undefined) {
      throw new AssertionError(message || "Expected value to be defined");
    }
  },

  /**
   * 断言类型
   */
  isType(value: any, type: string, message?: string): void {
    if (typeof value !== type) {
      throw new AssertionError(
        message || `Expected ${value} to be of type ${type}, got ${typeof value}`
      );
    }
  },

  /**
   * 断言包含
   */
  contains(container: any, item: any, message?: string): void {
    if (Array.isArray(container)) {
      if (!container.includes(item)) {
        throw new AssertionError(
          message || `Expected array to contain ${item}`
        );
      }
    } else if (typeof container === 'string') {
      if (!container.includes(item)) {
        throw new AssertionError(
          message || `Expected string to contain ${item}`
        );
      }
    } else {
      throw new AssertionError('Container must be array or string');
    }
  },

  /**
   * 断言抛出错误
   */
  async throws(fn: () => Promise<any> | any, message?: string): Promise<void> {
    try {
      await fn();
      throw new AssertionError(message || 'Expected function to throw');
    } catch (error) {
      if (error instanceof AssertionError && error.message.includes('Expected function to throw')) {
        throw error;
      }
      // 函数确实抛出了错误，测试通过
    }
  },

  /**
   * 深度比较辅助函数
   */
  deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a == null || b == null) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }
};

// ==================== 测试运行器类 ====================

export class TestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  /**
   * 添加测试套件
   */
  addSuite(suite: TestSuite): void {
    this.suites.push(suite);
  }

  /**
   * 创建测试套件
   */
  describe(name: string, description: string, fn: () => void): void {
    const suite: TestSuite = {
      name,
      description,
      tests: []
    };

    this.currentSuite = suite;
    fn();
    this.currentSuite = null;

    this.addSuite(suite);
  }

  /**
   * 添加测试用例
   */
  it(name: string, test: () => Promise<void> | void, options?: { timeout?: number; skip?: boolean }): void {
    if (!this.currentSuite) {
      throw new Error('Test case must be inside a test suite');
    }

    this.currentSuite.tests.push({
      name,
      description: name,
      test,
      timeout: options?.timeout || 5000,
      skip: options?.skip || false
    });
  }

  /**
   * 设置套件钩子
   */
  beforeAll(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.beforeAll = fn;
    }
  }

  afterAll(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.afterAll = fn;
    }
  }

  beforeEach(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.beforeEach = fn;
    }
  }

  afterEach(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.afterEach = fn;
    }
  }

  /**
   * 运行单个测试
   */
  private async runTest(test: TestCase, hooks: { beforeEach?: () => Promise<void> | void; afterEach?: () => Promise<void> | void }): Promise<TestResult> {
    const startTime = Date.now();

    if (test.skip) {
      return {
        name: test.name,
        passed: true,
        duration: 0,
        skipped: true
      };
    }

    try {
      // 运行 beforeEach 钩子
      if (hooks.beforeEach) {
        await hooks.beforeEach();
      }

      // 运行测试
      const testPromise = Promise.resolve(test.test());
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${test.timeout}ms`)), test.timeout);
      });

      await Promise.race([testPromise, timeoutPromise]);

      // 运行 afterEach 钩子
      if (hooks.afterEach) {
        await hooks.afterEach();
      }

      return {
        name: test.name,
        passed: true,
        duration: Date.now() - startTime,
        skipped: false
      };

    } catch (error) {
      // 确保 afterEach 钩子运行
      try {
        if (hooks.afterEach) {
          await hooks.afterEach();
        }
      } catch (hookError) {
        logger.error('AfterEach hook failed:', hookError);
      }

      return {
        name: test.name,
        passed: false,
        error: error as Error,
        duration: Date.now() - startTime,
        skipped: false
      };
    }
  }

  /**
   * 运行测试套件
   */
  private async runSuite(suite: TestSuite): Promise<SuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    try {
      // 运行 beforeAll 钩子
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // 运行所有测试
      for (const test of suite.tests) {
        const result = await this.runTest(test, {
          beforeEach: suite.beforeEach,
          afterEach: suite.afterEach
        });
        results.push(result);
      }

      // 运行 afterAll 钩子
      if (suite.afterAll) {
        await suite.afterAll();
      }

    } catch (error) {
      logger.error(`Suite setup/teardown failed for ${suite.name}:`, error);
    }

    const passed = results.filter(r => r.passed && !r.skipped).length;
    const failed = results.filter(r => !r.passed && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    return {
      name: suite.name,
      description: suite.description,
      results,
      duration: Date.now() - startTime,
      passed,
      failed,
      skipped
    };
  }

  /**
   * 运行所有测试
   */
  async run(): Promise<TestReport> {
    const startTime = Date.now();
    const suiteResults: SuiteResult[] = [];

    logger.debug('🧪 开始运行测试...\n');

    for (const suite of this.suites) {
      logger.debug(`📋 运行测试套件: ${suite.name}`);
      const result = await this.runSuite(suite);
      suiteResults.push(result);

      // 输出套件结果
      logger.debug(`  ✅ 通过: ${result.passed}`);
      logger.debug(`  ❌ 失败: ${result.failed}`);
      logger.debug(`  ⏭️ 跳过: ${result.skipped}`);
      logger.debug(`  ⏱️ 耗时: ${result.duration}ms\n`);
    }

    const totalPassed = suiteResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = suiteResults.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = suiteResults.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = Date.now() - startTime;

    const report: TestReport = {
      suites: suiteResults,
      totalDuration,
      totalPassed,
      totalFailed,
      totalSkipped,
      success: totalFailed === 0
    };

    // 输出总结
    logger.debug('📊 测试总结:');
    logger.debug(`  总计: ${totalPassed + totalFailed + totalSkipped} 个测试`);
    logger.debug(`  ✅ 通过: ${totalPassed}`);
    logger.debug(`  ❌ 失败: ${totalFailed}`);
    logger.debug(`  ⏭️ 跳过: ${totalSkipped}`);
    logger.debug(`  ⏱️ 总耗时: ${totalDuration}ms`);
    logger.debug(`  🎯 成功率: ${totalPassed + totalFailed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);

    if (report.success) {
      logger.debug('\n🎉 所有测试通过！');
    } else {
      logger.debug('\n💥 有测试失败！');
      
      // 输出失败详情
      for (const suite of suiteResults) {
        for (const result of suite.results) {
          if (!result.passed && !result.skipped) {
            logger.debug(`\n❌ ${suite.name} > ${result.name}`);
            if (result.error) {
              logger.debug(`   错误: ${result.error.message}`);
            }
          }
        }
      }
    }

    return report;
  }

  /**
   * 清除所有测试
   */
  clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }
}

// 创建全局测试运行器实例
export const testRunner = new TestRunner();

// 导出全局函数
export const describe = testRunner.describe.bind(testRunner);
export const it = testRunner.it.bind(testRunner);
export const beforeAll = testRunner.beforeAll.bind(testRunner);
export const afterAll = testRunner.afterAll.bind(testRunner);
export const beforeEach = testRunner.beforeEach.bind(testRunner);
export const afterEach = testRunner.afterEach.bind(testRunner);

export default TestRunner;
