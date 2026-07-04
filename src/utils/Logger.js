/**
 * Logger.js - Sistema di logging strutturato per Jarvis
 * Supporta: console, file, analytics
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

const LOG_COLORS = {
  DEBUG: '\x1b[36m',     // Cyan
  INFO: '\x1b[32m',      // Green
  WARN: '\x1b[33m',      // Yellow
  ERROR: '\x1b[31m',     // Red
  CRITICAL: '\x1b[35m',  // Magenta
  RESET: '\x1b[0m',
};

class Logger {
  constructor() {
    this.currentLevel = LOG_LEVELS.INFO;
    this.logs = [];
    this.maxLogs = 1000;
    this.enableConsole = true;
    this.enableStorage = true;
    this.enableAnalytics = false;
  }

  /**
   * Inizializza il logger
   */
  async init(options = {}) {
    this.currentLevel = options.level || LOG_LEVELS.INFO;
    this.enableConsole = options.enableConsole !== false;
    this.enableStorage = options.enableStorage !== false;
    this.enableAnalytics = options.enableAnalytics || false;

    console.log('[Logger] Initialized with level:', Object.keys(LOG_LEVELS)[this.currentLevel]);
  }

  /**
   * Log interno
   */
  _log(level, module, message, data = {}) {
    if (level < this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS)[level];
    const logEntry = {
      timestamp,
      level: levelName,
      module,
      message,
      data,
    };

    // Console output
    if (this.enableConsole) {
      const color = LOG_COLORS[levelName] || '';
      const reset = LOG_COLORS.RESET;
      console.log(
        `${color}[${timestamp}] [${module}] ${levelName}: ${message}${reset}`,
        Object.keys(data).length > 0 ? data : ''
      );
    }

    // Storage
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Persist critical/error logs
    if (level >= LOG_LEVELS.ERROR && this.enableStorage) {
      this._persistLog(logEntry);
    }

    // Analytics
    if (this.enableAnalytics && level >= LOG_LEVELS.WARN) {
      this._sendAnalytics(logEntry);
    }
  }

  debug(module, message, data) {
    this._log(LOG_LEVELS.DEBUG, module, message, data);
  }

  info(module, message, data) {
    this._log(LOG_LEVELS.INFO, module, message, data);
  }

  warn(module, message, data) {
    this._log(LOG_LEVELS.WARN, module, message, data);
  }

  error(module, message, error = {}) {
    this._log(LOG_LEVELS.ERROR, module, message, {
      errorMessage: error.message,
      errorStack: error.stack,
      ...error,
    });
  }

  critical(module, message, error = {}) {
    this._log(LOG_LEVELS.CRITICAL, module, message, {
      errorMessage: error.message,
      errorStack: error.stack,
      ...error,
    });
  }

  /**
   * Persisti log su storage
   */
  async _persistLog(logEntry) {
    try {
      const existingLogs = await AsyncStorage.getItem('jarvis_error_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(logEntry);
      // Mantieni ultimi 500 log di errore
      if (logs.length > 500) {
        logs.shift();
      }
      await AsyncStorage.setItem('jarvis_error_logs', JSON.stringify(logs));
    } catch (e) {
      // Fallback: log in memory only
    }
  }

  /**
   * Invia a servizio analytics (implementare)
   */
  async _sendAnalytics(logEntry) {
    // TODO: Integrare con servizio analytics (Mixpanel, Sentry, ecc.)
  }

  /**
   * Ottieni tutti i log in memoria
   */
  getLogs(filter = {}) {
    let filtered = this.logs;

    if (filter.level) {
      filtered = filtered.filter(l => l.level === filter.level);
    }
    if (filter.module) {
      filtered = filtered.filter(l => l.module.includes(filter.module));
    }
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= sinceTime);
    }

    return filtered;
  }

  /**
   * Esporta log in formato JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Pulisci log
   */
  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();
export default Logger;
