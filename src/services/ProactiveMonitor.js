/**
 * ProactiveMonitor.js - Monitoraggio proattivo e suggerimenti intelligenti
 * Implementa: event monitoring, smart suggestions, predictive actions
 */

import { logger } from '../utils/Logger';
import { storageService } from './StorageService';
import { groqOptimizer } from './GroqOptimizer';

class ProactiveMonitor {
  constructor() {
    this.monitors = new Map();
    this.suggestions = [];
    this.enabled = true;
    this.checkInterval = 300000; // 5 minuti
  }

  /**
   * Inizializza il monitor
   */
  async init(options = {}) {
    this.enabled = options.enabled !== false;
    this.checkInterval = options.checkInterval || 300000;
    if (this.enabled) {
      this._startMonitoring();
    }
    logger.info('ProactiveMonitor', 'Initialized');
  }

  /**
   * Avvia monitoraggio proattivo
   */
  _startMonitoring() {
    this.monitoringTimer = setInterval(async () => {
      await this._checkForSuggestions();
    }, this.checkInterval);
  }

  /**
   * Controlla se ci sono suggerimenti da fare
   */
  async _checkForSuggestions() {
    try {
      const allUsers = await this._getAllUsers();

      for (const user of allUsers) {
        const suggestions = await this._generateSuggestions(user.userId);
        if (suggestions.length > 0) {
          logger.info('ProactiveMonitor', `Generated ${suggestions.length} suggestions for ${user.name}`);
          this.suggestions.push(...suggestions);
        }
      }
    } catch (error) {
      logger.error('ProactiveMonitor', 'Monitoring check failed', error);
    }
  }

  /**
   * Genera suggerimenti per utente
   */
  async _generateSuggestions(userId) {
    const suggestions = [];

    // Suggerimento 1: Attività non completate
    const pendingActivities = await this._checkPendingActivities(userId);
    if (pendingActivities.length > 0) {
      suggestions.push({
        type: 'pending_tasks',
        priority: 'high',
        message: `Hai ${pendingActivities.length} attività non completate. Vuoi che ti aiuti a organizzarle?`,
        actions: ['show', 'dismiss'],
      });
    }

    // Suggerimento 2: Pausa lavorativa
    const workDuration = await this._getWorkDuration(userId);
    if (workDuration > 120) { // Più di 2 ore
      suggestions.push({
        type: 'break_suggestion',
        priority: 'medium',
        message: `Stai lavorando da ${Math.round(workDuration / 60)} minuti. Una pausa potrebbe essere utile!`,
        actions: ['take_break', 'dismiss'],
      });
    }

    // Suggerimento 3: Riepilogo giorno
    const dayEnd = new Date();
    dayEnd.setHours(18, 0, 0, 0);
    if (new Date() > dayEnd && !await this._briefingDeliveredToday(userId)) {
      suggestions.push({
        type: 'day_summary',
        priority: 'low',
        message: 'Vuoi un riepilogo di quello che hai fatto oggi?',
        actions: ['show_summary', 'dismiss'],
      });
    }

    return suggestions;
  }

  /**
   * Controlla attività in sospeso
   */
  async _checkPendingActivities(userId) {
    try {
      return await storageService.db.getAllAsync(
        `SELECT * FROM activities
         WHERE userId = ? AND endTime IS NULL
         ORDER BY startTime DESC`,
        [userId]
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Calcola durata lavoro odierno
   */
  async _getWorkDuration(userId) {
    try {
      const result = await storageService.db.getFirstAsync(
        `SELECT SUM(CAST(duration AS FLOAT)) / 1000 / 60 as totalMinutes
         FROM activities
         WHERE userId = ? AND DATE(startTime) = DATE('now')
         AND type IN ('work', 'chat', 'coding')`,
        [userId]
      );
      return result?.totalMinutes || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Controlla se briefing è stato già inviato oggi
   */
  async _briefingDeliveredToday(userId) {
    try {
      const result = await storageService.db.getFirstAsync(
        `SELECT COUNT(*) as count FROM briefings
         WHERE userId = ? AND DATE(date) = DATE('now')`,
        [userId]
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ottieni tutti gli utenti
   */
  async _getAllUsers() {
    try {
      return await storageService.db.getAllAsync('SELECT DISTINCT userId, name FROM user_profile');
    } catch (error) {
      return [];
    }
  }

  /**
   * Ottieni suggerimenti in sospeso
   */
  getPendingSuggestions(limit = 3) {
    return this.suggestions.splice(0, limit);
  }

  /**
   * Arresta il monitor
   */
  stop() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.enabled = false;
  }
}

export const proactiveMonitor = new ProactiveMonitor();
export default ProactiveMonitor;
