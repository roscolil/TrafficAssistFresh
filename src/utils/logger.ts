/**
 * Production-ready logging utility for Traffic Assist
 * Replaces console.log statements with configurable logging
 */

// Type declarations for cross-platform compatibility
declare const __DEV__: boolean | undefined;

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  source?: string;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor() {
    // Determine environment and log level
    this.isDevelopment = this.detectDevelopmentMode();
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  private detectDevelopmentMode(): boolean {
    // Check various indicators for development mode
    if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    )
      return true;

    // Check for localhost in browser environment
    try {
      // @ts-ignore - Global window check
      if (typeof window !== 'undefined') {
        // @ts-ignore - Access window.location safely
        const hostname = window.location?.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
      }
    } catch (error) {
      // Ignore errors accessing window
    }

    return false;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private addLog(
    level: LogLevel,
    message: string,
    data?: any,
    source?: string,
  ): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      source,
    };

    // Store log entry
    this.logs.push(logEntry);

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console in development
    if (this.isDevelopment) {
      this.outputToConsole(logEntry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const prefix = entry.source ? `[${entry.source}]` : '';
    const timestamp = entry.timestamp.toISOString().substr(11, 8);

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(
          `${timestamp} ${prefix} ERROR:`,
          entry.message,
          entry.data,
        );
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} ${prefix} WARN:`, entry.message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(`${timestamp} ${prefix} INFO:`, entry.message, entry.data);
        break;
      case LogLevel.DEBUG:
        console.log(`${timestamp} ${prefix} DEBUG:`, entry.message, entry.data);
        break;
    }
  }

  // Public logging methods
  error(message: string, data?: any, source?: string): void {
    this.addLog(LogLevel.ERROR, message, data, source);
  }

  warn(message: string, data?: any, source?: string): void {
    this.addLog(LogLevel.WARN, message, data, source);
  }

  info(message: string, data?: any, source?: string): void {
    this.addLog(LogLevel.INFO, message, data, source);
  }

  debug(message: string, data?: any, source?: string): void {
    this.addLog(LogLevel.DEBUG, message, data, source);
  }

  // Utility methods
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
export const logger = new Logger();

// Convenience exports for common patterns
export const logError = (message: string, data?: any, source?: string) =>
  logger.error(message, data, source);

export const logWarn = (message: string, data?: any, source?: string) =>
  logger.warn(message, data, source);

export const logInfo = (message: string, data?: any, source?: string) =>
  logger.info(message, data, source);

export const logDebug = (message: string, data?: any, source?: string) =>
  logger.debug(message, data, source);
