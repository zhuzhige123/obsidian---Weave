/**
 * Vitest 测试设置文件
 */

import { vi } from 'vitest';

// Mock Obsidian API
global.window = global.window || {};

// Mock DOM APIs
Object.defineProperty(window, 'AbortController', {
  writable: true,
  value: class AbortController {
    signal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    
    abort() {
      this.signal.aborted = true;
    }
  }
});

// Store original timer functions
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

// Mock setTimeout and clearTimeout without recursion
global.setTimeout = vi.fn((fn, delay) => {
  if (typeof fn === 'function') {
    return originalSetTimeout(fn, delay);
  }
  return 0;
});

global.clearTimeout = vi.fn((id) => {
  originalClearTimeout(id);
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

// Mock performance API
global.performance = {
  ...performance,
  now: vi.fn(() => Date.now())
};

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = MockResizeObserver as any;

class MockAnimation {
  private listeners = new Map<string, Array<() => void>>();
  private finished = false;
  private cancelled = false;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private element: HTMLElement,
    private keyframes: Keyframe[],
    private options: KeyframeAnimationOptions
  ) {
    this.applyKeyframe(this.keyframes[0]);

    const duration = typeof options.duration === 'number' ? options.duration : 0;
    const delay = typeof options.delay === 'number' ? options.delay : 0;
    this.finishTimer = originalSetTimeout(() => this.finish(), duration + delay);
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  cancel() {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    if (this.finishTimer) {
      originalClearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    this.emit('cancel');
  }

  private finish() {
    if (this.finished || this.cancelled) return;
    this.finished = true;
    this.applyKeyframe(this.keyframes[this.keyframes.length - 1]);
    this.emit('finish');
  }

  private emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  private applyKeyframe(keyframe?: Keyframe) {
    if (!keyframe) return;

    for (const [property, value] of Object.entries(keyframe)) {
      if (property === 'offset' || property === 'composite' || property === 'easing') {
        continue;
      }

      (this.element.style as any)[property] = String(value);
    }
  }
}

if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function (
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: number | KeyframeAnimationOptions
  ) {
    const normalizedKeyframes = Array.isArray(keyframes)
      ? keyframes
      : [keyframes as Keyframe];
    const normalizedOptions =
      typeof options === 'number'
        ? { duration: options }
        : (options ?? {});

    return new MockAnimation(this as HTMLElement, normalizedKeyframes, normalizedOptions as KeyframeAnimationOptions) as any;
  };
}
