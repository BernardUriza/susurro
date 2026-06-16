import { LogLevel } from '../types';

export class Logger {
  private level: LogLevel = 'info';
  private onLog?: (level: LogLevel, message: string, data?: any) => void;
  private prefix: string;
  
  constructor(prefix: string = '[Murmuraba]') {
    this.prefix = prefix;
  }
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  setLogHandler(handler: (level: LogLevel, message: string, data?: any) => void): void {
    this.onLog = handler;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return currentIndex > 0 && messageIndex <= currentIndex;
  }
  
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const formattedMessage = `${this.prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (this.onLog) {
      this.onLog(level, formattedMessage, data);
    } else {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       console.log;
      
      if (data !== undefined) {
        logMethod(formattedMessage, data);
      } else {
        logMethod(formattedMessage);
      }
    }
  }
  
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
}