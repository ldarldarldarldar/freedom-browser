import { DiagnosticLog } from '../browser/types';

const LOGS_STORAGE_KEY = 'freedom_local_diagnostic_logs';
const MAX_LOCAL_LOGS = 300;

export class LoggerService {
  private static instance: LoggerService;
  private isLoggingEnabled = false;
  private inMemoryLogs: DiagnosticLog[] = [];

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public setLoggingEnabled(enabled: boolean): void {
    this.isLoggingEnabled = enabled;
    if (!enabled) {
      // Zero telemetry & zero logs kept when disabled
      this.clearLogs();
    } else {
      this.log('INFO', 'SECURITY', 'Local diagnostic logging enabled. Logs strictly kept on device.');
    }
  }

  public isEnabled(): boolean {
    return this.isLoggingEnabled;
  }

  public log(level: DiagnosticLog['level'], category: DiagnosticLog['category'], message: string): void {
    if (!this.isLoggingEnabled) return;

    const logEntry: DiagnosticLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
    };

    this.inMemoryLogs.unshift(logEntry);
    if (this.inMemoryLogs.length > MAX_LOCAL_LOGS) {
      this.inMemoryLogs.pop();
    }

    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.inMemoryLogs.slice(0, 100)));
    } catch {
      // In case quota exceeded
    }
  }

  public getLogs(): DiagnosticLog[] {
    if (!this.isLoggingEnabled) return [];
    if (this.inMemoryLogs.length === 0) {
      try {
        const stored = localStorage.getItem(LOGS_STORAGE_KEY);
        if (stored) {
          this.inMemoryLogs = JSON.parse(stored);
        }
      } catch {
        this.inMemoryLogs = [];
      }
    }
    return [...this.inMemoryLogs];
  }

  public clearLogs(): void {
    this.inMemoryLogs = [];
    try {
      localStorage.removeItem(LOGS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  public exportLogsAsText(): string {
    const logs = this.getLogs();
    return logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}`)
      .join('\n');
  }
}

export const logger = LoggerService.getInstance();
