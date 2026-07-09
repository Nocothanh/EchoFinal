/**
 * DailyBriefing.js - Briefing mattutino personalizzato
 * Generazione automatica di briefing basato su contesto utente
 * Integra meteo reale, email, e calendario
 */

import { storageService } from './StorageService';
import { weatherService } from './WeatherService';
import { emailService } from './EmailService';
import { logger } from '../utils/Logger';

class DailyBriefing {
  constructor() {
    this.briefingTime = '08:00'; // Default mattina
    this.timer = null;
    this.weatherApiKey = null;
  }

  /**
   * Inizializza daily briefing
   */
  async init(options = {}) {
    this.briefingTime = options.briefingTime || '08:00';
    this.weatherApiKey = options.weatherApiKey || null;

    // Inizializza servizio meteo
    if (this.weatherApiKey) {
      await weatherService.init(this.weatherApiKey);
    }

    this._scheduleBriefing();
    logger.info('DailyBriefing', 'Initialized', { 
      time: this.briefingTime,
      hasWeatherApiKey: !!this.weatherApiKey
    });
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
      // Richiedi per domani
      this._scheduleBriefing();
    }, delay);
  }

  /**
   * Genera briefing personalizzato
   */
  async generateBriefing(userId, userProfile, preferences) {
    try {
      const [stats, activities, weather, emails] = await Promise.all([
        this._getStats(userId),
        this._getActivitiesForToday(userId),
        this._getWeather(),
        this._getEmails()
      ]);

      const briefingContent = this._formatBriefing(userProfile, stats, activities, weather, emails, preferences);
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
    try {
      return await storageService.getUserStats(userId, 1);
    } catch (error) {
      return { conversations: 0, messages: 0 };
    }
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
   * Ottieni meteo reale
   */
  async _getWeather() {
    try {
      if (this.weatherApiKey) {
        const result = await weatherService.getCurrentWeather();
        if (result.success) {
          return result.data;
        }
      }
      
      // Fallback: meteo non disponibile
      return {
        city: 'Posizione sconosciuta',
        temperature: null,
        condition: null,
        description: 'Meteo non disponibile',
        iconEmoji: '🌤️'
      };
    } catch (error) {
      logger.error('DailyBriefing', 'Failed to fetch weather', error);
      return {
        city: 'Posizione sconosciuta',
        temperature: null,
        condition: null,
        description: 'Meteo non disponibile',
        iconEmoji: '🌤️'
      };
    }
  }

  /**
   * Ottieni email recenti
   */
  async _getEmails() {
    try {
      const result = await emailService.getUnreadEmails(5);
      if (result.success) {
        return result.data;
      }
      return [];
    } catch (error) {
      logger.error('DailyBriefing', 'Failed to fetch emails', error);
      return [];
    }
  }

  /**
   * Formatta briefing
   */
  _formatBriefing(userProfile, stats, activities, weather, emails, preferences) {
    const userName = userProfile?.name || 'Utente';
    let briefing = `Buongiorno ${userName}! 🌅\n\n`;
    briefing += `Ecco il tuo briefing di oggi:\n\n`;

    // METEO
    briefing += `🌤️ **METEO**\n`;
    if (weather.temperature !== null) {
      briefing += `${weather.iconEmoji} ${weather.city}: ${weather.temperature}°C\n`;
      briefing += `${weather.descriptionIt || weather.description}\n`;
      
      // Consiglio abbigliamento
      const clothing = weatherService.getClothingSuggestion(weather);
      if (clothing) {
        briefing += `${clothing}\n`;
      }
    } else {
      briefing += `Meteo non disponibile\n`;
    }
    briefing += '\n';

    // EMAIL
    briefing += `📧 **EMAIL**\n`;
    if (emails && emails.length > 0) {
      briefing += `Hai ${emails.length} email non lette:\n`;
      emails.slice(0, 3).forEach((email, i) => {
        const from = email.from?.split('<')[0].trim() || 'Sconosciuto';
        briefing += `${i + 1}. ${from}: ${email.subject}\n`;
      });
    } else {
      briefing += `Nessuna email non letta 🎉\n`;
    }
    briefing += '\n';

    // ATTIVITÀ PROGRAMMATE
    if (activities && activities.length > 0) {
      briefing += `📋 **ATTIVITÀ PROGRAMMATE**\n`;
      activities.slice(0, 5).forEach(a => {
        const time = new Date(a.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        briefing += `• ${time} - ${a.title}\n`;
      });
      briefing += '\n';
    }

    // STATISTICHE
    if (stats && stats.conversations > 0) {
      briefing += `📊 **IERI**\n`;
      briefing += `${stats.conversations} conversazioni, ${stats.messages} messaggi\n\n`;
    }

    // SUGGERIMENTO GIORNATA
    briefing += `💡 **SUGGERIMENTO**\n`;
    if (weather.temperature !== null) {
      if (weather.temperature < 10) {
        briefing += `Fa freddo oggi (${weather.temperature}°C). Vestiti bene!\n`;
      } else if (weather.temperature > 30) {
        briefing += `Fa caldo oggi (${weather.temperature}°C). Idratati bene!\n`;
      } else if (weather.condition?.toLowerCase().includes('rain')) {
        briefing += `Piove oggi. Porta l'ombrello!\n`;
      } else {
        briefing += `Bel tempo oggi. Perfetto per una passeggiata!\n`;
      }
    } else {
      briefing += `Ottima giornata per essere produttivi!\n`;
    }

    briefing += `\nHai una buona giornata! 🚀`;
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
   * Imposta orario briefing
   */
  setBriefingTime(time) {
    this.briefingTime = time;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this._scheduleBriefing();
    logger.info('DailyBriefing', `Briefing time set to ${time}`);
  }

  /**
   * Imposta API key meteo
   */
  setWeatherApiKey(apiKey) {
    this.weatherApiKey = apiKey;
    weatherService.setApiKey(apiKey);
    logger.info('DailyBriefing', 'Weather API key updated');
  }

  /**
   * Ottieni briefing di esempio
   */
  getExampleBriefing() {
    return `Buongiorno! 🌅

Ecco il tuo briefing di oggi:

🌤️ **METEO**
☀️ Milano: 22°C
Cielo sereno
👕 Abbigliamento leggero, va bene così.

📧 **EMAIL**
Hai 3 email non lette:
1. Mario: Report mensile
2. Team: Aggiornamento progetto
3. Newsletter: Tech news

📋 **ATTIVITÀ PROGRAMMATE**
• 10:00 - Meeting team
• 14:30 - Pranzo con Marco
• 16:00 - Revisione codice

📊 **IERI**
12 conversazioni, 48 messaggi

💡 **SUGGERIMENTO**
Bel tempo oggi. Perfetto per una passeggiata!

Hai una buona giornata! 🚀`;
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

  /**
   * Cleanup
   */
  cleanup() {
    this.stop();
    logger.info('DailyBriefing', 'Cleanup completed');
  }
}

export const dailyBriefing = new DailyBriefing();
export default DailyBriefing;
