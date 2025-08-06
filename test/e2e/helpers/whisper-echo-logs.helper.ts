/**
 * Helper utility to capture and validate WhisperEchoLog messages during E2E tests
 */
import { Page } from 'puppeteer';

export interface CapturedLogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface WhisperLogCapture {
  logs: CapturedLogEntry[];
  errors: string[];
  consoleMessages: Array<{ type: string; text: string; timestamp: Date }>;
}

export class WhisperEchoLogsHelper {
  private page: Page;
  private capture: WhisperLogCapture = {
    logs: [],
    errors: [],
    consoleMessages: []
  };

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set up log capturing for WhisperEchoLog component and console messages
   */
  async setupCapture(): Promise<void> {
    // Capture console messages
    this.page.on('console', (msg) => {
      const timestamp = new Date();
      const type = msg.type();
      const text = msg.text();
      
      this.capture.consoleMessages.push({
        type,
        text,
        timestamp
      });

      // Capture errors specifically
      if (type === 'error') {
        this.capture.errors.push(text);
      }
    });

    // Capture page errors
    this.page.on('pageerror', (error) => {
      this.capture.errors.push(error.message);
    });

    // Set up WhisperEchoLog monitoring
    await this.page.evaluateOnNewDocument(() => {
      // Store original console methods
      const originalMethods = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
      };

      // Create a global log store
      (window as any).__whisperLogCapture = [];

      // Intercept console methods to capture Whisper-related logs
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('Whisper') || message.includes('Model') || message.includes('Worker')) {
          (window as any).__whisperLogCapture.push({
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            message,
            type: 'info'
          });
        }
        originalMethods.log(...args);
      };

      console.error = (...args) => {
        const message = args.join(' ');
        (window as any).__whisperLogCapture.push({
          id: `error-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          message,
          type: 'error'
        });
        originalMethods.error(...args);
      };

      console.warn = (...args) => {
        const message = args.join(' ');
        if (message.includes('Whisper') || message.includes('Model')) {
          (window as any).__whisperLogCapture.push({
            id: `warn-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            message,
            type: 'warning'
          });
        }
        originalMethods.warn(...args);
      };

      console.info = (...args) => {
        const message = args.join(' ');
        if (message.includes('Whisper') || message.includes('Model')) {
          (window as any).__whisperLogCapture.push({
            id: `info-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            message,
            type: 'info'
          });
        }
        originalMethods.info(...args);
      };
    });
  }

  /**
   * Wait for WhisperEchoLog component to appear on the page
   */
  async waitForWhisperEchoLog(timeout: number = 30000): Promise<void> {
    await this.page.waitForSelector('[data-testid="whisper-echo-logs"], div:has-text("WHISPER_ECHO_LOG")', {
      timeout,
      visible: true
    });
  }

  /**
   * Get the current logs from the WhisperEchoLog component
   */
  async getWhisperEchoLogs(): Promise<CapturedLogEntry[]> {
    try {
      // First try to get logs from the component DOM
      const domLogs = await this.page.evaluate(() => {
        const logEntries: CapturedLogEntry[] = [];
        
        // Look for log entries in the WhisperEchoLog component
        const logElements = document.querySelectorAll('[class*="logEntry"], .log-entry, [data-log-type]');
        
        logElements.forEach((element, index) => {
          const messageElement = element.querySelector('[class*="message"], .message') || element;
          const timestampElement = element.querySelector('[class*="timestamp"], .timestamp');
          
          const message = messageElement?.textContent?.trim() || '';
          const timestampText = timestampElement?.textContent?.trim() || '';
          
          // Extract type from class names or data attributes
          let type: 'info' | 'warning' | 'error' | 'success' = 'info';
          if (element.classList.contains('error') || element.getAttribute('data-log-type') === 'error') {
            type = 'error';
          } else if (element.classList.contains('warning') || element.getAttribute('data-log-type') === 'warning') {
            type = 'warning';
          } else if (element.classList.contains('success') || element.getAttribute('data-log-type') === 'success') {
            type = 'success';
          }

          if (message) {
            logEntries.push({
              id: `dom-log-${index}`,
              timestamp: new Date(),
              message,
              type
            });
          }
        });

        return logEntries;
      });

      // Also get captured logs from our interception
      const capturedLogs = await this.page.evaluate(() => {
        return (window as any).__whisperLogCapture || [];
      });

      // Combine both sources
      const allLogs = [...domLogs, ...capturedLogs];
      this.capture.logs = allLogs;

      return allLogs;
    } catch (error) {
      console.error('Error getting WhisperEchoLogs:', error);
      return this.capture.logs;
    }
  }

  /**
   * Wait for specific log message to appear
   */
  async waitForLogMessage(
    messagePattern: string | RegExp,
    timeout: number = 30000,
    type?: 'info' | 'warning' | 'error' | 'success'
  ): Promise<CapturedLogEntry | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const logs = await this.getWhisperEchoLogs();
      
      const matchingLog = logs.find(log => {
        const messageMatches = typeof messagePattern === 'string' 
          ? log.message.includes(messagePattern)
          : messagePattern.test(log.message);
        
        const typeMatches = !type || log.type === type;
        
        return messageMatches && typeMatches;
      });

      if (matchingLog) {
        return matchingLog;
      }

      await this.page.waitForTimeout(100);
    }

    return null;
  }

  /**
   * Wait for model loading progress messages
   */
  async waitForModelLoadingProgress(timeout: number = 30000): Promise<CapturedLogEntry[]> {
    const progressLogs: CapturedLogEntry[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const logs = await this.getWhisperEchoLogs();
      
      // Look for progress-related messages
      const newProgressLogs = logs.filter(log => 
        log.message.includes('%') ||
        log.message.includes('progress') ||
        log.message.includes('loading') ||
        log.message.includes('Loading') ||
        log.message.includes('Cargando') ||
        log.message.includes('descarga') ||
        log.message.toLowerCase().includes('modelo')
      );

      // Add new logs that we haven't seen before
      for (const log of newProgressLogs) {
        if (!progressLogs.find(existing => existing.id === log.id)) {
          progressLogs.push(log);
        }
      }

      // Check if model is ready
      const readyLog = logs.find(log => 
        log.message.includes('listo para transcripción') ||
        log.message.includes('ready') ||
        log.message.includes('completamente cargado')
      );

      if (readyLog) {
        progressLogs.push(readyLog);
        break;
      }

      await this.page.waitForTimeout(500);
    }

    return progressLogs;
  }

  /**
   * Wait for model to be fully loaded
   */
  async waitForModelReady(timeout: number = 30000): Promise<boolean> {
    const readyLog = await this.waitForLogMessage(
      /listo para transcripción|ready|completamente cargado/i,
      timeout,
      'success'
    );

    return readyLog !== null;
  }

  /**
   * Get all captured data
   */
  getCapture(): WhisperLogCapture {
    return { ...this.capture };
  }

  /**
   * Get logs filtered by type
   */
  getLogsByType(type: 'info' | 'warning' | 'error' | 'success'): CapturedLogEntry[] {
    return this.capture.logs.filter(log => log.type === type);
  }

  /**
   * Get logs containing specific text
   */
  getLogsContaining(text: string): CapturedLogEntry[] {
    return this.capture.logs.filter(log => 
      log.message.toLowerCase().includes(text.toLowerCase())
    );
  }

  /**
   * Check if any errors were captured
   */
  hasErrors(): boolean {
    return this.capture.errors.length > 0;
  }

  /**
   * Get all captured errors
   */
  getErrors(): string[] {
    return [...this.capture.errors];
  }

  /**
   * Get console messages by type
   */
  getConsoleMessagesByType(type: string): Array<{ type: string; text: string; timestamp: Date }> {
    return this.capture.consoleMessages.filter(msg => msg.type === type);
  }

  /**
   * Clear captured data
   */
  clearCapture(): void {
    this.capture = {
      logs: [],
      errors: [],
      consoleMessages: []
    };
  }

  /**
   * Extract progress percentage from log messages
   */
  extractProgressPercentages(): number[] {
    const percentages: number[] = [];
    
    for (const log of this.capture.logs) {
      const match = log.message.match(/(\d+)%/);
      if (match) {
        percentages.push(parseInt(match[1], 10));
      }
    }

    return percentages.sort((a, b) => a - b);
  }
}