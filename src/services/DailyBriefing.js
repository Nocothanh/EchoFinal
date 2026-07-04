/**
 * DailyBriefing.js - Briefing mattutino personalizzato
 * Generazione automatica di briefing basato su contesto utente
 */

import { storageService } from './StorageService';
import { logger } from '../utils/Logger';
import { groqOptimizer } from './GroqOptimizer';

class DailyBriefing {
  constructor() {
    this.briefingTime = '08:00'; // Default mattina
    this.timer = null;
  }

  /**
   * Inizializza daily briefing
   */
  async init(options = {}) {
    this.briefingTime = options.briefingTime || '08:00';
    this._scheduleBriefing();
    logger.info('DailyBriefing', 'Initialized', { time: this.briefingTime });
  }

  /**
   * Pianifica briefing quotidiano
   */
  _scheduleBriefing() {
    const [hours, minutes] = this.briefingTime.split(':').map(Number);
    const now = new Date();
    let next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();
    logger.debug('DailyBriefing', `Next briefing scheduled in ${Math.round(delay / 1000 / 60)} minutes`);

    this.timer = setTimeout(() => {
      this._deliverBriefing();
      // Richedula per domani
      this._scheduleBriefing();
    }, delay);
  }

  /**
   * Genera briefing personalizzato
   */
  async generateBriefing(userId, userProfile, preferences) {
    try {
      const [stats, activities, weather] = await Promise.all([
        this._getStats(userId),
        this._getActivitiesForToday(userId),
        this._getWeather(userProfile),
      ]);

      const briefingContent = this._formatBriefing(userProfile, stats, activities, weather, preferences);
      return briefingContent;
    } catch (error) {
      logger.error('DailyBriefing', 'Generation failed', error);
      return null;
    }
  }

  /**
   * Ottieni statistiche
   */
  async _getStats(userId) {
    return await storageService.getUserStats(userId, 1);
  }

  /**
   * Ottieni attività programmate per oggi
   */
  async _getActivitiesForToday(userId) {
    try {
      return await storageService.db.getAllAsync(
        `SELECT * FROM activities
         WHERE userId = ? AND DATE(startTime) = DATE('now')
         ORDER BY startTime ASC`,
        [userId]
      );
    } catch (error) {
      logger.error('DailyBriefing', 'Failed to fetch activities', error);
      return [];
    }
  }

  /**
   * Placeholder per meteo
   */
  async _getWeather(userProfile) {
    // TODO: Integrare con weather API
    return {
      temp: 'N/A',
      condition: 'N/A',
    };
  }

  /**
   * Formatta briefing
   */
  _formatBriefing(userProfile, stats, activities, weather, preferences) {
    let briefing = `Buongiorno ${userProfile.name}! 🌅\n\n`;
    briefing += `Ecco il tuo briefing di oggi:\n\n`;

    // Meteo
    if (weather.temp !== 'N/A') {
      briefing += `🌤️ Meteo: ${weather.temp}, ${weather.condition}\n\n`;
    }

    // Attività programmate
    if (activities.length > 0) {
      briefing += `📋 Attività programmate:\n`;
      activities.slice(0, 5).forEach(a => {
        const time = new Date(a.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        briefing += `   • ${time} - ${a.title}\n`;
      });
      briefing += '\n';
    }

    // Statistiche
    if (stats.conversations > 0) {
      briefing += `📊 Ieri: ${stats.conversations} conversazioni, ${stats.messages} messaggi\n\n`;
    }

    briefing += `Hai una buona giornata! 🚀`;
    return briefing;
  }

  /**
   * Consegna briefing (simulated)
   */
  async _deliverBriefing() {
    logger.info('DailyBriefing', 'Briefing delivered');
    // TODO: Inviare via notification/voice
  }

  /**
   * Arresta il briefing
   */
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const dailyBriefing = new DailyBriefing();
export default DailyBriefing;
