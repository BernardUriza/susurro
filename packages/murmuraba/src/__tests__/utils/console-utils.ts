import { vi, beforeEach, afterEach, expect, type MockInstance } from 'vitest';

/**
 * Centralized console mocking utilities
 * Provides consistent console mocking across all tests
 */

export interface ConsoleMocks {
  log: MockInstance;
  error: MockInstance;
  warn: MockInstance;
  info: MockInstance;
  debug: MockInstance;
  trace: MockInstance;
  table: MockInstance;
  group: MockInstance;
  groupEnd: MockInstance;
}

export interface ConsoleMockOptions {
  silent?: boolean;
  showEmojis?: boolean;
  showErrors?: boolean;
  showWarnings?: boolean;
  captureOutput?: boolean;
}

export class ConsoleCapture {
  private captured: Map<keyof ConsoleMocks, any[][]> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.captured.clear();
    ['log', 'error', 'warn', 'info', 'debug', 'trace'].forEach(method => {
      this.captured.set(method as keyof ConsoleMocks, []);
    });
  }

  capture(method: keyof ConsoleMocks, args: any[]) {
    const entries = this.captured.get(method) || [];
    entries.push(args);
    this.captured.set(method, entries);
  }

  getOutput(method?: keyof ConsoleMocks): any[][] {
    if (method) {
      return this.captured.get(method) || [];
    }
    return Array.from(this.captured.values()).flat();
  }

  getLogs() {
    return this.getOutput('log');
  }

  getErrors() {
    return this.getOutput('error');
  }

  getWarnings() {
    return this.getOutput('warn');
  }

  hasLogs() {
    return this.getLogs().length > 0;
  }

  hasErrors() {
    return this.getErrors().length > 0;
  }

  hasWarnings() {
    return this.getWarnings().length > 0;
  }

  findLog(pattern: string | RegExp): any[] | undefined {
    return this.getLogs().find(args =>
      args.some(arg =>
        typeof arg === 'string' &&
        (typeof pattern === 'string' ? arg.includes(pattern) : pattern.test(arg))
      )
    );
  }

  findError(pattern: string | RegExp): any[] | undefined {
    return this.getErrors().find(args =>
      args.some(arg =>
        typeof arg === 'string' &&
        (typeof pattern === 'string' ? arg.includes(pattern) : pattern.test(arg))
      )
    );
  }
}

/**
 * Mock all console methods with options
 */
export function mockConsole(options: ConsoleMockOptions = {}): ConsoleMocks & { capture?: ConsoleCapture } {
  const {
    silent = true,
    showEmojis = false,
    showErrors = false,
    showWarnings = false,
    captureOutput = false,
  } = options;

  const capture = captureOutput ? new ConsoleCapture() : undefined;

  const createMock = (method: keyof ConsoleMocks, shouldShow: boolean = false) => {
    return vi.spyOn(console, method).mockImplementation((...args: any[]) => {
      // Capture output if enabled
      if (capture) {
        capture.capture(method, args);
      }

      // Show output based on options
      if (!silent) {
        return;
      }

      if (shouldShow) {
        console.info(`[${method.toUpperCase()}]`, ...args);
        return;
      }

      if (showEmojis && args.some(arg => 
        typeof arg === 'string' && /[\u{1F300}-\u{1F9FF}]/u.test(arg)
      )) {
        console.info(...args);
      }
    });
  };

  const mocks: ConsoleMocks = {
    log: createMock('log'),
    error: createMock('error', showErrors),
    warn: createMock('warn', showWarnings),
    info: createMock('info'),
    debug: createMock('debug'),
    trace: createMock('trace'),
    table: createMock('table'),
    group: createMock('group'),
    groupEnd: createMock('groupEnd'),
  };

  return capture ? { ...mocks, capture } : mocks;
}

/**
 * Restore all console mocks
 */
export function restoreConsole(mocks: ConsoleMocks) {
  Object.values(mocks).forEach(mock => {
    if (mock && typeof mock.mockRestore === 'function') {
      mock.mockRestore();
    }
  });
}

/**
 * Helper for using console mocks in beforeEach/afterEach
 */
export function useConsoleMocks(options: ConsoleMockOptions = {}) {
  let mocks: ConsoleMocks & { capture?: ConsoleCapture };

  beforeEach(() => {
    mocks = mockConsole(options);
  });

  afterEach(() => {
    if (mocks) {
      restoreConsole(mocks);
    }
  });

  return () => mocks;
}

/**
 * Temporarily suppress console output for a specific function
 */
export async function withSuppressedConsole<T>(
  fn: () => T | Promise<T>,
  options: ConsoleMockOptions = {}
): Promise<T> {
  const mocks = mockConsole(options);
  try {
    return await fn();
  } finally {
    restoreConsole(mocks);
  }
}

/**
 * Assert console output patterns
 */
export class ConsoleAssertions {
  constructor(private mocks: ConsoleMocks) {}

  expectLog(pattern: string | RegExp) {
    expect(this.mocks.log).toHaveBeenCalledWith(
      expect.stringMatching(pattern),
      ...expect.anything()
    );
  }

  expectError(pattern: string | RegExp) {
    expect(this.mocks.error).toHaveBeenCalledWith(
      expect.stringMatching(pattern),
      ...expect.anything()
    );
  }

  expectWarning(pattern: string | RegExp) {
    expect(this.mocks.warn).toHaveBeenCalledWith(
      expect.stringMatching(pattern),
      ...expect.anything()
    );
  }

  expectNoLogs() {
    expect(this.mocks.log).not.toHaveBeenCalled();
  }

  expectNoErrors() {
    expect(this.mocks.error).not.toHaveBeenCalled();
  }

  expectNoWarnings() {
    expect(this.mocks.warn).not.toHaveBeenCalled();
  }

  expectLogCount(count: number) {
    expect(this.mocks.log).toHaveBeenCalledTimes(count);
  }

  expectErrorCount(count: number) {
    expect(this.mocks.error).toHaveBeenCalledTimes(count);
  }
}