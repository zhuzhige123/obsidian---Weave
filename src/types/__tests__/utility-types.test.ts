/**
 * utility-types 单元测试
 * 验证类型守卫和工具函数的正确性
 */

import {
  isError,
  isErrorWithMessage,
  isErrorWithStack,
  isWeaveError,
  isFileSystemError,
  isStorageError,
  extractErrorMessage,
  extractErrorStack,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isDefined,
  isNullOrUndefined,
  safeJsonParse,
  safeJsonStringify
} from '../utility-types';
import { ErrorCode, ErrorSeverity } from '../error-types';

describe('Utility Types - Error Guards', () => {
  test('isError should correctly identify Error objects', () => {
    expect(isError(new Error('test'))).toBe(true);
    expect(isError(new TypeError('test'))).toBe(true);
    expect(isError('string')).toBe(false);
    expect(isError({ message: 'test' })).toBe(false);
  });

  test('isErrorWithMessage should identify objects with message property', () => {
    expect(isErrorWithMessage(new Error('test'))).toBe(true);
    expect(isErrorWithMessage({ message: 'test' })).toBe(true);
    expect(isErrorWithMessage({ msg: 'test' })).toBe(false);
    expect(isErrorWithMessage('string')).toBe(false);
  });

  test('isErrorWithStack should identify objects with stack property', () => {
    const error = new Error('test');
    expect(isErrorWithStack(error)).toBe(true);
    expect(isErrorWithStack({ message: 'test' })).toBe(false);
  });

  test('isWeaveError should identify Weave error objects', () => {
    const weaveError = {
      code: ErrorCode.FILE_NOT_FOUND,
      message: 'File not found',
      severity: ErrorSeverity.ERROR
    };
    expect(isWeaveError(weaveError)).toBe(true);
    expect(isWeaveError(new Error('test'))).toBe(false);
  });

  test('isFileSystemError should identify file system errors', () => {
    const fsError = {
      code: ErrorCode.FILE_NOT_FOUND,
      message: 'File not found',
      severity: ErrorSeverity.ERROR,
      path: '/test/path',
      operation: 'read' as const
    };
    expect(isFileSystemError(fsError)).toBe(true);

    const storageError = {
      code: ErrorCode.STORAGE_READ_ERROR,
      message: 'Storage read error',
      severity: ErrorSeverity.ERROR,
      operation: 'read' as const
    };
    expect(isFileSystemError(storageError)).toBe(false);
  });
});

describe('Utility Types - Error Extraction', () => {
  test('extractErrorMessage should extract message from various error types', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
    expect(extractErrorMessage({ message: 'custom error' })).toBe('custom error');
    expect(extractErrorMessage('string error')).toBe('string error');
    expect(extractErrorMessage(null)).toBe('未知错误');
  });

  test('extractErrorStack should extract stack from errors', () => {
    const error = new Error('test');
    const stack = extractErrorStack(error);
    expect(stack).toBeDefined();
    expect(typeof stack).toBe('string');
    
    expect(extractErrorStack('string')).toBeUndefined();
    expect(extractErrorStack({ message: 'test' })).toBeUndefined();
  });
});

describe('Utility Types - Type Guards', () => {
  test('isString should identify strings', () => {
    expect(isString('test')).toBe(true);
    expect(isString('')).toBe(true);
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
  });

  test('isNumber should identify numbers', () => {
    expect(isNumber(123)).toBe(true);
    expect(isNumber(0)).toBe(true);
    expect(isNumber(-1)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber('123')).toBe(false);
  });

  test('isBoolean should identify booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean('true')).toBe(false);
  });

  test('isObject should identify objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject('string')).toBe(false);
  });

  test('isArray should identify arrays', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray({})).toBe(false);
    expect(isArray('string')).toBe(false);
  });

  test('isFunction should identify functions', () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(function() {})).toBe(true);
    expect(isFunction({})).toBe(false);
    expect(isFunction('string')).toBe(false);
  });

  test('isDefined should identify defined values', () => {
    expect(isDefined('test')).toBe(true);
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  test('isNullOrUndefined should identify null and undefined', () => {
    expect(isNullOrUndefined(null)).toBe(true);
    expect(isNullOrUndefined(undefined)).toBe(true);
    expect(isNullOrUndefined('')).toBe(false);
    expect(isNullOrUndefined(0)).toBe(false);
  });
});

describe('Utility Types - JSON Helpers', () => {
  test('safeJsonParse should parse valid JSON', () => {
    const json = '{"key":"value"}';
    const result = safeJsonParse(json, {});
    expect(result).toEqual({ key: 'value' });
  });

  test('safeJsonParse should return default on invalid JSON', () => {
    const invalidJson = '{invalid}';
    const defaultValue = { default: true };
    const result = safeJsonParse(invalidJson, defaultValue);
    expect(result).toBe(defaultValue);
  });

  test('safeJsonStringify should stringify objects', () => {
    const obj = { key: 'value' };
    const result = safeJsonStringify(obj);
    expect(result).toBe('{"key":"value"}');
  });

  test('safeJsonStringify should handle circular references', () => {
    const obj: any = { key: 'value' };
    obj.circular = obj;
    const result = safeJsonStringify(obj);
    expect(result).toBe('');
  });
});



