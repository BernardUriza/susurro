/**
 * Centralized Logging Utility
 * Replaces scattered console.log statements with structured logging
 */

// Log Levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// Log Categories
export enum LogCategory {
  AUDIO = 'AUDIO',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  WASM = 'WASM',
  UI = 'UI',
  API = 'API',
  PERFORMANCE = 'PERFORMANCE',
  SYSTEM = 'SYSTEM',
  TEST = 'TEST',
}

// Log Entry Interface
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  source?: string;
  context?: Record<string, any>;
}

// Logger Configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStoredEntries: number;
  enableTimestamps: boolean;
  enableColors: boolean;
  categories: LogCategory[];
}

// Default Configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableStorage: true,
  maxStoredEntries: 1000,
  enableTimestamps: true,
  enableColors: true,
  categories: Object.values(LogCategory),
};

// Logger Class
class Logger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private listeners: ((entry: LogEntry) => void)[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Core logging method
  private log(level: LogLevel, category: LogCategory, message: string, data?: any, context?: Record<string, any>) {
    // Check if this log level should be processed
    if (level < this.config.level) return;

    // Check if this category is enabled
    if (!this.config.categories.includes(category)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      source: this.getCallerInfo(),
      context,
    };

    // Store entry if enabled
    if (this.config.enableStorage) {
      this.entries.push(entry);
      
      // Maintain max entries limit
      if (this.entries.length > this.config.maxStoredEntries) {
        this.entries.shift();
      }
    }

    // Console output if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    });
  }

  // Debug logging
  debug(category: LogCategory, message: string, data?: any, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, category, message, data, context);
  }

  // Info logging
  info(category: LogCategory, message: string, data?: any, context?: Record<string, any>) {
    this.log(LogLevel.INFO, category, message, data, context);
  }

  // Warning logging
  warn(category: LogCategory, message: string, data?: any, context?: Record<string, any>) {
    this.log(LogLevel.WARN, category, message, data, context);
  }

  // Error logging
  error(category: LogCategory, message: string, data?: any, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, category, message, data, context);
  }

  // Performance logging
  time(category: LogCategory, label: string, context?: Record<string, any>) {
    const startTime = performance.now();
    this.debug(category, `Timer started: ${label}`, { startTime }, context);
    
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.info(category, `Timer ended: ${label}`, { 
          startTime, 
          endTime, 
          duration: `${duration.toFixed(2)}ms` 
        }, context);
        return duration;
      }
    };
  }

  // Group logging
  group(category: LogCategory, title: string, context?: Record<string, any>) {
    this.info(category, `Group Start: ${title}`, undefined, context);
    
    return {
      log: (message: string, data?: any) => this.info(category, `  ${message}`, data, context),
      end: () => this.info(category, `Group End: ${title}`, undefined, context),
    };
  }

  // Output to console with formatting
  private outputToConsole(entry: LogEntry) {
    const { level, category, message, data, timestamp } = entry;
    
    // Format timestamp
    const timeStr = this.config.enableTimestamps 
      ? `[${new Date(timestamp).toISOString()}]` 
      : '';

    // Format category
    const categoryStr = `[${category}]`;

    // Choose console method based on level
    const consoleMethod = this.getConsoleMethod(level);
    
    // Format message with colors if enabled
    const formattedMessage = this.config.enableColors 
      ? this.colorizeMessage(level, `${timeStr}${categoryStr} ${message}`)
      : `${timeStr}${categoryStr} ${message}`;

    // Output to console
    if (data !== undefined) {
      consoleMethod(formattedMessage, data);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  // Get appropriate console method
  private getConsoleMethod(level: LogLevel) {
    switch (level) {
      case LogLevel.DEBUG: return console.debug;
      case LogLevel.INFO: return console.info;
      case LogLevel.WARN: return console.warn;
      case LogLevel.ERROR: return console.error;
      default: return console.log;
    }
  }

  // Colorize message based on level
  private colorizeMessage(level: LogLevel, message: string): string {
    if (typeof window !== 'undefined') {
      // Browser environment - use CSS styles
      switch (level) {
        case LogLevel.DEBUG: return `%c${message}`; // Will need CSS styling
        case LogLevel.INFO: return `%c${message}`;
        case LogLevel.WARN: return `%c${message}`;
        case LogLevel.ERROR: return `%c${message}`;
        default: return message;
      }
    } else {
      // Node.js environment - use ANSI colors
      const colors: Record<LogLevel, string> = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',   // Green
        [LogLevel.WARN]: '\x1b[33m',   // Yellow
        [LogLevel.ERROR]: '\x1b[31m',  // Red
        [LogLevel.SILENT]: '\x1b[37m', // White/Default
      };
      const reset = '\x1b[0m';
      const color = colors[level] || '';
      return `${color}${message}${reset}`;
    }
  }

  // Get caller info for source tracking
  private getCallerInfo(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const stackLines = stack.split('\n');
    // Skip the first few lines (Error, this method, log method)
    const callerLine = stackLines[4] || stackLines[3] || '';
    
    // Extract file and line number
    const match = callerLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      const [, , file, line] = match;
      const fileName = file?.split('/').pop() || file || 'unknown';
      return `${fileName}:${line}`;
    }
    
    return 'unknown';
  }

  // Configuration methods
  setLevel(level: LogLevel) {
    this.config.level = level;
  }

  setCategories(categories: LogCategory[]) {
    this.config.categories = categories;
  }

  enableCategory(category: LogCategory) {
    if (!this.config.categories.includes(category)) {
      this.config.categories.push(category);
    }
  }

  disableCategory(category: LogCategory) {
    this.config.categories = this.config.categories.filter(c => c !== category);
  }

  // Listener management
  addListener(listener: (entry: LogEntry) => void) {
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  removeListener(listener: (entry: LogEntry) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Export/Import logs
  exportLogs(): LogEntry[] {
    return [...this.entries];
  }

  clearLogs() {
    this.entries = [];
  }

  // Search logs
  searchLogs(query: {
    level?: LogLevel;
    category?: LogCategory;
    message?: string;
    since?: number;
    until?: number;
  }): LogEntry[] {
    return this.entries.filter(entry => {
      if (query.level !== undefined && entry.level < query.level) return false;
      if (query.category !== undefined && entry.category !== query.category) return false;
      if (query.message && !entry.message.toLowerCase().includes(query.message.toLowerCase())) return false;
      if (query.since && entry.timestamp < query.since) return false;
      if (query.until && entry.timestamp > query.until) return false;
      return true;
    });
  }

  // Get stats
  getStats() {
    const stats = {
      total: this.entries.length,
      byLevel: {} as Record<LogLevel, number>,
      byCategory: {} as Record<LogCategory, number>,
      timeRange: {
        oldest: this.entries[0]?.timestamp,
        newest: this.entries[this.entries.length - 1]?.timestamp,
      },
    };

    this.entries.forEach(entry => {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
    });

    return stats;
  }
}

// Create singleton instance
const logger = new Logger();

// Category-specific logger interfaces
export const AudioLogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.AUDIO, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.AUDIO, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.AUDIO, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.AUDIO, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.AUDIO, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.AUDIO, title, context),
};

export const RecordingLogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.RECORDING, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.RECORDING, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.RECORDING, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.RECORDING, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.RECORDING, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.RECORDING, title, context),
};

export const ProcessingLogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.PROCESSING, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.PROCESSING, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.PROCESSING, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.PROCESSING, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.PROCESSING, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.PROCESSING, title, context),
};

export const WASMLogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.WASM, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.WASM, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.WASM, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.WASM, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.WASM, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.WASM, title, context),
};

export const UILogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.UI, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.UI, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.UI, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.UI, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.UI, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.UI, title, context),
};

export const PerformanceLogger = {
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    logger.debug(LogCategory.PERFORMANCE, message, data, context),
  info: (message: string, data?: any, context?: Record<string, any>) => 
    logger.info(LogCategory.PERFORMANCE, message, data, context),
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    logger.warn(LogCategory.PERFORMANCE, message, data, context),
  error: (message: string, data?: any, context?: Record<string, any>) => 
    logger.error(LogCategory.PERFORMANCE, message, data, context),
  time: (label: string, context?: Record<string, any>) => 
    logger.time(LogCategory.PERFORMANCE, label, context),
  group: (title: string, context?: Record<string, any>) => 
    logger.group(LogCategory.PERFORMANCE, title, context),
};

// Export main logger and utilities
export { logger as Logger };
export default logger;